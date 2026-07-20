import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { findApjComponentAsset, resolvePointComponentAssets, setCompanyAssetInstallation } from "@/lib/apjComponentAsset";

function normalizeRecord(record: Record<string, unknown>) {
  const rawPayload = record.raw_payload && typeof record.raw_payload === "object" ? (record.raw_payload as Record<string, unknown>) : {};
  return {
    id: String(record.fb_doc_id || ""),
    idTitik: String(record.id_titik || rawPayload.id_titik || rawPayload.idTitik || ""),
    namaTitik: String(record.nama_titik || rawPayload.nama_titik || rawPayload.namaTitik || ""),
    namaJalan: String(record.nama_jalan || rawPayload.nama_jalan || rawPayload.namaJalan || "-"),
    kabupaten: String(record.kabupaten || rawPayload.kabupaten || "-"),
    dayaLampu: String(record.daya_lampu || rawPayload.daya_lampu || rawPayload.dayaLampu || "-"),
    surveyorName: String(record.surveyor_name || rawPayload.surveyor_name || rawPayload.surveyorName || "-"),
    latitude: typeof record.latitude === "number" ? record.latitude : Number(record.latitude || rawPayload.latitude || 0),
    longitude: typeof record.longitude === "number" ? record.longitude : Number(record.longitude || rawPayload.longitude || 0),
    createdAt: String(record.created_at || rawPayload.createdAt || ""),
    source: String(record.source || "survey_apj_propose"),
    group: String(record.zona || rawPayload.grup || rawPayload.group || rawPayload.zona || ""),
    status: String(record.status || rawPayload.status || rawPayload.kontruksiStatus || ""),
    stage: String(record.stage || rawPayload.stage || rawPayload.tahap || ""),
    rawPayload,
  };
}

function isCommissioningStage(record: Record<string, unknown>) {
  const rawPayload = record.raw_payload && typeof record.raw_payload === "object" ? (record.raw_payload as Record<string, unknown>) : {};
  const stage = String(record.stage || rawPayload.stage || rawPayload.tahap || rawPayload.type || "").toLowerCase();
  return stage.includes("comission") || stage.includes("commission");
}

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const titikId = decodeURIComponent(id || "").trim();

    if (!titikId) {
      return NextResponse.json({ error: "ID titik wajib diisi." }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();

    const { data: constructionData, error: constructionError } = await supabase
      .from("kontruksi_valid")
      .select("*")
      .eq("id_titik", titikId)
      .order("validated_at", { ascending: false })
      .limit(20);

    if (constructionError) {
      throw new Error(constructionError.message);
    }

    const constructionRows = (Array.isArray(constructionData) ? (constructionData as Record<string, unknown>[]) : [])
      .filter(isCommissioningStage)
      .map((row) => ({ ...row, source: "kontruksi_valid" }));

    if (constructionRows.length > 0) {
      const normalizedRows = constructionRows.map(normalizeRecord);
      const componentAssets = await resolvePointComponentAssets(supabase, normalizedRows[0].rawPayload);
      const linkedPower = normalizeString(componentAssets.lampu1?.detail?.dayaWatt)
        || normalizeString(componentAssets.lampu2?.detail?.dayaWatt);
      return NextResponse.json({
        latest: { ...normalizedRows[0], dayaLampu: linkedPower || normalizedRows[0].dayaLampu, componentAssets },
        history: normalizedRows,
        source: "kontruksi_valid:comissioning",
      });
    }

    const { data, error } = await supabase
      .from("survey_apj_propose")
      .select("*")
      .eq("id_titik", titikId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      throw new Error(error.message);
    }

    const rows = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
    if (rows.length === 0) {
      return NextResponse.json({ error: "Data titik APJ tidak ditemukan." }, { status: 404 });
    }

    const normalizedRows = rows.map(normalizeRecord);
    const componentAssets = await resolvePointComponentAssets(supabase, normalizedRows[0].rawPayload);
    const linkedPower = normalizeString(componentAssets.lampu1?.detail?.dayaWatt)
      || normalizeString(componentAssets.lampu2?.detail?.dayaWatt);
    return NextResponse.json({
      latest: { ...normalizedRows[0], dayaLampu: linkedPower || normalizedRows[0].dayaLampu, componentAssets },
      history: normalizedRows,
      source: "survey_apj_propose",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memuat detail titik APJ." },
      { status: 500 }
    );
  }
}

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

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const titikId = decodeURIComponent(id || "").trim();
    const payload = (await request.json()) as Record<string, unknown>;
    if (!titikId) return NextResponse.json({ error: "ID titik wajib diisi." }, { status: 400 });

    const supabase = getSupabaseAdminClient() as any;
    const { data, error } = await supabase
      .from("kontruksi_valid")
      .select("*")
      .eq("id_titik", titikId)
      .order("validated_at", { ascending: false })
      .limit(1);
    if (error) throw new Error(error.message);
    const row = Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) : undefined;
    if (!row) return NextResponse.json({ error: "Data APJ O&M tidak ditemukan." }, { status: 404 });

    const rawPayload = row.raw_payload && typeof row.raw_payload === "object" ? (row.raw_payload as Record<string, unknown>) : {};
    const now = new Date().toISOString();
    const namaTitik = normalizeString(payload.namaTitik) || normalizeString(row.nama_titik) || titikId;
    const group = normalizeString(payload.group) || normalizeString(row.zona) || normalizeString(rawPayload.grup) || "Tanpa Grup";
    const latitude = normalizeNumber(payload.latitude);
    const longitude = normalizeNumber(payload.longitude);
    const lampSerial = normalizeString(payload.noSeriLampu1) || normalizeString(payload.noSeriLampu2);
    const lampOwnership = normalizeString(payload.noSeriLampu1)
      ? (normalizeString(payload.kepemilikanLampu1) === "Pemerintah" ? "Pemerintah" : "Perusahaan")
      : (normalizeString(payload.kepemilikanLampu2) === "Pemerintah" ? "Pemerintah" : "Perusahaan");
    const linkedLamp = lampSerial ? await findApjComponentAsset(supabase, lampSerial, lampOwnership) : null;
    const linkedLampPower = normalizeString(linkedLamp?.detail?.dayaWatt);
    const dayaLampu = linkedLampPower || (lampSerial ? "" : normalizeString(payload.dayaLampu) || normalizeString(rawPayload.dayaLampu));
    const nextRawPayload = {
      ...rawPayload,
      idTitik: titikId,
      namaTitik,
      nama_titik: namaTitik,
      namaJalan: normalizeString(payload.namaJalan) || normalizeString(rawPayload.namaJalan),
      nama_jalan: normalizeString(payload.namaJalan) || normalizeString(rawPayload.nama_jalan),
      kabupaten: normalizeString(payload.kabupaten) || normalizeString(rawPayload.kabupaten),
      kecamatan: normalizeString(payload.kecamatan),
      dayaLampu,
      daya_lampu: dayaLampu,
      noSeriTiangArm: normalizeString(payload.noSeriTiangArm),
      no_seri_tiang_arm: normalizeString(payload.noSeriTiangArm),
      kepemilikanTiangArm: normalizeString(payload.kepemilikanTiangArm) === "Pemerintah" ? "Pemerintah" : "Perusahaan",
      noSeriLampu1: normalizeString(payload.noSeriLampu1),
      no_seri_lampu_1: normalizeString(payload.noSeriLampu1),
      kepemilikanLampu1: normalizeString(payload.kepemilikanLampu1) === "Pemerintah" ? "Pemerintah" : "Perusahaan",
      noSeriLampu2: normalizeString(payload.noSeriLampu2),
      no_seri_lampu_2: normalizeString(payload.noSeriLampu2),
      kepemilikanLampu2: normalizeString(payload.kepemilikanLampu2) === "Pemerintah" ? "Pemerintah" : "Perusahaan",
      lebarJalan: normalizeString(payload.lebarJalan),
      lebar_jalan: normalizeString(payload.lebarJalan),
      fungsiRuas: normalizeString(payload.fungsiRuas),
      fungsi_ruas: normalizeString(payload.fungsiRuas),
      zona: normalizeString(payload.zona),
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
      latitude: latitude ?? row.latitude ?? rawPayload.latitude,
      longitude: longitude ?? row.longitude ?? rawPayload.longitude,
      updatedAt: now,
    };

    const { error: updateError } = await supabase
      .from("kontruksi_valid")
      .update({
        nama_titik: namaTitik,
        daya_lampu: dayaLampu,
        zona: group,
        latitude: latitude ?? row.latitude,
        longitude: longitude ?? row.longitude,
        raw_payload: nextRawPayload,
        updated_at: now,
      })
      .eq("fb_doc_id", row.fb_doc_id);
    if (updateError) throw new Error(updateError.message);

    const links = [
      ["noSeriTiangArm", "kepemilikanTiangArm"],
      ["noSeriLampu1", "kepemilikanLampu1"],
      ["noSeriLampu2", "kepemilikanLampu2"],
    ] as const;
    for (const [serialKey, ownershipKey] of links) {
      const oldSerial = normalizeString(rawPayload[serialKey]);
      const oldOwnership = normalizeString(rawPayload[ownershipKey]) === "Pemerintah" ? "Pemerintah" : "Perusahaan";
      const newSerial = normalizeString(nextRawPayload[serialKey]);
      const newOwnership = normalizeString(nextRawPayload[ownershipKey]) === "Pemerintah" ? "Pemerintah" : "Perusahaan";
      if (oldSerial && oldOwnership === "Perusahaan" && (oldSerial !== newSerial || newOwnership !== "Perusahaan")) {
        await setCompanyAssetInstallation(supabase, oldSerial, null);
      }
      if (newSerial && newOwnership === "Perusahaan") {
        await setCompanyAssetInstallation(supabase, newSerial, titikId);
      }
    }
    return NextResponse.json({ idTitik: titikId, message: "Data APJ berhasil diperbarui." });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal memperbarui data APJ." }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const titikId = decodeURIComponent(id || "").trim();
    if (!titikId) return NextResponse.json({ error: "ID titik wajib diisi." }, { status: 400 });

    const supabase = getSupabaseAdminClient() as any;
    const { data, error } = await supabase
      .from("kontruksi_valid")
      .select("fb_doc_id, raw_payload")
      .eq("id_titik", titikId)
      .order("validated_at", { ascending: false })
      .limit(1);
    if (error) throw new Error(error.message);
    const row = Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) : undefined;
    if (!row) return NextResponse.json({ error: "Data APJ O&M tidak ditemukan." }, { status: 404 });

    const rawPayload = row.raw_payload && typeof row.raw_payload === "object" ? (row.raw_payload as Record<string, unknown>) : {};
    const isOmTestData = Boolean(rawPayload.isOmTestData || rawPayload.isTestData || rawPayload.source === "om_manual_test");
    if (!isOmTestData) {
      return NextResponse.json({ error: "Data konstruksi asli tidak boleh dihapus dari fitur test O&M." }, { status: 403 });
    }

    const { error: deleteError } = await supabase.from("kontruksi_valid").delete().eq("fb_doc_id", row.fb_doc_id);
    if (deleteError) throw new Error(deleteError.message);
    return NextResponse.json({ idTitik: titikId, message: "Data test APJ O&M berhasil dihapus." });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal menghapus data APJ." }, { status: 500 });
  }
}
