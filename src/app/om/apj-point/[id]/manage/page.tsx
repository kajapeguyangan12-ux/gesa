"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";

type ApjPoint = {
  idTitik: string;
  namaTitik?: string;
  namaJalan: string;
  kabupaten: string;
  dayaLampu: string;
  group?: string;
  latitude: number;
  longitude: number;
  createdAt?: string;
  rawPayload?: Record<string, unknown>;
  componentAssets?: Record<string, ComponentAsset | null>;
};

type ComponentAsset = {
  id: string;
  nomorSeri: string;
  nama: string;
  kategori: string;
  kepemilikan: "Perusahaan" | "Pemerintah";
  lokasi: string;
  kondisi?: string;
  status?: string;
  detail: Record<string, unknown>;
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

type BmdUnit = {
  id: string;
  nomorRegister: string;
  nomorSeri?: string;
  namaAset: string;
  kategori: string;
  status: string;
};

const emptyManageForm = {
  namaTitik: "",
  noSeriTiangArm: "",
  kepemilikanTiangArm: "Perusahaan",
  noSeriLampu1: "",
  kepemilikanLampu1: "Perusahaan",
  noSeriLampu2: "",
  kepemilikanLampu2: "Perusahaan",
  kabupaten: "",
  kecamatan: "",
  namaJalan: "",
  lebarJalan: "",
  fungsiRuas: "",
  group: "",
  zona: "",
  dayaLampu: "",
  tiang: "",
  lenganArm: "",
  armAgExs: "",
  presetIluminasi: "",
  presetIluminasiAwal: "",
  presetIluminasiBatas: "",
  latitude: "",
  longitude: "",
  instalasi: "",
  keteranganTitik: "",
};

function rawText(raw: Record<string, unknown> | undefined, ...keys: string[]) {
  for (const key of keys) {
    const value = raw?.[key];
    if (value !== undefined && value !== null) return String(value);
  }
  return "";
}

function serialText(raw: Record<string, unknown> | undefined, ...keys: string[]) {
  const value = rawText(raw, ...keys);
  return value === "-" ? "" : value;
}

function qrImageUrl(value: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=10&data=${encodeURIComponent(value)}`;
}

function ManageApjPoint({ idTitik }: { idTitik: string }) {
  const router = useRouter();
  const [point, setPoint] = useState<ApjPoint | null>(null);
  const [form, setForm] = useState(emptyManageForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [materialUnits, setMaterialUnits] = useState<MaterialUnit[]>([]);
  const [bmdUnits, setBmdUnits] = useState<BmdUnit[]>([]);
  const isOmTestData = Boolean(point?.rawPayload?.isOmTestData || point?.rawPayload?.isTestData || point?.rawPayload?.source === "om_manual_test");

  const reportUrl = useMemo(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
    return `${origin}/lapor-apj?idTitik=${encodeURIComponent(idTitik)}`;
  }, [idTitik]);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/om/apj-point/${encodeURIComponent(idTitik)}`, { cache: "no-store" });
      const payload = (await response.json()) as { latest?: ApjPoint; error?: string };
      if (!response.ok || !payload.latest) throw new Error(payload.error || "Data APJ tidak ditemukan.");
      const next = payload.latest;
      const raw = next.rawPayload;
      setPoint(next);
      setForm({
        namaTitik: next.namaTitik || rawText(raw, "namaTitik", "nama_titik") || next.idTitik || idTitik,
        noSeriTiangArm: serialText(raw, "noSeriTiangArm", "no_seri_tiang_arm"),
        kepemilikanTiangArm: rawText(raw, "kepemilikanTiangArm") === "Pemerintah" ? "Pemerintah" : "Perusahaan",
        noSeriLampu1: serialText(raw, "noSeriLampu1", "no_seri_lampu_1"),
        kepemilikanLampu1: rawText(raw, "kepemilikanLampu1") === "Pemerintah" ? "Pemerintah" : "Perusahaan",
        noSeriLampu2: serialText(raw, "noSeriLampu2", "no_seri_lampu_2"),
        kepemilikanLampu2: rawText(raw, "kepemilikanLampu2") === "Pemerintah" ? "Pemerintah" : "Perusahaan",
        kabupaten: next.kabupaten === "-" ? "" : next.kabupaten || rawText(raw, "kabupaten"),
        kecamatan: rawText(raw, "kecamatan"),
        namaJalan: next.namaJalan === "-" ? "" : next.namaJalan || rawText(raw, "namaJalan", "nama_jalan", "jalan"),
        lebarJalan: rawText(raw, "lebarJalan", "lebar_jalan"),
        fungsiRuas: rawText(raw, "fungsiRuas", "fungsi_ruas"),
        group: next.group || rawText(raw, "grup", "group"),
        zona: rawText(raw, "zona"),
        dayaLampu: next.dayaLampu === "-" ? "" : next.dayaLampu || rawText(raw, "dayaLampu", "daya_lampu"),
        tiang: rawText(raw, "tiang"),
        lenganArm: rawText(raw, "lenganArm", "lengan_arm"),
        armAgExs: rawText(raw, "armAgExs", "arm_ag_exs"),
        presetIluminasi: rawText(raw, "presetIluminasi", "preset_iluminasi"),
        presetIluminasiAwal: rawText(raw, "presetIluminasiAwal", "preset_iluminasi_awal"),
        presetIluminasiBatas: rawText(raw, "presetIluminasiBatas", "preset_iluminasi_batas"),
        latitude: Number.isFinite(next.latitude) ? String(next.latitude) : "",
        longitude: Number.isFinite(next.longitude) ? String(next.longitude) : "",
        instalasi: rawText(raw, "instalasi"),
        keteranganTitik: rawText(raw, "keteranganTitik", "keterangan_titik"),
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Data APJ tidak ditemukan.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idTitik]);

  useEffect(() => {
    const loadAssetOptions = async () => {
      try {
        const [materialsResponse, bmdResponse] = await Promise.all([
          fetch("/api/bmd-gudang?resource=materials", { cache: "no-store" }),
          fetch("/api/bmd-gudang?resource=bmd-assets", { cache: "no-store" }),
        ]);
        const materialsPayload = (await materialsResponse.json()) as { items?: MaterialUnit[] };
        const bmdPayload = (await bmdResponse.json()) as { items?: BmdUnit[] };
        if (materialsResponse.ok) setMaterialUnits(materialsPayload.items || []);
        if (bmdResponse.ok) setBmdUnits(bmdPayload.items || []);
      } catch {
        setMaterialUnits([]);
        setBmdUnits([]);
      }
    };
    void loadAssetOptions();
  }, [idTitik, message]);

  useEffect(() => {
    if (materialUnits.length === 0) return;
    setForm((current) => {
      const hasCompanyLamp = (current.kepemilikanLampu1 === "Perusahaan" && Boolean(current.noSeriLampu1))
        || (current.kepemilikanLampu2 === "Perusahaan" && Boolean(current.noSeriLampu2));
      if (!hasCompanyLamp) return current;
      const syncedPower = syncManagedLampPower(current);
      if (!syncedPower || syncedPower === current.dayaLampu) return current;
      return { ...current, dayaLampu: syncedPower };
    });
    // Sinkronisasi hanya diperlukan ketika daftar master unit selesai dimuat.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materialUnits, form.noSeriLampu1, form.noSeriLampu2, form.kepemilikanLampu1, form.kepemilikanLampu2]);

  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const syncManagedLampPower = (next: typeof form) => {
    const serials = [
      next.kepemilikanLampu1 === "Perusahaan" ? next.noSeriLampu1 : "",
      next.kepemilikanLampu2 === "Perusahaan" ? next.noSeriLampu2 : "",
    ].filter(Boolean);
    const unit = materialUnits.find((item) => serials.includes(item.nomorSeri || item.kodeBarang));
    return unit?.detail?.dayaWatt || "";
  };

  const selectManagedComponent = (key: "noSeriTiangArm" | "noSeriLampu1" | "noSeriLampu2", value: string) => {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === "noSeriLampu1" || key === "noSeriLampu2") next.dayaLampu = syncManagedLampPower(next);
      return next;
    });
  };

  const changeManagedOwnership = (
    serialKey: "noSeriTiangArm" | "noSeriLampu1" | "noSeriLampu2",
    ownershipKey: "kepemilikanTiangArm" | "kepemilikanLampu1" | "kepemilikanLampu2",
    value: string
  ) => {
    setForm((current) => {
      const next = { ...current, [ownershipKey]: value, [serialKey]: "" };
      if (serialKey === "noSeriLampu1" || serialKey === "noSeriLampu2") next.dayaLampu = syncManagedLampPower(next);
      return next;
    });
  };

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/om/apj-point/${encodeURIComponent(idTitik)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) throw new Error(payload.error || "Gagal menyimpan data APJ.");
      setMessage(payload.message || "Data APJ berhasil disimpan.");
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Gagal menyimpan data APJ.");
    } finally {
      setSaving(false);
    }
  };

  const deleteTestPoint = async () => {
    if (!isOmTestData) {
      setError("Data konstruksi asli tidak boleh dihapus dari fitur test O&M.");
      return;
    }
    const confirmed = window.confirm(`Hapus data test APJ ${idTitik}? Data konstruksi asli tidak akan terpengaruh.`);
    if (!confirmed) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/om/apj-point/${encodeURIComponent(idTitik)}`, { method: "DELETE" });
      const payload = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) throw new Error(payload.error || "Gagal menghapus data APJ.");
      router.push("/om/maps");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Gagal menghapus data APJ.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.16),_transparent_30%),linear-gradient(180deg,_#f8fafc_0%,_#eefcf8_100%)] px-4 py-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link href="/om/maps" className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">‹</Link>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-700">Admin Data APJ</div>
              <h1 className="text-2xl font-black text-slate-950">Kelola Detail Titik APJ</h1>
              <p className="text-sm text-slate-600">Admin O&M mengelola detail APJ dan QR dari halaman ini.</p>
            </div>
          </div>
          <Link href={`/om/apj-point/${encodeURIComponent(idTitik)}/qr`} className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            Generate QR
          </Link>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="rounded-[28px] border border-slate-200 bg-white/95 p-5 shadow-sm">
            <div className="mb-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">ID Titik</div>
              <div className="mt-1 text-3xl font-black text-slate-950">{idTitik}</div>
              {isOmTestData ? (
                <div className="mt-2 inline-flex rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">Data test O&M</div>
              ) : null}
            </div>
            {loading ? <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Memuat data APJ...</div> : null}
            {error ? <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
            {point ? (
              <form onSubmit={save} className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2 rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm leading-6 text-sky-900">
                  Nomor seri hanya menjadi penghubung. Pilih <b>Perusahaan</b> untuk mengambil detail dari Gudang, atau <b>Pemerintah</b> untuk mengambil detail barang yang sudah dilepas dan tersimpan di BMD.
                </div>
                {([
                  ["Tiang/Arm", "noSeriTiangArm", "kepemilikanTiangArm", "tiangArm"],
                  ["Lampu 1", "noSeriLampu1", "kepemilikanLampu1", "lampu1"],
                  ["Lampu 2", "noSeriLampu2", "kepemilikanLampu2", "lampu2"],
                ] as const).map(([label, serialKey, ownershipKey, assetKey]) => {
                  const asset = point.componentAssets?.[assetKey];
                  const ownership = form[ownershipKey];
                  const allowedCategories = assetKey === "tiangArm" ? ["TIANG", "ARM"] : ["LAMPU"];
                  const companyOptions = materialUnits.filter((unit) =>
                    allowedCategories.includes(unit.kategori)
                    && (unit.statusUnit === "Tersedia" || unit.installedPointId === idTitik || (unit.nomorSeri || unit.kodeBarang) === form[serialKey])
                  );
                  const governmentOptions = bmdUnits.filter((unit) =>
                    allowedCategories.some((category) => unit.kategori.toUpperCase().includes(category))
                    || (unit.nomorSeri || unit.nomorRegister) === form[serialKey]
                  );
                  return (
                    <div key={serialKey} className="md:col-span-2 grid gap-3 rounded-2xl border border-slate-200 p-4 md:grid-cols-[1fr_220px]">
                      <label className="block">
                        <span className="text-sm font-semibold text-slate-700">No Seri {label}</span>
                        <select value={form[serialKey]} onChange={(event) => selectManagedComponent(serialKey, event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-teal-400">
                          <option value="">Kosong / belum dipasang</option>
                          {ownership === "Pemerintah"
                            ? governmentOptions.map((unit) => {
                                const serial = unit.nomorSeri || unit.nomorRegister;
                                return <option key={unit.id} value={serial}>{serial} — {unit.namaAset}</option>;
                              })
                            : companyOptions
                                .filter((unit) => {
                                  const serial = unit.nomorSeri || unit.kodeBarang;
                                  if (serialKey === "noSeriLampu1" || serialKey === "noSeriLampu2") {
                                    const otherSerial = serialKey === "noSeriLampu1" ? form.noSeriLampu2 : form.noSeriLampu1;
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
                      <label className="block">
                        <span className="text-sm font-semibold text-slate-700">Kepemilikan</span>
                        <select value={form[ownershipKey]} onChange={(event) => changeManagedOwnership(serialKey, ownershipKey, event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-teal-400">
                          <option value="Perusahaan">Barang Perusahaan (Gudang)</option>
                          <option value="Pemerintah">Barang Pemerintah (BMD)</option>
                        </select>
                      </label>
                      <div className={`md:col-span-2 rounded-xl px-4 py-3 text-sm ${asset ? "bg-emerald-50 text-emerald-800" : "bg-slate-50 text-slate-500"}`}>
                        {asset ? <><b>{asset.nama}</b> · {asset.kategori} · {asset.lokasi}{asset.kondisi ? ` · ${asset.kondisi}` : ""}</> : form[serialKey] ? "Detail belum ditemukan. Pastikan nomor seri sudah dibuat pada master yang dipilih, lalu simpan/muat ulang." : "Belum ada nomor seri yang dihubungkan."}
                      </div>
                    </div>
                  );
                })}
                {[
                  ["Nama Titik", "namaTitik"],
                  ["Kabupaten", "kabupaten"],
                  ["Kecamatan", "kecamatan"],
                  ["Nama Jalan", "namaJalan"],
                  ["Lebar Jalan", "lebarJalan"],
                  ["Fungsi Ruas", "fungsiRuas"],
                  ["Grup APJ", "group"],
                  ["Zona / Label Area", "zona"],
                  ["Daya Lampu", "dayaLampu"],
                  ["Tiang", "tiang"],
                  ["Lengan ARM", "lenganArm"],
                  ["ARM AG/EXS", "armAgExs"],
                  ["Preset Iluminasi", "presetIluminasi"],
                  ["Preset Iluminasi Awal", "presetIluminasiAwal"],
                  ["Batas Preset Iluminasi", "presetIluminasiBatas"],
                  ["Latitude", "latitude"],
                  ["Longitude", "longitude"],
                  ["Instalasi", "instalasi"],
                ].map(([label, key]) => (
                  <label key={key} className="block">
                    <span className="text-sm font-semibold text-slate-700">{label}</span>
                    <input
                      value={form[key as keyof typeof form]}
                      onChange={(event) => update(key as keyof typeof form, event.target.value)}
                      readOnly={key === "dayaLampu" && Boolean(form.noSeriLampu1 || form.noSeriLampu2)}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-teal-400"
                    />
                  </label>
                ))}
                <label className="block md:col-span-2">
                  <span className="text-sm font-semibold text-slate-700">Keterangan Titik</span>
                  <textarea
                    value={form.keteranganTitik}
                    onChange={(event) => update("keteranganTitik", event.target.value)}
                    rows={3}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-teal-400"
                  />
                </label>
                <div className="md:col-span-2">
                  {message ? <div className="mb-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div> : null}
                  <button type="submit" disabled={saving} className="rounded-2xl bg-teal-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-60">
                    {saving ? "Menyimpan..." : "Simpan Detail APJ"}
                  </button>
                  {isOmTestData ? (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void deleteTestPoint()}
                      className="ml-2 rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-bold text-red-700 disabled:opacity-60"
                    >
                      Hapus Data Test
                    </button>
                  ) : null}
                </div>
              </form>
            ) : null}
          </section>

          <aside className="space-y-4">
            <div className="rounded-[28px] border border-red-100 bg-white/95 p-5 text-center shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-red-600">QR Masyarakat</div>
              <img src={qrImageUrl(reportUrl)} alt={`QR ${idTitik}`} className="mx-auto mt-4 h-56 w-56 rounded-2xl border border-slate-200 bg-white p-3" />
              <div className="mt-3 break-all rounded-2xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">{reportUrl}</div>
              <Link href={`/lapor-apj?idTitik=${encodeURIComponent(idTitik)}`} className="mt-3 block rounded-2xl bg-red-600 px-4 py-3 text-sm font-bold text-white">
                Lihat Tampilan Masyarakat
              </Link>
            </div>
            <div className="rounded-[28px] border border-slate-200 bg-white/95 p-5 shadow-sm">
              <div className="text-sm font-black text-slate-950">Aturan Flow</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Admin mengelola data APJ di sini. QR hanya membuka halaman masyarakat untuk melihat ringkas data titik dan mengirim laporan.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

export default function ManageApjPointPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <ProtectedRoute>
      <ManageApjPoint idTitik={decodeURIComponent(id)} />
    </ProtectedRoute>
  );
}
