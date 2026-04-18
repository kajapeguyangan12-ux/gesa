import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { buildTaskInsertRow, createHybridId } from "@/lib/supabaseHybrid";

interface TaskRow {
  fb_doc_id: string | null;
  title: string | null;
  description: string | null;
  surveyor_id: string | null;
  surveyor_name: string | null;
  surveyor_email: string | null;
  status: string | null;
  type: string | null;
  kmz_file_url: string | null;
  kmz_file_url_2: string | null;
  offline_enabled: boolean | null;
  created_at: string | null;
  raw_payload?: Record<string, unknown> | null;
}

function mapTaskRow(row: TaskRow) {
  return {
    id: row.fb_doc_id || "",
    title: row.title || "Tanpa Judul",
    description: row.description || "",
    surveyorId: row.surveyor_id || "",
    surveyorName: row.surveyor_name || "",
    surveyorEmail: row.surveyor_email || "",
    status: row.status || "",
    type: row.type || "",
    kmzFileUrl: row.kmz_file_url || "",
    kmzFileUrl2: row.kmz_file_url_2 || "",
    offlineEnabled: Boolean(row.offline_enabled),
    createdAt: row.created_at,
    startedAt: row.raw_payload?.startedAt || null,
    completedAt: row.raw_payload?.completedAt || null,
    kabupaten: typeof row.raw_payload?.kabupaten === "string" ? row.raw_payload.kabupaten : "",
    kabupatenName: typeof row.raw_payload?.kabupatenName === "string" ? row.raw_payload.kabupatenName : "",
    excelFileUrl:
      typeof row.raw_payload?.excelFileUrl === "string"
        ? row.raw_payload.excelFileUrl
        : typeof row.raw_payload?.excel_file_url === "string"
          ? row.raw_payload.excel_file_url
          : "",
  };
}

export async function GET(request: NextRequest) {
  try {
    const adminId = request.nextUrl.searchParams.get("adminId")?.trim();
    const supabase = getSupabaseAdminClient() as any;
    let query = supabase
      .from("tasks")
      .select("fb_doc_id, title, description, surveyor_id, surveyor_name, surveyor_email, status, type, kmz_file_url, kmz_file_url_2, offline_enabled, created_at, raw_payload")
      .order("created_at", { ascending: false })
      .limit(200);

    if (adminId) {
      query = query.eq("created_by_admin_id", adminId);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return NextResponse.json({
      source: "supabase",
      tasks: ((data || []) as TaskRow[]).map(mapTaskRow),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memuat tugas admin dari Supabase." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const taskId = createHybridId();
    const row = buildTaskInsertRow(taskId, payload);
    const supabase = getSupabaseAdminClient() as any;
    const { error } = await supabase.from("tasks").upsert(row, { onConflict: "fb_doc_id" });
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, id: taskId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal membuat tugas di Supabase." },
      { status: 500 }
    );
  }
}
