import { mapBmdAssetRow, mapMaterialRow, normalizeString } from "@/lib/bmdGudang";

export type AssetOwnership = "Perusahaan" | "Pemerintah";

export type ApjComponentAsset = {
  id: string;
  nomorSeri: string;
  nama: string;
  kategori: string;
  kepemilikan: AssetOwnership;
  lokasi: string;
  kondisi?: string;
  status?: string;
  detail: Record<string, unknown>;
  source: "gudang" | "bmd";
};

function sameSerial(value: unknown, serial: string) {
  return normalizeString(value).toLowerCase() === serial.trim().toLowerCase();
}

export async function findApjComponentAsset(
  supabase: any,
  serial: string,
  ownership: AssetOwnership
): Promise<ApjComponentAsset | null> {
  const normalizedSerial = serial.trim();
  if (!normalizedSerial) return null;

  if (ownership === "Pemerintah") {
    const { data, error } = await supabase.from("bmd_assets").select("*").limit(1000);
    if (error) throw new Error(error.message);
    const row = (Array.isArray(data) ? data : []).find((item: Record<string, unknown>) => {
      const raw = item.raw_payload && typeof item.raw_payload === "object" ? item.raw_payload as Record<string, unknown> : {};
      return sameSerial(item.nomor_register, normalizedSerial)
        || sameSerial(raw.nomorSeri, normalizedSerial)
        || sameSerial(raw.no_seri, normalizedSerial);
    }) as Record<string, unknown> | undefined;
    if (!row) return null;
    const asset = mapBmdAssetRow(row);
    return {
      id: asset.id,
      nomorSeri: asset.nomorSeri || asset.nomorRegister,
      nama: asset.namaAset,
      kategori: asset.kategori,
      kepemilikan: "Pemerintah",
      lokasi: asset.lokasi,
      kondisi: asset.kondisi,
      status: asset.status,
      detail: {
        asalTitikApj: asset.asalTitikApj || "-",
        tanggalPelepasan: asset.tanggalPelepasan || "-",
        alasanPelepasan: asset.alasanPelepasan || "-",
        dokumenPelepasan: asset.dokumenPelepasan || "-",
      },
      source: "bmd",
    };
  }

  const { data, error } = await supabase.from("mst_gudang_material").select("*").limit(1000);
  if (error) throw new Error(error.message);
  const row = (Array.isArray(data) ? data : []).find((item: Record<string, unknown>) => {
    const raw = item.raw_payload && typeof item.raw_payload === "object" ? item.raw_payload as Record<string, unknown> : {};
    return sameSerial(item.kode_barang, normalizedSerial)
      || sameSerial(raw.nomorSeri, normalizedSerial)
      || sameSerial(raw.no_seri, normalizedSerial);
  }) as Record<string, unknown> | undefined;
  if (!row) return null;
  const material = mapMaterialRow(row);
  return {
    id: material.id,
    nomorSeri: material.nomorSeri || material.kodeBarang,
    nama: material.namaBarang,
    kategori: material.kategori,
    kepemilikan: "Perusahaan",
    lokasi: material.lokasiGudang,
    status: material.stokTersedia > 0 ? "Tersedia" : "Terpasang/Habis",
    detail: material.detail as unknown as Record<string, unknown>,
    source: "gudang",
  };
}

export async function resolvePointComponentAssets(supabase: any, raw: Record<string, unknown>) {
  const definitions = [
    ["tiangArm", raw.noSeriTiangArm || raw.no_seri_tiang_arm, raw.kepemilikanTiangArm],
    ["lampu1", raw.noSeriLampu1 || raw.no_seri_lampu_1, raw.kepemilikanLampu1],
    ["lampu2", raw.noSeriLampu2 || raw.no_seri_lampu_2, raw.kepemilikanLampu2],
  ] as const;

  const entries = await Promise.all(definitions.map(async ([key, serialValue, ownershipValue]) => {
    const serial = normalizeString(serialValue);
    const ownership: AssetOwnership = normalizeString(ownershipValue) === "Pemerintah" ? "Pemerintah" : "Perusahaan";
    if (!serial) return [key, null] as const;
    try {
      return [key, await findApjComponentAsset(supabase, serial, ownership)] as const;
    } catch {
      // Detail titik tetap harus bisa dibuka saat master Gudang/BMD belum dimigrasikan.
      return [key, null] as const;
    }
  }));
  return Object.fromEntries(entries);
}

export async function setCompanyAssetInstallation(supabase: any, serial: string, pointId: string | null) {
  const asset = await findApjComponentAsset(supabase, serial, "Perusahaan");
  if (!asset) return;
  const { data, error } = await supabase
    .from("mst_gudang_material")
    .select("raw_payload")
    .eq("fb_doc_id", asset.id)
    .limit(1);
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return;
  const raw = row.raw_payload && typeof row.raw_payload === "object" ? row.raw_payload as Record<string, unknown> : {};
  const currentPointId = normalizeString(raw.installedPointId);
  if (pointId && currentPointId && currentPointId !== pointId) {
    throw new Error(`Unit ${serial} sudah terpasang di titik ${currentPointId}.`);
  }
  const now = new Date().toISOString();
  const nextStatus = pointId ? "Terpasang" : "Tersedia";
  const { error: updateError } = await supabase
    .from("mst_gudang_material")
    .update({
      raw_payload: {
        ...raw,
        statusUnit: nextStatus,
        installedPointId: pointId || "",
        installedAt: pointId ? now : "",
        updatedAt: now,
      },
      updated_at: now,
    })
    .eq("fb_doc_id", asset.id);
  if (updateError) throw new Error(updateError.message);
}

export async function loadCompanyLampPowerMap(supabase: any) {
  const { data, error } = await supabase.from("mst_gudang_material").select("kode_barang, kategori, raw_payload").eq("kategori", "LAMPU").limit(5000);
  if (error) throw new Error(error.message);
  const powers = new Map<string, string>();
  for (const row of Array.isArray(data) ? data as Record<string, unknown>[] : []) {
    const raw = row.raw_payload && typeof row.raw_payload === "object" ? row.raw_payload as Record<string, unknown> : {};
    const detail = raw.detail && typeof raw.detail === "object" ? raw.detail as Record<string, unknown> : {};
    const power = normalizeString(detail.dayaWatt) || normalizeString(raw.dayaWatt);
    if (!power) continue;
    for (const serial of [normalizeString(raw.nomorSeri), normalizeString(row.kode_barang)]) {
      if (serial && serial !== "-") powers.set(serial.toLowerCase(), power);
    }
  }
  return powers;
}

export function resolveRawPointLampPower(raw: Record<string, unknown>, powers: Map<string, string>) {
  for (const value of [raw.noSeriLampu1, raw.no_seri_lampu_1, raw.noSeriLampu2, raw.no_seri_lampu_2]) {
    const serial = normalizeString(value);
    if (!serial || serial === "-") continue;
    const power = powers.get(serial.toLowerCase());
    if (power) return power;
  }
  return "";
}
