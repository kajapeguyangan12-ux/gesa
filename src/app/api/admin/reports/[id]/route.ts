import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

interface ReportDetailRow {
  id: string | null;
  fb_doc_id: string | null;
  title: string | null;
  project_title: string | null;
  project_location: string | null;
  location: string | null;
  reporter_name: string | null;
  officer: string | null;
  created_by_id: string | null;
  created_by_email: string | null;
  created_by_name: string | null;
  created_by_role: string | null;
  watt: string | null;
  meter: string | null;
  voltage: string | null;
  date: string | null;
  time: string | null;
  status: string | null;
  source: string | null;
  kabupaten: string | null;
  project_date: string | null;
  created_at: string | null;
  grid_data: unknown;
  raw_payload: Record<string, unknown> | null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabaseAdminClient();

    const { data, error } = await supabase
      .from("reports")
      .select("id, fb_doc_id, title, project_title, project_location, location, reporter_name, officer, created_by_id, created_by_email, created_by_name, created_by_role, watt, meter, voltage, date, time, status, source, kabupaten, project_date, created_at, grid_data, raw_payload")
      .or(`id.eq.${id},fb_doc_id.eq.${id}`)
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      return NextResponse.json({ report: null }, { status: 404 });
    }

    const row = data as ReportDetailRow;
    const rawPayload = row.raw_payload || {};

    return NextResponse.json({
      source: "supabase",
      report: {
        id: row.id || row.fb_doc_id || id,
        projectTitle: row.project_title || row.title || rawPayload.projectTitle || rawPayload.title || "",
        title: row.title || row.project_title || rawPayload.title || rawPayload.projectTitle || "",
        projectLocation: row.project_location || row.location || rawPayload.projectLocation || rawPayload.location || "",
        location: row.location || row.project_location || rawPayload.location || rawPayload.projectLocation || "",
        reporterName: row.reporter_name || rawPayload.reporterName || "",
        officer: row.officer || rawPayload.officer || "",
        createdById: row.created_by_id || rawPayload.createdById || "",
        createdByEmail: row.created_by_email || rawPayload.createdByEmail || "",
        createdByName: row.created_by_name || rawPayload.createdByName || "",
        createdByRole: row.created_by_role || rawPayload.createdByRole || "",
        watt: row.watt || rawPayload.watt || "",
        meter: row.meter || rawPayload.meter || "",
        voltage: row.voltage || rawPayload.voltage || "",
        date: row.date || rawPayload.date || "",
        time: row.time || rawPayload.time || "",
        status: row.status || rawPayload.status || "",
        source: row.source || rawPayload.source || "",
        kabupaten: row.kabupaten || rawPayload.kabupaten || "",
        projectDate: row.project_date || rawPayload.projectDate || null,
        createdAt: row.created_at || rawPayload.createdAt || null,
        gridData: row.grid_data ?? rawPayload.gridData ?? null,
        rawPayload,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memuat detail report dari Supabase." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabaseAdminClient();

    const { error } = await supabase
      .from("reports")
      .delete()
      .or(`id.eq.${id},fb_doc_id.eq.${id}`);

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal menghapus report dari Supabase." },
      { status: 500 }
    );
  }
}
