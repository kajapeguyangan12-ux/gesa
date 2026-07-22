"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/hooks/useAuth";

const OMApjLeafletMap = dynamic(() => import("@/components/om/OMApjLeafletMap"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center bg-slate-50 text-sm text-slate-500">Memuat peta O&M...</div>,
});

type ApjReportSummary = {
  total: number;
  new: number;
  diproses: number;
  selesai: number;
  ditolak: number;
};

type ApjPoint = {
  id: string;
  idTitik: string;
  namaTitik: string;
  namaJalan: string;
  kabupaten: string;
  dayaLampu: string;
  group: string;
  sourceTaskId: string;
  latitude: number;
  longitude: number;
  status: string;
  source: string;
  stage: string;
  validatedAt: string;
  reports: ApjReportSummary;
};

type ApjGroup = {
  id: string;
  name: string;
  sourceTaskId: string;
  total: number;
  withCoordinate: number;
  reports: ApjReportSummary;
  points: ApjPoint[];
};

type ApjPayload = {
  groups?: ApjGroup[];
  points?: ApjPoint[];
  summary?: {
    groups: number;
    points: number;
    withCoordinate: number;
    reports: number;
  };
  error?: string;
};

type MaterialUnit = {
  id: string;
  kodeBarang: string;
  nomorSeri?: string;
  namaBarang: string;
  kategori: "TIANG" | "LAMPU" | "ARM" | "KABEL";
  statusUnit: "Tersedia" | "Terpasang" | "Dilepas";
  installedPointId?: string;
  detail?: { dayaWatt?: string };
};

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function pointTone(point: ApjPoint) {
  if (point.reports.diproses > 0) return "bg-amber-500";
  if (point.reports.new > 0) return "bg-red-600";
  if (point.reports.selesai > 0) return "bg-emerald-600";
  return "bg-sky-600";
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-black text-slate-950">{value}</div>
    </div>
  );
}

const emptyCreateForm = {
  idTitik: "",
  noSeriTiangArm: "",
  noSeriLampu1: "",
  noSeriLampu2: "",
  kabupaten: "",
  kecamatan: "",
  namaJalan: "",
  lebarJalan: "",
  fungsiRuas: "",
  zona: "",
  group: "",
  dayaLampu: "",
  tiang: "",
  lenganArm: "",
  armAgExs: "",
  presetIluminasi: "",
  presetIluminasiAwal: "",
  presetIluminasiBatas: "",
  latitude: "",
  longitude: "",
  keteranganTitik: "",
  instalasi: "",
};

function OMMapsContent() {
  const { user } = useAuth();
  const accountKabupaten = user?.role === "super-admin" ? "" : user?.kabupaten?.trim().toLowerCase() || "tabanan";
  const [groups, setGroups] = useState<ApjGroup[]>([]);
  const [summary, setSummary] = useState<ApjPayload["summary"]>();
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [testBusy, setTestBusy] = useState(false);
  const [testMessage, setTestMessage] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [groupMode, setGroupMode] = useState<"existing" | "new">("new");
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [materialUnits, setMaterialUnits] = useState<MaterialUnit[]>([]);

  const loadPoints = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ limit: "5000" });
      if (accountKabupaten) params.set("kabupaten", accountKabupaten);
      const response = await fetch(`/api/om/apj-points?${params}`, { cache: "no-store" });
      const payload = (await response.json()) as ApjPayload;
      if (!response.ok) throw new Error(payload.error || "Gagal memuat titik APJ O&M.");
      const nextGroups = payload.groups || [];
      setGroups(nextGroups);
      setSummary(payload.summary);
      setSelectedGroupId((current) => (current && nextGroups.some((group) => group.id === current) ? current : ""));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Gagal memuat titik APJ O&M.");
    } finally {
      setLoading(false);
    }
  }, [accountKabupaten]);

  useEffect(() => {
    void loadPoints();
  }, [loadPoints]);

  useEffect(() => {
    const loadMaterialUnits = async () => {
      try {
        const response = await fetch("/api/bmd-gudang?resource=materials", { cache: "no-store" });
        const payload = (await response.json()) as { items?: MaterialUnit[] };
        if (response.ok) setMaterialUnits(payload.items || []);
      } catch {
        setMaterialUnits([]);
      }
    };
    void loadMaterialUnits();
  }, [showCreateForm]);

  const mutateTestPoint = async (method: "POST" | "DELETE") => {
    setTestBusy(true);
    setTestMessage("");
    try {
      const response = await fetch("/api/om/apj-test-point", { method });
      const payload = (await response.json()) as { idTitik?: string; message?: string; error?: string };
      if (!response.ok) throw new Error(payload.error || "Gagal memproses data test.");
      setTestMessage(payload.message || "Data test diproses.");
      await loadPoints();
      if (method === "POST") {
        setSelectedGroupId("");
        setQuery(payload.idTitik || "TEST-APJ-001");
      } else {
        setQuery("");
      }
    } catch (mutationError) {
      setTestMessage(mutationError instanceof Error ? mutationError.message : "Gagal memproses data test.");
    } finally {
      setTestBusy(false);
    }
  };

  const updateCreateForm = (key: keyof typeof createForm, value: string) => {
    setCreateForm((current) => ({ ...current, [key]: value }));
  };

  const selectCreateComponent = (key: "noSeriTiangArm" | "noSeriLampu1" | "noSeriLampu2", value: string) => {
    setCreateForm((current) => {
      const next = { ...current, [key]: value };
      if (key === "noSeriLampu1" || key === "noSeriLampu2") {
        const otherSerial = key === "noSeriLampu1" ? next.noSeriLampu2 : next.noSeriLampu1;
        const selectedUnit = materialUnits.find((unit) => (unit.nomorSeri || unit.kodeBarang) === value);
        const otherUnit = materialUnits.find((unit) => (unit.nomorSeri || unit.kodeBarang) === otherSerial);
        next.dayaLampu = selectedUnit?.detail?.dayaWatt || otherUnit?.detail?.dayaWatt || "";
      }
      return next;
    });
  };

  const openCreateModal = () => {
    const defaultGroup = groups[0]?.name || "";
    setGroupMode(defaultGroup ? "existing" : "new");
    setCreateForm((current) => ({
      ...current,
      kabupaten: accountKabupaten || current.kabupaten,
      group: current.group || defaultGroup,
      zona: current.zona || defaultGroup,
    }));
    setShowCreateForm(true);
  };

  const closeCreateModal = () => {
    if (testBusy) return;
    setShowCreateForm(false);
  };

  const createManualTestPoint = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const finalGroup = createForm.group.trim();
    if (!finalGroup) {
      setTestMessage("Pilih grup yang ada atau isi nama grup baru dulu.");
      return;
    }
    setTestBusy(true);
    setTestMessage("");
    try {
      const response = await fetch("/api/om/apj-test-point", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...createForm,
          kabupaten: accountKabupaten || createForm.kabupaten,
          actorRole: user?.role || "admin",
          actorKabupaten: accountKabupaten,
          group: finalGroup,
          zona: createForm.zona.trim() || finalGroup,
        }),
      });
      const payload = (await response.json()) as { idTitik?: string; message?: string; error?: string };
      if (!response.ok) throw new Error(payload.error || "Gagal membuat data APJ test.");
      setTestMessage(payload.message || "Data APJ test berhasil dibuat.");
      await loadPoints();
      setSelectedGroupId("");
      setQuery(payload.idTitik || createForm.idTitik);
      setCreateForm(emptyCreateForm);
      setShowCreateForm(false);
    } catch (createError) {
      setTestMessage(createError instanceof Error ? createError.message : "Gagal membuat data APJ test.");
    } finally {
      setTestBusy(false);
    }
  };

  const selectedGroup = useMemo(() => groups.find((group) => group.id === selectedGroupId) || null, [groups, selectedGroupId]);

  const visiblePoints = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = selectedGroup?.points || [];
    if (!q) return base;
    return base.filter((point) =>
      [point.idTitik, point.namaTitik, point.namaJalan, point.kabupaten, point.dayaLampu]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [query, selectedGroup]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.16),_transparent_30%),linear-gradient(180deg,_#f8fafc_0%,_#eefcf8_100%)]">
      <header className="border-b border-slate-200 bg-white/90 px-4 py-4 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link href="/om" className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-sm" aria-label="Kembali ke O&M">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-700">Master APJ O&M</div>
              <h1 className="text-2xl font-black text-slate-950">Maps Titik APJ Menyala</h1>
              <p className="text-sm text-slate-600">Sumber: konstruksi valid tahap comissioning, dikelompokkan per grup/zona.</p>
            </div>
          </div>
          <div className="rounded-2xl border border-teal-100 bg-teal-50 px-4 py-3 text-sm text-slate-700">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Pengguna</div>
            <div className="mt-1 font-bold">{user?.displayName || user?.name || user?.email || "O&M"}</div>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-4 px-4 py-5 lg:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <MiniStat label="Grup" value={loading ? "..." : summary?.groups || 0} />
            <MiniStat label="Titik" value={loading ? "..." : summary?.points || 0} />
            <MiniStat label="Koordinat" value={loading ? "..." : summary?.withCoordinate || 0} />
            <MiniStat label="Laporan" value={loading ? "..." : summary?.reports || 0} />
          </div>

          <div className="rounded-[28px] border border-red-100 bg-white/95 p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-red-600">Test APJ O&M</div>
            <h2 className="mt-2 text-lg font-black text-slate-950">Tambah data APJ untuk uji QR</h2>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              Data dibuat sebagai comissioning valid di jalur yang sama dengan konstruksi, tetapi diberi tanda test O&M agar aman dihapus.
            </p>
            <button
              type="button"
              onClick={openCreateModal}
              className="mt-3 w-full rounded-2xl bg-slate-950 px-3 py-2 text-xs font-bold text-white"
            >
              Tambah APJ Test Baru
            </button>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={testBusy}
                onClick={() => void mutateTestPoint("POST")}
                className="rounded-2xl bg-red-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
              >
                Buat Test
              </button>
              <button
                type="button"
                disabled={testBusy}
                onClick={() => void mutateTestPoint("DELETE")}
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-60"
              >
                Hapus Test
              </button>
            </div>
            <Link href="/om/apj-point/TEST-APJ-001/qr" className="mt-2 block rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-center text-xs font-bold text-red-700">
              Buka QR TEST-APJ-001
            </Link>
            {testMessage ? <div className="mt-3 rounded-2xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">{testMessage}</div> : null}
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white/95 p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-slate-950">Grup APJ</h2>
                <p className="text-xs text-slate-500">Pilih grup untuk melihat titik di dalamnya.</p>
              </div>
              <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-700">{groups.length}</span>
            </div>
            {loading ? <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">Memuat grup...</div> : null}
            {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
            {!loading && !error && groups.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                Belum ada APJ menyala dari konstruksi valid tahap comissioning.
              </div>
            ) : null}
            <div className="max-h-[560px] space-y-2 overflow-auto pr-1">
              {groups.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => setSelectedGroupId(group.id)}
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    selectedGroup?.id === group.id
                      ? "border-teal-300 bg-teal-50 shadow-sm"
                      : "border-slate-200 bg-white hover:border-teal-200 hover:bg-teal-50/50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black text-slate-950">{group.name}</div>
                      <div className="mt-1 text-xs text-slate-500">{group.sourceTaskId || "Tanpa ID tugas"}</div>
                    </div>
                    <div className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700">{group.total} titik</div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px]">
                    <div className="rounded-xl bg-white px-2 py-1.5 text-red-700">Baru {group.reports.new}</div>
                    <div className="rounded-xl bg-white px-2 py-1.5 text-amber-700">Proses {group.reports.diproses}</div>
                    <div className="rounded-xl bg-white px-2 py-1.5 text-emerald-700">Selesai {group.reports.selesai}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <section className="space-y-4">
          <div className="rounded-[28px] border border-slate-200 bg-white/95 p-4 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">{selectedGroup ? "Grup aktif" : "Pilih grup dulu"}</div>
                <h2 className="text-2xl font-black text-slate-950">{selectedGroup?.name || "Semua Grup APJ"}</h2>
                <p className="text-sm text-slate-600">
                  {selectedGroup ? `${selectedGroup.total} titik APJ, ${selectedGroup.withCoordinate} titik punya koordinat.` : "Peta menampilkan marker grup. Klik grup untuk melihat titik di dalamnya."}
                </p>
              </div>
              {selectedGroup ? (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedGroupId("");
                    setQuery("");
                  }}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700"
                >
                  Lihat Semua Grup
                </button>
              ) : null}
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-100 lg:max-w-sm"
                placeholder="Cari ID, jalan, daya, kabupaten..."
              />
            </div>
          </div>

          <div className="relative min-h-[460px] overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
            <div className="absolute inset-x-6 top-6 z-10 flex flex-wrap gap-2">
              <span className="rounded-full bg-sky-600 px-3 py-1 text-xs font-bold text-white">Menyala</span>
              <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white">Ada laporan baru</span>
              <span className="rounded-full bg-amber-500 px-3 py-1 text-xs font-bold text-white">Diproses</span>
              <span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white">Selesai</span>
            </div>
            <div className="h-[460px]">
              <OMApjLeafletMap groups={groups} selectedGroup={selectedGroup} onSelectGroup={setSelectedGroupId} />
            </div>
            {groups.length === 0 ? (
              <div className="relative z-10 flex min-h-[460px] items-center justify-center px-8 text-center">
                <div>
                  <div className="text-xl font-black text-slate-800">Belum ada grup APJ</div>
                  <div className="mt-2 text-sm text-slate-500">Buat data test atau validasi data comissioning dari konstruksi.</div>
                </div>
              </div>
            ) : null}
          </div>

          {!selectedGroup ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {groups.map((group) => (
                <button key={group.id} type="button" onClick={() => setSelectedGroupId(group.id)} className="rounded-[24px] border border-slate-200 bg-white/95 p-4 text-left shadow-sm transition hover:border-teal-300 hover:bg-teal-50">
                  <div className="text-base font-black text-slate-950">{group.name}</div>
                  <div className="mt-1 text-sm text-slate-600">{group.total} titik APJ, {group.withCoordinate} punya koordinat</div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                    <span className="rounded-xl bg-red-50 px-2 py-1.5 text-red-700">Baru {group.reports.new}</span>
                    <span className="rounded-xl bg-amber-50 px-2 py-1.5 text-amber-700">Proses {group.reports.diproses}</span>
                    <span className="rounded-xl bg-emerald-50 px-2 py-1.5 text-emerald-700">Selesai {group.reports.selesai}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {visiblePoints.map((point, index) => (
              <div key={`${point.idTitik}-card-${index}`} className="rounded-[24px] border border-slate-200 bg-white/95 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-base font-black text-slate-950">{point.idTitik}</div>
                    <div className="mt-1 truncate text-sm text-slate-600">{point.namaJalan || point.namaTitik}</div>
                  </div>
                  <span className={`h-3 w-3 rounded-full ${pointTone(point)}`} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
                  <div className="rounded-xl bg-slate-50 p-2">Daya: <b>{point.dayaLampu}</b></div>
                  <div className="rounded-xl bg-slate-50 p-2">Valid: <b>{formatDate(point.validatedAt)}</b></div>
                  <div className="rounded-xl bg-slate-50 p-2">Laporan: <b>{point.reports.total}</b></div>
                  <div className="rounded-xl bg-slate-50 p-2">Koordinat: <b>{point.latitude && point.longitude ? "Ada" : "-"}</b></div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href={`/om/apj-point/${encodeURIComponent(point.idTitik)}/manage`} className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-bold text-white">
                    Kelola
                  </Link>
                  <Link href={`/om/apj-point/${encodeURIComponent(point.idTitik)}/qr`} className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
                    QR
                  </Link>
                  {point.latitude && point.longitude ? (
                    <a href={`https://www.google.com/maps?q=${point.latitude},${point.longitude}`} target="_blank" rel="noreferrer" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700">
                      Google Maps
                    </a>
                  ) : null}
                </div>
              </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {showCreateForm ? (
        <div className="fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto bg-slate-950/55 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-5xl rounded-[32px] border border-white/70 bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex flex-col gap-3 rounded-t-[32px] border-b border-slate-200 bg-white/95 p-5 backdrop-blur sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-red-600">Tambah APJ O&M</div>
                <h2 className="mt-1 text-2xl font-black text-slate-950">Form lengkap data titik APJ test</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Data ini masuk sebagai data commissioning valid bertanda test O&M, jadi bisa dipakai untuk QR, scan, laporan, dan distribusi tugas tanpa menunggu modul konstruksi.
                </p>
              </div>
              <button
                type="button"
                onClick={closeCreateModal}
                disabled={testBusy}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm disabled:opacity-60"
                aria-label="Tutup form tambah APJ"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={createManualTestPoint} className="space-y-5 p-5">
              <section className="rounded-[26px] border border-teal-100 bg-teal-50/70 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">Grup APJ</div>
                    <h3 className="mt-1 text-lg font-black text-slate-950">Pilih tempat data ini masuk</h3>
                    <p className="mt-1 text-xs leading-5 text-slate-600">Pakai grup lama kalau titik ini satu zona dengan data yang sudah ada, atau buat grup baru untuk zona/lokasi baru.</p>
                  </div>
                  <div className="grid min-w-[280px] grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const defaultGroup = createForm.group || groups[0]?.name || "";
                        setGroupMode("existing");
                        updateCreateForm("group", defaultGroup);
                        updateCreateForm("zona", createForm.zona || defaultGroup);
                      }}
                      disabled={groups.length === 0}
                      className={`rounded-2xl border px-3 py-2 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-45 ${
                        groupMode === "existing" ? "border-teal-500 bg-teal-600 text-white" : "border-slate-200 bg-white text-slate-700"
                      }`}
                    >
                      Grup yang ada
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setGroupMode("new");
                        updateCreateForm("group", "");
                        updateCreateForm("zona", "");
                      }}
                      className={`rounded-2xl border px-3 py-2 text-xs font-black transition ${
                        groupMode === "new" ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-700"
                      }`}
                    >
                      Grup baru
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {groupMode === "existing" ? (
                    <label className="block">
                      <span className="text-[11px] font-semibold text-slate-600">Pilih Grup</span>
                      <select
                        required
                        value={createForm.group}
                        onChange={(event) => {
                          updateCreateForm("group", event.target.value);
                          updateCreateForm("zona", event.target.value);
                        }}
                        className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-teal-400"
                      >
                        <option value="">Pilih grup APJ</option>
                        {groups.map((group) => (
                          <option key={group.id} value={group.name}>
                            {group.name} ({group.total} titik)
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <label className="block">
                      <span className="text-[11px] font-semibold text-slate-600">Nama Grup Baru</span>
                      <input
                        required
                        value={createForm.group}
                        onChange={(event) => {
                          updateCreateForm("group", event.target.value);
                          updateCreateForm("zona", event.target.value);
                        }}
                        className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-teal-400"
                        placeholder="Contoh: Grup APJ Jalan Melati"
                      />
                    </label>
                  )}
                  <label className="block">
                    <span className="text-[11px] font-semibold text-slate-600">Zona / Label Area</span>
                    <input
                      value={createForm.zona}
                      onChange={(event) => updateCreateForm("zona", event.target.value)}
                      className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-teal-400"
                      placeholder="Kosongkan jika sama dengan nama grup"
                    />
                  </label>
                </div>
              </section>

              <section className="grid gap-3 md:grid-cols-2">
                {([
                  ["No seri Tiang/Arm", "noSeriTiangArm", ["TIANG", "ARM"]],
                  ["No seri Lampu 1", "noSeriLampu1", ["LAMPU"]],
                  ["No seri Lampu 2", "noSeriLampu2", ["LAMPU"]],
                ] as const).map(([label, key, categories]) => (
                  <label key={key} className="block">
                    <span className="text-[11px] font-semibold text-slate-600">{label}</span>
                    <select
                      value={createForm[key]}
                      onChange={(event) => selectCreateComponent(key, event.target.value)}
                      className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
                    >
                      <option value="">Kosong / belum dipasang</option>
                      {materialUnits
                        .filter((unit) => (categories as readonly string[]).includes(unit.kategori) && unit.statusUnit === "Tersedia")
                        .filter((unit) => {
                          const serial = unit.nomorSeri || unit.kodeBarang;
                          if (key === "noSeriLampu1" || key === "noSeriLampu2") {
                            const otherSerial = key === "noSeriLampu1" ? createForm.noSeriLampu2 : createForm.noSeriLampu1;
                            if (serial === otherSerial) return false;
                            const otherUnit = materialUnits.find((item) => (item.nomorSeri || item.kodeBarang) === otherSerial);
                            if (otherUnit?.detail?.dayaWatt && unit.detail?.dayaWatt !== otherUnit.detail.dayaWatt) return false;
                          }
                          return true;
                        })
                        .map((unit) => {
                          const serial = unit.nomorSeri || unit.kodeBarang;
                          return <option key={unit.id} value={serial}>{serial} — {unit.namaBarang} ({unit.kategori})</option>;
                        })}
                    </select>
                  </label>
                ))}
                {[
                  ["ID Titik APJ", "idTitik", "Contoh: TEST-APJ-002"],
                  ["Kabupaten", "kabupaten", "Contoh: Tabanan / Denpasar"],
                  ["Kecamatan", "kecamatan", "Contoh: Tabanan"],
                  ["Nama Jalan", "namaJalan", "Contoh: Jalan Melati"],
                  ["Lebar Jalan", "lebarJalan", "Contoh: 8 m"],
                  ["Fungsi Ruas", "fungsiRuas", "Contoh: Arteri / Kolektor / Lokal"],
                  ["Daya Lampu", "dayaLampu", "Contoh: 120W"],
                  ["Tiang", "tiang", "Contoh: 9 m / Oktagonal"],
                  ["Lengan ARM", "lenganArm", "Contoh: Single Arm"],
                  ["Arm AG/EXS", "armAgExs", "Contoh: AG"],
                  ["Rata-rata Iluminasi (Lux)", "presetIluminasi", "Contoh: 17"],
                  ["Preset Awal (Lux)", "presetIluminasiAwal", "Contoh: 35"],
                  ["Batas Bawah Iluminasi (Lux)", "presetIluminasiBatas", "Contoh: 27"],
                  ["Latitude", "latitude", "Contoh: -8.5392"],
                  ["Longitude", "longitude", "Contoh: 115.1256"],
                  ["Instalasi", "instalasi", "Contoh: Terpasang / Belum terpasang"],
                ].map(([label, key, placeholder]) => (
                  <label key={key} className="block">
                    <span className="text-[11px] font-semibold text-slate-600">{label}</span>
                    <input
                      type={["presetIluminasi", "presetIluminasiAwal", "presetIluminasiBatas"].includes(key) ? "number" : "text"}
                      min={["presetIluminasi", "presetIluminasiAwal", "presetIluminasiBatas"].includes(key) ? "0" : undefined}
                      step={["presetIluminasi", "presetIluminasiAwal", "presetIluminasiBatas"].includes(key) ? "0.01" : undefined}
                      required={["idTitik", "kecamatan", "namaJalan", "fungsiRuas", "latitude", "longitude"].includes(key)}
                      disabled={key === "kabupaten" && Boolean(accountKabupaten)}
                      value={createForm[key as keyof typeof createForm]}
                      onChange={(event) => updateCreateForm(key as keyof typeof createForm, event.target.value)}
                      readOnly={key === "dayaLampu" && Boolean(createForm.noSeriLampu1 || createForm.noSeriLampu2)}
                      className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
                      placeholder={placeholder}
                    />
                  </label>
                ))}
              </section>

              <label className="block">
                <span className="text-[11px] font-semibold text-slate-600">Keterangan Titik</span>
                <textarea
                  value={createForm.keteranganTitik}
                  onChange={(event) => updateCreateForm("keteranganTitik", event.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
                  placeholder="Catatan titik, kondisi sekitar, identitas tambahan, atau catatan commissioning"
                />
              </label>

              <div className="sticky bottom-0 -mx-5 flex flex-col gap-2 border-t border-slate-200 bg-white/95 p-5 backdrop-blur sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeCreateModal}
                  disabled={testBusy}
                  className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 disabled:opacity-60"
                >
                  Batal
                </button>
                <button type="submit" disabled={testBusy} className="rounded-2xl bg-teal-600 px-5 py-3 text-sm font-black text-white shadow-sm disabled:opacity-60">
                  {testBusy ? "Menyimpan..." : "Simpan APJ Test"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function OMMapsPage() {
  return (
    <ProtectedRoute>
      <OMMapsContent />
    </ProtectedRoute>
  );
}
