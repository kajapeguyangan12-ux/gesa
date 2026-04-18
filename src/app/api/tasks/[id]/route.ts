import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
export { PATCH } from "@/app/api/admin/tasks/[id]/route";

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
    startedAt:
      typeof row.raw_payload?.startedAt === "string"
        ? row.raw_payload.startedAt
        : row.raw_payload?.startedAt || null,
    completedAt:
      typeof row.raw_payload?.completedAt === "string"
        ? row.raw_payload.completedAt
        : row.raw_payload?.completedAt || null,
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

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("tasks")
      .select("fb_doc_id, title, description, surveyor_id, surveyor_name, surveyor_email, status, type, kmz_file_url, kmz_file_url_2, offline_enabled, created_at, raw_payload")
      .eq("fb_doc_id", id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) {
      return NextResponse.json({ error: "Task tidak ditemukan." }, { status: 404 });
    }

    return NextResponse.json({
      source: "supabase",
      task: mapTaskRow(data as TaskRow),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memuat detail tugas dari Supabase." },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest) {
  return new Response(null, { status: 405 });
}
