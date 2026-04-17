import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

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

export async function GET(request: NextRequest) {
  try {
    const surveyorId = request.nextUrl.searchParams.get("surveyorId")?.trim();
    if (!surveyorId) {
      return NextResponse.json({ error: "surveyorId wajib diisi." }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("tasks")
      .select("fb_doc_id, title, description, surveyor_id, surveyor_name, surveyor_email, status, type, kmz_file_url, kmz_file_url_2, offline_enabled, created_at, raw_payload")
      .eq("surveyor_id", surveyorId)
      .eq("type", "pra-existing")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      throw new Error(error.message);
    }

    const tasks = ((data || []) as TaskRow[]).map((row) => ({
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
    }));

    return NextResponse.json({
      source: "supabase",
      tasks,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memuat tugas pra-existing dari Supabase." },
      { status: 500 }
    );
  }
}
