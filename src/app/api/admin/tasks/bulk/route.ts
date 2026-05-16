import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { buildTaskUpdateRow } from "@/lib/supabaseHybrid";
import { cleanupSupabaseStorageObjects } from "@/lib/supabaseStorageCleanup";

interface BulkTaskPayload {
  action?: "complete" | "reactivate" | "delete";
  ids?: string[];
}

interface TaskExistingRow {
  fb_doc_id: string | null;
  raw_payload: Record<string, unknown> | null;
  kmz_file_url: string | null;
  kmz_file_url_2: string | null;
}

type TaskUpdateRow = ReturnType<typeof buildTaskUpdateRow>;

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as BulkTaskPayload;
    const action = payload.action;
    const ids = Array.isArray(payload.ids)
      ? Array.from(new Set(payload.ids.map((value) => (typeof value === "string" ? value.trim() : "")).filter(Boolean)))
      : [];

    if (!action || !["complete", "reactivate", "delete"].includes(action)) {
      return NextResponse.json({ error: "Aksi bulk tidak valid." }, { status: 400 });
    }

    if (ids.length === 0) {
      return NextResponse.json({ error: "Tidak ada tugas yang dipilih." }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const { data, error: readError } = await supabase
      .from("tasks")
      .select("fb_doc_id, raw_payload, kmz_file_url, kmz_file_url_2")
      .in("fb_doc_id", ids);

    if (readError) throw new Error(readError.message);

    const taskRows = (data || []) as TaskExistingRow[];
    const rowsById = new Map(
      taskRows
        .map((row) => [typeof row.fb_doc_id === "string" ? row.fb_doc_id.trim() : "", row] as const)
        .filter(([id]) => Boolean(id))
    );

    const missingIds = ids.filter((id) => !rowsById.has(id));
    if (missingIds.length > 0) {
      return NextResponse.json(
        { error: `Sebagian tugas tidak ditemukan: ${missingIds.join(", ")}` },
        { status: 404 }
      );
    }

    if (action === "delete") {
      for (const id of ids) {
        const row = rowsById.get(id);
        if (!row) continue;
        await cleanupSupabaseStorageObjects(row.kmz_file_url, row.kmz_file_url_2, row.raw_payload);
      }

      const { error } = await supabase.from("tasks").delete().in("fb_doc_id", ids);
      if (error) throw new Error(error.message);
    } else {
      const patch =
        action === "complete"
          ? {
              status: "completed",
              completedAt: new Date().toISOString(),
            }
          : {
              status: "in-progress",
              reactivatedAt: new Date().toISOString(),
              completedAt: null,
            };

      const tasksTable = supabase.from("tasks") as unknown as {
        update: (values: TaskUpdateRow) => {
          eq: (column: string, value: string) => Promise<{ error: { message: string } | null }>;
        };
      };

      for (const id of ids) {
        const row = rowsById.get(id);
        if (!row) continue;
        const updateRow = buildTaskUpdateRow((row.raw_payload as Record<string, unknown> | null) || {}, patch);
        const { error } = await tasksTable.update(updateRow).eq("fb_doc_id", id);
        if (error) throw new Error(error.message);
      }
    }

    return NextResponse.json({ ok: true, processed: ids.length, action });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal menjalankan aksi massal tugas." },
      { status: 500 }
    );
  }
}
