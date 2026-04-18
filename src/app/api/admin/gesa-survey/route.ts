import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

type SurveyType = "existing" | "apj-propose" | "pra-existing";

interface SurveyRow {
  id: string;
  taskId?: string;
  status: string;
  title?: string;
  type: string;
  surveyorName?: string;
  surveyorEmail?: string;
  surveyorUid?: string;
  verifiedBy?: string;
  verifiedAt?: string | null;
  validatedAt?: string | null;
  kabupaten?: string;
  kabupatenName?: string;
  kecamatan?: string;
  jumlahLampu?: number;
  desa?: string;
  createdAt?: string | null;
  [key: string]: unknown;
}

interface ReportSummary {
  totalData: number;
  totalTitik: number;
  totalLampu: number;
  totalMenunggu: number;
  totalDiverifikasi: number;
  totalTervalidasi: number;
  totalDitolak: number;
  totalSurveyor: number;
}

const emptySummary: ReportSummary = {
  totalData: 0,
  totalTitik: 0,
  totalLampu: 0,
  totalMenunggu: 0,
  totalDiverifikasi: 0,
  totalTervalidasi: 0,
  totalDitolak: 0,
  totalSurveyor: 0,
};

const SUPABASE_PAGE_SIZE = 1000;

function normalizeLampCount(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function normalizeCoordinate(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const normalized = value.replace(",", ".").trim();
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeKabupatenLabel(value: unknown) {
  if (typeof value !== "string") return "";
  return value
    .trim()
    .toLowerCase()
    .replace(/^kabupaten\s+/i, "")
    .replace(/^kab\.\s*/i, "")
    .replace(/^kab\s+/i, "");
}

function buildSummary(rows: SurveyRow[]): ReportSummary {
  const surveyors = new Set<string>();

  return rows.reduce<ReportSummary>((summary, row) => {
    if (row.surveyorName) {
      surveyors.add(row.surveyorName.trim().toLowerCase());
    }

    const status = row.status?.toLowerCase();
    summary.totalData += 1;
    summary.totalTitik += 1;
    summary.totalLampu += row.jumlahLampu ?? 0;
    if (status === "menunggu") summary.totalMenunggu += 1;
    if (status === "diverifikasi") summary.totalDiverifikasi += 1;
    if (status === "tervalidasi") summary.totalTervalidasi += 1;
    if (status === "ditolak") summary.totalDitolak += 1;
    summary.totalSurveyor = surveyors.size;
    return summary;
  }, { ...emptySummary });
}

function buildKecamatanSummary(rows: SurveyRow[]) {
  const grouped = new Map<string, SurveyRow[]>();
  for (const row of rows) {
    const key = row.kecamatan?.trim() || "Tanpa Kecamatan";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)?.push(row);
  }

  return Array.from(grouped.entries())
    .map(([kecamatan, items]) => ({
      kecamatan,
      ...buildSummary(items),
    }))
    .sort((a, b) => b.totalData - a.totalData || a.kecamatan.localeCompare(b.kecamatan));
}

function mapSupabaseSurveyRow(type: SurveyType, row: Record<string, unknown>): SurveyRow {
  const rawPayload = (row.raw_payload as Record<string, unknown> | null) || {};
  const status = typeof row.status === "string" ? row.status : typeof rawPayload.status === "string" ? rawPayload.status : "";
  const normalizedType = type === "apj-propose" ? "propose" : type;
  const verifiedBy =
    typeof rawPayload.verifiedBy === "string"
      ? rawPayload.verifiedBy
      : typeof rawPayload.validatedBy === "string"
        ? rawPayload.validatedBy
        : "";
  const verifiedAtRaw =
    row.verified_at ??
    rawPayload.verifiedAt ??
    rawPayload.validatedAt ??
    row.updated_at ??
    null;
  const validatedAtRaw = rawPayload.validatedAt ?? row.updated_at ?? null;
  const kabupaten =
    typeof row.kabupaten === "string"
      ? row.kabupaten
      : typeof rawPayload.kabupatenName === "string"
        ? rawPayload.kabupatenName
        : typeof rawPayload.kabupaten === "string"
          ? rawPayload.kabupaten
          : "";
  const latitude = normalizeCoordinate(rawPayload.latitude);
  const longitude = normalizeCoordinate(rawPayload.longitude);
  const adminLatitude = normalizeCoordinate(rawPayload.adminLatitude);
  const adminLongitude = normalizeCoordinate(rawPayload.adminLongitude);
  const finalLatitude = normalizeCoordinate(rawPayload.finalLatitude) ?? adminLatitude ?? latitude;
  const finalLongitude = normalizeCoordinate(rawPayload.finalLongitude) ?? adminLongitude ?? longitude;

  return {
    ...rawPayload,
    id: String(row.fb_doc_id || row.id || ""),
    taskId: typeof row.task_id === "string" ? row.task_id : typeof rawPayload.taskId === "string" ? rawPayload.taskId : "",
    taskTitle: typeof rawPayload.taskTitle === "string" ? rawPayload.taskTitle : "",
    status,
    title: typeof row.title === "string" ? row.title : typeof rawPayload.title === "string" ? rawPayload.title : "",
    type: normalizedType,
    surveyorName:
      typeof row.surveyor_name === "string"
        ? row.surveyor_name
        : typeof rawPayload.surveyorName === "string"
          ? rawPayload.surveyorName
          : "",
    surveyorEmail:
      typeof row.surveyor_email === "string"
        ? row.surveyor_email
        : typeof rawPayload.surveyorEmail === "string"
          ? rawPayload.surveyorEmail
          : "",
    surveyorUid:
      typeof row.surveyor_uid === "string"
        ? row.surveyor_uid
        : typeof rawPayload.surveyorUid === "string"
          ? rawPayload.surveyorUid
          : "",
    verifiedBy,
    verifiedAt:
      typeof verifiedAtRaw === "string"
        ? verifiedAtRaw
        : typeof verifiedAtRaw === "object" && verifiedAtRaw && "seconds" in verifiedAtRaw
          ? new Date(Number((verifiedAtRaw as { seconds: number }).seconds) * 1000).toISOString()
          : null,
    validatedAt:
      typeof validatedAtRaw === "string"
        ? validatedAtRaw
        : typeof validatedAtRaw === "object" && validatedAtRaw && "seconds" in validatedAtRaw
          ? new Date(Number((validatedAtRaw as { seconds: number }).seconds) * 1000).toISOString()
          : null,
    latitude,
    longitude,
    adminLatitude,
    adminLongitude,
    finalLatitude,
    finalLongitude,
    kabupaten,
    kabupatenName: kabupaten,
    kecamatan:
      typeof rawPayload.kecamatan === "string"
        ? rawPayload.kecamatan
        : typeof rawPayload.kecamatanName === "string"
          ? rawPayload.kecamatanName
          : "",
    banjar: typeof rawPayload.banjar === "string" ? rawPayload.banjar : "",
    jumlahLampu:
      normalizedType === "pra-existing"
        ? normalizeLampCount(rawPayload.jumlahLampu)
        : normalizeLampCount(rawPayload.jumlahLampu ?? rawPayload.dataLampu),
    desa: typeof rawPayload.desa === "string" ? rawPayload.desa : "",
    namaJalan:
      typeof rawPayload.namaJalan === "string"
        ? rawPayload.namaJalan
        : typeof rawPayload.lokasiLengkap === "string"
          ? rawPayload.lokasiLengkap
          : "",
    kategori:
      typeof rawPayload.kategori === "string"
        ? rawPayload.kategori
        : normalizedType === "existing"
          ? "Survey Existing"
          : normalizedType === "propose"
            ? "Survey APJ Propose"
            : "Survey Pra Existing",
    zona:
      typeof rawPayload.zona === "string"
        ? rawPayload.zona
        : normalizedType === "existing"
          ? "Existing"
          : normalizedType === "propose"
            ? "Propose"
            : "Pra Existing",
    keterangan:
      typeof rawPayload.keterangan === "string"
        ? rawPayload.keterangan
        : typeof rawPayload.kondisi === "string"
          ? rawPayload.kondisi
          : "",
    createdAt:
      typeof row.created_at === "string"
        ? row.created_at
        : typeof rawPayload.createdAt === "string"
          ? rawPayload.createdAt
          : null,
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
  };
}

function matchesKabupaten(row: SurveyRow, activeKabupaten: string | null) {
  if (!activeKabupaten) return true;
  return normalizeKabupatenLabel(row.kabupaten) === normalizeKabupatenLabel(activeKabupaten);
}

export async function GET(request: NextRequest) {
  try {
    const includeDetails = request.nextUrl.searchParams.get("includeDetails") === "1";
    const activeKabupaten = request.nextUrl.searchParams.get("kabupaten")?.trim() || null;
    const adminId = request.nextUrl.searchParams.get("adminId")?.trim() || null;
    const requestedType = request.nextUrl.searchParams.get("type")?.trim() || null;
    const offset = Math.max(0, Number.parseInt(request.nextUrl.searchParams.get("offset") || "0", 10) || 0);
    const limitParam = Number.parseInt(request.nextUrl.searchParams.get("limit") || "0", 10) || 0;
    const limit = limitParam > 0 ? limitParam : null;
    const statusFilters = new Set(
      (request.nextUrl.searchParams.get("status") || "")
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean)
    );
    const supabase = getSupabaseAdminClient();

    const fetchAllTableRows = async (table: string) => {
      const rows: Record<string, unknown>[] = [];
      let offset = 0;

      while (true) {
        const { data, error } = await supabase
          .from(table)
          .select("id, fb_doc_id, task_id, title, status, surveyor_name, surveyor_email, surveyor_uid, kabupaten, created_at, verified_at, updated_at, raw_payload")
          .order("created_at", { ascending: false })
          .range(offset, offset + SUPABASE_PAGE_SIZE - 1);

        if (error) throw new Error(error.message);

        const batch = (data || []) as Record<string, unknown>[];
        rows.push(...batch);

        if (batch.length < SUPABASE_PAGE_SIZE) {
          break;
        }

        offset += SUPABASE_PAGE_SIZE;
      }

      return rows;
    };

    let allowedTaskIds: Set<string> | null = null;
    if (adminId) {
      const { data: taskRows, error: taskError } = await supabase
        .from("tasks")
        .select("fb_doc_id")
        .eq("created_by_admin_id", adminId);

      if (taskError) throw new Error(taskError.message);

      allowedTaskIds = new Set(
        ((taskRows || []) as Array<{ fb_doc_id: string | null }>)
          .map((row) => (typeof row.fb_doc_id === "string" ? row.fb_doc_id : ""))
          .filter(Boolean)
      );
    }

    const loadTable = async (table: string, type: SurveyType) => {
      const data = await fetchAllTableRows(table);
      let mappedRows = data.map((item) => mapSupabaseSurveyRow(type, item));
      mappedRows = mappedRows.filter((row) => matchesKabupaten(row, activeKabupaten));
      if (statusFilters.size > 0) {
        mappedRows = mappedRows.filter((row) => statusFilters.has((row.status || "").toLowerCase()));
      }

      if (!allowedTaskIds) return mappedRows;
      return mappedRows.filter((row) => row.taskId && allowedTaskIds?.has(row.taskId));
    };

    const tablesToLoad: Array<{ table: string; type: SurveyType }> = [];
    if (!requestedType || requestedType === "propose") {
      tablesToLoad.push({ table: "survey_apj_propose", type: "apj-propose" });
    }
    if (!requestedType || requestedType === "existing") {
      tablesToLoad.push({ table: "survey_existing", type: "existing" });
    }
    if (!requestedType || requestedType === "pra-existing") {
      tablesToLoad.push({ table: "survey_pra_existing", type: "pra-existing" });
    }

    const loadedResults = await Promise.all(tablesToLoad.map(({ table, type }) => loadTable(table, type)));
    const proposeRows = requestedType && requestedType !== "propose" ? [] : loadedResults[tablesToLoad.findIndex((item) => item.type === "apj-propose")] || [];
    const existingRows = requestedType && requestedType !== "existing" ? [] : loadedResults[tablesToLoad.findIndex((item) => item.type === "existing")] || [];
    const praExistingRows = requestedType && requestedType !== "pra-existing" ? [] : loadedResults[tablesToLoad.findIndex((item) => item.type === "pra-existing")] || [];

    const combinedRows = [...proposeRows, ...existingRows, ...praExistingRows].sort((a, b) => {
      const left = typeof a.createdAt === "string" ? new Date(a.createdAt).getTime() : 0;
      const right = typeof b.createdAt === "string" ? new Date(b.createdAt).getTime() : 0;
      return right - left;
    });
    const totalRows = combinedRows.length;
    const allRows = includeDetails
      ? (limit ? combinedRows.slice(offset, offset + limit) : combinedRows.slice(offset))
      : [];

    return NextResponse.json({
      source: "supabase",
      generatedAt: new Date().toISOString(),
      totalUniqueSurveyors: new Set(
        [...proposeRows, ...existingRows, ...praExistingRows]
          .map((row) => row.surveyorName?.trim().toLowerCase())
          .filter(Boolean)
      ).size,
      propose: buildSummary(proposeRows),
      existing: buildSummary(existingRows),
      praExisting: buildSummary(praExistingRows),
      praExistingByKecamatan: buildKecamatanSummary(praExistingRows),
      totalRows,
      allRows,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memuat data gesa survey dari Supabase." },
      { status: 500 }
    );
  }
}
