export type MaterialCategory = "TIANG" | "LAMPU" | "ARM";
export type InventoryTransactionType = "MASUK" | "KELUAR" | "MUTASI" | "RETUR" | "BOOKED";
export type BmdCondition = "Baik" | "Rusak Ringan" | "Rusak Berat";
export type BmdStatus = "Di Gudang" | "Dipinjam" | "Dihapuskan";

export type TiangDetail = {
  tinggiMeter: string;
  jenisTiang: string;
  tipeTanam: string;
};

export type LampuDetail = {
  dayaWatt: string;
  jenisLed: string;
  merk: string;
  lumen: string;
};

export type ArmDetail = {
  panjangMeter: string;
  diameterInch: string;
  sudutKemiringan: string;
};

export type MaterialBase = {
  id: string;
  kodeBarang: string;
  namaBarang: string;
  kategori: MaterialCategory;
  stokTersedia: number;
  stokMinimum: number;
  lokasiGudang: string;
  fotoLabel: string;
};

export type MaterialItem =
  | (MaterialBase & { kategori: "TIANG"; detail: TiangDetail })
  | (MaterialBase & { kategori: "LAMPU"; detail: LampuDetail })
  | (MaterialBase & { kategori: "ARM"; detail: ArmDetail });

export type InventoryTransaction = {
  id: string;
  materialId: string;
  materialName: string;
  type: InventoryTransactionType;
  jumlah: number;
  referensi: string;
  sourceModule: "Gudang" | "Konstruksi" | "O&M";
  status: "Draft" | "Booked" | "Posted";
  timeLabel: string;
};

export type MaterialRequest = {
  id: string;
  materialId: string;
  materialName: string;
  quantity: number;
  requestType: "Pengajuan Barang" | "Peminjaman BMD";
  requesterName: string;
  requesterId?: string;
  note: string;
  status: "Diajukan" | "Diproses" | "Disetujui" | "Ditolak";
  locationHint: string;
  timeLabel: string;
};

export type BmdAsset = {
  id: string;
  nomorRegister: string;
  namaAset: string;
  kategori: string;
  kondisi: BmdCondition;
  status: BmdStatus;
  lokasi: string;
  peminjam: string;
  estimasiKembali: string;
};

export function createDocId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseFloat(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

export function createDefaultMaterialDetail(category: MaterialCategory) {
  if (category === "TIANG") {
    return {
      tinggiMeter: "",
      jenisTiang: "",
      tipeTanam: "",
    };
  }

  if (category === "LAMPU") {
    return {
      dayaWatt: "",
      jenisLed: "",
      merk: "",
      lumen: "",
    };
  }

  return {
    panjangMeter: "",
    diameterInch: "",
    sudutKemiringan: "",
  };
}

export function formatTimeLabel(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function mapMaterialRow(row: Record<string, unknown>): MaterialItem {
  const raw = (row.raw_payload as Record<string, unknown> | null) || {};
  const kategori = (normalizeString(row.kategori) || normalizeString(raw.kategori) || "LAMPU") as MaterialCategory;
  const base: MaterialBase = {
    id: String(row.fb_doc_id || row.id || raw.id || ""),
    kodeBarang: normalizeString(row.kode_barang) || normalizeString(raw.kodeBarang),
    namaBarang: normalizeString(row.nama_barang) || normalizeString(raw.namaBarang),
    kategori,
    stokTersedia: normalizeNumber(row.stok_tersedia ?? raw.stokTersedia, 0),
    stokMinimum: normalizeNumber(row.stok_minimum ?? raw.stokMinimum, 0),
    lokasiGudang: normalizeString(row.lokasi_gudang) || normalizeString(raw.lokasiGudang),
    fotoLabel: normalizeString(row.foto_label) || normalizeString(raw.fotoLabel) || kategori,
  };

  const detail = (raw.detail as Record<string, unknown> | undefined) || {};
  if (kategori === "TIANG") {
    return {
      ...base,
      kategori,
      detail: {
        tinggiMeter: normalizeString(detail.tinggiMeter),
        jenisTiang: normalizeString(detail.jenisTiang),
        tipeTanam: normalizeString(detail.tipeTanam),
      },
    };
  }
  if (kategori === "LAMPU") {
    return {
      ...base,
      kategori,
      detail: {
        dayaWatt: normalizeString(detail.dayaWatt),
        jenisLed: normalizeString(detail.jenisLed),
        merk: normalizeString(detail.merk),
        lumen: normalizeString(detail.lumen),
      },
    };
  }
  return {
    ...base,
    kategori,
    detail: {
      panjangMeter: normalizeString(detail.panjangMeter),
      diameterInch: normalizeString(detail.diameterInch),
      sudutKemiringan: normalizeString(detail.sudutKemiringan),
    },
  };
}

export function mapTransactionRow(row: Record<string, unknown>): InventoryTransaction {
  const raw = (row.raw_payload as Record<string, unknown> | null) || {};
  return {
    id: String(row.fb_doc_id || row.id || raw.id || ""),
    materialId: normalizeString(row.material_id) || normalizeString(raw.materialId),
    materialName: normalizeString(row.material_name) || normalizeString(raw.materialName),
    type: (normalizeString(row.tipe_transaksi) || normalizeString(raw.type) || "MASUK") as InventoryTransactionType,
    jumlah: normalizeNumber(row.jumlah ?? raw.jumlah, 0),
    referensi: normalizeString(row.id_referensi) || normalizeString(raw.referensi),
    sourceModule: (normalizeString(row.source_module) || normalizeString(raw.sourceModule) || "Gudang") as InventoryTransaction["sourceModule"],
    status: (normalizeString(row.status) || normalizeString(raw.status) || "Posted") as InventoryTransaction["status"],
    timeLabel: formatTimeLabel(normalizeString(row.created_at) || normalizeString(raw.createdAt)),
  };
}

export function mapRequestRow(row: Record<string, unknown>): MaterialRequest {
  const raw = (row.raw_payload as Record<string, unknown> | null) || {};
  return {
    id: String(row.fb_doc_id || row.id || raw.id || ""),
    materialId: normalizeString(row.material_id) || normalizeString(raw.materialId),
    materialName: normalizeString(row.material_name) || normalizeString(raw.materialName),
    quantity: normalizeNumber(row.quantity ?? raw.quantity, 1),
    requestType: (normalizeString(row.request_type) || normalizeString(raw.requestType) || "Pengajuan Barang") as MaterialRequest["requestType"],
    requesterName: normalizeString(row.requester_name) || normalizeString(raw.requesterName),
    requesterId: normalizeString(row.requester_id) || normalizeString(raw.requesterId),
    note: normalizeString(row.note) || normalizeString(raw.note),
    status: (normalizeString(row.status) || normalizeString(raw.status) || "Diajukan") as MaterialRequest["status"],
    locationHint: normalizeString(row.location_hint) || normalizeString(raw.locationHint),
    timeLabel: formatTimeLabel(normalizeString(row.created_at) || normalizeString(raw.createdAt)),
  };
}

export function mapBmdAssetRow(row: Record<string, unknown>): BmdAsset {
  const raw = (row.raw_payload as Record<string, unknown> | null) || {};
  return {
    id: String(row.fb_doc_id || row.id || raw.id || ""),
    nomorRegister: normalizeString(row.nomor_register) || normalizeString(raw.nomorRegister),
    namaAset: normalizeString(row.nama_aset) || normalizeString(raw.namaAset),
    kategori: normalizeString(row.kategori) || normalizeString(raw.kategori),
    kondisi: (normalizeString(row.kondisi) || normalizeString(raw.kondisi) || "Baik") as BmdCondition,
    status: (normalizeString(row.status_keberadaan) || normalizeString(raw.status) || "Di Gudang") as BmdStatus,
    lokasi: normalizeString(row.lokasi) || normalizeString(raw.lokasi),
    peminjam: normalizeString(row.peminjam) || normalizeString(raw.peminjam) || "-",
    estimasiKembali: normalizeString(row.estimasi_kembali) || normalizeString(raw.estimasiKembali) || "-",
  };
}
