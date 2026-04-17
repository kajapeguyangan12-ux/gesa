"use client";

export type AdminSurveyType = "existing" | "propose" | "pra-existing";
export type AdminSurveyStatus = "menunggu" | "diverifikasi" | "tervalidasi" | "ditolak";

export interface AdminSurveyRow {
  id: string;
  title: string;
  type: AdminSurveyType | string;
  status: string;
  surveyorName: string;
  surveyorEmail?: string;
  surveyorUid?: string;
  createdAt?: string | number | Date | null;
  verifiedAt?: string | number | Date | null;
  verifiedBy?: string;
  validatedAt?: string | number | Date | null;
  validatedBy?: string;
  rejectedAt?: string | number | Date | null;
  rejectedBy?: string;
  rejectionReason?: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  originalLatitude?: number;
  originalLongitude?: number;
  adminLatitude?: number | null;
  adminLongitude?: number | null;
  finalLatitude?: number | null;
  finalLongitude?: number | null;
  hasAdminCoordinateOverride?: boolean;
  taskId?: string;
  taskTitle?: string;
  kabupaten?: string;
  kabupatenName?: string;
  kecamatan?: string;
  desa?: string;
  banjar?: string;
  namaJalan?: string;
  namaGang?: string;
  lokasiJalan?: string;
  jenisExisting?: string;
  keteranganTiang?: string;
  kepemilikan?: string;
  kepemilikanTiang?: string;
  kepemilikanDisplay?: string;
  jenis?: string;
  jenisTitik?: string;
  palet?: string;
  lumina?: string;
  metodeUkur?: string;
  tinggiMedian?: string;
  lebarMedian?: string;
  medianDisplay?: string;
  lebarJalan1?: string;
  lebarJalan2?: string;
  lebarJalanDisplay?: string;
  lebarTrotoar?: string;
  lamnyaBerdekatan?: string;
  tinggiAPM?: string;
  tinggiARM?: string;
  tinggiArm?: string;
  lebarBahuBertiang?: string;
  lebarTrotoarBertiang?: string;
  lainnyaBertiang?: string;
  statusIDTitik?: string;
  idTitik?: string;
  dayaLampu?: string;
  dataTiang?: string;
  dataRuas?: string;
  subRuas?: string;
  median?: string;
  lebarJalan?: string;
  jarakAntarTiang?: string;
  jenisLampu?: string;
  jumlahLampu?: string | number;
  kondisi?: string;
  jenisTiang?: string;
  fotoAktual?: string;
  fotoKemerataan?: string;
  fungsiLampu?: string;
  garduStatus?: string;
  kodeGardu?: string;
  kmzFileUrl?: string;
  fotoTiangAPM?: string;
  fotoTitikActual?: string;
  photoUrl?: string;
  zona?: string;
  kategori?: string;
  editedBy?: string;
  keterangan?: string;
  [key: string]: unknown;
}

interface FetchAdminSurveyRowsOptions {
  activeKabupaten?: string | null;
  adminId?: string | null;
  statuses?: string[];
  type?: AdminSurveyType;
}

function normalizeNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

export function normalizeAdminSurveyRow(raw: AdminSurveyRow): AdminSurveyRow {
  const normalizedType = raw.type === "apj-propose" ? "propose" : raw.type;
  const latitude = normalizeNumber(raw.latitude);
  const longitude = normalizeNumber(raw.longitude);
  const originalLatitude = normalizeNumber(raw.originalLatitude);
  const originalLongitude = normalizeNumber(raw.originalLongitude);
  const adminLatitude = normalizeNumber(raw.adminLatitude);
  const adminLongitude = normalizeNumber(raw.adminLongitude);
  const finalLatitude = normalizeNumber(raw.finalLatitude);
  const finalLongitude = normalizeNumber(raw.finalLongitude);

  return {
    ...raw,
    type:
      normalizedType === "existing" || normalizedType === "propose" || normalizedType === "pra-existing"
        ? normalizedType
        : "existing",
    title:
      raw.title ||
      (normalizedType === "existing"
        ? `Survey Existing - ${raw.namaJalan || "Untitled"}`
        : normalizedType === "propose"
          ? `Survey APJ Propose - ${raw.namaJalan || "Untitled"}`
          : `Survey Pra Existing - ${raw.jenisLampu || "Untitled"}`),
    surveyorName: raw.surveyorName || "Unknown",
    status: raw.status || "menunggu",
    latitude: finalLatitude ?? adminLatitude ?? latitude ?? 0,
    longitude: finalLongitude ?? adminLongitude ?? longitude ?? 0,
    originalLatitude: originalLatitude ?? latitude ?? 0,
    originalLongitude: originalLongitude ?? longitude ?? 0,
    adminLatitude: adminLatitude ?? null,
    adminLongitude: adminLongitude ?? null,
    finalLatitude: finalLatitude ?? adminLatitude ?? latitude ?? null,
    finalLongitude: finalLongitude ?? adminLongitude ?? longitude ?? null,
    hasAdminCoordinateOverride:
      typeof raw.hasAdminCoordinateOverride === "boolean"
        ? raw.hasAdminCoordinateOverride
        : adminLatitude !== undefined &&
          adminLongitude !== undefined &&
          latitude !== undefined &&
          longitude !== undefined &&
          (Math.abs(adminLatitude - latitude) > 0.0000001 || Math.abs(adminLongitude - longitude) > 0.0000001),
    kepemilikan: (raw.kepemilikan as string) || (raw.keteranganTiang as string) || "N/A",
    jenis: (raw.jenis as string) || (raw.jenisTitik as string) || "N/A",
    tinggiArm: (raw.tinggiArm as string) || (raw.tinggiARM as string) || "N/A",
    verifiedBy: raw.verifiedBy || (raw.editedBy as string) || "Admin",
    validatedBy: raw.validatedBy || (raw.editedBy as string) || "Admin",
    kabupatenName: raw.kabupatenName || raw.kabupaten || "",
    kepemilikanDisplay: raw.kepemilikanDisplay || raw.keteranganTiang || raw.kepemilikanTiang || "",
  };
}

export async function fetchAdminSurveyRows(options: FetchAdminSurveyRowsOptions) {
  const params = new URLSearchParams({ includeDetails: "1" });
  if (options.activeKabupaten) params.set("kabupaten", options.activeKabupaten);
  if (options.adminId) params.set("adminId", options.adminId);
  if (options.statuses?.length) params.set("status", options.statuses.join(","));

  const response = await fetch(`/api/admin/gesa-survey?${params.toString()}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Gagal memuat data survey dari Supabase.");
  }

  const payload = (await response.json()) as {
    source?: string;
    generatedAt?: string;
    allRows?: AdminSurveyRow[];
    existing?: { totalData?: number };
    propose?: { totalData?: number };
    praExisting?: { totalData?: number };
  };

  let rows = Array.isArray(payload.allRows) ? payload.allRows.map(normalizeAdminSurveyRow) : [];
  if (options.type) {
    rows = rows.filter((row) => row.type === options.type);
  }

  return {
    source: payload.source || "supabase",
    generatedAt: payload.generatedAt || "",
    rows,
    counts: {
      total: rows.length,
      existing: payload.existing?.totalData ?? rows.filter((row) => row.type === "existing").length,
      propose: payload.propose?.totalData ?? rows.filter((row) => row.type === "propose").length,
      praExisting:
        payload.praExisting?.totalData ?? rows.filter((row) => row.type === "pra-existing").length,
    },
  };
}
