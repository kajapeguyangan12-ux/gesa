import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

const TEST_POINT_ID = "TEST-APJ-001";
const TEST_DOC_ID = "om_test_apj_qr_001";
const TEST_TASK_ID = "om-test-qr";

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseFloat(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function makeDocId(idTitik: string) {
  return `om_manual_apj_${idTitik.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "test"}`;
}

function testPointPayload(now: string) {
  return {
    id: TEST_DOC_ID,
    idTitik: TEST_POINT_ID,
    namaTitik: "Test APJ QR O&M",
    namaJalan: "Jalan Test QR O&M",
    kabupaten: "tabanan",
    dayaLampu: "120W",
    grup: "Grup Test QR",
    group: "Grup Test QR",
    sourceTaskId: TEST_TASK_ID,
    stage: "comissioning",
    tahap: "comissioning",
    status: "valid",
    kontruksiStatus: "valid",
    source: "om_manual_test",
    isOmTestData: true,
    latitude: -8.5392,
    longitude: 115.1256,
    isTestData: true,
    createdAt: now,
    updatedAt: now,
    validatedAt: now,
  };
}

export async function GET() {
  try {
    const supabase = getSupabaseAdminClient() as any;
    const { data, error } = await supabase
      .from("kontruksi_valid")
      .select("fb_doc_id, id_titik, raw_payload, validated_at")
      .eq("fb_doc_id", TEST_DOC_ID)
      .limit(1);
    if (error) throw new Error(error.message);
    return NextResponse.json({ exists: Array.isArray(data) && data.length > 0, idTitik: TEST_POINT_ID, item: Array.isArray(data) ? data[0] || null : null });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal mengecek data test APJ." }, { status: 500 });
  }
}

export async function POST() {
  try {
    return await createOrUpdateTestPoint();
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal membuat data test APJ." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    return await createOrUpdateTestPoint(payload);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal menyimpan data test APJ." }, { status: 500 });
  }
}

async function createOrUpdateTestPoint(payload?: Record<string, unknown>) {
    const supabase = getSupabaseAdminClient() as any;
    const now = new Date().toISOString();
    const idTitik = normalizeString(payload?.idTitik) || TEST_POINT_ID;
    const docId = payload ? makeDocId(idTitik) : TEST_DOC_ID;
    const taskId = normalizeString(payload?.sourceTaskId) || (payload ? `om-manual-${idTitik.toLowerCase()}` : TEST_TASK_ID);
    const zona = normalizeString(payload?.zona);
    const group = normalizeString(payload?.group) || zona || "Grup Test QR";
    const namaTitik = normalizeString(payload?.namaTitik) || `${idTitik} - ${normalizeString(payload?.namaJalan) || "APJ O&M"}`;
    const namaJalan = normalizeString(payload?.namaJalan) || "Jalan Test QR O&M";
    const kecamatan = normalizeString(payload?.kecamatan);
    const kabupaten = normalizeString(payload?.kabupaten) || kecamatan || "tabanan";
    const dayaLampu = normalizeString(payload?.dayaLampu) || "120W";
    const latitude = normalizeNumber(payload?.latitude) ?? -8.5392;
    const longitude = normalizeNumber(payload?.longitude) ?? 115.1256;

    const { data: existingRows, error: existingError } = await supabase
      .from("kontruksi_valid")
      .select("fb_doc_id, raw_payload")
      .eq("id_titik", idTitik)
      .limit(1);
    if (existingError) throw new Error(existingError.message);
    const existing = Array.isArray(existingRows) ? (existingRows[0] as { fb_doc_id?: string; raw_payload?: Record<string, unknown> } | undefined) : undefined;
    const existingRaw = existing?.raw_payload && typeof existing.raw_payload === "object" ? existing.raw_payload : {};
    const isExistingTest = Boolean(existingRaw.isOmTestData || existingRaw.isTestData || existingRaw.source === "om_manual_test");
    if (existing && !isExistingTest) {
      return NextResponse.json({ error: "ID titik sudah dipakai data konstruksi asli. Gunakan ID test lain agar tidak rancu." }, { status: 409 });
    }

    const rawPayload = payload
      ? {
          ...existingRaw,
          ...payload,
          id: existing?.fb_doc_id || docId,
          idTitik,
          id_titik: idTitik,
          namaTitik,
          namaJalan,
          nama_jalan: namaJalan,
          kabupaten,
          kecamatan,
          dayaLampu,
          daya_lampu: dayaLampu,
          noSeriTiangArm: normalizeString(payload.noSeriTiangArm),
          no_seri_tiang_arm: normalizeString(payload.noSeriTiangArm),
          noSeriLampu1: normalizeString(payload.noSeriLampu1),
          no_seri_lampu_1: normalizeString(payload.noSeriLampu1),
          noSeriLampu2: normalizeString(payload.noSeriLampu2),
          no_seri_lampu_2: normalizeString(payload.noSeriLampu2),
          lebarJalan: normalizeString(payload.lebarJalan),
          lebar_jalan: normalizeString(payload.lebarJalan),
          fungsiRuas: normalizeString(payload.fungsiRuas),
          fungsi_ruas: normalizeString(payload.fungsiRuas),
          zona,
          grup: group,
          group,
          tiang: normalizeString(payload.tiang),
          lenganArm: normalizeString(payload.lenganArm),
          lengan_arm: normalizeString(payload.lenganArm),
          armAgExs: normalizeString(payload.armAgExs),
          arm_ag_exs: normalizeString(payload.armAgExs),
          presetIluminasi: normalizeString(payload.presetIluminasi),
          preset_iluminasi: normalizeString(payload.presetIluminasi),
          presetIluminasiAwal: normalizeString(payload.presetIluminasiAwal),
          preset_iluminasi_awal: normalizeString(payload.presetIluminasiAwal),
          presetIluminasiBatas: normalizeString(payload.presetIluminasiBatas),
          preset_iluminasi_batas: normalizeString(payload.presetIluminasiBatas),
          instalasi: normalizeString(payload.instalasi),
          keteranganTitik: normalizeString(payload.keteranganTitik),
          keterangan_titik: normalizeString(payload.keteranganTitik),
          sourceTaskId: taskId,
          stage: "comissioning",
          tahap: "comissioning",
          status: "valid",
          kontruksiStatus: "valid",
          source: "om_manual_test",
          isOmTestData: true,
          latitude,
          longitude,
          createdAt: existingRaw.createdAt || now,
          updatedAt: now,
          validatedAt: normalizeString(payload.validatedAt) || normalizeString(existingRaw.validatedAt) || now,
        }
      : testPointPayload(now);
    const { error } = await supabase.from("kontruksi_valid").upsert(
      {
        fb_doc_id: existing?.fb_doc_id || docId,
        source_submission_id: existing?.fb_doc_id || docId,
        source_task_id: taskId,
        submitted_by_id: "om-manual-test",
        submitted_by_name: "O&M Manual Test",
        nama_titik: namaTitik,
        id_titik: idTitik,
        zona: group,
        stage: "comissioning",
        status: "valid",
        latitude,
        longitude,
        raw_payload: rawPayload,
        created_at: existingRaw.createdAt || now,
        updated_at: now,
        validated_at: rawPayload.validatedAt,
      },
      { onConflict: "fb_doc_id" }
    );
    if (error) throw new Error(error.message);
    return NextResponse.json({ idTitik, message: payload ? "Data test APJ O&M berhasil disimpan." : "Data test APJ berhasil dibuat." });
}

export async function DELETE(request: NextRequest) {
  try {
    const idTitik = normalizeString(request.nextUrl.searchParams.get("idTitik"));
    const supabase = getSupabaseAdminClient() as any;
    let query = supabase.from("kontruksi_valid").delete();
    if (idTitik) query = query.eq("id_titik", idTitik).contains("raw_payload", { isOmTestData: true });
    else query = query.eq("fb_doc_id", TEST_DOC_ID).eq("source_task_id", TEST_TASK_ID);
    const { error } = await query;
    if (error) throw new Error(error.message);
    return NextResponse.json({ idTitik: idTitik || TEST_POINT_ID, message: "Data test APJ berhasil dihapus." });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal menghapus data test APJ." }, { status: 500 });
  }
}
