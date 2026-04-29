import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { randomUUID } from "node:crypto";

interface ReportRow {
  id: string | null;
  fb_doc_id: string | null;
  title: string | null;
  project_title: string | null;
  project_location: string | null;
  location: string | null;
  reporter_name: string | null;
  officer: string | null;
  created_by_id: string | null;
  watt: string | null;
  meter: string | null;
  voltage: string | null;
  status: string | null;
  kabupaten: string | null;
  project_date: string | null;
  created_at: string | null;
  grid_data?: unknown;
  raw_payload?: Record<string, unknown> | null;
}

function pickString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

function pickNestedValue(source: Record<string, unknown> | null | undefined, ...paths: string[]) {
  if (!source) return null;
  for (const path of paths) {
    const segments = path.split(".");
    let current: unknown = source;
    let valid = true;
    for (const segment of segments) {
      if (!current || typeof current !== "object" || !(segment in (current as Record<string, unknown>))) {
        valid = false;
        break;
      }
      current = (current as Record<string, unknown>)[segment];
    }
    if (valid && current !== null && current !== undefined && String(current).trim()) {
      return current;
    }
  }
  return null;
}

function formatUnitValue(value: unknown, unit: string) {
  if (value === null || value === undefined) return "-";
  const text = String(value).trim();
  if (!text) return "-";
  const normalizedUnit = unit.toLowerCase();
  if (text.toLowerCase().endsWith(normalizedUnit)) return text;
  const numeric = Number.parseFloat(text.replace(",", ".").replace(/[^0-9.+-eE]/g, ""));
  if (Number.isFinite(numeric)) {
    return `${numeric}${unit}`;
  }
  return text;
}

function resolveReportFields(row: ReportRow) {
  const raw = row.raw_payload || {};

  const title = pickString(
    row.title,
    row.project_title,
    pickNestedValue(raw, "projectTitle", "title", "judul", "name", "nama", "namaLampu", "lampName", "lokasiJalan", "namaJalan")
  ) || "Tanpa Judul";

  const location = pickString(
    row.location,
    row.project_location,
    pickNestedValue(raw, "projectLocation", "location", "lokasi", "place", "lokasiJalan", "namaJalan", "namaGang", "alamatJalan", "alamat")
  ) || "-";

  const officer = pickString(
    row.officer,
    row.reporter_name,
    pickNestedValue(raw, "officer", "petugas", "reporterName", "nama_pelapor", "petugasSurvey", "surveyor", "userName", "displayName", "modifiedBy", "createdBy", "user", "reporter")
  ) || "-";

  const reporterName = pickString(
    row.reporter_name,
    pickNestedValue(raw, "reporterName", "nama_pelapor", "petugas", "surveyor", "userName", "displayName")
  ) || "";

  const createdByName = pickString(
    pickNestedValue(raw, "createdByName", "modifiedBy", "createdBy", "userName", "displayName"),
    reporterName,
    officer
  ) || "";

  const watt = formatUnitValue(
    pickString(
      row.watt,
      pickNestedValue(raw, "watt", "power", "potency", "wattage", "lamp_watt", "daya", "daya_lampu", "dayaLampu", "lamp_power", "lampPower", "lamp.watt", "lamp.power", "lamp.daya", "lampu.watt", "lampu.power", "lampu.daya", "spesifikasi.watt", "spesifikasi.power", "spesifikasi.daya", "spec.watt", "spec.power", "spec.daya")
    ),
    "W"
  );

  const meter = formatUnitValue(
    pickString(
      row.meter,
      pickNestedValue(raw, "meter", "poleHeight", "tinggiTiang", "tinggi_tiang", "tinggi_tiang_m", "tinggiMeter", "tinggiTiangMeter", "height", "pole_height", "ketinggian", "tinggi", "lamp.poleHeight", "lamp.height", "lamp.tinggi", "lampu.poleHeight", "lampu.height", "lampu.tinggi", "spesifikasi.poleHeight", "spesifikasi.height", "spesifikasi.tinggi", "spec.poleHeight", "spec.height", "spec.tinggi")
    ),
    "m"
  );

  const voltage = formatUnitValue(
    pickString(
      row.voltage,
      pickNestedValue(raw, "voltage", "tegangan", "teganganAwal", "initialVoltage", "volt", "lamp_voltage", "lamp.voltage", "lampu.voltage", "spesifikasi.voltage", "spec.voltage")
    ),
    "V"
  );

  const date = pickString(
    pickNestedValue(raw, "date", "tanggal"),
    row.project_date ? new Date(row.project_date).toISOString().slice(0, 10) : null,
    row.created_at ? new Date(row.created_at).toISOString().slice(0, 10) : null
  ) || "-";

  return {
    raw,
    title,
    location,
    officer,
    reporterName,
    createdByName,
    watt,
    meter,
    voltage,
    date,
    projectTitle: pickString(row.project_title, row.title, pickNestedValue(raw, "projectTitle", "title")) || "",
    projectLocation: pickString(row.project_location, row.location, pickNestedValue(raw, "projectLocation", "location")) || "",
    source: pickString(pickNestedValue(raw, "source")) || "",
  };
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

function toDisplayDate(value: string | null) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function toDisplayTime(value: string | null) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  }).replace(":", ".");
}

export async function GET(request: NextRequest) {
  try {
    const limitParam = Number.parseInt(request.nextUrl.searchParams.get("limit") || "10", 10);
    const offsetParam = Number.parseInt(request.nextUrl.searchParams.get("offset") || "0", 10);
    const kabupaten = request.nextUrl.searchParams.get("kabupaten")?.trim() || "";
    const createdById = request.nextUrl.searchParams.get("createdById")?.trim() || "";
    const includeData = request.nextUrl.searchParams.get("includeData") === "1";
    const sortParam = request.nextUrl.searchParams.get("sort")?.trim().toLowerCase();
    const ascending = sortParam === "asc";
    const safeLimit = Number.isFinite(limitParam) ? Math.max(1, Math.min(limitParam, 1000)) : 10;
    const safeOffset = Number.isFinite(offsetParam) ? Math.max(0, offsetParam) : 0;
    const supabase = getSupabaseAdminClient();
    const selectClause = includeData
      ? "id, fb_doc_id, title, project_title, project_location, location, reporter_name, officer, created_by_id, watt, meter, voltage, status, kabupaten, project_date, created_at, grid_data, raw_payload"
      : "id, fb_doc_id, title, project_title, project_location, location, reporter_name, officer, created_by_id, watt, meter, voltage, status, kabupaten, project_date, created_at, raw_payload";

    let query = supabase
      .from("reports")
      .select(selectClause)
      .order("created_at", { ascending })
      .range(safeOffset, safeOffset + safeLimit - 1);

    if (kabupaten) {
      query = query.eq("kabupaten", kabupaten);
    }
    if (createdById) {
      query = query.eq("created_by_id", createdById);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    const reports = ((data || []) as ReportRow[]).map((row) => {
      const normalized = resolveReportFields(row);
      return {
        id: row.id || row.fb_doc_id,
        title: normalized.title,
        date: normalized.date,
        dateDisplay: toDisplayDate(row.project_date || row.created_at),
        time: row.created_at ? toDisplayTime(row.created_at) : "-",
        timeDisplay: row.created_at ? toDisplayTime(row.created_at) : "",
        location: normalized.location,
        officer: normalized.officer,
        createdById: row.created_by_id || "",
        createdByName: normalized.createdByName,
        reporterName: normalized.reporterName,
        watt: normalized.watt,
        meter: normalized.meter,
        voltage: normalized.voltage,
        kabupaten: row.kabupaten || "",
        status: row.status || "",
        source: normalized.source,
        createdAt: row.created_at,
        ...(includeData
          ? {
              projectTitle: normalized.projectTitle,
              projectLocation: normalized.projectLocation,
              gridData: row.grid_data ?? normalized.raw.gridData ?? null,
              rawPayload: normalized.raw,
            }
          : {}),
      };
    });

    const lastDataChangeAt =
      reports.reduce<string>((latest, report) => {
        const current = typeof report.createdAt === "string" ? report.createdAt : "";
        if (!current) return latest;
        return !latest || new Date(current).getTime() > new Date(latest).getTime() ? current : latest;
      }, "") || new Date().toISOString();

    return NextResponse.json({
      source: "supabase",
      generatedAt: new Date().toISOString(),
      lastDataChangeAt,
      offset: safeOffset,
      limit: safeLimit,
      reports,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memuat reports dari Supabase." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const supabase = getSupabaseAdminClient() as any;
    const reportId = pickString(payload.id, payload.fb_doc_id) || randomUUID();
    const createdAt = normalizeTimestamp(payload.createdAt, new Date().toISOString()) || new Date().toISOString();
    const rawPayload: Record<string, unknown> = {
      ...payload,
      id: reportId,
      createdAt,
      updatedAt: normalizeTimestamp(payload.updatedAt, createdAt) || createdAt,
    };

    const row = {
      fb_doc_id: reportId,
      title: pickString(payload.title, payload.projectTitle) || "Pengukuran Cahaya",
      project_title: pickString(payload.projectTitle, payload.title) || "Pengukuran Cahaya",
      project_location: pickString(payload.projectLocation, payload.location) || "",
      location: pickString(payload.location, payload.projectLocation) || "",
      reporter_name: pickString(payload.reporterName, payload.officer) || "",
      officer: pickString(payload.officer, payload.reporterName) || "",
      created_by_id: pickString(payload.createdById) || null,
      created_by_email: pickString(payload.createdByEmail) || null,
      created_by_name: pickString(payload.createdByName, payload.reporterName, payload.officer) || null,
      created_by_role: pickString(payload.createdByRole) || null,
      watt: pickString(payload.watt) || null,
      meter: pickString(payload.meter) || null,
      voltage: pickString(payload.voltage) || null,
      date: pickString(payload.date) || null,
      time: pickString(payload.time) || null,
      status: pickString(payload.status) || "pending",
      source: pickString(payload.source) || "survey-cahaya",
      kabupaten: pickString(payload.kabupaten) || null,
      project_date: normalizeTimestamp(payload.projectDate, createdAt),
      created_at: createdAt,
      grid_data: payload.gridData ?? null,
      raw_payload: rawPayload,
    };

    const { error } = await supabase.from("reports").insert(row);
    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ ok: true, id: reportId, source: "supabase" });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal menyimpan report ke Supabase." },
      { status: 500 }
    );
  }
}
