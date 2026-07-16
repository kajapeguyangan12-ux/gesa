import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

type RawRecord = Record<string, unknown>;

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseFloat(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function normalizeDate(value: unknown) {
  if (!value) return "";
  const date = new Date(value as string);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function getRawPayload(row: RawRecord) {
  return row.raw_payload && typeof row.raw_payload === "object" ? (row.raw_payload as RawRecord) : {};
}

function isCommissioningStage(row: RawRecord) {
  const raw = getRawPayload(row);
  const stage = [
    normalizeString(row.stage),
    normalizeString(raw.stage),
    normalizeString(raw.tahap),
    normalizeString(raw.type),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return stage.includes("comission") || stage.includes("commission");
}

function normalizePoint(row: RawRecord) {
  const raw = getRawPayload(row);
  const idTitik = normalizeString(row.id_titik) || normalizeString(raw.idTitik) || normalizeString(raw.id_titik);
  const group =
    normalizeString(row.zona) ||
    normalizeString(raw.grup) ||
    normalizeString(raw.group) ||
    normalizeString(raw.zona) ||
    normalizeString(row.source_task_id) ||
    "Tanpa Grup";
  return {
    id: normalizeString(row.fb_doc_id) || normalizeString(raw.id) || idTitik,
    idTitik,
    namaTitik: normalizeString(row.nama_titik) || normalizeString(raw.namaTitik) || idTitik,
    namaJalan: normalizeString(raw.namaJalan) || normalizeString(raw.nama_jalan) || normalizeString(raw.jalan) || "-",
    kabupaten: normalizeString(raw.kabupaten) || normalizeString(raw.area) || "-",
    dayaLampu: normalizeString(raw.dayaLampu) || normalizeString(raw.daya_lampu) || "-",
    group,
    sourceTaskId: normalizeString(row.source_task_id) || normalizeString(raw.sourceTaskId),
    latitude: normalizeNumber(row.latitude ?? raw.latitude ?? raw.lat),
    longitude: normalizeNumber(row.longitude ?? raw.longitude ?? raw.lng ?? raw.lon),
    status: "menyala",
    source: "kontruksi_valid",
    stage: normalizeString(row.stage) || normalizeString(raw.stage) || normalizeString(raw.tahap) || "comissioning",
    validatedAt: normalizeDate(row.validated_at || raw.validatedAt),
    updatedAt: normalizeDate(row.updated_at || raw.updatedAt),
    operationalAt: normalizeDate(raw.operationalAt || raw.operational_at || row.validated_at || row.created_at || raw.createdAt || raw.created_at),
  };
}

function getReportPointId(report: RawRecord) {
  const raw = getRawPayload(report);
  return normalizeString(raw.idTitik) || normalizeString(raw.id_titik) || normalizeString(report.location);
}

function summarizeReports(reports: RawRecord[]) {
  const byPoint = new Map<string, { total: number; new: number; diproses: number; selesai: number; ditolak: number }>();
  reports.forEach((report) => {
    const idTitik = getReportPointId(report);
    if (!idTitik) return;
    const status = normalizeString(report.status) || normalizeString(getRawPayload(report).status) || "new";
    const current = byPoint.get(idTitik) || { total: 0, new: 0, diproses: 0, selesai: 0, ditolak: 0 };
    current.total += 1;
    if (status === "diproses") current.diproses += 1;
    else if (status === "selesai") current.selesai += 1;
    else if (status === "ditolak") current.ditolak += 1;
    else current.new += 1;
    byPoint.set(idTitik, current);
  });
  return byPoint;
}

export async function GET(request: NextRequest) {
  try {
    const limit = Math.min(Math.max(Number.parseInt(request.nextUrl.searchParams.get("limit") || "1000", 10) || 1000, 1), 5000);
    const kabupaten = normalizeString(request.nextUrl.searchParams.get("kabupaten")).toLowerCase();
    const supabase = getSupabaseAdminClient() as any;

    const [{ data: constructionRows, error: constructionError }, { data: reportRows, error: reportError }] = await Promise.all([
      supabase
        .from("kontruksi_valid")
        .select("fb_doc_id, source_task_id, nama_titik, id_titik, zona, stage, status, latitude, longitude, raw_payload, created_at, updated_at, validated_at")
        .order("validated_at", { ascending: false })
        .limit(limit),
      supabase
        .from("om_reports")
        .select("fb_doc_id, location, status, raw_payload")
        .order("created_at", { ascending: false })
        .limit(limit),
    ]);

    if (constructionError) throw new Error(constructionError.message);
    const safeReportRows =
      reportError && String(reportError.message || "").includes("om_reports")
        ? []
        : reportError
          ? (() => {
              throw new Error(reportError.message);
            })()
          : reportRows || [];

    const reportSummary = summarizeReports(safeReportRows as RawRecord[]);
    const pointsById = new Map<string, ReturnType<typeof normalizePoint> & { reports: ReturnType<typeof summarizeReports> extends Map<string, infer T> ? T : never }>();

    ((constructionRows || []) as RawRecord[])
      .filter(isCommissioningStage)
      .map(normalizePoint)
      .filter((point) => point.idTitik)
      .filter((point) => !kabupaten || point.kabupaten.toLowerCase() === kabupaten)
      .forEach((point) => {
        if (pointsById.has(point.idTitik)) return;
        pointsById.set(point.idTitik, {
          ...point,
          reports: reportSummary.get(point.idTitik) || { total: 0, new: 0, diproses: 0, selesai: 0, ditolak: 0 },
        });
      });

    const points = Array.from(pointsById.values());
    const groups = Array.from(
      points.reduce((acc, point) => {
        const key = point.group || "Tanpa Grup";
        const current = acc.get(key) || {
          id: key,
          name: key,
          sourceTaskId: point.sourceTaskId,
          total: 0,
          withCoordinate: 0,
          reports: { total: 0, new: 0, diproses: 0, selesai: 0, ditolak: 0 },
          points: [] as typeof points,
        };
        current.total += 1;
        if (point.latitude && point.longitude) current.withCoordinate += 1;
        current.reports.total += point.reports.total;
        current.reports.new += point.reports.new;
        current.reports.diproses += point.reports.diproses;
        current.reports.selesai += point.reports.selesai;
        current.reports.ditolak += point.reports.ditolak;
        current.points.push(point);
        acc.set(key, current);
        return acc;
      }, new Map<string, { id: string; name: string; sourceTaskId: string; total: number; withCoordinate: number; reports: { total: number; new: number; diproses: number; selesai: number; ditolak: number }; points: typeof points }>())
    ).map(([, group]) => group);

    return NextResponse.json({
      source: "kontruksi_valid:comissioning",
      summary: {
        groups: groups.length,
        points: points.length,
        withCoordinate: points.filter((point) => point.latitude && point.longitude).length,
        reports: points.reduce((sum, point) => sum + point.reports.total, 0),
      },
      groups,
      points,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memuat master titik APJ O&M." },
      { status: 500 }
    );
  }
}
