import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { buildTaskUpdateRow } from "@/lib/supabaseHybrid";
import { cleanupSupabaseStorageObjects } from "@/lib/supabaseStorageCleanup";

interface TaskExistingRow {
  raw_payload: Record<string, unknown> | null;
}

interface TaskCleanupRow {
  kmz_file_url: string | null;
  kmz_file_url_2: string | null;
  raw_payload: Record<string, unknown> | null;
}

type TaskUpdateRow = ReturnType<typeof buildTaskUpdateRow>;

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const patch = (await request.json()) as Record<string, unknown>;
    const supabase = getSupabaseAdminClient();

    const { data, error: readError } = await supabase
      .from("tasks")
      .select("raw_payload")
      .eq("fb_doc_id", id)
      .maybeSingle();

    if (readError) throw new Error(readError.message);
    const existing = data as TaskExistingRow | null;
    if (!existing) {
      return NextResponse.json({ error: "Task tidak ditemukan." }, { status: 404 });
    }

    const row: TaskUpdateRow = buildTaskUpdateRow((existing.raw_payload as Record<string, unknown> | null) || {}, patch);
    const tasksTable = supabase.from("tasks") as unknown as {
      update: (values: TaskUpdateRow) => {
        eq: (column: string, value: string) => Promise<{ error: { message: string } | null }>;
      };
    };
    const { error } = await tasksTable.update(row).eq("fb_doc_id", id);
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memperbarui tugas di Supabase." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = getSupabaseAdminClient();
    const { data, error: readError } = await supabase
      .from("tasks")
      .select("kmz_file_url, kmz_file_url_2, raw_payload")
      .eq("fb_doc_id", id)
      .maybeSingle();

    if (readError) throw new Error(readError.message);
    const existing = data as TaskCleanupRow | null;
    if (!existing) {
      return NextResponse.json({ error: "Task tidak ditemukan." }, { status: 404 });
    }

    await cleanupSupabaseStorageObjects(existing.kmz_file_url, existing.kmz_file_url_2, existing.raw_payload);

    const { error } = await supabase.from("tasks").delete().eq("fb_doc_id", id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal menghapus tugas di Supabase." },
      { status: 500 }
    );
  }
}
