"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { getActiveKabupatenFromStorage, setActiveKabupatenToStorage } from "@/utils/helpers";
import { KABUPATEN_OPTIONS } from "@/utils/constants";

type MaterialCategory = "TIANG" | "LAMPU" | "ARM" | "KABEL";
type InventoryTransactionType = "MASUK" | "KELUAR" | "MUTASI" | "RETUR" | "BOOKED";
type BmdCondition = "Baik" | "Rusak Ringan" | "Rusak Berat";
type BmdStatus = "Di Gudang" | "Dipinjam" | "Dihapuskan";

type MaterialBase = {
  id: string;
  kodeBarang: string;
  namaBarang: string;
  kategori: MaterialCategory;
  stokTersedia: number;
  stokMinimum: number;
  lokasiGudang: string;
  fotoLabel: string;
  fotoUrl?: string;
  nomorSeri?: string;
  kepemilikan: "Perusahaan";
  statusUnit: "Tersedia" | "Terpasang" | "Dilepas";
  installedPointId?: string;
};

type TiangDetail = {
  tinggiMeter: string;
  jenisTiang: string;
  tipeTanam: string;
};

type LampuDetail = {
  dayaWatt: string;
  jenisLed: string;
  merk: string;
  lumen: string;
};

type ArmDetail = {
  panjangMeter: string;
  diameterInch: string;
  sudutKemiringan: string;
};

type KabelDetail = {
  jenisKabel: string;
  ukuranKabel: string;
  panjangRoll: string;
};

type MaterialItem =
  | (MaterialBase & { kategori: "TIANG"; detail: TiangDetail })
  | (MaterialBase & { kategori: "LAMPU"; detail: LampuDetail })
  | (MaterialBase & { kategori: "ARM"; detail: ArmDetail })
  | (MaterialBase & { kategori: "KABEL"; detail: KabelDetail });

type InventoryTransaction = {
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

type MaterialRequest = {
  id: string;
  materialId: string;
  materialName: string;
  quantity: number;
  requestType: "Pengajuan Barang" | "Peminjaman BMD";
  requesterName: string;
  requesterId?: string;
  note: string;
  status: "Diajukan" | "Diproses" | "Disetujui" | "Dikeluarkan" | "Selesai" | "Ditolak";
  locationHint: string;
  timeLabel: string;
  workType?: string;
  sourceModule?: "Gudang" | "Konstruksi" | "O&M";
  auditTrail?: Array<{
    status: string;
    actorId: string;
    actorName: string;
    note: string;
    at: string;
  }>;
};

type BmdAsset = {
  id: string;
  nomorRegister: string;
  namaAset: string;
  kategori: string;
  kondisi: BmdCondition;
  status: BmdStatus;
  lokasi: string;
  peminjam: string;
  estimasiKembali: string;
  fotoUrl?: string;
  nomorSeri?: string;
  kepemilikan: "Pemerintah";
  asalTitikApj?: string;
  tanggalPelepasan?: string;
  alasanPelepasan?: string;
  dokumenPelepasan?: string;
};

const INITIAL_MATERIALS: MaterialItem[] = [];
const INITIAL_TRANSACTIONS: InventoryTransaction[] = [];
const INITIAL_BMD_ASSETS: BmdAsset[] = [];
const INITIAL_REQUESTS: MaterialRequest[] = [];
const MATERIAL_CATEGORY_ORDER: MaterialCategory[] = ["LAMPU", "TIANG", "ARM", "KABEL"];
const MATERIAL_CATEGORY_LABEL: Record<MaterialCategory, string> = {
  LAMPU: "Lampu",
  TIANG: "Tiang",
  ARM: "Arm",
  KABEL: "Kabel",
};
const WORK_TYPE_OPTIONS: Array<{
  value: string;
  label: string;
  sourceModule: "Konstruksi" | "O&M";
  allowedCategories: MaterialCategory[];
}> = [
  {
    value: "konstruksi-pemasangan-tiang",
    label: "Konstruksi - Pemasangan Tiang",
    sourceModule: "Konstruksi",
    allowedCategories: ["TIANG", "ARM", "LAMPU"],
  },
  {
    value: "konstruksi-pemasangan-kabel",
    label: "Konstruksi - Pemasangan Kabel",
    sourceModule: "Konstruksi",
    allowedCategories: ["KABEL"],
  },
  {
    value: "om-preventive",
    label: "O&M Preventive",
    sourceModule: "O&M",
    allowedCategories: ["LAMPU", "ARM", "KABEL"],
  },
  {
    value: "om-corrective",
    label: "O&M Corrective",
    sourceModule: "O&M",
    allowedCategories: ["TIANG", "LAMPU", "ARM", "KABEL"],
  },
];

function getWorkTypeOption(value: string) {
  return WORK_TYPE_OPTIONS.find((option) => option.value === value) || WORK_TYPE_OPTIONS[0];
}

function createDefaultMaterialDetail(category: MaterialCategory) {
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

  if (category === "KABEL") {
    return {
      jenisKabel: "",
      ukuranKabel: "",
      panjangRoll: "",
    };
  }

  return {
    panjangMeter: "",
    diameterInch: "",
    sudutKemiringan: "",
  };
}

function getCategoryAccent(category: MaterialCategory) {
  if (category === "TIANG") {
    return {
      badge: "bg-slate-100 text-slate-700 border-slate-200",
      chip: "from-slate-700 via-slate-800 to-zinc-900",
      surface: "from-slate-50 to-slate-100",
    };
  }

  if (category === "LAMPU") {
    return {
      badge: "bg-amber-100 text-amber-800 border-amber-200",
      chip: "from-amber-400 via-orange-400 to-rose-500",
      surface: "from-amber-50 to-orange-50",
    };
  }

  if (category === "KABEL") {
    return {
      badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
      chip: "from-emerald-500 via-teal-500 to-cyan-600",
      surface: "from-emerald-50 to-teal-50",
    };
  }

  return {
    badge: "bg-sky-100 text-sky-700 border-sky-200",
    chip: "from-sky-500 via-cyan-500 to-blue-600",
    surface: "from-sky-50 to-cyan-50",
  };
}

function getStockTone(stock: number, minimum: number) {
  if (stock <= minimum) return "text-rose-600";
  if (stock <= minimum + 5) return "text-amber-600";
  return "text-emerald-600";
}

function getTransactionTone(type: InventoryTransactionType) {
  if (type === "MASUK" || type === "RETUR") return "bg-emerald-50 text-emerald-700 border-emerald-100";
  if (type === "BOOKED") return "bg-amber-50 text-amber-700 border-amber-100";
  if (type === "MUTASI") return "bg-sky-50 text-sky-700 border-sky-100";
  return "bg-rose-50 text-rose-700 border-rose-100";
}

function getBmdStatusTone(status: BmdStatus) {
  if (status === "Di Gudang") return "bg-emerald-50 text-emerald-700 border-emerald-100";
  if (status === "Dipinjam") return "bg-amber-50 text-amber-700 border-amber-100";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function getConditionTone(condition: BmdCondition) {
  if (condition === "Baik") return "text-emerald-600";
  if (condition === "Rusak Ringan") return "text-amber-600";
  return "text-rose-600";
}

function StockMetricCard({
  label,
  value,
  note,
  accent,
}: {
  label: string;
  value: string;
  note: string;
  accent: string;
}) {
  return (
    <div className="rounded-[26px] border border-white/80 bg-white/88 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur">
      <div className={`inline-flex rounded-full bg-gradient-to-r px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-white ${accent}`}>
        {label}
      </div>
      <div className="mt-4 text-3xl font-bold text-slate-900">{value}</div>
      <div className="mt-2 text-sm leading-6 text-slate-600">{note}</div>
    </div>
  );
}

function PatchButton({
  active,
  label,
  note,
  onClick,
}: {
  active: boolean;
  label: string;
  note: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-[24px] border px-4 py-4 text-left transition ${
        active ? "border-slate-900 bg-slate-900 text-white shadow-lg" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
      }`}
    >
      <div className="text-sm font-semibold">{label}</div>
      <div className={`mt-1 text-xs leading-5 ${active ? "text-slate-200" : "text-slate-500"}`}>{note}</div>
    </button>
  );
}

function DetailField({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-4 py-3">
      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-900">{String(value || "-")}</div>
    </div>
  );
}

function MaterialDetailSummary({ item }: { item: MaterialItem }) {
  if (item.kategori === "TIANG") {
    return (
      <div className="flex flex-wrap gap-2 text-xs text-slate-600">
        <span className="rounded-full bg-white px-3 py-1">{item.detail.tinggiMeter}</span>
        <span className="rounded-full bg-white px-3 py-1">{item.detail.jenisTiang}</span>
        <span className="rounded-full bg-white px-3 py-1">{item.detail.tipeTanam}</span>
      </div>
    );
  }

  if (item.kategori === "LAMPU") {
    return (
      <div className="flex flex-wrap gap-2 text-xs text-slate-600">
        <span className="rounded-full bg-white px-3 py-1">{item.detail.dayaWatt}</span>
        <span className="rounded-full bg-white px-3 py-1">{item.detail.jenisLed}</span>
        <span className="rounded-full bg-white px-3 py-1">{item.detail.lumen}</span>
      </div>
    );
  }

  if (item.kategori === "KABEL") {
    return (
      <div className="flex flex-wrap gap-2 text-xs text-slate-600">
        <span className="rounded-full bg-white px-3 py-1">{item.detail.jenisKabel}</span>
        <span className="rounded-full bg-white px-3 py-1">{item.detail.ukuranKabel}</span>
        <span className="rounded-full bg-white px-3 py-1">{item.detail.panjangRoll}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2 text-xs text-slate-600">
      <span className="rounded-full bg-white px-3 py-1">{item.detail.panjangMeter}</span>
      <span className="rounded-full bg-white px-3 py-1">{item.detail.diameterInch}</span>
      <span className="rounded-full bg-white px-3 py-1">{item.detail.sudutKemiringan}</span>
    </div>
  );
}

function MaterialCard({
  item,
  active,
  onClick,
  compactCategoryLabel,
}: {
  item: MaterialItem;
  active: boolean;
  onClick: () => void;
  compactCategoryLabel?: string;
}) {
  const accent = getCategoryAccent(item.kategori);

  return (
    <button
      onClick={onClick}
      className={`w-full rounded-[28px] border p-4 text-left transition-all ${active ? "border-slate-900 bg-slate-50 shadow-md" : "border-slate-200 bg-white hover:border-slate-300"}`}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4">
          {item.fotoUrl ? (
            <div className="h-16 w-16 rounded-3xl bg-cover bg-center shadow-sm" style={{ backgroundImage: `url("${item.fotoUrl}")` }} />
          ) : (
            <div className={`flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br ${accent.surface} text-base font-bold text-slate-700 shadow-sm`}>
              {item.fotoLabel}
            </div>
          )}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${accent.badge}`}>
                {compactCategoryLabel || item.kategori}
              </span>
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{item.kodeBarang}</span>
            </div>
            <div className="mt-2 text-lg font-bold text-slate-900">{item.namaBarang}</div>
            <div className="mt-2">
              <MaterialDetailSummary item={item} />
            </div>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Status Unit</div>
            <div className={`mt-1 text-sm font-bold ${item.statusUnit === "Terpasang" ? "text-sky-700" : "text-emerald-700"}`}>{item.statusUnit}</div>
          </div>
          <DetailField label="ID Unit" value={item.nomorSeri || item.kodeBarang} />
          <DetailField label="Lokasi" value={item.installedPointId ? `Titik ${item.installedPointId}` : item.lokasiGudang} />
        </div>
      </div>
    </button>
  );
}

function BmdAssetCard({
  asset,
  active,
  onClick,
}: {
  asset: BmdAsset;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-[28px] border p-4 text-left transition-all ${active ? "border-slate-900 bg-slate-50 shadow-md" : "border-slate-200 bg-white hover:border-slate-300"}`}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4">
          {asset.fotoUrl ? (
            <div className="h-16 w-16 shrink-0 rounded-3xl bg-cover bg-center shadow-sm" style={{ backgroundImage: `url("${asset.fotoUrl}")` }} />
          ) : null}
          <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${getBmdStatusTone(asset.status)}`}>
              {asset.status}
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{asset.nomorRegister}</span>
          </div>
          <div className="mt-2 text-lg font-bold text-slate-900">{asset.namaAset}</div>
          <div className="mt-1 text-sm text-slate-600">{asset.kategori}</div>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Kondisi</div>
            <div className={`mt-1 text-sm font-semibold ${getConditionTone(asset.kondisi)}`}>{asset.kondisi}</div>
          </div>
          <DetailField label="Lokasi" value={asset.lokasi} />
          <DetailField label="Peminjam" value={asset.peminjam} />
        </div>
      </div>
    </button>
  );
}

export default function BmdGudangDashboard({ adminMode = false }: { adminMode?: boolean }) {
  const router = useRouter();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super-admin";
  const [activeKabupaten, setActiveKabupaten] = useState("tabanan");
  const [activeTab, setActiveTab] = useState<"gudang" | "bmd">("gudang");
  const [activeGudangPatch, setActiveGudangPatch] = useState<"tambah" | "database" | "operasional" | "antrian">(
    adminMode ? "database" : "operasional"
  );
  const [activeBmdPatch, setActiveBmdPatch] = useState<"tambah" | "database" | "operasional" | "alur">(
    "database"
  );
  const [materials, setMaterials] = useState<MaterialItem[]>(INITIAL_MATERIALS);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>(INITIAL_TRANSACTIONS);
  const [bmdAssets, setBmdAssets] = useState<BmdAsset[]>(INITIAL_BMD_ASSETS);
  const [requests, setRequests] = useState<MaterialRequest[]>(INITIAL_REQUESTS);
  const [loadingData, setLoadingData] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const [loadError, setLoadError] = useState<string>("");
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>(INITIAL_MATERIALS[0]?.id || "");
  const [selectedBmdId, setSelectedBmdId] = useState<string>(INITIAL_BMD_ASSETS[0]?.id || "");
  const [logQuantity, setLogQuantity] = useState<string>("1");
  const [logReference, setLogReference] = useState<string>("WO-KTR-021");
  const [loanBorrower, setLoanBorrower] = useState<string>("Tim Konstruksi Zona Timur");
  const [loanPurpose, setLoanPurpose] = useState<string>("Pemakaian sementara untuk inspeksi lapangan");
  const [materialCategoryDraft, setMaterialCategoryDraft] = useState<MaterialCategory>("LAMPU");
  const [materialCodeDraft, setMaterialCodeDraft] = useState<string>("");
  const [materialSerialDraft, setMaterialSerialDraft] = useState<string>("");
  const [materialNameDraft, setMaterialNameDraft] = useState<string>("");
  const [materialPhotoLabelDraft, setMaterialPhotoLabelDraft] = useState<string>("");
  const [materialPhotoFile, setMaterialPhotoFile] = useState<File | null>(null);
  const [materialLocationDraft, setMaterialLocationDraft] = useState<string>("Gudang Utama");
  const [materialStockDraft, setMaterialStockDraft] = useState<string>("0");
  const [materialMinimumDraft, setMaterialMinimumDraft] = useState<string>("0");
  const [materialDetailDraft, setMaterialDetailDraft] = useState<TiangDetail | LampuDetail | ArmDetail | KabelDetail>(createDefaultMaterialDetail("LAMPU"));
  const [requestQuantity, setRequestQuantity] = useState<string>("1");
  const [requestNote, setRequestNote] = useState<string>("");
  const [requestWorkType, setRequestWorkType] = useState<string>(WORK_TYPE_OPTIONS[0].value);
  const [bmdRegisterDraft, setBmdRegisterDraft] = useState<string>("");
  const [bmdSerialDraft, setBmdSerialDraft] = useState<string>("");
  const [bmdOriginPointDraft, setBmdOriginPointDraft] = useState<string>("");
  const [bmdReleaseDateDraft, setBmdReleaseDateDraft] = useState<string>("");
  const [bmdReleaseReasonDraft, setBmdReleaseReasonDraft] = useState<string>("");
  const [bmdReleaseDocumentDraft, setBmdReleaseDocumentDraft] = useState<string>("");
  const [bmdNameDraft, setBmdNameDraft] = useState<string>("");
  const [bmdCategoryDraft, setBmdCategoryDraft] = useState<string>("Perangkat Lapangan");
  const [bmdLocationDraft, setBmdLocationDraft] = useState<string>("Rak BMD A-01");
  const [bmdConditionDraft, setBmdConditionDraft] = useState<BmdCondition>("Baik");
  const [bmdPhotoFile, setBmdPhotoFile] = useState<File | null>(null);

  useEffect(() => {
    if (!user) return;
    const nextKabupaten = isSuperAdmin
      ? getActiveKabupatenFromStorage(user.uid || "") || "tabanan"
      : user.kabupaten?.trim().toLowerCase() || "tabanan";
    setActiveKabupaten(nextKabupaten);
    setActiveKabupatenToStorage(user.uid || "", nextKabupaten);
  }, [isSuperAdmin, user]);

  const handleKabupatenChange = (kabupaten: string) => {
    if (!isSuperAdmin || !user) return;
    setActiveKabupaten(kabupaten);
    setActiveKabupatenToStorage(user.uid || "", kabupaten);
  };

  const totalItems = materials.length;
  const lampuReady = materials.filter((item) => item.kategori === "LAMPU" && item.statusUnit === "Tersedia").length;
  const tiangReady = materials.filter((item) => item.kategori === "TIANG" && item.statusUnit === "Tersedia").length;
  const installedUnits = materials.filter((item) => item.statusUnit === "Terpasang").length;
  const totalBmd = bmdAssets.length;
  const borrowedBmd = bmdAssets.filter((asset) => asset.status === "Dipinjam").length;
  const damagedBmd = bmdAssets.filter((asset) => asset.kondisi !== "Baik").length;
  const totalRequests = requests.length;

  const selectedMaterial = materials.find((item) => item.id === selectedMaterialId) || materials[0] || null;
  const selectedBmdAsset = bmdAssets.find((item) => item.id === selectedBmdId) || bmdAssets[0] || null;
  const selectedWorkType = getWorkTypeOption(requestWorkType);
  const selectedMaterialAllowed = selectedMaterial ? selectedWorkType.allowedCategories.includes(selectedMaterial.kategori) : false;
  const groupedMaterials = MATERIAL_CATEGORY_ORDER.map((category) => ({
    category,
    label: MATERIAL_CATEGORY_LABEL[category],
    items: materials.filter((item) => item.kategori === category),
  }));
  const groupedBmdAssets = Object.entries(
    bmdAssets.reduce<Record<string, BmdAsset[]>>((accumulator, asset) => {
      const key = asset.kategori || "Tanpa Kategori";
      if (!accumulator[key]) accumulator[key] = [];
      accumulator[key].push(asset);
      return accumulator;
    }, {})
  );

  const endpoint = adminMode ? "/api/admin/bmd-gudang" : "/api/bmd-gudang";

  const fetchJson = useCallback(async (url: string, init?: RequestInit) => {
    const response = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string; items?: unknown[] };
    if (!response.ok) {
      const apiError = payload.error || "Permintaan ke server gagal.";
      if (apiError.includes("mst_gudang_material") && apiError.toLowerCase().includes("schema cache")) {
        throw new Error("Database Gudang belum disiapkan. Jalankan scripts/bmd-gudang-schema.sql satu kali di SQL Editor Supabase.");
      }
      throw new Error(apiError);
    }
    return payload;
  }, []);

  const uploadGudangPhoto = async (file: File, folder: string) => {
    const body = new FormData();
    body.append("file", file);
    body.append("folder", folder);
    body.append("filename", file.name);
    const response = await fetch("/api/storage/survey-attachments", {
      method: "POST",
      body,
    });
    const payload = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
    if (!response.ok || !payload.url) {
      throw new Error(payload.error || "Gagal mengunggah foto.");
    }
    return payload.url;
  };

  const loadDashboardData = useCallback(async () => {
    try {
      setLoadingData(true);
      setLoadError("");
      const requestParams = !adminMode && user?.uid ? `&requesterId=${encodeURIComponent(user.uid)}` : "";
      const [materialsPayload, bmdPayload, requestsPayload, transactionsPayload] = await Promise.all([
        fetchJson(`${endpoint}?resource=materials`),
        fetchJson(`${endpoint}?resource=bmd-assets`),
        fetchJson(`${endpoint}?resource=requests${requestParams}`),
        adminMode ? fetchJson(`${endpoint}?resource=transactions`) : Promise.resolve({ items: [] }),
      ]);

      setMaterials(Array.isArray(materialsPayload.items) ? (materialsPayload.items as MaterialItem[]) : []);
      setBmdAssets(Array.isArray(bmdPayload.items) ? (bmdPayload.items as BmdAsset[]) : []);
      setRequests(Array.isArray(requestsPayload.items) ? (requestsPayload.items as MaterialRequest[]) : []);
      setTransactions(Array.isArray(transactionsPayload.items) ? (transactionsPayload.items as InventoryTransaction[]) : []);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Gagal memuat modul BMD & Gudang.");
    } finally {
      setLoadingData(false);
    }
  }, [adminMode, endpoint, fetchJson, user?.uid]);

  useEffect(() => {
    if (!user) return;
    void loadDashboardData();
  }, [user, loadDashboardData]);

  useEffect(() => {
    if (materials.length === 0) {
      setSelectedMaterialId("");
      return;
    }
    if (!materials.some((item) => item.id === selectedMaterialId)) {
      setSelectedMaterialId(materials[0].id);
    }
  }, [materials, selectedMaterialId]);

  useEffect(() => {
    if (bmdAssets.length === 0) {
      setSelectedBmdId("");
      return;
    }
    if (!bmdAssets.some((item) => item.id === selectedBmdId)) {
      setSelectedBmdId(bmdAssets[0].id);
    }
  }, [bmdAssets, selectedBmdId]);

  const handleMaterialCategoryChange = (category: MaterialCategory) => {
    setMaterialCategoryDraft(category);
    setMaterialDetailDraft(createDefaultMaterialDetail(category));
  };

  const handleMaterialDetailChange = (key: string, value: string) => {
    setMaterialDetailDraft((previous) => ({ ...previous, [key]: value }));
  };

  const handleCreateMaterial = async () => {
    if (!materialCodeDraft.trim() || !materialSerialDraft.trim() || !materialNameDraft.trim()) {
      setLoadError("Kode barang, nomor seri/ID unit, dan nama barang wajib diisi.");
      return;
    }
    try {
      setActionBusy(true);
      const fotoUrl = materialPhotoFile
        ? await uploadGudangPhoto(materialPhotoFile, `bmd-gudang/materials/${materialCodeDraft.trim() || "material"}`)
        : "";
      await fetchJson(endpoint, {
        method: "POST",
        body: JSON.stringify({
          action: "create-material",
          kodeBarang: materialCodeDraft.trim(),
          nomorSeri: materialSerialDraft.trim(),
          kepemilikan: "Perusahaan",
          namaBarang: materialNameDraft.trim(),
          kategori: materialCategoryDraft,
          stokTersedia: 1,
          stokMinimum: 0,
          lokasiGudang: materialLocationDraft.trim() || "Gudang Utama",
          fotoLabel: materialPhotoLabelDraft.trim() || materialCategoryDraft,
          fotoUrl,
          detail: materialDetailDraft,
        }),
      });
      setMaterialCodeDraft("");
      setMaterialSerialDraft("");
      setMaterialNameDraft("");
      setMaterialPhotoLabelDraft("");
      setMaterialPhotoFile(null);
      setMaterialLocationDraft("Gudang Utama");
      setMaterialStockDraft("0");
      setMaterialMinimumDraft("0");
      setMaterialDetailDraft(createDefaultMaterialDetail(materialCategoryDraft));
      await loadDashboardData();
    } finally {
      setActionBusy(false);
    }
  };

  const handleCreateBmdAsset = async () => {
    if (!bmdRegisterDraft.trim() || !bmdNameDraft.trim()) return;
    try {
      setActionBusy(true);
      const fotoUrl = bmdPhotoFile
        ? await uploadGudangPhoto(bmdPhotoFile, `bmd-gudang/assets/${bmdRegisterDraft.trim() || "asset"}`)
        : "";
      await fetchJson(endpoint, {
        method: "POST",
        body: JSON.stringify({
          action: "create-bmd-asset",
          nomorRegister: bmdRegisterDraft.trim(),
          nomorSeri: bmdSerialDraft.trim() || bmdRegisterDraft.trim(),
          kepemilikan: "Pemerintah",
          asalTitikApj: bmdOriginPointDraft.trim(),
          tanggalPelepasan: bmdReleaseDateDraft,
          alasanPelepasan: bmdReleaseReasonDraft.trim(),
          dokumenPelepasan: bmdReleaseDocumentDraft.trim(),
          namaAset: bmdNameDraft.trim(),
          kategori: bmdCategoryDraft.trim() || "Aset BMD",
          kondisi: bmdConditionDraft,
          status: "Di Gudang",
          lokasi: bmdLocationDraft.trim() || "Rak BMD A-01",
          peminjam: "-",
          estimasiKembali: "-",
          fotoUrl,
        }),
      });
      setBmdRegisterDraft("");
      setBmdSerialDraft("");
      setBmdOriginPointDraft("");
      setBmdReleaseDateDraft("");
      setBmdReleaseReasonDraft("");
      setBmdReleaseDocumentDraft("");
      setBmdNameDraft("");
      setBmdCategoryDraft("Perangkat Lapangan");
      setBmdLocationDraft("Rak BMD A-01");
      setBmdConditionDraft("Baik");
      setBmdPhotoFile(null);
      await loadDashboardData();
    } finally {
      setActionBusy(false);
    }
  };

  const handleSubmitMaterialRequest = async () => {
    if (!selectedMaterial) return;
    if (!selectedMaterialAllowed) {
      setLoadError(`Barang kategori ${MATERIAL_CATEGORY_LABEL[selectedMaterial.kategori]} tidak cocok untuk ${selectedWorkType.label}.`);
      return;
    }
    const qty = 1;
    try {
      setActionBusy(true);
      setLoadError("");
      await fetchJson(endpoint, {
        method: "POST",
        body: JSON.stringify({
          action: "create-request",
          requestType: "Pengajuan Barang",
          materialId: selectedMaterial.id,
          materialName: selectedMaterial.namaBarang,
          quantity: qty,
          requesterId: user?.uid || "",
          requesterName: user?.displayName || user?.email || "Petugas",
          note: requestNote.trim() || "Tanpa catatan tambahan",
          locationHint: selectedMaterial.lokasiGudang,
          workType: selectedWorkType.value,
          sourceModule: selectedWorkType.sourceModule,
          allowedCategories: selectedWorkType.allowedCategories,
        }),
      });
      setRequestQuantity("1");
      setRequestNote("");
      await loadDashboardData();
    } finally {
      setActionBusy(false);
    }
  };

  const handleSubmitBmdRequest = async () => {
    if (!selectedBmdAsset) return;
    try {
      setActionBusy(true);
      await fetchJson(endpoint, {
        method: "POST",
        body: JSON.stringify({
          action: "create-request",
          requestType: "Peminjaman BMD",
          materialId: selectedBmdAsset.id,
          materialName: selectedBmdAsset.namaAset,
          quantity: 1,
          requesterId: user?.uid || "",
          requesterName: user?.displayName || user?.email || "Petugas",
          note: requestNote.trim() || loanPurpose.trim() || "Tanpa catatan tambahan",
          locationHint: selectedBmdAsset.lokasi,
        }),
      });
      setRequestNote("");
      await loadDashboardData();
    } finally {
      setActionBusy(false);
    }
  };

  const handleAddStock = async () => {
    const qty = 1;
    if (!selectedMaterial) return;
    try {
      setActionBusy(true);
      await fetchJson(endpoint, {
        method: "POST",
        body: JSON.stringify({
          action: "create-transaction",
          materialId: selectedMaterial.id,
          materialName: selectedMaterial.namaBarang,
          type: "MASUK",
          jumlah: qty,
          referensi: logReference || "ADJ-MASUK",
          sourceModule: "Gudang",
          status: "Posted",
        }),
      });
      await loadDashboardData();
    } finally {
      setActionBusy(false);
    }
  };

  const handleBookMaterial = async () => {
    const qty = 1;
    if (!selectedMaterial) return;
    try {
      setActionBusy(true);
      await fetchJson(endpoint, {
        method: "POST",
        body: JSON.stringify({
          action: "create-transaction",
          materialId: selectedMaterial.id,
          materialName: selectedMaterial.namaBarang,
          type: "BOOKED",
          jumlah: qty,
          referensi: logReference || "WO-DRAFT",
          sourceModule: "Konstruksi",
          status: "Booked",
        }),
      });
      await loadDashboardData();
    } finally {
      setActionBusy(false);
    }
  };

  const handleCheckoutMaterial = async () => {
    const qty = 1;
    if (!selectedMaterial) return;
    try {
      setActionBusy(true);
      await fetchJson(endpoint, {
        method: "POST",
        body: JSON.stringify({
          action: "create-transaction",
          materialId: selectedMaterial.id,
          materialName: selectedMaterial.namaBarang,
          type: "KELUAR",
          jumlah: qty,
          referensi: logReference || "WO-KELUAR",
          sourceModule: "Konstruksi",
          status: "Posted",
        }),
      });
      await loadDashboardData();
    } finally {
      setActionBusy(false);
    }
  };

  const handleLoanBmd = async () => {
    if (!selectedBmdAsset) return;
    try {
      setActionBusy(true);
      await fetchJson(endpoint, {
        method: "POST",
        body: JSON.stringify({
          action: "update-bmd-status",
          assetId: selectedBmdAsset.id,
          status: "Dipinjam",
          lokasi: loanPurpose || "Dipakai sementara",
          peminjam: loanBorrower || "Unit Internal",
          estimasiKembali: "30 Mei 2026",
        }),
      });
      await loadDashboardData();
    } finally {
      setActionBusy(false);
    }
  };

  const handleReturnBmd = async () => {
    if (!selectedBmdAsset) return;
    try {
      setActionBusy(true);
      await fetchJson(endpoint, {
        method: "POST",
        body: JSON.stringify({
          action: "update-bmd-status",
          assetId: selectedBmdAsset.id,
          status: "Di Gudang",
          lokasi: "Rak BMD A-01",
          peminjam: "-",
          estimasiKembali: "-",
        }),
      });
      await loadDashboardData();
    } finally {
      setActionBusy(false);
    }
  };

  const handleUpdateRequestStatus = async (requestId: string, status: MaterialRequest["status"]) => {
    try {
      setActionBusy(true);
      await fetchJson(endpoint, {
        method: "POST",
        body: JSON.stringify({
          action: "update-request-status",
          requestId,
          status,
          actorId: user?.uid || "",
          actorName: user?.displayName || user?.email || "Admin Gudang",
          note: `Status diubah menjadi ${status}`,
        }),
      });
      await loadDashboardData();
    } finally {
      setActionBusy(false);
    }
  };

  const handleCheckoutApprovedRequest = async (request: MaterialRequest) => {
    if (request.status !== "Disetujui") return;
    try {
      setActionBusy(true);
      if (request.requestType === "Peminjaman BMD") {
        await fetchJson(endpoint, {
          method: "POST",
          body: JSON.stringify({
            action: "update-bmd-status",
            assetId: request.materialId,
            status: "Dipinjam",
            lokasi: request.note || "Dipakai peminjam",
            peminjam: request.requesterName || "Peminjam",
            estimasiKembali: "-",
          }),
        });
      } else {
        await fetchJson(endpoint, {
          method: "POST",
          body: JSON.stringify({
            action: "create-transaction",
            materialId: request.materialId,
            materialName: request.materialName,
            type: "KELUAR",
            jumlah: request.quantity,
            referensi: request.id,
            sourceModule: "Konstruksi",
            status: "Posted",
          }),
        });
      }
      await fetchJson(endpoint, {
        method: "POST",
        body: JSON.stringify({
          action: "update-request-status",
          requestId: request.id,
          status: "Dikeluarkan",
          actorId: user?.uid || "",
          actorName: user?.displayName || user?.email || "Admin Gudang",
          note: request.requestType === "Peminjaman BMD" ? "Aset BMD sudah dicatat dipinjam." : "Barang sudah dicatat keluar dari gudang.",
        }),
      });
      await loadDashboardData();
    } finally {
      setActionBusy(false);
    }
  };

  const handleReturnApprovedBmdRequest = async (request: MaterialRequest) => {
    if (request.requestType !== "Peminjaman BMD" || request.status !== "Dikeluarkan") return;
    try {
      setActionBusy(true);
      await fetchJson(endpoint, {
        method: "POST",
        body: JSON.stringify({
          action: "update-bmd-status",
          assetId: request.materialId,
          status: "Di Gudang",
          lokasi: request.locationHint || "Rak BMD A-01",
          peminjam: "-",
          estimasiKembali: "-",
        }),
      });
      await fetchJson(endpoint, {
        method: "POST",
        body: JSON.stringify({
          action: "update-request-status",
          requestId: request.id,
          status: "Selesai",
          actorId: user?.uid || "",
          actorName: user?.displayName || user?.email || "Admin Gudang",
          note: "Aset BMD sudah dikembalikan dan diterima gudang.",
        }),
      });
      await loadDashboardData();
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.18),_transparent_24%),radial-gradient(circle_at_right,_rgba(59,130,246,0.12),_transparent_28%),linear-gradient(180deg,_#fffdf8_0%,_#ffffff_48%,_#f8fbff_100%)] pb-24 text-slate-900 lg:pb-10">
      <div className="mx-auto w-full max-w-7xl px-4 pb-8 pt-4 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between rounded-[28px] border border-white/75 bg-white/82 px-4 py-3 shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur md:px-6">
          <button
            onClick={() => router.push(adminMode ? "/admin/module-selection" : "/module-selection")}
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition-all hover:-translate-x-0.5 hover:shadow-md"
            aria-label="Kembali"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>

          <div className="text-center">
            <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-amber-500 sm:text-xs">
              {adminMode ? "Admin Dashboard" : "Dashboard Operasional"}
            </div>
            <div className="text-base font-bold text-slate-900 sm:text-xl">BMD & Gudang Project</div>
          </div>

          <div className="relative h-11 w-11 sm:h-12 sm:w-12">
            <Image src="/BDG1.png" alt="Logo" fill className="object-contain" />
          </div>
        </header>

        <section className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="relative overflow-hidden rounded-[32px] bg-[linear-gradient(135deg,_#0f172a_0%,_#1d4ed8_45%,_#f59e0b_100%)] px-5 py-6 text-white shadow-[0_24px_70px_rgba(15,23,42,0.2)] sm:px-7 sm:py-8">
            <div className="absolute -right-10 top-0 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute bottom-0 right-10 h-28 w-28 rounded-full bg-amber-200/20 blur-2xl" />
            <div className="relative max-w-2xl">
              <div className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-50">
                Split Dashboard
              </div>
              <h1 className="mt-4 text-2xl font-bold leading-tight sm:text-3xl lg:text-4xl">
                Pisahkan barang perusahaan di Gudang dari barang pemerintah yang sudah dilepas ke BMD.
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-100 sm:text-base">
                Gudang perusahaan mencatat setiap barang sebagai satu unit ber-ID unik, lengkap dengan lokasi pemasangannya.
                BMD difokuskan ke register, asal titik, kondisi, dan dokumen pelepasan barang pemerintah.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <div className="min-w-[160px] rounded-2xl border border-white/12 bg-white/10 px-4 py-3 backdrop-blur">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-300">Akun Aktif</div>
                  <div className="mt-1 text-sm font-semibold text-white sm:text-base">{user?.displayName || user?.email || "Petugas"}</div>
                </div>
                <div className="min-w-[160px] rounded-2xl border border-white/12 bg-white/10 px-4 py-3 backdrop-blur">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-300">Mode</div>
                  <div className="mt-1 text-sm font-semibold text-white sm:text-base">{adminMode ? "Kontrol Admin" : "Operasional Lapangan"}</div>
                </div>
                <div className="min-w-[160px] rounded-2xl border border-white/12 bg-white/10 px-4 py-3 backdrop-blur">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-300">Hak Akses</div>
                  <div className="mt-1 text-sm font-semibold text-white sm:text-base">{adminMode ? "Full akses data & transaksi" : "Lihat stok & ajukan kebutuhan"}</div>
                </div>
                <div className="min-w-[160px] rounded-2xl border border-white/12 bg-white/10 px-4 py-3 backdrop-blur">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-300">Kabupaten</div>
                  {isSuperAdmin ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {KABUPATEN_OPTIONS.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleKabupatenChange(item.id)}
                          className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                            activeKabupaten === item.id
                              ? "bg-white text-slate-950 shadow-sm"
                              : "bg-white/10 text-white hover:bg-white/20"
                          }`}
                        >
                          {item.name}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <>
                      <div className="mt-1 text-sm font-semibold text-white sm:text-base">{activeKabupaten}</div>
                      <div className="mt-1 text-[11px] text-slate-200">Terkunci dari akun</div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-[28px] border border-amber-100 bg-white/90 p-5 shadow-[0_18px_45px_rgba(251,191,36,0.12)] backdrop-blur">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-500">Aturan Inti</div>
              <div className="mt-2 text-xl font-bold text-slate-900">Aset vs. Stok</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Barang Gudang adalah milik perusahaan. BMD dicatat per unit khusus barang pemerintah yang dilepas dan disimpan.
              </p>
            </div>
            <div className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Akses Cepat</div>
              <div className="mt-2 text-lg font-bold text-slate-900">Tab Operasional</div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <button onClick={() => setActiveTab("gudang")} className={`rounded-2xl px-3 py-3 text-left ${activeTab === "gudang" ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-600"}`}>
                  <div className="font-semibold">Gudang Material</div>
                  <div className="mt-1 text-xs opacity-80">Inventaris per ID unit</div>
                </button>
                <button onClick={() => setActiveTab("bmd")} className={`rounded-2xl px-3 py-3 text-left ${activeTab === "bmd" ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-600"}`}>
                  <div className="font-semibold">Manajemen BMD</div>
                  <div className="mt-1 text-xs opacity-80">Aset formal</div>
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {activeTab === "gudang" ? (
            <>
              <StockMetricCard label="Total Unit" value={String(totalItems)} note="Dihitung satu per ID barang unik." accent="from-slate-700 to-slate-900" />
              <StockMetricCard label="Lampu Tersedia" value={String(lampuReady)} note="Unit lampu yang belum terpasang." accent="from-amber-400 to-orange-500" />
              <StockMetricCard label="Tiang Tersedia" value={String(tiangReady)} note="Unit tiang yang belum terpasang." accent="from-sky-500 to-blue-600" />
              <StockMetricCard label={adminMode ? "Unit Terpasang" : "Pengajuan Saya"} value={String(adminMode ? installedUnits : totalRequests)} note={adminMode ? "Unit yang sudah terhubung ke titik APJ." : "Jumlah pengajuan yang sudah Anda buat."} accent="from-rose-500 to-red-600" />
            </>
          ) : (
            <>
              <StockMetricCard label="Total Aset BMD" value={String(totalBmd)} note="Jumlah aset tercatat pada register." accent="from-slate-700 to-slate-900" />
              <StockMetricCard label="Barang Pemerintah" value={String(totalBmd)} note="Terpisah dari barang milik perusahaan." accent="from-amber-400 to-orange-500" />
              <StockMetricCard label="Aset Rusak" value={String(damagedBmd)} note="Butuh tindak lanjut perawatan." accent="from-rose-500 to-red-600" />
              <StockMetricCard label="Tersimpan" value={String(totalBmd - borrowedBmd)} note="Barang pemerintah yang tersimpan pada register BMD." accent="from-emerald-500 to-teal-600" />
            </>
          )}
        </section>

        {loadError ? <div className="mt-6 rounded-[24px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">{loadError}</div> : null}
        {loadingData ? <div className="mt-6 rounded-[24px] border border-slate-200 bg-white/90 px-5 py-5 text-sm text-slate-600 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">Memuat data BMD & Gudang dari Supabase...</div> : null}

        {activeTab === "gudang" ? (
          <>
            <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {adminMode ? <PatchButton active={activeGudangPatch === "tambah"} label="Patch Tambah Data" note="Form khusus input master barang." onClick={() => setActiveGudangPatch("tambah")} /> : null}
              <PatchButton active={activeGudangPatch === "database"} label="Patch Database Barang" note="Barang dibagi per jenis: Lampu, Tiang, Arm, Kabel." onClick={() => setActiveGudangPatch("database")} />
              <PatchButton active={activeGudangPatch === "operasional"} label={adminMode ? "Patch Operasional" : "Patch Pengajuan"} note={adminMode ? "Tambah stok, booking, dan log keluar." : "Ajukan kebutuhan barang ke admin."} onClick={() => setActiveGudangPatch("operasional")} />
              <PatchButton active={activeGudangPatch === "antrian"} label={adminMode ? "Patch Antrian" : "Patch Riwayat"} note={adminMode ? "Approve dan tindak lanjuti pengajuan." : "Lihat riwayat pengajuan barang."} onClick={() => setActiveGudangPatch("antrian")} />
            </section>

            {adminMode && activeGudangPatch === "tambah" ? (
              <section className="mt-6 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-[30px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_20px_45px_rgba(15,23,42,0.08)]">
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Patch Gudang</div>
                  <h2 className="mt-1 text-2xl font-bold text-slate-900">Tambah Data Barang</h2>
                  <div className="mt-2 text-sm leading-6 text-slate-600">Master ini khusus barang milik perusahaan. Nomor seri/kode barang dapat dihubungkan ke komponen pada titik APJ.</div>
                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    <label className="text-sm font-semibold text-slate-700">
                      Kategori
                      <select value={materialCategoryDraft} onChange={(event) => handleMaterialCategoryChange(event.target.value as MaterialCategory)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400">
                        <option value="LAMPU">Lampu</option>
                        <option value="TIANG">Tiang</option>
                        <option value="ARM">Arm</option>
                        <option value="KABEL">Kabel</option>
                      </select>
                    </label>
                    <label className="text-sm font-semibold text-slate-700">
                      Kode Barang
                      <input value={materialCodeDraft} onChange={(event) => setMaterialCodeDraft(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400" placeholder="BRG-LAMPU-001" />
                    </label>
                    <label className="text-sm font-semibold text-slate-700">
                      Nomor Seri / ID Unit *
                      <input required value={materialSerialDraft} onChange={(event) => setMaterialSerialDraft(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400" placeholder="SN-LMP-0001" />
                    </label>
                    <label className="text-sm font-semibold text-slate-700">
                      Nama Barang
                      <input value={materialNameDraft} onChange={(event) => setMaterialNameDraft(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400" placeholder="Lampu LED Jalan 90 Watt" />
                    </label>
                    <label className="text-sm font-semibold text-slate-700">
                      Label Foto/Icon
                      <input value={materialPhotoLabelDraft} onChange={(event) => setMaterialPhotoLabelDraft(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400" placeholder="90W / 9M / 1.5M" />
                    </label>
                    <label className="text-sm font-semibold text-slate-700">
                      Foto Barang
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(event) => setMaterialPhotoFile(event.target.files?.[0] || null)}
                        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                      />
                      <span className="mt-1 block text-xs font-normal text-slate-500">{materialPhotoFile?.name || "Opsional, akan tampil sebagai foto asli barang."}</span>
                    </label>
                    <label className="text-sm font-semibold text-slate-700">
                      Lokasi Gudang
                      <input value={materialLocationDraft} onChange={(event) => setMaterialLocationDraft(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400" placeholder="Gudang Utama" />
                    </label>
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                      Otomatis dihitung sebagai <b>1 unit</b>. Setiap barang dibuat satu per satu menggunakan ID unik.
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    {materialCategoryDraft === "TIANG" ? (
                      <>
                        <label className="text-sm font-semibold text-slate-700">
                          Tinggi Meter
                          <input value={(materialDetailDraft as TiangDetail).tinggiMeter} onChange={(event) => handleMaterialDetailChange("tinggiMeter", event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400" placeholder="9 m" />
                        </label>
                        <label className="text-sm font-semibold text-slate-700">
                          Jenis Tiang
                          <input value={(materialDetailDraft as TiangDetail).jenisTiang} onChange={(event) => handleMaterialDetailChange("jenisTiang", event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400" placeholder="Hexagonal" />
                        </label>
                        <label className="text-sm font-semibold text-slate-700">
                          Tipe Tanam
                          <input value={(materialDetailDraft as TiangDetail).tipeTanam} onChange={(event) => handleMaterialDetailChange("tipeTanam", event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400" placeholder="Baseplate" />
                        </label>
                      </>
                    ) : null}
                    {materialCategoryDraft === "LAMPU" ? (
                      <>
                        <label className="text-sm font-semibold text-slate-700">
                          Daya Watt
                          <input value={(materialDetailDraft as LampuDetail).dayaWatt} onChange={(event) => handleMaterialDetailChange("dayaWatt", event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400" placeholder="90 W" />
                        </label>
                        <label className="text-sm font-semibold text-slate-700">
                          Jenis LED
                          <input value={(materialDetailDraft as LampuDetail).jenisLed} onChange={(event) => handleMaterialDetailChange("jenisLed", event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400" placeholder="LED SMD" />
                        </label>
                        <label className="text-sm font-semibold text-slate-700">
                          Merk / Lumen
                          <input
                            value={`${(materialDetailDraft as LampuDetail).merk}${(materialDetailDraft as LampuDetail).lumen ? " | " : ""}${(materialDetailDraft as LampuDetail).lumen}`}
                            onChange={(event) => {
                              const [merk, lumen] = event.target.value.split("|").map((part) => part.trim());
                              handleMaterialDetailChange("merk", merk || "");
                              handleMaterialDetailChange("lumen", lumen || "");
                            }}
                            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400"
                            placeholder="Philips | 13500 lm"
                          />
                        </label>
                      </>
                    ) : null}
                    {materialCategoryDraft === "ARM" ? (
                      <>
                        <label className="text-sm font-semibold text-slate-700">
                          Panjang Meter
                          <input value={(materialDetailDraft as ArmDetail).panjangMeter} onChange={(event) => handleMaterialDetailChange("panjangMeter", event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400" placeholder="1.5 m" />
                        </label>
                        <label className="text-sm font-semibold text-slate-700">
                          Diameter Inch
                          <input value={(materialDetailDraft as ArmDetail).diameterInch} onChange={(event) => handleMaterialDetailChange("diameterInch", event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400" placeholder='2"' />
                        </label>
                        <label className="text-sm font-semibold text-slate-700">
                          Sudut Kemiringan
                          <input value={(materialDetailDraft as ArmDetail).sudutKemiringan} onChange={(event) => handleMaterialDetailChange("sudutKemiringan", event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400" placeholder="15 derajat" />
                        </label>
                      </>
                    ) : null}
                    {materialCategoryDraft === "KABEL" ? (
                      <>
                        <label className="text-sm font-semibold text-slate-700">
                          Jenis Kabel
                          <input value={(materialDetailDraft as KabelDetail).jenisKabel} onChange={(event) => handleMaterialDetailChange("jenisKabel", event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400" placeholder="NYY / NYM / Twisted" />
                        </label>
                        <label className="text-sm font-semibold text-slate-700">
                          Ukuran Kabel
                          <input value={(materialDetailDraft as KabelDetail).ukuranKabel} onChange={(event) => handleMaterialDetailChange("ukuranKabel", event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400" placeholder="2x2.5 mm" />
                        </label>
                        <label className="text-sm font-semibold text-slate-700">
                          Panjang Roll
                          <input value={(materialDetailDraft as KabelDetail).panjangRoll} onChange={(event) => handleMaterialDetailChange("panjangRoll", event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400" placeholder="100 m" />
                        </label>
                      </>
                    ) : null}
                  </div>
                  <button onClick={handleCreateMaterial} disabled={actionBusy} className="mt-5 rounded-2xl bg-gradient-to-r from-slate-800 to-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:shadow-lg">
                    Tambah Barang ke Master Gudang
                  </button>
                </div>
                <div className="rounded-[30px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_20px_45px_rgba(15,23,42,0.08)]">
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Ringkasan Patch</div>
                  <div className="mt-1 text-xl font-bold text-slate-900">Distribusi Database Barang</div>
                  <div className="mt-4 space-y-3">
                    {groupedMaterials.map((group) => (
                      <div key={group.category} className="rounded-[24px] border border-slate-100 bg-slate-50 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-slate-900">{group.label}</div>
                            <div className="mt-1 text-xs text-slate-500">Patch database khusus jenis {group.label.toLowerCase()}.</div>
                          </div>
                          <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">{group.items.length} item</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            ) : null}

            {activeGudangPatch === "database" ? (
              <section className="mt-6 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
                <div className="space-y-5">
                  {groupedMaterials.map((group) => (
                    <div key={group.category} className="rounded-[30px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_20px_45px_rgba(15,23,42,0.08)]">
                      <div className="mb-4 flex items-end justify-between gap-4">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Patch Database Barang</div>
                          <h2 className="mt-1 text-2xl font-bold text-slate-900">{group.label}</h2>
                        </div>
                        <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600">{group.items.length} barang</div>
                      </div>
                      <div className="space-y-4">
                        {group.items.length === 0 ? <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-5 text-sm leading-6 text-slate-600">Belum ada data pada patch {group.label.toLowerCase()}.</div> : null}
                        {group.items.map((item) => (
                          <MaterialCard key={item.id} item={item} active={item.id === selectedMaterialId} onClick={() => setSelectedMaterialId(item.id)} compactCategoryLabel={group.label} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="rounded-[30px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_20px_45px_rgba(15,23,42,0.08)]">
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Detail Barang</div>
                  <h2 className="mt-1 text-xl font-bold text-slate-900">Data Lengkap Per Barang</h2>
                  {selectedMaterial ? (
                    <>
                      <div className="mt-4 rounded-[24px] bg-slate-50 p-4">
                        <div className="text-sm font-semibold text-slate-900">{selectedMaterial.namaBarang}</div>
                        <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">{selectedMaterial.kodeBarang} • {MATERIAL_CATEGORY_LABEL[selectedMaterial.kategori]}</div>
                      </div>
                      <div className="mt-4 grid gap-3">
                        <DetailField label="Nomor Seri / ID Unit" value={selectedMaterial.nomorSeri || selectedMaterial.kodeBarang} />
                        <DetailField label="Status Unit" value={selectedMaterial.statusUnit} />
                        <DetailField label="Terpasang di Titik" value={selectedMaterial.installedPointId || "-"} />
                        <DetailField label="Lokasi" value={selectedMaterial.installedPointId ? `Titik APJ ${selectedMaterial.installedPointId}` : selectedMaterial.lokasiGudang} />
                        <DetailField label="Label" value={selectedMaterial.fotoLabel} />
                      </div>
                      <div className="mt-4 rounded-[24px] border border-slate-200 bg-white p-4">
                        <div className="text-sm font-semibold text-slate-900">Detail Spesifikasi</div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          {selectedMaterial.kategori === "TIANG" ? (
                            <>
                              <DetailField label="Tinggi Meter" value={selectedMaterial.detail.tinggiMeter} />
                              <DetailField label="Jenis Tiang" value={selectedMaterial.detail.jenisTiang} />
                              <DetailField label="Tipe Tanam" value={selectedMaterial.detail.tipeTanam} />
                            </>
                          ) : null}
                          {selectedMaterial.kategori === "LAMPU" ? (
                            <>
                              <DetailField label="Daya Watt" value={selectedMaterial.detail.dayaWatt} />
                              <DetailField label="Jenis LED" value={selectedMaterial.detail.jenisLed} />
                              <DetailField label="Merk" value={selectedMaterial.detail.merk} />
                              <DetailField label="Lumen" value={selectedMaterial.detail.lumen} />
                            </>
                          ) : null}
                          {selectedMaterial.kategori === "ARM" ? (
                            <>
                              <DetailField label="Panjang Meter" value={selectedMaterial.detail.panjangMeter} />
                              <DetailField label="Diameter Inch" value={selectedMaterial.detail.diameterInch} />
                              <DetailField label="Sudut" value={selectedMaterial.detail.sudutKemiringan} />
                            </>
                          ) : null}
                          {selectedMaterial.kategori === "KABEL" ? (
                            <>
                              <DetailField label="Jenis Kabel" value={selectedMaterial.detail.jenisKabel} />
                              <DetailField label="Ukuran Kabel" value={selectedMaterial.detail.ukuranKabel} />
                              <DetailField label="Panjang Roll" value={selectedMaterial.detail.panjangRoll} />
                            </>
                          ) : null}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="mt-4 rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-5 text-sm leading-6 text-slate-600">Belum ada barang yang dipilih dari patch database.</div>
                  )}
                </div>
              </section>
            ) : null}

            {activeGudangPatch === "operasional" ? (
              <section className="mt-6 grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
                <div className="rounded-[30px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_20px_45px_rgba(15,23,42,0.08)]">
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{adminMode ? "Patch Operasional" : "Patch Pengajuan"}</div>
                  <h2 className="mt-1 text-xl font-bold text-slate-900">{adminMode ? "Checkout Ala Kasir Gudang" : "Ajukan Kebutuhan Barang"}</h2>
                  {selectedMaterial ? (
                    <>
                      <div className="mt-4 rounded-[24px] bg-slate-50 p-4">
                        <div className="text-sm font-semibold text-slate-900">{selectedMaterial.namaBarang}</div>
                        <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">{selectedMaterial.kodeBarang}</div>
                      </div>
                      <div className="mt-4 grid gap-3">
                        <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
                          Transaksi berlaku untuk <b>1 unit</b>: {selectedMaterial.nomorSeri || selectedMaterial.kodeBarang}.
                        </div>
                        {adminMode ? (
                          <label className="text-sm font-semibold text-slate-700">
                            Referensi Work Order
                            <input value={logReference} onChange={(event) => setLogReference(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400" placeholder="WO-KTR-021 / OM-REP-001" />
                          </label>
                        ) : (
                          <label className="text-sm font-semibold text-slate-700">
                            Catatan Pengajuan
                            <textarea value={requestNote} onChange={(event) => setRequestNote(event.target.value)} className="mt-2 min-h-[110px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400" placeholder="Tuliskan kebutuhan, proyek, atau lokasi kerja" />
                          </label>
                        )}
                      </div>
                      {adminMode ? (
                        <div className="mt-4 grid gap-3">
                          <button onClick={handleBookMaterial} disabled={actionBusy} className="rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:shadow-lg">Book ke Konstruksi / O&M</button>
                          <button onClick={handleCheckoutMaterial} disabled={actionBusy} className="rounded-2xl bg-gradient-to-r from-slate-800 to-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:shadow-lg">Log Keluar Barang</button>
                        </div>
                      ) : (
                        <div className="mt-4 grid gap-3">
                          <label className="text-sm font-semibold text-slate-700">
                            Jenis Pekerjaan
                            <select
                              value={requestWorkType}
                              onChange={(event) => setRequestWorkType(event.target.value)}
                              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400"
                            >
                              {WORK_TYPE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <div className={`rounded-2xl px-4 py-3 text-sm ${selectedMaterialAllowed ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                            {selectedMaterialAllowed
                              ? `Barang ini cocok untuk ${selectedWorkType.label}.`
                              : `Kategori ${selectedMaterial ? MATERIAL_CATEGORY_LABEL[selectedMaterial.kategori] : "-"} tidak cocok untuk ${selectedWorkType.label}.`}
                            <div className="mt-1 text-xs">
                              Kategori boleh: {selectedWorkType.allowedCategories.map((category) => MATERIAL_CATEGORY_LABEL[category]).join(", ")}
                            </div>
                          </div>
                          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">Lokasi barang saat ini: <span className="font-semibold text-slate-900">{selectedMaterial.lokasiGudang}</span></div>
                          <button onClick={handleSubmitMaterialRequest} disabled={actionBusy || !selectedMaterialAllowed} className="rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60">Ajukan Barang ke Admin Gudang</button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="mt-4 rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-5 text-sm leading-6 text-slate-600">Pilih barang dari patch database terlebih dahulu.</div>
                  )}
                </div>
                <div className="rounded-[30px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_20px_45px_rgba(15,23,42,0.08)]">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{adminMode ? "Log Operasional" : "Barang Terpilih"}</div>
                      <div className="mt-1 text-xl font-bold text-slate-900">{adminMode ? "Pergerakan Barang" : "Detail Barang untuk Pengajuan"}</div>
                    </div>
                    <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{adminMode ? `${transactions.length} transaksi` : `${materials.length} master`}</div>
                  </div>
                  <div className="mt-4 space-y-3">
                    {adminMode ? (
                      transactions.length === 0 ? (
                        <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-5 text-sm leading-6 text-slate-600">Belum ada pergerakan barang.</div>
                      ) : (
                        transactions.map((transaction) => (
                          <div key={transaction.id} className="rounded-[24px] border border-slate-100 bg-slate-50 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-semibold text-slate-900">{transaction.materialName}</div>
                                <div className="mt-1 text-xs text-slate-500">{transaction.referensi} • {transaction.sourceModule}</div>
                              </div>
                              <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${getTransactionTone(transaction.type)}`}>{transaction.type}</span>
                            </div>
                            <div className="mt-3 flex items-center justify-between text-sm">
                              <div className="text-slate-600">Qty {transaction.jumlah}</div>
                              <div className="font-semibold text-slate-900">{transaction.status}</div>
                            </div>
                            <div className="mt-2 text-xs text-slate-500">{transaction.timeLabel}</div>
                          </div>
                        ))
                      )
                    ) : selectedMaterial ? (
                      <>
                        <DetailField label="Jenis Patch" value={MATERIAL_CATEGORY_LABEL[selectedMaterial.kategori]} />
                        <DetailField label="Status Unit" value={selectedMaterial.statusUnit} />
                        <DetailField label="Lokasi" value={selectedMaterial.installedPointId ? `Titik APJ ${selectedMaterial.installedPointId}` : selectedMaterial.lokasiGudang} />
                      </>
                    ) : (
                      <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-5 text-sm leading-6 text-slate-600">Belum ada barang terpilih.</div>
                    )}
                  </div>
                </div>
              </section>
            ) : null}

            {activeGudangPatch === "antrian" ? (
              <section className="mt-6">
                <div className="rounded-[30px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_20px_45px_rgba(15,23,42,0.08)]">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{adminMode ? "Patch Antrian Pengajuan" : "Patch Riwayat Pengajuan"}</div>
                      <div className="mt-1 text-xl font-bold text-slate-900">{adminMode ? "Approve / Reject Petugas" : "Riwayat Pengajuan Barang"}</div>
                    </div>
                    <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{requests.length} pengajuan</div>
                  </div>
                  <div className="mt-4 space-y-3">
                    {requests.length === 0 ? <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-5 text-sm leading-6 text-slate-600">{adminMode ? "Belum ada pengajuan petugas." : "Belum ada pengajuan barang."}</div> : null}
                    {requests.map((request) => (
                      <div key={request.id} className="rounded-[24px] border border-slate-100 bg-slate-50 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-slate-900">{request.materialName}</div>
                            <div className="mt-1 text-xs text-slate-500">{request.requestType} • {request.requesterName}</div>
                          </div>
                          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700">{request.status}</span>
                        </div>
                        <div className="mt-3 text-sm text-slate-700">Qty {request.quantity}</div>
                        {request.workType ? (
                          <div className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                            {getWorkTypeOption(request.workType).label}
                          </div>
                        ) : null}
                        <div className="mt-2 text-sm text-slate-600">{request.note}</div>
                        {request.auditTrail && request.auditTrail.length > 0 ? (
                          <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Audit Status</div>
                            <div className="mt-2 space-y-2">
                              {request.auditTrail.slice(-3).reverse().map((audit, index) => (
                                <div key={`${request.id}-audit-${index}`} className="text-xs leading-5 text-slate-600">
                                  <span className="font-semibold text-slate-900">{audit.status}</span> oleh {audit.actorName || "-"}
                                  {audit.note ? <span> - {audit.note}</span> : null}
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        <div className="mt-2 text-xs text-slate-500">Lokasi acuan: {request.locationHint} • {request.timeLabel}</div>
                        {adminMode ? (
                          <div className="mt-4 flex flex-wrap gap-2">
                            <button onClick={() => handleUpdateRequestStatus(request.id, "Diproses")} disabled={actionBusy} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">Tandai Diproses</button>
                            <button onClick={() => handleUpdateRequestStatus(request.id, "Disetujui")} disabled={actionBusy} className="rounded-2xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-white">Setujui</button>
                            {request.status === "Disetujui" ? (
                              <button onClick={() => handleCheckoutApprovedRequest(request)} disabled={actionBusy} className="rounded-2xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white">Log Keluar</button>
                            ) : null}
                            {request.status === "Dikeluarkan" ? (
                              request.requestType === "Peminjaman BMD" ? (
                                <button onClick={() => handleReturnApprovedBmdRequest(request)} disabled={actionBusy} className="rounded-2xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white">Kembalikan Aset</button>
                              ) : (
                                <button onClick={() => handleUpdateRequestStatus(request.id, "Selesai")} disabled={actionBusy} className="rounded-2xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white">Selesaikan</button>
                              )
                            ) : null}
                            <button onClick={() => handleUpdateRequestStatus(request.id, "Ditolak")} disabled={actionBusy} className="rounded-2xl bg-rose-500 px-3 py-2 text-xs font-semibold text-white">Tolak</button>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            ) : null}
          </>
        ) : (
          <>
            <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {adminMode ? <PatchButton active={activeBmdPatch === "tambah"} label="Catat Pelepasan BMD" note="Registrasi barang pemerintah yang dilepas dari titik." onClick={() => setActiveBmdPatch("tambah")} /> : null}
              <PatchButton active={activeBmdPatch === "database"} label="Database BMD" note="Barang pemerintah tersimpan, terpisah dari Gudang perusahaan." onClick={() => setActiveBmdPatch("database")} />
              <PatchButton active={activeBmdPatch === "alur"} label="Patch Alur BMD" note="Ringkasan proses administratif BMD." onClick={() => setActiveBmdPatch("alur")} />
            </section>

            {adminMode && activeBmdPatch === "tambah" ? (
              <section className="mt-6 grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
                <div className="rounded-[30px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_20px_45px_rgba(15,23,42,0.08)]">
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Patch BMD</div>
                  <h2 className="mt-1 text-2xl font-bold text-slate-900">Catat Barang Pemerintah yang Dilepas</h2>
                  <div className="mt-2 text-sm leading-6 text-slate-600">BMD hanya untuk barang milik pemerintah yang dilepas dari titik lalu disimpan. Barang milik perusahaan tetap dicatat di Gudang.</div>
                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    <label className="text-sm font-semibold text-slate-700">
                      Nomor Register Aset
                      <input value={bmdRegisterDraft} onChange={(event) => setBmdRegisterDraft(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400" placeholder="01.05.11.0001" />
                    </label>
                    <label className="text-sm font-semibold text-slate-700">
                      Nama Aset
                      <input value={bmdNameDraft} onChange={(event) => setBmdNameDraft(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400" placeholder="GPS Handheld Survey" />
                    </label>
                    <label className="text-sm font-semibold text-slate-700">
                      Nomor Seri Barang
                      <input value={bmdSerialDraft} onChange={(event) => setBmdSerialDraft(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400" placeholder="SN-BMD-0001" />
                    </label>
                    <label className="text-sm font-semibold text-slate-700">
                      Asal ID Titik APJ
                      <input value={bmdOriginPointDraft} onChange={(event) => setBmdOriginPointDraft(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400" placeholder="AR-001-001" />
                    </label>
                    <label className="text-sm font-semibold text-slate-700">
                      Tanggal Pelepasan
                      <input type="date" value={bmdReleaseDateDraft} onChange={(event) => setBmdReleaseDateDraft(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400" />
                    </label>
                    <label className="text-sm font-semibold text-slate-700">
                      Dokumen/Berita Acara
                      <input value={bmdReleaseDocumentDraft} onChange={(event) => setBmdReleaseDocumentDraft(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400" placeholder="BAST-2026-001" />
                    </label>
                    <label className="text-sm font-semibold text-slate-700 md:col-span-2">
                      Alasan Pelepasan
                      <textarea value={bmdReleaseReasonDraft} onChange={(event) => setBmdReleaseReasonDraft(event.target.value)} rows={2} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400" placeholder="Rusak, diganti, atau alasan pelepasan lainnya" />
                    </label>
                    <label className="text-sm font-semibold text-slate-700">
                      Kategori
                      <input value={bmdCategoryDraft} onChange={(event) => setBmdCategoryDraft(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400" placeholder="Perangkat Lapangan" />
                    </label>
                    <label className="text-sm font-semibold text-slate-700">
                      Lokasi Simpan
                      <input value={bmdLocationDraft} onChange={(event) => setBmdLocationDraft(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400" placeholder="Rak BMD A-01" />
                    </label>
                    <label className="text-sm font-semibold text-slate-700">
                      Foto Aset
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(event) => setBmdPhotoFile(event.target.files?.[0] || null)}
                        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                      />
                      <span className="mt-1 block text-xs font-normal text-slate-500">{bmdPhotoFile?.name || "Opsional, akan tampil di kartu aset."}</span>
                    </label>
                    <label className="text-sm font-semibold text-slate-700 md:col-span-2">
                      Kondisi Awal
                      <select value={bmdConditionDraft} onChange={(event) => setBmdConditionDraft(event.target.value as BmdCondition)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400">
                        <option value="Baik">Baik</option>
                        <option value="Rusak Ringan">Rusak Ringan</option>
                        <option value="Rusak Berat">Rusak Berat</option>
                      </select>
                    </label>
                  </div>
                  <button onClick={handleCreateBmdAsset} disabled={actionBusy} className="mt-5 rounded-2xl bg-gradient-to-r from-slate-800 to-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:shadow-lg">Tambah Aset ke Register BMD</button>
                </div>
                <div className="rounded-[30px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_20px_45px_rgba(15,23,42,0.08)]">
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Ringkasan Patch</div>
                  <div className="mt-1 text-xl font-bold text-slate-900">Kategori Aset BMD</div>
                  <div className="mt-4 space-y-3">
                    {groupedBmdAssets.length === 0 ? <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-5 text-sm leading-6 text-slate-600">Belum ada aset BMD tercatat.</div> : null}
                    {groupedBmdAssets.map(([category, items]) => (
                      <div key={category} className="rounded-[24px] border border-slate-100 bg-slate-50 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-slate-900">{category}</div>
                            <div className="mt-1 text-xs text-slate-500">Patch database aset untuk kategori ini.</div>
                          </div>
                          <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">{items.length} aset</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            ) : null}

            {activeBmdPatch === "database" ? (
              <section className="mt-6 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
                <div className="space-y-5">
                  {groupedBmdAssets.length === 0 ? <div className="rounded-[30px] border border-dashed border-slate-300 bg-slate-50/70 p-8 text-center"><div className="text-lg font-bold text-slate-900">Belum ada aset BMD</div><div className="mt-2 text-sm leading-6 text-slate-600">Mulai dengan registrasi aset agar database BMD terbentuk per kategori.</div></div> : null}
                  {groupedBmdAssets.map(([category, items]) => (
                    <div key={category} className="rounded-[30px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_20px_45px_rgba(15,23,42,0.08)]">
                      <div className="mb-4 flex items-end justify-between gap-4">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Patch Database Aset</div>
                          <h2 className="mt-1 text-2xl font-bold text-slate-900">{category}</h2>
                        </div>
                        <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600">{items.length} aset</div>
                      </div>
                      <div className="space-y-4">
                        {items.map((asset) => (
                          <BmdAssetCard key={asset.id} asset={asset} active={asset.id === selectedBmdId} onClick={() => setSelectedBmdId(asset.id)} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="rounded-[30px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_20px_45px_rgba(15,23,42,0.08)]">
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Detail Aset</div>
                  <h2 className="mt-1 text-xl font-bold text-slate-900">Data Lengkap Per Aset</h2>
                  {selectedBmdAsset ? (
                    <>
                      <div className="mt-4 rounded-[24px] bg-slate-50 p-4">
                        <div className="text-sm font-semibold text-slate-900">{selectedBmdAsset.namaAset}</div>
                        <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">{selectedBmdAsset.nomorRegister} • {selectedBmdAsset.kategori}</div>
                      </div>
                      <div className="mt-4 grid gap-3">
                        <DetailField label="Status" value={selectedBmdAsset.status} />
                        <DetailField label="Kepemilikan" value="Pemerintah" />
                        <DetailField label="Nomor Seri" value={selectedBmdAsset.nomorSeri || selectedBmdAsset.nomorRegister} />
                        <DetailField label="Asal Titik APJ" value={selectedBmdAsset.asalTitikApj || "-"} />
                        <DetailField label="Tanggal Pelepasan" value={selectedBmdAsset.tanggalPelepasan || "-"} />
                        <DetailField label="Alasan Pelepasan" value={selectedBmdAsset.alasanPelepasan || "-"} />
                        <DetailField label="Dokumen Pelepasan" value={selectedBmdAsset.dokumenPelepasan || "-"} />
                        <DetailField label="Kondisi" value={selectedBmdAsset.kondisi} />
                        <DetailField label="Lokasi" value={selectedBmdAsset.lokasi} />
                      </div>
                    </>
                  ) : (
                    <div className="mt-4 rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-5 text-sm leading-6 text-slate-600">Belum ada aset yang dipilih dari patch database BMD.</div>
                  )}
                </div>
              </section>
            ) : null}

            {activeBmdPatch === "alur" ? (
              <section className="mt-6">
                <div className="rounded-[30px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_20px_45px_rgba(15,23,42,0.08)]">
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Patch Alur BMD</div>
                  <div className="mt-1 text-xl font-bold text-slate-900">Alur Administratif</div>
                  <div className="mt-4 grid gap-3 text-sm leading-6 text-slate-600 md:grid-cols-3">
                    <div className="rounded-2xl bg-slate-50 px-4 py-4">1. Petugas melepas barang pemerintah dari titik APJ dan mencatat nomor serinya.</div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-4">2. Admin mencatat asal titik, kondisi, tanggal, dan dokumen pelepasan ke register BMD.</div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-4">3. Barang disimpan di lokasi BMD dan tetap dapat ditelusuri dari nomor seri serta riwayat titiknya.</div>
                  </div>
                </div>
              </section>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
