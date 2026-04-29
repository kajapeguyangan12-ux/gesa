"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/hooks/useAuth";

type RiwayatItem = {
  id?: string;
  idTitik?: string;
  koordinat?: string;
  grup?: string;
  zona?: string;
  namaTitik?: string;
  latitude?: number;
  longitude?: number;
  status?: string;
  kontruksiStatus?: string;
  updatedAt?: string;
  createdAt?: any;
  validatedAt?: any;
  submittedByName?: string;
  submittedById?: string;
  createdById?: string;
  petugasId?: string;
  userId?: string;
  kategori?: string;
  jenis?: string;
  tahap?: string;
  stage?: string;
  type?: string;
  menu?: string;
  [key: string]: any;
};

type RiwayatListProps = {
  title: string;
  backHref: string;
  storageSection: string;
  storageSubKey?: string;
  listLabel?: string;
  emptyTitle?: string;
  emptyDesc?: string;
  flowTitle?: string;
  flowSteps?: string[];
};

export default function RiwayatList({
  title,
  backHref,
  storageSection,
  storageSubKey,
  listLabel = "List Hasil Kontruksi",
  emptyTitle = "Belum ada hasil kontruksi",
  emptyDesc = "Hasil kontruksi akan muncul setelah petugas mengirim data.",
  flowTitle = "Alur Riwayat",
  flowSteps = [
    "Pilih tugas dan titik yang akan dikerjakan.",
    "Lengkapi form hasil kontruksi.",
    "Kirim data hasil ke sistem.",
    "Riwayat hasil akan tampil di sini.",
  ],
}: RiwayatListProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<RiwayatItem[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("Semua");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [detailItem, setDetailItem] = useState<RiwayatItem | null>(null);

  const stageKey = storageSubKey || storageSection;

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/admin/kontruksi?resource=history&limit=1000", { cache: "no-store" });
        const payload = (await response.json()) as { items?: RiwayatItem[]; error?: string };
        if (!response.ok) throw new Error(payload.error || "Gagal memuat riwayat kontruksi.");
        const allItems: RiwayatItem[] = Array.isArray(payload.items) ? payload.items : [];

        const filteredByStage = allItems.filter((item) => {
          const stage =
            item.kategori ||
            item.jenis ||
            item.tahap ||
            item.stage ||
            item.type ||
            item.menu ||
            "";
          if (!stage) return true;
          return stage.toLowerCase() === stageKey.toLowerCase();
        });

        const filteredByUser = filteredByStage.filter((item) => {
          if (!user?.uid) return true;
          const owner =
            item.submittedById ||
            item.createdById ||
            item.petugasId ||
            item.userId ||
            "";
          if (!owner) return true;
          return owner === user.uid;
        });

        if (active) setItems(filteredByUser);
      } catch (e) {
        console.error("Failed to load kontruksi history:", e);
        if (active) {
          setItems([]);
          setError("Gagal memuat riwayat kontruksi.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    load();

    return () => {
      active = false;
    };
  }, [storageSection, storageSubKey, stageKey, user?.uid]);

  const groups = useMemo(() => {
    const list = new Set<string>();
    items.forEach((item) => {
      if (item.grup) list.add(item.grup);
    });
    return ["Semua", ...Array.from(list)];
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = search.toLowerCase().trim();
    return items.filter((item) => {
      const target = `${item.idTitik || ""} ${item.koordinat || ""} ${item.grup || ""} ${item.zona || ""} ${item.namaTitik || ""}`.toLowerCase();
      const matchSearch = target.includes(q);
      const matchFilter = filter === "Semua" ? true : item.grup === filter;
      return matchSearch && matchFilter;
    });
  }, [items, search, filter]);

  const showEmptyFlow = items.length === 0;

  const formatDate = (value: any) => {
    if (!value) return "-";
    try {
      const date = typeof value?.toDate === "function" ? value.toDate() : new Date(value);
      if (Number.isNaN(date.getTime())) return "-";
      return date.toLocaleString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "-";
    }
  };

  const renderValue = (value: any) => {
    if (value === null || value === undefined || value === "") return "-";
    if (typeof value === "string" && value.startsWith("http")) {
      return (
        <a href={value} target="_blank" rel="noreferrer" className="text-blue-600 underline break-all">
          {value}
        </a>
      );
    }
    if (typeof value === "object") {
      try {
        return <span className="break-all">{JSON.stringify(value)}</span>;
      } catch {
        return "-";
      }
    }
    return <span className="break-all">{String(value)}</span>;
  };

  const getStatusStyle = (value: string) => {
    const v = (value || "").toLowerCase();
    if (v.includes("selesai") || v.includes("done") || v.includes("valid")) {
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    }
    if (v.includes("berjalan") || v.includes("progress") || v.includes("ongoing")) {
      return "bg-amber-100 text-amber-700 border-amber-200";
    }
    if (v.includes("terkendala") || v.includes("batal") || v.includes("reject")) {
      return "bg-red-100 text-red-700 border-red-200";
    }
    if (v.includes("belum") || v.includes("assigned")) {
      return "bg-slate-100 text-slate-700 border-slate-200";
    }
    return "bg-gray-100 text-gray-700 border-gray-200";
  };

  return (
    <div className="relative min-h-screen bg-white overflow-hidden">
      <div className="absolute left-4 top-20 h-20 w-1 bg-red-600" />
      <div className="absolute left-6 top-20 h-20 w-[3px] bg-red-500" />

      <div className="absolute -bottom-28 -left-28 h-80 w-80 rounded-full bg-red-600" />
      <div className="absolute -bottom-20 -left-20 h-72 w-72 rounded-full border-[6px] border-red-500" />

      <div className="relative mx-auto w-full max-w-md px-5 pb-24 pt-5">
        <div className="text-[11px] uppercase tracking-wide text-gray-300">dashboard</div>

        <header className="mt-2 flex items-center justify-between">
          <button
            onClick={() => router.push(backHref)}
            className="w-10 h-10 rounded-full bg-gray-900 text-white flex items-center justify-center shadow-md"
            aria-label="Kembali"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="text-center">
            <div className="text-base font-semibold text-gray-900">{title}</div>
          </div>

          <div className="relative w-12 h-12">
            <Image src="/BDG1.png" alt="Logo" fill className="object-contain" />
          </div>
        </header>

        <div className="mt-4 flex items-center gap-2">
          <div className="flex-1 relative">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
              className="w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 py-2 text-xs"
            />
            <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <div className="relative">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-2 py-2 text-xs"
            >
              {groups.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 text-center text-xs font-semibold text-gray-700">{listLabel}</div>

        <div className="mt-3 space-y-2">
          {loading ? (
            <div className="rounded-2xl border border-gray-300 bg-white p-4 text-center text-xs text-gray-500 shadow-sm">
              Memuat riwayat...
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-center text-xs text-red-700 shadow-sm">
              {error}
            </div>
          ) : showEmptyFlow ? (
            <div className="space-y-3">
              <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-4 text-center text-xs text-gray-500 shadow-sm">
                <div className="text-xs font-semibold text-gray-700">{emptyTitle}</div>
                <div className="mt-1 text-[11px] text-gray-500">{emptyDesc}</div>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white p-4 shadow-sm">
                <div className="text-xs font-bold text-gray-900 mb-3">{flowTitle}</div>
                <div className="space-y-2 text-[11px] text-gray-600">
                  {flowSteps.map((step, idx) => (
                    <div key={`${idx}-${step}`} className="flex items-start gap-2">
                      <div className="w-5 h-5 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center text-[11px] font-semibold">
                        {idx + 1}
                      </div>
                      <div>{step}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="rounded-2xl border border-gray-300 bg-white p-4 text-center text-xs text-gray-500 shadow-sm">
              Tidak ada hasil yang sesuai pencarian.
            </div>
          ) : (
            filteredItems.map((item, idx) => (
              <button
                key={`${item.id || idx}`}
                onClick={() => setDetailItem(item)}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-left shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[11px] text-gray-500">Id Titik</div>
                    <div className="text-sm font-semibold text-gray-900 truncate">{item.idTitik || "-"}</div>
                    <div className="text-[11px] text-gray-500">Nama Titik</div>
                    <div className="text-xs text-gray-700 truncate">{item.namaTitik || "-"}</div>
                    <div className="text-[11px] text-gray-500">Koordinat</div>
                    <div className="text-xs text-gray-700 truncate">
                      {item.koordinat || (item.latitude && item.longitude ? `${item.latitude}, ${item.longitude}` : "-")}
                    </div>
                    <div className="text-[11px] text-gray-500">Grup</div>
                    <div className="text-xs text-gray-700 truncate">{item.grup || item.zona || "-"}</div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-[11px] text-gray-500">Status</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getStatusStyle(
                          item.kontruksiStatus || item.status || ""
                        )}`}
                      >
                        {item.kontruksiStatus || item.status || "-"}
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] text-gray-500">Tanggal</div>
                    <div className="text-[11px] text-gray-700 truncate">
                      {formatDate(item.updatedAt || item.validatedAt || item.createdAt)}
                    </div>
                  </div>
                  <div className="w-7 h-7 rounded-full border border-gray-400 flex items-center justify-center text-gray-600">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {detailItem && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl overflow-hidden border border-gray-200 shadow-xl">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
              <button
                onClick={() => setDetailItem(null)}
                className="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <div>
                <div className="text-sm text-gray-500">Detail Hasil</div>
                <div className="text-base font-bold text-gray-900">{detailItem.namaTitik || detailItem.idTitik || "Detail Kontruksi"}</div>
              </div>
            </div>
            <div className="p-4 space-y-3 text-xs text-gray-700">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[11px] text-gray-500">Id Titik</div>
                  <div className="font-semibold text-gray-900">{detailItem.idTitik || "-"}</div>
                </div>
                <div>
                  <div className="text-[11px] text-gray-500">Nama Titik</div>
                  <div className="font-semibold text-gray-900">{detailItem.namaTitik || "-"}</div>
                </div>
                <div>
                  <div className="text-[11px] text-gray-500">Koordinat</div>
                  <div className="font-semibold text-gray-900">
                    {detailItem.koordinat || (detailItem.latitude && detailItem.longitude ? `${detailItem.latitude}, ${detailItem.longitude}` : "-")}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-gray-500">Grup/Zona</div>
                  <div className="font-semibold text-gray-900">{detailItem.grup || detailItem.zona || "-"}</div>
                </div>
                <div>
                  <div className="text-[11px] text-gray-500">Status</div>
                  <div className="font-semibold text-gray-900 flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getStatusStyle(
                        detailItem.kontruksiStatus || detailItem.status || ""
                      )}`}
                    >
                      {detailItem.kontruksiStatus || detailItem.status || "-"}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-gray-500">Dikirim Oleh</div>
                  <div className="font-semibold text-gray-900">{detailItem.submittedByName || "-"}</div>
                </div>
                <div>
                  <div className="text-[11px] text-gray-500">Dibuat</div>
                  <div className="font-semibold text-gray-900">{formatDate(detailItem.createdAt)}</div>
                </div>
                <div>
                  <div className="text-[11px] text-gray-500">Diupdate</div>
                  <div className="font-semibold text-gray-900">{formatDate(detailItem.updatedAt || detailItem.validatedAt)}</div>
                </div>
              </div>

              <div className="pt-2 border-t border-gray-200">
                <div className="text-[11px] text-gray-500 mb-2">Aksi Cepat</div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      const lat = detailItem.latitude;
                      const lng = detailItem.longitude;
                      if (!lat || !lng) return;
                      const url = `https://www.google.com/maps?q=${lat},${lng}`;
                      window.open(url, "_blank");
                    }}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-gray-200 ${
                      detailItem.latitude && detailItem.longitude ? "hover:bg-gray-50" : "opacity-50 cursor-not-allowed"
                    }`}
                    disabled={!detailItem.latitude || !detailItem.longitude}
                  >
                    Buka Maps
                  </button>
                  <button
                    onClick={() => {
                      const coord = detailItem.koordinat || "";
                      if (!coord) return;
                      const url = `https://www.google.com/maps?q=${encodeURIComponent(coord)}`;
                      window.open(url, "_blank");
                    }}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-gray-200 ${
                      detailItem.koordinat ? "hover:bg-gray-50" : "opacity-50 cursor-not-allowed"
                    }`}
                    disabled={!detailItem.koordinat}
                  >
                    Maps (Teks)
                  </button>
                </div>
              </div>

              <div className="pt-2 border-t border-gray-200">
                <div className="text-[11px] text-gray-500 mb-2">Foto</div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(detailItem)
                    .filter(([key, value]) => {
                      if (typeof value !== "string") return false;
                      if (!value.startsWith("http")) return false;
                      const lower = key.toLowerCase();
                      return lower.includes("foto") || lower.includes("photo") || lower.includes("gambar");
                    })
                    .map(([key, value]) => (
                      <button
                        key={key}
                        onClick={() => window.open(value as string, "_blank")}
                        className="px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-gray-200 hover:bg-gray-50"
                      >
                        Lihat {key}
                      </button>
                    ))}
                  {Object.entries(detailItem).filter(([key, value]) => {
                    if (typeof value !== "string") return false;
                    if (!value.startsWith("http")) return false;
                    const lower = key.toLowerCase();
                    return lower.includes("foto") || lower.includes("photo") || lower.includes("gambar");
                  }).length === 0 && <div className="text-[11px] text-gray-500">Tidak ada foto.</div>}
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  {Object.entries(detailItem)
                    .filter(([key, value]) => {
                      if (typeof value !== "string") return false;
                      if (!value.startsWith("http")) return false;
                      const lower = key.toLowerCase();
                      return lower.includes("foto") || lower.includes("photo") || lower.includes("gambar");
                    })
                    .map(([key, value]) => (
                      <button
                        key={`${key}-thumb`}
                        onClick={() => window.open(value as string, "_blank")}
                        className="relative overflow-hidden rounded-lg border border-gray-200 bg-gray-50 aspect-square"
                        aria-label={`Foto ${key}`}
                      >
                        <Image src={value as string} alt={`Foto ${key}`} fill className="object-cover" />
                      </button>
                    ))}
                </div>
              </div>

              <div className="pt-2 border-t border-gray-200">
                <div className="text-[11px] text-gray-500 mb-2">Data Lengkap</div>
                <div className="space-y-2">
                  {Object.entries(detailItem)
                    .filter(([key]) => !["id", "createdAt", "updatedAt", "validatedAt"].includes(key))
                    .map(([key, value]) => (
                      <div key={key} className="flex items-start justify-between gap-3">
                        <div className="text-[11px] text-gray-500 w-1/3">{key}</div>
                        <div className="text-[11px] text-gray-900 w-2/3 text-right">{renderValue(value)}</div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
