"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { OMPageShell } from "@/components/om/OMPageShell";

type Reading = {
  id: string;
  sampledAt: string;
  voltage: number | null;
  current: number | null;
  powerKw: number | null;
  energyKwh: number | null;
  powerFactor: number | null;
  frequencyHz: number | null;
  status: string;
};

type Group = {
  id: string;
  name: string;
  lampCount: number;
  panel: null | { id: string; name: string; meterSerial: string; mqttTopic: string; status: string };
  latestReading: Reading | null;
};

type Point = {
  id: string;
  idTitik: string;
  namaTitik: string;
  namaJalan: string;
  dayaLampu: string;
  noSeriLampu1: string;
  noSeriLampu2: string;
  status: string;
  updatedAt: string;
};

type History = {
  id: string;
  assetType: string;
  assetId: string;
  eventType: string;
  description: string;
  occurredAt: string;
  source: string;
};

function dateTime(value?: string) {
  if (!value) return "Belum ada data";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

function metric(value: number | null | undefined, unit: string) {
  return value === null || value === undefined ? "-" : `${value.toLocaleString("id-ID", { maximumFractionDigits: 2 })} ${unit}`;
}

function statusTone(status?: string) {
  const value = (status || "").toLowerCase();
  if (["normal", "online", "aktif"].includes(value)) return "bg-emerald-50 text-emerald-700";
  if (["warning", "peringatan"].includes(value)) return "bg-amber-50 text-amber-700";
  return "bg-slate-100 text-slate-600";
}

export default function OMECMHistory() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"ecm" | "history">("ecm");
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [points, setPoints] = useState<Point[]>([]);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [history, setHistory] = useState<History[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [setupRequired, setSetupRequired] = useState(false);
  const [showPanelForm, setShowPanelForm] = useState(false);
  const [savingPanel, setSavingPanel] = useState(false);
  const [message, setMessage] = useState("");
  const [panelForm, setPanelForm] = useState({ panelName: "", meterSerial: "", mqttTopic: "" });

  const area = useMemo(() => {
    if (!user) return "";
    return user.role === "super-admin" ? "" : user.kabupaten?.trim().toLowerCase() || "tabanan";
  }, [user]);
  const selectedGroup = groups.find((group) => group.id === selectedId) || null;

  const loadGroups = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (area) params.set("kabupaten", area);
      const response = await fetch(`/api/om/ecm?${params}`, { cache: "no-store" });
      const payload = await response.json() as { groups?: Group[]; setupRequired?: boolean; error?: string };
      if (!response.ok) throw new Error(payload.error || "Gagal memuat grup ECM.");
      const nextGroups = payload.groups || [];
      setGroups(nextGroups);
      setSetupRequired(Boolean(payload.setupRequired));
      setSelectedId((current) => current && nextGroups.some((group) => group.id === current) ? current : nextGroups[0]?.id || "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Gagal memuat grup ECM.");
    } finally {
      setLoading(false);
    }
  }, [area]);

  const loadDetail = useCallback(async (groupId: string) => {
    if (!groupId) return;
    setDetailLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ groupId, limit: "168" });
      if (area) params.set("kabupaten", area);
      const response = await fetch(`/api/om/ecm?${params}`, { cache: "no-store" });
      const payload = await response.json() as { points?: Point[]; readings?: Reading[]; history?: History[]; setupRequired?: boolean; error?: string };
      if (!response.ok) throw new Error(payload.error || "Gagal memuat detail grup.");
      setPoints(payload.points || []);
      setReadings(payload.readings || []);
      setHistory(payload.history || []);
      setSetupRequired(Boolean(payload.setupRequired));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Gagal memuat detail grup.");
    } finally {
      setDetailLoading(false);
    }
  }, [area]);

  useEffect(() => { void loadGroups(); }, [loadGroups]);
  useEffect(() => { void loadDetail(selectedId); }, [loadDetail, selectedId]);
  useEffect(() => {
    setPanelForm({
      panelName: selectedGroup?.panel?.name || (selectedGroup ? `Panel ${selectedGroup.name}` : ""),
      meterSerial: selectedGroup?.panel?.meterSerial === "-" ? "" : selectedGroup?.panel?.meterSerial || "",
      mqttTopic: selectedGroup?.panel?.mqttTopic === "-" ? "" : selectedGroup?.panel?.mqttTopic || "",
    });
  }, [selectedGroup?.id, selectedGroup?.panel?.id]);
  useEffect(() => {
    if (!selectedGroup) {
      setSelectedAssetId("");
      return;
    }
    setSelectedAssetId(selectedGroup.panel ? `panel:${selectedGroup.panel.id}` : points[0]?.idTitik ? `lampu:${points[0].idTitik}` : "");
  }, [selectedGroup?.id, selectedGroup?.panel?.id, points]);

  const savePanel = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedGroup) return;
    setSavingPanel(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/om/ecm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "register-panel",
          groupId: selectedGroup.id,
          groupName: selectedGroup.name,
          panelId: selectedGroup.panel?.id,
          ...panelForm,
          smartMeterSerial: panelForm.meterSerial,
          status: panelForm.meterSerial ? "terdaftar" : "belum-terhubung",
          actorRole: user?.role || "admin",
          actorKabupaten: area,
        }),
      });
      const payload = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(payload.error || "Gagal menyimpan panel.");
      setMessage(payload.message || "Panel berhasil disimpan.");
      setShowPanelForm(false);
      await loadGroups();
      await loadDetail(selectedGroup.id);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Gagal menyimpan panel.");
    } finally {
      setSavingPanel(false);
    }
  };

  const latest = readings[0] || selectedGroup?.latestReading;
  const selectedAsset = useMemo(() => {
    const [type, id] = selectedAssetId.split(":");
    if (type === "panel") return { type, id, name: selectedGroup?.panel?.name || "Panel APJ" };
    const point = points.find((item) => item.idTitik === id);
    return point ? { type: "lampu", id, name: point.idTitik } : null;
  }, [points, selectedAssetId, selectedGroup?.panel?.name]);
  const historyItems = useMemo(() => {
    if (!selectedAsset) return [];
    const storedItems = history
      .filter((item) => item.assetType === selectedAsset.type && item.assetId === selectedAsset.id)
      .map((item) => ({ type: item.assetType, asset: selectedAsset.name, title: item.eventType, detail: item.description || item.source, at: item.occurredAt }));
    if (selectedAsset.type === "panel") {
      return [
        ...storedItems,
        ...readings.map((item) => ({ type: "panel", asset: selectedAsset.name, title: "Pembacaan smart meter", detail: `${metric(item.powerKw, "kW")} · ${metric(item.energyKwh, "kWh")} · ${item.status}`, at: item.sampledAt })),
      ].sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime());
    }
    const point = points.find((item) => item.idTitik === selectedAsset.id);
    const masterItem = point ? [{ type: "lampu", asset: point.idTitik, title: "Data titik APJ diperbarui", detail: `${point.namaJalan} · ${point.dayaLampu} · No. seri ${point.noSeriLampu1}`, at: point.updatedAt }] : [];
    return [...storedItems, ...masterItem].sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime());
  }, [history, points, readings, selectedAsset]);

  return (
    <OMPageShell
      eyebrow="ECM & History"
      title="Monitoring panel dan riwayat aset APJ dalam satu modul."
      description="Buka grup untuk melihat panel, pembacaan smart meter dua-jam, lalu pindah tab untuk menelusuri history panel dan setiap lampu."
      statusTitle="Satu grup, satu panel, seluruh anggota tetap terbaca."
      statusDescription="Data MQTT dibentuk per interval dua jam agar monitoring konsumsi dan penelusuran aset tidak bercampur antarkelompok."
      metaCards={[
        { label: "Grup", value: String(groups.length), hint: "Grup APJ tersedia", tone: "teal" },
        { label: "Panel", value: String(groups.filter((group) => group.panel).length), hint: "Panel sudah didaftarkan", tone: "cyan" },
        { label: "Lampu", value: String(groups.reduce((sum, group) => sum + group.lampCount, 0)), hint: "Anggota seluruh grup", tone: "emerald" },
        { label: "Interval", value: "2 Jam", hint: "Siklus data smart meter", tone: "slate" },
      ]}
    >
      <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
          <div className="inline-flex rounded-2xl bg-slate-100 p-1">
            <button type="button" onClick={() => setTab("ecm")} className={`rounded-xl px-4 py-2 text-sm font-bold ${tab === "ecm" ? "bg-slate-950 text-white shadow" : "text-slate-600"}`}>ECM Panel</button>
            <button type="button" onClick={() => setTab("history")} className={`rounded-xl px-4 py-2 text-sm font-bold ${tab === "history" ? "bg-slate-950 text-white shadow" : "text-slate-600"}`}>History Aset</button>
          </div>
          <button type="button" onClick={() => void loadGroups()} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700">Muat ulang</button>
        </div>

        {setupRequired ? <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Tabel ECM belum aktif. Jalankan tambahan schema pada <b>scripts/om-supabase-schema.sql</b> di Supabase.</div> : null}
        {error ? <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
        {message ? <div className="border-b border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}

        <div className="grid min-h-[560px] lg:grid-cols-[310px_minmax(0,1fr)]">
          <aside className="border-b border-slate-200 bg-slate-50/80 p-3 lg:border-b-0 lg:border-r">
            <div className="px-2 pb-3 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Daftar Grup APJ</div>
            <div className="space-y-2">
              {loading ? <div className="rounded-xl bg-white p-4 text-sm text-slate-500">Memuat grup...</div> : null}
              {!loading && groups.length === 0 ? <div className="rounded-xl bg-white p-4 text-sm text-slate-500">Belum ada grup commissioning.</div> : null}
              {groups.map((group) => (
                <button key={group.id} type="button" onClick={() => setSelectedId(group.id)} className={`w-full rounded-2xl border p-3 text-left transition ${selectedId === group.id ? "border-teal-400 bg-white shadow-sm" : "border-transparent bg-white/70 hover:border-slate-200"}`}>
                  <div className="flex items-start justify-between gap-2"><span className="font-black text-slate-950">{group.name}</span><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${statusTone(group.latestReading?.status || group.panel?.status)}`}>{group.latestReading?.status || group.panel?.status || "Tanpa panel"}</span></div>
                  <div className="mt-2 text-xs text-slate-500">{group.lampCount} lampu · {group.panel?.meterSerial || "smart meter belum diatur"}</div>
                </button>
              ))}
            </div>
          </aside>

          <section className="min-w-0 p-4 sm:p-5">
            {!selectedGroup ? <div className="flex min-h-[420px] items-center justify-center text-sm text-slate-500">Pilih grup APJ.</div> : detailLoading ? <div className="text-sm text-slate-500">Memuat detail {selectedGroup.name}...</div> : tab === "ecm" ? (
              <div className="space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><div className="text-xs font-bold uppercase tracking-[0.2em] text-teal-700">Grup aktif</div><h2 className="mt-1 text-2xl font-black text-slate-950">{selectedGroup.name}</h2><p className="mt-1 text-sm text-slate-500">{points.length} titik lampu terhubung ke grup ini.</p></div>
                  <button type="button" onClick={() => setShowPanelForm((value) => !value)} className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-bold text-white">{selectedGroup.panel ? "Kelola Panel" : "Daftarkan Panel"}</button>
                </div>

                {showPanelForm ? <form onSubmit={savePanel} className="grid gap-3 rounded-2xl border border-teal-200 bg-teal-50 p-4 sm:grid-cols-3">
                  <label className="text-xs font-semibold text-slate-600">Nama Panel<input required value={panelForm.panelName} onChange={(event) => setPanelForm((form) => ({ ...form, panelName: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" /></label>
                  <label className="text-xs font-semibold text-slate-600">Serial Smart Meter<input value={panelForm.meterSerial} onChange={(event) => setPanelForm((form) => ({ ...form, meterSerial: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" /></label>
                  <label className="text-xs font-semibold text-slate-600">MQTT Topic<input value={panelForm.mqttTopic} onChange={(event) => setPanelForm((form) => ({ ...form, mqttTopic: event.target.value }))} placeholder="apj/grup/panel/meter" className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" /></label>
                  <div className="sm:col-span-3"><button disabled={savingPanel || setupRequired} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{savingPanel ? "Menyimpan..." : "Simpan Panel"}</button></div>
                </form> : null}

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <Metric label="Tegangan" value={metric(latest?.voltage, "V")} />
                  <Metric label="Arus" value={metric(latest?.current, "A")} />
                  <Metric label="Daya Aktif" value={metric(latest?.powerKw, "kW")} />
                  <Metric label="Energi" value={metric(latest?.energyKwh, "kWh")} />
                </div>
                <div className="rounded-2xl border border-slate-200">
                  <div className="border-b border-slate-200 px-4 py-3"><h3 className="font-black text-slate-950">Pembacaan per 2 jam</h3><p className="text-xs text-slate-500">Terakhir: {dateTime(latest?.sampledAt)}</p></div>
                  <div className="overflow-x-auto"><table className="min-w-full text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr>{["Waktu", "Volt", "Ampere", "kW", "kWh", "PF", "Hz", "Status"].map((label) => <th key={label} className="px-3 py-2 font-bold">{label}</th>)}</tr></thead><tbody>{readings.map((row) => <tr key={row.id} className="border-t border-slate-100"><td className="whitespace-nowrap px-3 py-2">{dateTime(row.sampledAt)}</td><td className="px-3 py-2">{row.voltage ?? "-"}</td><td className="px-3 py-2">{row.current ?? "-"}</td><td className="px-3 py-2">{row.powerKw ?? "-"}</td><td className="px-3 py-2">{row.energyKwh ?? "-"}</td><td className="px-3 py-2">{row.powerFactor ?? "-"}</td><td className="px-3 py-2">{row.frequencyHz ?? "-"}</td><td className="px-3 py-2"><span className={`rounded-full px-2 py-1 font-bold ${statusTone(row.status)}`}>{row.status}</span></td></tr>)}</tbody></table>{readings.length === 0 ? <div className="p-5 text-center text-sm text-slate-500">Belum ada data MQTT untuk grup ini.</div> : null}</div>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div><div className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">Pilih aset dalam grup</div><h2 className="mt-1 text-2xl font-black text-slate-950">{selectedGroup.name}</h2><p className="mt-1 text-sm text-slate-500">Pilih panel atau satu ID titik APJ untuk melihat history miliknya saja.</p></div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {selectedGroup.panel ? <AssetCard selected={selectedAssetId === `panel:${selectedGroup.panel.id}`} onClick={() => setSelectedAssetId(`panel:${selectedGroup.panel!.id}`)} title={selectedGroup.panel.name} subtitle={selectedGroup.panel.meterSerial || "-"} type="Panel" /> : null}
                  {points.map((point) => <AssetCard key={point.idTitik} selected={selectedAssetId === `lampu:${point.idTitik}`} onClick={() => setSelectedAssetId(`lampu:${point.idTitik}`)} title={point.idTitik} subtitle={`${point.noSeriLampu1}${point.noSeriLampu2 !== "-" ? ` / ${point.noSeriLampu2}` : ""}`} type="Titik APJ" />)}
                </div>
                <div className="rounded-2xl border border-slate-200 p-4"><h3 className="font-black text-slate-950">History {selectedAsset?.name || "aset"}</h3><p className="mt-1 text-xs text-slate-500">Urutan tanggal terbaru, termasuk kegiatan preventif dan korektif.</p><div className="mt-4 space-y-3">{historyItems.map((item, index) => <div key={`${item.type}-${item.asset}-${item.at}-${index}`} className="flex gap-3"><div className={`mt-1 h-3 w-3 shrink-0 rounded-full ${item.type === "panel" ? "bg-cyan-500" : "bg-amber-500"}`} /><div className="min-w-0 flex-1 border-b border-slate-100 pb-3"><div className="flex flex-wrap justify-between gap-2"><span className="font-bold text-slate-900">{item.title}</span><span className="text-xs text-slate-400">{dateTime(item.at)}</span></div><p className="mt-1 text-sm text-slate-600">{item.detail}</p></div></div>)}{historyItems.length === 0 ? <div className="text-sm text-slate-500">Belum ada history untuk aset yang dipilih.</div> : null}</div></div>
              </div>
            )}
          </section>
        </div>
      </div>
    </OMPageShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{label}</div><div className="mt-2 text-xl font-black text-slate-950">{value}</div></div>;
}

function AssetCard({ type, title, subtitle, selected, onClick }: { type: string; title: string; subtitle: string; selected: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`rounded-2xl border p-3 text-left transition ${selected ? "border-cyan-400 bg-cyan-50 shadow-sm" : "border-slate-200 bg-white hover:border-cyan-200"}`}><div className="text-[10px] font-bold uppercase tracking-[0.18em] text-teal-600">{type}</div><div className="mt-1 font-black text-slate-950">{title}</div><div className="mt-1 truncate text-xs text-slate-500">No. seri: {subtitle}</div></button>;
}
