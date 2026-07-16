import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

type OMReportRow = {
  fb_doc_id: string | null;
  title: string | null;
  description: string | null;
  report_type: string | null;
  location: string | null;
  reporter_uid: string | null;
  reporter_name: string | null;
  reporter_role: string | null;
  status: string | null;
  raw_payload: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
};

export async function GET(request: NextRequest) {
  try {
    const uid = request.nextUrl.searchParams.get("uid")?.trim() || "";
    const limit = Math.min(Math.max(Number.parseInt(request.nextUrl.searchParams.get("limit") || "30", 10) || 30, 1), 100);

    if (!uid) {
      return NextResponse.json({ error: "uid wajib diisi." }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("om_reports")
      .select("fb_doc_id, title, description, report_type, location, reporter_uid, reporter_name, reporter_role, status, raw_payload, created_at, updated_at")
      .eq("reporter_uid", uid)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(error.message);
    }

    const reports = (data || []) as OMReportRow[];

    return NextResponse.json({
      reports: reports.map((row) => ({
        ...(row.raw_payload || {}),
        id: row.fb_doc_id || "",
        title: row.title || "",
        description: row.description || "",
        reportType: row.report_type || "preventif",
        location: row.location || "-",
        reporterUid: row.reporter_uid || "",
        reporterName: row.reporter_name || "",
        reporterRole: row.reporter_role || "",
        status: row.status || "new",
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
      summary: {
        total: reports.length,
        new: reports.filter((row) => (row.status || "new") === "new").length,
        preventif: reports.filter((row) => (row.report_type || "preventif") === "preventif").length,
        korektif: reports.filter((row) => row.report_type === "korektif").length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memuat laporan O&M milik user." },
      { status: 500 }
    );
  }
}
