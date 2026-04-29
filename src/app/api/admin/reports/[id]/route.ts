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

function pickString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

function normalizeTimestamp(value: unknown, fallback?: string | null) {
  if (!value) return fallback ?? null;
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? fallback ?? null : parsed.toISOString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "object" && value && "seconds" in value) {
    const seconds = Number((value as { seconds?: unknown }).seconds);
    return Number.isFinite(seconds) ? new Date(seconds * 1000).toISOString() : fallback ?? null;
  }
  return fallback ?? null;
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
    const merged = {
      ...rawPayload,
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
    };

    return NextResponse.json({
      source: "supabase",
      report: {
        ...merged,
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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const patch = (await request.json()) as Record<string, unknown>;
    const supabase = getSupabaseAdminClient() as any;

    const { data: existing, error: fetchError } = await supabase
      .from("reports")
      .select("id, fb_doc_id, title, project_title, project_location, location, reporter_name, officer, created_by_id, created_by_email, created_by_name, created_by_role, watt, meter, voltage, date, time, status, source, kabupaten, project_date, created_at, grid_data, raw_payload")
      .or(`id.eq.${id},fb_doc_id.eq.${id}`)
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      throw new Error(fetchError.message);
    }

    if (!existing) {
      return NextResponse.json({ error: "Report tidak ditemukan." }, { status: 404 });
    }

    const current = existing as ReportDetailRow;
    const currentRawPayload = current.raw_payload || {};
    const nowIso = new Date().toISOString();
    const modifiedAt = normalizeTimestamp(patch.modifiedAt, nowIso);
    const modifiedBy = pickString(patch.modifiedBy, currentRawPayload.modifiedBy) || "Admin";
    const mergedRawPayload: Record<string, unknown> = {
      ...currentRawPayload,
      ...patch,
      modifiedBy,
      modifiedAt,
      updatedAt: normalizeTimestamp(patch.updatedAt, modifiedAt) || modifiedAt,
    };

    const updateRow = {
      title: pickString(
        patch.title,
        patch.projectTitle,
        mergedRawPayload.title,
        mergedRawPayload.projectTitle,
        current.title,
        current.project_title
      ),
      project_title: pickString(
        patch.projectTitle,
        patch.title,
        mergedRawPayload.projectTitle,
        mergedRawPayload.title,
        current.project_title,
        current.title
      ),
      project_location: pickString(
        patch.projectLocation,
        patch.location,
        mergedRawPayload.projectLocation,
        mergedRawPayload.location,
        current.project_location,
        current.location
      ),
      location: pickString(
        patch.location,
        patch.projectLocation,
        mergedRawPayload.location,
        mergedRawPayload.projectLocation,
        current.location,
        current.project_location
      ),
      reporter_name: pickString(patch.reporterName, mergedRawPayload.reporterName, current.reporter_name),
      officer: pickString(
        patch.officer,
        patch.reporterName,
        mergedRawPayload.officer,
        mergedRawPayload.reporterName,
        current.officer,
        current.reporter_name
      ),
      watt: pickString(patch.watt, mergedRawPayload.watt, current.watt),
      meter: pickString(patch.meter, mergedRawPayload.meter, current.meter),
      voltage: pickString(patch.voltage, mergedRawPayload.voltage, current.voltage),
      date: pickString(patch.date, mergedRawPayload.date, current.date),
      time: pickString(patch.time, mergedRawPayload.time, current.time),
      status: pickString(patch.status, mergedRawPayload.status, current.status),
      source: pickString(patch.source, mergedRawPayload.source, current.source),
      kabupaten: pickString(patch.kabupaten, mergedRawPayload.kabupaten, current.kabupaten),
      project_date: normalizeTimestamp(patch.projectDate, current.project_date),
      grid_data: patch.gridData ?? current.grid_data ?? currentRawPayload.gridData ?? null,
      raw_payload: {
        ...mergedRawPayload,
        gridData: patch.gridData ?? current.grid_data ?? currentRawPayload.gridData ?? null,
        modifiedBy,
        modifiedAt,
      },
    };

    const { error: updateError } = await supabase
      .from("reports")
      .update(updateRow)
      .or(`id.eq.${id},fb_doc_id.eq.${id}`);

    if (updateError) {
      throw new Error(updateError.message);
    }

    return NextResponse.json({ ok: true, modifiedAt, modifiedBy });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memperbarui report di Supabase." },
      { status: 500 }
    );
  }
}
