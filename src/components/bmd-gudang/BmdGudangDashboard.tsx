"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

type MaterialCategory = "TIANG" | "LAMPU" | "ARM";
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

type MaterialItem =
  | (MaterialBase & { kategori: "TIANG"; detail: TiangDetail })
  | (MaterialBase & { kategori: "LAMPU"; detail: LampuDetail })
  | (MaterialBase & { kategori: "ARM"; detail: ArmDetail });

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
  status: "Diajukan" | "Diproses" | "Disetujui" | "Ditolak";
  locationHint: string;
  timeLabel: string;
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
};

const INITIAL_MATERIALS: MaterialItem[] = [];
const INITIAL_TRANSACTIONS: InventoryTransaction[] = [];
const INITIAL_BMD_ASSETS: BmdAsset[] = [];
const INITIAL_REQUESTS: MaterialRequest[] = [];
const MATERIAL_CATEGORY_ORDER: MaterialCategory[] = ["LAMPU", "TIANG", "ARM"];
const MATERIAL_CATEGORY_LABEL: Record<MaterialCategory, string> = {
  LAMPU: "Lampu",
  TIANG: "Tiang",
  ARM: "Arm",
};

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
          <div className={`flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br ${accent.surface} text-base font-bold text-slate-700 shadow-sm`}>
            {item.fotoLabel}
          </div>
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
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Stok</div>
            <div className={`mt-1 text-xl font-bold ${getStockTone(item.stokTersedia, item.stokMinimum)}`}>{item.stokTersedia}</div>
          </div>
          <DetailField label="Minimum" value={item.stokMinimum} />
          <DetailField label="Lokasi" value={item.lokasiGudang} />
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
  const [activeTab, setActiveTab] = useState<"gudang" | "bmd">("gudang");
  const [activeGudangPatch, setActiveGudangPatch] = useState<"tambah" | "database" | "operasional" | "antrian">(
    adminMode ? "database" : "operasional"
  );
  const [activeBmdPatch, setActiveBmdPatch] = useState<"tambah" | "database" | "operasional" | "alur">(
    adminMode ? "database" : "operasional"
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
  const [materialNameDraft, setMaterialNameDraft] = useState<string>("");
  const [materialPhotoLabelDraft, setMaterialPhotoLabelDraft] = useState<string>("");
  const [materialLocationDraft, setMaterialLocationDraft] = useState<string>("Gudang Utama");
  const [materialStockDraft, setMaterialStockDraft] = useState<string>("0");
  const [materialMinimumDraft, setMaterialMinimumDraft] = useState<string>("0");
  const [materialDetailDraft, setMaterialDetailDraft] = useState<TiangDetail | LampuDetail | ArmDetail>(createDefaultMaterialDetail("LAMPU"));
  const [requestQuantity, setRequestQuantity] = useState<string>("1");
  const [requestNote, setRequestNote] = useState<string>("");
  const [bmdRegisterDraft, setBmdRegisterDraft] = useState<string>("");
  const [bmdNameDraft, setBmdNameDraft] = useState<string>("");
  const [bmdCategoryDraft, setBmdCategoryDraft] = useState<string>("Perangkat Lapangan");
  const [bmdLocationDraft, setBmdLocationDraft] = useState<string>("Rak BMD A-01");
  const [bmdConditionDraft, setBmdConditionDraft] = useState<BmdCondition>("Baik");

  const totalItems = materials.length;
  const lampuReady = materials.filter((item) => item.kategori === "LAMPU" && item.stokTersedia > item.stokMinimum).length;
  const tiangReady = materials.filter((item) => item.kategori === "TIANG" && item.stokTersedia > item.stokMinimum).length;
  const criticalStock = materials.filter((item) => item.stokTersedia <= item.stokMinimum).length;
  const totalBmd = bmdAssets.length;
  const borrowedBmd = bmdAssets.filter((asset) => asset.status === "Dipinjam").length;
  const damagedBmd = bmdAssets.filter((asset) => asset.kondisi !== "Baik").length;
  const totalRequests = requests.length;

  const selectedMaterial = materials.find((item) => item.id === selectedMaterialId) || materials[0] || null;
  const selectedBmdAsset = bmdAssets.find((item) => item.id === selectedBmdId) || bmdAssets[0] || null;
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
      throw new Error(payload.error || "Permintaan ke server gagal.");
    }
    return payload;
  }, []);

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
    if (!materialCodeDraft.trim() || !materialNameDraft.trim()) return;
    try {
      setActionBusy(true);
      await fetchJson(endpoint, {
        method: "POST",
        body: JSON.stringify({
          action: "create-material",
          kodeBarang: materialCodeDraft.trim(),
          namaBarang: materialNameDraft.trim(),
          kategori: materialCategoryDraft,
          stokTersedia: materialStockDraft,
          stokMinimum: materialMinimumDraft,
          lokasiGudang: materialLocationDraft.trim() || "Gudang Utama",
          fotoLabel: materialPhotoLabelDraft.trim() || materialCategoryDraft,
          detail: materialDetailDraft,
        }),
      });
      setMaterialCodeDraft("");
      setMaterialNameDraft("");
      setMaterialPhotoLabelDraft("");
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
      await fetchJson(endpoint, {
        method: "POST",
        body: JSON.stringify({
          action: "create-bmd-asset",
          nomorRegister: bmdRegisterDraft.trim(),
          namaAset: bmdNameDraft.trim(),
          kategori: bmdCategoryDraft.trim() || "Aset BMD",
          kondisi: bmdConditionDraft,
          status: "Di Gudang",
          lokasi: bmdLocationDraft.trim() || "Rak BMD A-01",
          peminjam: "-",
          estimasiKembali: "-",
        }),
      });
      setBmdRegisterDraft("");
      setBmdNameDraft("");
      setBmdCategoryDraft("Perangkat Lapangan");
      setBmdLocationDraft("Rak BMD A-01");
      setBmdConditionDraft("Baik");
      await loadDashboardData();
    } finally {
      setActionBusy(false);
    }
  };

  const handleSubmitMaterialRequest = async () => {
    if (!selectedMaterial) return;
    const qty = Number.parseInt(requestQuantity, 10);
    if (!Number.isFinite(qty) || qty <= 0) return;
    try {
      setActionBusy(true);
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
    const qty = Number.parseInt(logQuantity, 10);
    if (!selectedMaterial || !Number.isFinite(qty) || qty <= 0) return;
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
    const qty = Number.parseInt(logQuantity, 10);
    if (!selectedMaterial || !Number.isFinite(qty) || qty <= 0) return;
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
    const qty = Number.parseInt(logQuantity, 10);
    if (!selectedMaterial || !Number.isFinite(qty) || qty <= 0) return;
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
                Pisahkan stok operasional gudang dari aset BMD yang bersifat administratif.
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-100 sm:text-base">
                Gudang material difokuskan ke stok dinamis, log keluar-masuk, dan booking ke Konstruksi atau O&M.
                BMD difokuskan ke register aset, peminjaman internal, dan pengembalian formal.
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
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-[28px] border border-amber-100 bg-white/90 p-5 shadow-[0_18px_45px_rgba(251,191,36,0.12)] backdrop-blur">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-500">Aturan Inti</div>
              <div className="mt-2 text-xl font-bold text-slate-900">Aset vs. Stok</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Material gudang bisa habis pakai dan melekat ke proyek. BMD tetap dicatat per unit dan kembali lagi ke gudang.
              </p>
            </div>
            <div className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Akses Cepat</div>
              <div className="mt-2 text-lg font-bold text-slate-900">Tab Operasional</div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <button onClick={() => setActiveTab("gudang")} className={`rounded-2xl px-3 py-3 text-left ${activeTab === "gudang" ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-600"}`}>
                  <div className="font-semibold">Gudang Material</div>
                  <div className="mt-1 text-xs opacity-80">Stok dinamis</div>
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
              <StockMetricCard label="Total Item" value={String(totalItems)} note="Master barang aktif di gudang." accent="from-slate-700 to-slate-900" />
              <StockMetricCard label="Lampu Ready" value={String(lampuReady)} note="Lampu dengan stok di atas minimum." accent="from-amber-400 to-orange-500" />
              <StockMetricCard label="Tiang Ready" value={String(tiangReady)} note="Material tiang siap dipanggil proyek." accent="from-sky-500 to-blue-600" />
              <StockMetricCard label={adminMode ? "Stok Kritis" : "Pengajuan Saya"} value={String(adminMode ? criticalStock : totalRequests)} note={adminMode ? "Perlu restock atau mutasi gudang." : "Jumlah pengajuan yang sudah Anda buat."} accent="from-rose-500 to-red-600" />
            </>
          ) : (
            <>
              <StockMetricCard label="Total Aset BMD" value={String(totalBmd)} note="Jumlah aset tercatat pada register." accent="from-slate-700 to-slate-900" />
              <StockMetricCard label="Aset Terpinjam" value={String(borrowedBmd)} note="Sedang dibawa unit internal." accent="from-amber-400 to-orange-500" />
              <StockMetricCard label="Aset Rusak" value={String(damagedBmd)} note="Butuh tindak lanjut perawatan." accent="from-rose-500 to-red-600" />
              <StockMetricCard label="Siap Digunakan" value={String(totalBmd - borrowedBmd)} note="Bisa dipinjamkan dari gudang BMD." accent="from-emerald-500 to-teal-600" />
            </>
          )}
        </section>

        {loadError ? <div className="mt-6 rounded-[24px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">{loadError}</div> : null}
        {loadingData ? <div className="mt-6 rounded-[24px] border border-slate-200 bg-white/90 px-5 py-5 text-sm text-slate-600 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">Memuat data BMD & Gudang dari Supabase...</div> : null}

        {activeTab === "gudang" ? (
          <>
            <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {adminMode ? <PatchButton active={activeGudangPatch === "tambah"} label="Patch Tambah Data" note="Form khusus input master barang." onClick={() => setActiveGudangPatch("tambah")} /> : null}
              <PatchButton active={activeGudangPatch === "database"} label="Patch Database Barang" note="Barang dibagi per jenis: Lampu, Tiang, Arm." onClick={() => setActiveGudangPatch("database")} />
              <PatchButton active={activeGudangPatch === "operasional"} label={adminMode ? "Patch Operasional" : "Patch Pengajuan"} note={adminMode ? "Tambah stok, booking, dan log keluar." : "Ajukan kebutuhan barang ke admin."} onClick={() => setActiveGudangPatch("operasional")} />
              <PatchButton active={activeGudangPatch === "antrian"} label={adminMode ? "Patch Antrian" : "Patch Riwayat"} note={adminMode ? "Approve dan tindak lanjuti pengajuan." : "Lihat riwayat pengajuan barang."} onClick={() => setActiveGudangPatch("antrian")} />
            </section>

            {adminMode && activeGudangPatch === "tambah" ? (
              <section className="mt-6 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-[30px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_20px_45px_rgba(15,23,42,0.08)]">
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Patch Gudang</div>
                  <h2 className="mt-1 text-2xl font-bold text-slate-900">Tambah Data Barang</h2>
                  <div className="mt-2 text-sm leading-6 text-slate-600">Setiap barang dibuat dulu sebagai master, lalu dipakai oleh patch stok, transaksi, dan pengajuan.</div>
                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    <label className="text-sm font-semibold text-slate-700">
                      Kategori
                      <select value={materialCategoryDraft} onChange={(event) => handleMaterialCategoryChange(event.target.value as MaterialCategory)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400">
                        <option value="LAMPU">Lampu</option>
                        <option value="TIANG">Tiang</option>
                        <option value="ARM">Arm</option>
                      </select>
                    </label>
                    <label className="text-sm font-semibold text-slate-700">
                      Kode Barang
                      <input value={materialCodeDraft} onChange={(event) => setMaterialCodeDraft(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400" placeholder="BRG-LAMPU-001" />
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
                      Lokasi Gudang
                      <input value={materialLocationDraft} onChange={(event) => setMaterialLocationDraft(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400" placeholder="Gudang Utama" />
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="text-sm font-semibold text-slate-700">
                        Stok Awal
                        <input value={materialStockDraft} onChange={(event) => setMaterialStockDraft(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400" inputMode="numeric" />
                      </label>
                      <label className="text-sm font-semibold text-slate-700">
                        Stok Minimum
                        <input value={materialMinimumDraft} onChange={(event) => setMaterialMinimumDraft(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400" inputMode="numeric" />
                      </label>
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
                        <DetailField label="Stok Tersedia" value={selectedMaterial.stokTersedia} />
                        <DetailField label="Stok Minimum" value={selectedMaterial.stokMinimum} />
                        <DetailField label="Lokasi Gudang" value={selectedMaterial.lokasiGudang} />
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
                        <label className="text-sm font-semibold text-slate-700">
                          Jumlah
                          <input value={adminMode ? logQuantity : requestQuantity} onChange={(event) => (adminMode ? setLogQuantity(event.target.value) : setRequestQuantity(event.target.value))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400" inputMode="numeric" placeholder="Masukkan jumlah" />
                        </label>
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
                          <button onClick={handleAddStock} disabled={actionBusy} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">Tambah Stok Masuk</button>
                        </div>
                      ) : (
                        <div className="mt-4 grid gap-3">
                          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">Lokasi barang saat ini: <span className="font-semibold text-slate-900">{selectedMaterial.lokasiGudang}</span></div>
                          <button onClick={handleSubmitMaterialRequest} disabled={actionBusy} className="rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:shadow-lg">Ajukan Barang ke Admin Gudang</button>
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
                        <DetailField label="Stok Tersedia" value={selectedMaterial.stokTersedia} />
                        <DetailField label="Lokasi Gudang" value={selectedMaterial.lokasiGudang} />
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
                        <div className="mt-2 text-sm text-slate-600">{request.note}</div>
                        <div className="mt-2 text-xs text-slate-500">Lokasi acuan: {request.locationHint} • {request.timeLabel}</div>
                        {adminMode ? (
                          <div className="mt-4 flex flex-wrap gap-2">
                            <button onClick={() => handleUpdateRequestStatus(request.id, "Diproses")} disabled={actionBusy} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">Tandai Diproses</button>
                            <button onClick={() => handleUpdateRequestStatus(request.id, "Disetujui")} disabled={actionBusy} className="rounded-2xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-white">Setujui</button>
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
              {adminMode ? <PatchButton active={activeBmdPatch === "tambah"} label="Patch Tambah Aset" note="Registrasi aset BMD satu per satu." onClick={() => setActiveBmdPatch("tambah")} /> : null}
              <PatchButton active={activeBmdPatch === "database"} label="Patch Database Aset" note="Database BMD dibagi per kategori aset." onClick={() => setActiveBmdPatch("database")} />
              <PatchButton active={activeBmdPatch === "operasional"} label={adminMode ? "Patch Peminjaman" : "Patch Pengajuan"} note={adminMode ? "Catat pinjam dan pengembalian." : "Ajukan pinjam aset ke admin."} onClick={() => setActiveBmdPatch("operasional")} />
              <PatchButton active={activeBmdPatch === "alur"} label="Patch Alur BMD" note="Ringkasan proses administratif BMD." onClick={() => setActiveBmdPatch("alur")} />
            </section>

            {adminMode && activeBmdPatch === "tambah" ? (
              <section className="mt-6 grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
                <div className="rounded-[30px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_20px_45px_rgba(15,23,42,0.08)]">
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Patch BMD</div>
                  <h2 className="mt-1 text-2xl font-bold text-slate-900">Tambah Aset BMD</h2>
                  <div className="mt-2 text-sm leading-6 text-slate-600">Setiap aset diregistrasi per unit, lalu dipakai oleh patch database dan patch peminjaman.</div>
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
                      Kategori
                      <input value={bmdCategoryDraft} onChange={(event) => setBmdCategoryDraft(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400" placeholder="Perangkat Lapangan" />
                    </label>
                    <label className="text-sm font-semibold text-slate-700">
                      Lokasi Simpan
                      <input value={bmdLocationDraft} onChange={(event) => setBmdLocationDraft(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400" placeholder="Rak BMD A-01" />
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
                        <DetailField label="Kondisi" value={selectedBmdAsset.kondisi} />
                        <DetailField label="Lokasi" value={selectedBmdAsset.lokasi} />
                        <DetailField label="Peminjam" value={selectedBmdAsset.peminjam} />
                        <DetailField label="Estimasi Kembali" value={selectedBmdAsset.estimasiKembali} />
                      </div>
                    </>
                  ) : (
                    <div className="mt-4 rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-5 text-sm leading-6 text-slate-600">Belum ada aset yang dipilih dari patch database BMD.</div>
                  )}
                </div>
              </section>
            ) : null}

            {activeBmdPatch === "operasional" ? (
              <section className="mt-6 grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
                <div className="rounded-[30px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_20px_45px_rgba(15,23,42,0.08)]">
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{adminMode ? "Patch Peminjaman" : "Patch Pengajuan BMD"}</div>
                  <h2 className="mt-1 text-xl font-bold text-slate-900">{adminMode ? "Peminjaman & Pengembalian" : "Ajukan Peminjaman Aset"}</h2>
                  {selectedBmdAsset ? (
                    <>
                      <div className="mt-4 rounded-[24px] bg-slate-50 p-4">
                        <div className="text-sm font-semibold text-slate-900">{selectedBmdAsset.namaAset}</div>
                        <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">{selectedBmdAsset.nomorRegister}</div>
                      </div>
                      <div className="mt-4 grid gap-3">
                        <label className="text-sm font-semibold text-slate-700">
                          Dibawa Oleh
                          <input value={loanBorrower} onChange={(event) => setLoanBorrower(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400" placeholder="Masukkan unit / petugas" />
                        </label>
                        <label className="text-sm font-semibold text-slate-700">
                          Keperluan
                          <textarea value={loanPurpose} onChange={(event) => setLoanPurpose(event.target.value)} className="mt-2 min-h-[110px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400" placeholder="Tuliskan tujuan peminjaman" />
                        </label>
                      </div>
                      {adminMode ? (
                        <div className="mt-4 grid gap-3">
                          <button onClick={handleLoanBmd} disabled={actionBusy} className="rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:shadow-lg">Catat Peminjaman</button>
                          <button onClick={handleReturnBmd} disabled={actionBusy} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">Proses Pengembalian</button>
                        </div>
                      ) : (
                        <div className="mt-4 grid gap-3">
                          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">Lokasi aset saat ini: <span className="font-semibold text-slate-900">{selectedBmdAsset.lokasi}</span></div>
                          <button onClick={handleSubmitBmdRequest} disabled={actionBusy} className="rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:shadow-lg">Ajukan Peminjaman ke Admin</button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="mt-4 rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-5 text-sm leading-6 text-slate-600">Pilih aset dari patch database BMD terlebih dahulu.</div>
                  )}
                </div>
                <div className="rounded-[30px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_20px_45px_rgba(15,23,42,0.08)]">
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Status Aset</div>
                  <div className="mt-1 text-xl font-bold text-slate-900">Ringkasan Aset Terpilih</div>
                  <div className="mt-4 space-y-3">
                    {selectedBmdAsset ? (
                      <>
                        <DetailField label="Kategori" value={selectedBmdAsset.kategori} />
                        <DetailField label="Status" value={selectedBmdAsset.status} />
                        <DetailField label="Kondisi" value={selectedBmdAsset.kondisi} />
                        <DetailField label="Estimasi Kembali" value={selectedBmdAsset.estimasiKembali} />
                      </>
                    ) : (
                      <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-5 text-sm leading-6 text-slate-600">Belum ada aset terpilih.</div>
                    )}
                  </div>
                </div>
              </section>
            ) : null}

            {activeBmdPatch === "alur" ? (
              <section className="mt-6">
                <div className="rounded-[30px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_20px_45px_rgba(15,23,42,0.08)]">
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Patch Alur BMD</div>
                  <div className="mt-1 text-xl font-bold text-slate-900">Alur Administratif</div>
                  <div className="mt-4 grid gap-3 text-sm leading-6 text-slate-600 md:grid-cols-3">
                    <div className="rounded-2xl bg-slate-50 px-4 py-4">1. Registrasi aset baru dengan nomor register, kategori, dan kondisi awal.</div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-4">2. Saat dipinjam, status aset berubah menjadi <strong>Dipinjam</strong> dan tetap terhubung ke data detail aset.</div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-4">3. Saat kembali, admin cek kondisi lalu aset dikembalikan ke lokasi simpan BMD.</div>
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
