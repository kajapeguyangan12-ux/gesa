import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

interface TaskExportRow {
  fb_doc_id: string | null;
  title: string | null;
  status: string | null;
  type: string | null;
  surveyor_name: string | null;
  created_by_admin_name: string | null;
  created_by_admin_email: string | null;
  created_at: string | null;
}

export async function GET() {
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("tasks")
      .select("fb_doc_id, title, status, type, surveyor_name, created_by_admin_name, created_by_admin_email, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      source: "supabase",
      tasks: ((data || []) as TaskExportRow[]).map((row) => ({
        id: row.fb_doc_id,
        title: row.title || "Tanpa Judul",
        status: row.status || "-",
        type: row.type || "-",
        surveyorName: row.surveyor_name || "-",
        createdByAdminName: row.created_by_admin_name || "Admin",
        createdByAdminEmail: row.created_by_admin_email || "-",
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memuat data tugas dari Supabase." },
      { status: 500 }
    );
  }
}
