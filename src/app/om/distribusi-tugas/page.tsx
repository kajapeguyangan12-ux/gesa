"use client";

import { useEffect, useMemo, useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/hooks/useAuth";
import { OMPageShell } from "@/components/om/OMPageShell";
import { isMobileOmRole, PreventiveOMTaskList } from "@/components/om/PreventiveOMMobile";

type ApjPoint = {
  id: string;
  idTitik: string;
  namaTitik: string;
  namaJalan: string;
  dayaLampu: string;
  group: string;
  latitude: number;
  longitude: number;
  operationalAt?: string;
  validatedAt?: string;
};
type ApjGroup = { id: string; name: string; total: number; points: ApjPoint[] };
type OMUser = { id: string; uid: string; name: string; username: string; email: string; role: string };
type OMTask = {
  id: string;
  title: string;
  message: string;
  scope: string;
  groupName?: string;
  pointId?: string;
  pointName?: string;
  assignedName?: string;
  assignedUid?: string;
  repeatMode?: string;
  status?: string;
  createdAt?: string;
  operationalAt?: string;
  nextDueAt?: string;
};
type DistributionMode = "preventif" | "korektif";
type OMReport = {
  id: string;
  title: string;
  description: string;
  reportType: string;
  location: string;
  reporterName: string;
  status: string;
  createdAt?: string;
  damageType?: string;
  idTitik?: string;
  phoneNumber?: string;
  repairAction?: string;
};

function formatDateLabel(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function addMonths(value?: string, months = 6) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next.toISOString();
}

function TaskDistributionWorkspace() {
  const { user } = useAuth();
  const [mode, setMode] = useState<DistributionMode>("preventif");
  const [groups, setGroups] = useState<ApjGroup[]>([]);
  const [users, setUsers] = useState<OMUser[]>([]);
  const [reports, setReports] = useState<OMReport[]>([]);
  const [tasks, setTasks] = useState<OMTask[]>([]);
  const [form, setForm] = useState({
    scope: "group",
    groupId: "",
    pointId: "",
    assignedUid: "",
    title: "Tugas Preventif O&M",
    repeatMode: "6-bulan",
    luxTarget: "Sesuai standar jalan",
    description: "Ukur lux dari titik api lampu, cek lampu, ornamen, tiang, dan dokumentasikan bukti perawatan.",
  });
  const [correctiveForm, setCorrectiveForm] = useState({
    reportId: "",
    assignedUid: "",
    title: "Tugas Korektif O&M",
    description: "Tindak lanjuti laporan kerusakan APJ, perbaiki komponen bermasalah, dan dokumentasikan hasil pekerjaan.",
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedGroup = useMemo(() => groups.find((group) => group.id === form.groupId) || null, [form.groupId, groups]);
  const pointOptions = selectedGroup?.points || groups.flatMap((group) => group.points);
  const selectedPoint = useMemo(() => pointOptions.find((point) => point.idTitik === form.pointId) || null, [form.pointId, pointOptions]);
  const selectedUser = useMemo(() => users.find((item) => (item.uid || item.id) === form.assignedUid) || null, [form.assignedUid, users]);
  const preventiveUsers = useMemo(() => users.filter((item) => item.role === "petugas-om" || item.role === "petugas-om-preventif"), [users]);
  const correctiveUsers = useMemo(() => users.filter((item) => item.role === "petugas-om-correctif" || item.role === "petugas-om-corrective"), [users]);
  const selectedCorrectiveReport = useMemo(() => reports.find((report) => report.id === correctiveForm.reportId) || null, [correctiveForm.reportId, reports]);
  const selectedCorrectiveUser = useMemo(
    () => correctiveUsers.find((item) => (item.uid || item.id) === correctiveForm.assignedUid) || null,
    [correctiveForm.assignedUid, correctiveUsers]
  );
  const activeScopePoint = useMemo(() => {
    if (form.scope === "point") return selectedPoint;
    return selectedGroup?.points?.[0] || null;
  }, [form.scope, selectedGroup, selectedPoint]);
  const scopeOperationalAt = activeScopePoint?.operationalAt || activeScopePoint?.validatedAt || "";
  const scopeNextDueAt = useMemo(() => addMonths(scopeOperationalAt, 6), [scopeOperationalAt]);
  const selectedAssignedLabel = selectedUser?.name || selectedUser?.username || "-";

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [pointsResponse, usersResponse, tasksResponse] = await Promise.all([
        fetch("/api/om/apj-points?limit=5000", { cache: "no-store" }),
        fetch("/api/admin/user-admin?limit=300", { cache: "no-store" }),
        fetch("/api/om/tasks?limit=80", { cache: "no-store" }),
      ]);
      const pointsPayload = (await pointsResponse.json()) as { groups?: ApjGroup[]; error?: string };
      const usersPayload = (await usersResponse.json()) as { users?: OMUser[]; error?: string };
      const tasksPayload = (await tasksResponse.json()) as { tasks?: OMTask[]; error?: string };
      if (!pointsResponse.ok) throw new Error(pointsPayload.error || "Gagal memuat titik APJ.");
      if (!usersResponse.ok) throw new Error(usersPayload.error || "Gagal memuat petugas.");
      if (!tasksResponse.ok) throw new Error(tasksPayload.error || "Gagal memuat tugas.");
      const nextGroups = pointsPayload.groups || [];
      setGroups(nextGroups);
      setUsers((usersPayload.users || []).filter((item) => item.role.startsWith("petugas-om")));
      setTasks(tasksPayload.tasks || []);
      setForm((current) => ({
        ...current,
        groupId: current.groupId || nextGroups[0]?.id || "",
      }));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Gagal memuat data distribusi.");
    } finally {
      setLoading(false);
    }
  };

  const loadCorrectiveReports = async () => {
    try {
      const response = await fetch("/api/om/reports?limit=200", { cache: "no-store" });
      const payload = (await response.json()) as { reports?: OMReport[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Gagal memuat laporan korektif.");
      const nextReports = (payload.reports || []).filter((report) => ["new", "diproses"].includes(report.status || ""));
      setReports(nextReports);
      setCorrectiveForm((current) => ({
        ...current,
        reportId: current.reportId || nextReports[0]?.id || "",
      }));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Gagal memuat laporan korektif.");
      setReports([]);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (mode !== "korektif") return;
    void loadCorrectiveReports();
  }, [mode]);

  const update = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [key]: value, ...(key === "groupId" ? { pointId: "" } : {}) }));
  };

  const updateCorrective = (key: keyof typeof correctiveForm, value: string) => {
    setCorrectiveForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");
    if (form.scope === "group" && !selectedGroup) {
      setError("Pilih grup APJ dulu.");
      return;
    }
    if (form.scope === "point" && !selectedPoint) {
      setError("Pilih titik APJ dulu.");
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/om/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskType: "preventif",
          title: form.title,
          description: form.description,
          scope: form.scope,
          groupId: selectedGroup?.id || selectedPoint?.group || "",
          groupName: selectedGroup?.name || selectedPoint?.group || "",
          pointId: form.scope === "point" ? selectedPoint?.idTitik : "",
          pointName: selectedPoint?.namaTitik || selectedPoint?.namaJalan || "",
          targetPointCount: form.scope === "group" ? selectedGroup?.points.length || 0 : selectedPoint ? 1 : 0,
          targetPoints:
            form.scope === "group"
              ? (selectedGroup?.points || []).map((point) => ({
                  idTitik: point.idTitik,
                  namaTitik: point.namaTitik,
                  namaJalan: point.namaJalan,
                  dayaLampu: point.dayaLampu,
                  latitude: point.latitude,
                  longitude: point.longitude,
                  operationalAt: point.operationalAt || point.validatedAt || "",
                  nextDueAt: addMonths(point.operationalAt || point.validatedAt || "", 6),
                }))
              : selectedPoint
                ? [
                    {
                      idTitik: selectedPoint.idTitik,
                      namaTitik: selectedPoint.namaTitik,
                      namaJalan: selectedPoint.namaJalan,
                      dayaLampu: selectedPoint.dayaLampu,
                      latitude: selectedPoint.latitude,
                      longitude: selectedPoint.longitude,
                      operationalAt: selectedPoint.operationalAt || selectedPoint.validatedAt || "",
                      nextDueAt: addMonths(selectedPoint.operationalAt || selectedPoint.validatedAt || "", 6),
                    },
                  ]
                : [],
          assignedUid: selectedUser?.uid || selectedUser?.id || "",
          assignedName: selectedUser?.name || selectedUser?.username || "",
          repeatMode: form.repeatMode,
          operationalAt: scopeOperationalAt,
          nextDueAt: scopeNextDueAt,
          luxTarget: form.luxTarget,
          createdById: user?.uid || "",
          createdByName: user?.displayName || user?.name || user?.email || "Admin O&M",
        }),
      });
      const payload = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) throw new Error(payload.error || "Gagal mengirim tugas.");
      setMessage(payload.message || "Tugas preventif berhasil dikirim.");
      await loadData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Gagal mengirim tugas.");
    } finally {
      setSubmitting(false);
    }
  };

  const submitCorrective = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!selectedCorrectiveReport) {
      setError("Pilih laporan kerusakan dulu.");
      return;
    }
    setSubmitting(true);
    try {
      const pointId = selectedCorrectiveReport.idTitik || selectedCorrectiveReport.location || "";
      const response = await fetch("/api/om/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskType: "korektif",
          title: correctiveForm.title,
          description: correctiveForm.description,
          scope: "report",
          reportId: selectedCorrectiveReport.id,
          reportTitle: selectedCorrectiveReport.title,
          reportStatus: selectedCorrectiveReport.status,
          pointId,
          pointName: selectedCorrectiveReport.location,
          damageType: selectedCorrectiveReport.damageType || selectedCorrectiveReport.title,
          phoneNumber: selectedCorrectiveReport.phoneNumber || "",
          reporterName: selectedCorrectiveReport.reporterName,
          assignedUid: selectedCorrectiveUser?.uid || selectedCorrectiveUser?.id || "",
          assignedName: selectedCorrectiveUser?.name || selectedCorrectiveUser?.username || "",
          repeatMode: "berdasarkan-laporan",
          sourceReportId: selectedCorrectiveReport.id,
          createdById: user?.uid || "",
          createdByName: user?.displayName || user?.name || user?.email || "Admin O&M",
        }),
      });
      const payload = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) throw new Error(payload.error || "Gagal mengirim tugas korektif.");
      setMessage(payload.message || "Tugas korektif berhasil dikirim.");
      await Promise.all([loadData(), loadCorrectiveReports()]);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Gagal mengirim tugas korektif.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-2">
        <button
          type="button"
          onClick={() => setMode("preventif")}
          className={`rounded-[24px] border p-5 text-left transition ${mode === "preventif" ? "border-teal-300 bg-teal-50 shadow-sm" : "border-slate-200 bg-white hover:bg-slate-50"}`}
        >
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-700">Preventif</div>
          <div className="mt-2 text-xl font-black text-slate-950">Tugas rutin 6 bulan</div>
          <p className="mt-1 text-sm text-slate-600">Dikirim berdasarkan grup atau titik APJ yang sudah menyala.</p>
        </button>
        <button
          type="button"
          onClick={() => setMode("korektif")}
          className={`rounded-[24px] border p-5 text-left transition ${mode === "korektif" ? "border-rose-300 bg-rose-50 shadow-sm" : "border-slate-200 bg-white hover:bg-slate-50"}`}
        >
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-rose-700">Korektif</div>
          <div className="mt-2 text-xl font-black text-slate-950">Tugas dari laporan</div>
          <p className="mt-1 text-sm text-slate-600">Dikirim ketika ada laporan kerusakan dari preventif atau masyarakat.</p>
        </button>
      </div>

      {mode === "preventif" ? (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_360px]">
      <form onSubmit={submit} className="rounded-[28px] border border-white/70 bg-white/95 p-5 shadow-[0_18px_40px_-26px_rgba(15,23,42,0.38)]">
        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-700">Preventif</div>
        <h2 className="mt-2 text-2xl font-black text-slate-950">Kirim tugas per grup atau titik APJ</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">Petugas akan menerima tugas ini di daftar tugas mobile, lalu mengisi hasil ukur lux dan bukti perawatan.</p>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">Cakupan Tugas</span>
            <select value={form.scope} onChange={(event) => update("scope", event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-teal-400">
              <option value="group">Per Grup APJ</option>
              <option value="point">Per Titik APJ</option>
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">Grup APJ</span>
            <select value={form.groupId} onChange={(event) => update("groupId", event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-teal-400">
              <option value="">Pilih grup</option>
              {groups.map((group) => <option key={group.id} value={group.id}>{group.name} ({group.total} titik)</option>)}
            </select>
          </label>
          {form.scope === "point" ? (
            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-semibold text-slate-700">Titik APJ</span>
              <select value={form.pointId} onChange={(event) => update("pointId", event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-teal-400">
                <option value="">Pilih titik</option>
                {pointOptions.map((point) => <option key={point.idTitik} value={point.idTitik}>{point.idTitik} - {point.namaJalan || point.namaTitik} ({point.dayaLampu})</option>)}
              </select>
            </label>
          ) : null}
          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">Petugas</span>
            <select value={form.assignedUid} onChange={(event) => update("assignedUid", event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-teal-400">
              <option value="">Semua petugas preventif</option>
              {preventiveUsers.map((item) => <option key={item.uid || item.id} value={item.uid || item.id}>{item.name || item.username}</option>)}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">Jadwal</span>
            <select value={form.repeatMode} onChange={(event) => update("repeatMode", event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-teal-400">
              <option value="6-bulan">6 bulan sekali</option>
              <option value="bulanan">Bulanan</option>
              <option value="mingguan">Mingguan</option>
              <option value="sekali">Sekali</option>
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">Target Lux</span>
            <input value={form.luxTarget} onChange={(event) => update("luxTarget", event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-teal-400" />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">Judul</span>
            <input value={form.title} onChange={(event) => update("title", event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-teal-400" />
          </label>
          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-semibold text-slate-700">Penjabaran Tugas</span>
            <textarea value={form.description} onChange={(event) => update("description", event.target.value)} rows={5} className="w-full rounded-[24px] border border-slate-200 px-4 py-3 text-sm outline-none focus:border-teal-400" />
          </label>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Tanggal operasi titik</div>
            <div className="mt-2 text-sm font-bold text-slate-950">{formatDateLabel(scopeOperationalAt)}</div>
            <div className="mt-1 text-xs text-slate-500">{activeScopePoint ? `${activeScopePoint.idTitik} - ${activeScopePoint.namaJalan || activeScopePoint.namaTitik}` : "Pilih grup atau titik."}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Jatuh tempo 6 bulan</div>
            <div className="mt-2 text-sm font-bold text-slate-950">{formatDateLabel(scopeNextDueAt)}</div>
            <div className="mt-1 text-xs text-slate-500">Dihitung dari tanggal operasi lampu.</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Petugas terpilih</div>
            <div className="mt-2 text-sm font-bold text-slate-950">{selectedAssignedLabel}</div>
            <div className="mt-1 text-xs text-slate-500">{selectedUser ? selectedUser.email : "Semua petugas preventif"}</div>
          </div>
        </div>
        {error ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
        {message ? <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div> : null}
        <button type="submit" disabled={loading || submitting} className="mt-5 rounded-2xl bg-teal-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-60">
          {submitting ? "Mengirim..." : "Kirim Tugas Preventif"}
        </button>
      </form>

      <aside className="space-y-4">
        <div className="rounded-[28px] border border-slate-200 bg-white/95 p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Ringkasan</div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-teal-50 p-3"><div className="text-xs text-teal-700">Grup</div><div className="text-2xl font-black">{groups.length}</div></div>
            <div className="rounded-2xl bg-cyan-50 p-3"><div className="text-xs text-cyan-700">Petugas</div><div className="text-2xl font-black">{users.length}</div></div>
            <div className="rounded-2xl bg-emerald-50 p-3"><div className="text-xs text-emerald-700">Tugas</div><div className="text-2xl font-black">{tasks.length}</div></div>
            <div className="rounded-2xl bg-amber-50 p-3"><div className="text-xs text-amber-700">Titik target</div><div className="text-2xl font-black">{selectedGroup?.total || (selectedPoint ? 1 : 0)}</div></div>
          </div>
        </div>
        <div className="rounded-[28px] border border-slate-200 bg-white/95 p-5 shadow-sm">
          <div className="mb-3 text-sm font-black text-slate-950">Tugas terbaru</div>
          <div className="max-h-[420px] space-y-2 overflow-auto">
            {tasks.length === 0 ? <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Belum ada tugas preventif.</div> : null}
            {tasks.map((task) => (
              <div key={task.id} className="rounded-2xl border border-slate-200 bg-white p-3">
                <div className="text-sm font-bold text-slate-950">{task.title}</div>
                <div className="mt-1 text-xs text-slate-500">{task.scope === "point" ? task.pointId : task.groupName} • {task.repeatMode || "jadwal"}</div>
                <div className="mt-1 text-xs text-slate-500">Petugas: {task.assignedName || "-"}</div>
                <div className="mt-1 text-xs text-slate-500">Operasi: {formatDateLabel(task.operationalAt)}</div>
                <div className="mt-1 text-xs text-slate-500">Jatuh tempo: {formatDateLabel(task.nextDueAt)}</div>
                <div className="mt-2 inline-flex rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-700">{task.status || "assigned"}</div>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_360px]">
          <form onSubmit={submitCorrective} className="rounded-[28px] border border-white/70 bg-white/95 p-5 shadow-[0_18px_40px_-26px_rgba(15,23,42,0.38)]">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-rose-700">Korektif</div>
            <h2 className="mt-2 text-2xl font-black text-slate-950">Kirim tugas berdasarkan laporan kerusakan</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">Pilih laporan masuk, lalu tugaskan ke petugas korektif untuk diperbaiki di lapangan.</p>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-semibold text-slate-700">Laporan Kerusakan</span>
                <select value={correctiveForm.reportId} onChange={(event) => updateCorrective("reportId", event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-rose-400">
                  <option value="">Pilih laporan</option>
                  {reports.map((report) => (
                    <option key={report.id} value={report.id}>
                      {report.title || "Laporan"} - {report.location || report.idTitik || "-"} ({report.status})
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-700">Petugas Korektif</span>
                <select value={correctiveForm.assignedUid} onChange={(event) => updateCorrective("assignedUid", event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-rose-400">
                  <option value="">Semua petugas korektif</option>
                  {correctiveUsers.map((item) => <option key={item.uid || item.id} value={item.uid || item.id}>{item.name || item.username}</option>)}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-700">Judul</span>
                <input value={correctiveForm.title} onChange={(event) => updateCorrective("title", event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-rose-400" />
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-semibold text-slate-700">Instruksi Korektif</span>
                <textarea value={correctiveForm.description} onChange={(event) => updateCorrective("description", event.target.value)} rows={5} className="w-full rounded-[24px] border border-slate-200 px-4 py-3 text-sm outline-none focus:border-rose-400" />
              </label>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Sumber laporan</div>
                <div className="mt-2 text-sm font-bold text-slate-950">{selectedCorrectiveReport?.reportType || "-"}</div>
                <div className="mt-1 text-xs text-slate-500">{selectedCorrectiveReport?.reporterName || "Belum pilih laporan"}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Titik/Lokasi</div>
                <div className="mt-2 text-sm font-bold text-slate-950">{selectedCorrectiveReport?.idTitik || selectedCorrectiveReport?.location || "-"}</div>
                <div className="mt-1 text-xs text-slate-500">{selectedCorrectiveReport?.damageType || selectedCorrectiveReport?.title || "-"}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Petugas terpilih</div>
                <div className="mt-2 text-sm font-bold text-slate-950">{selectedCorrectiveUser?.name || selectedCorrectiveUser?.username || "-"}</div>
                <div className="mt-1 text-xs text-slate-500">{selectedCorrectiveUser?.email || "Semua petugas korektif"}</div>
              </div>
            </div>

            {error ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
            {message ? <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div> : null}
            <button type="submit" disabled={submitting} className="mt-5 rounded-2xl bg-rose-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-60">
              {submitting ? "Mengirim..." : "Kirim Tugas Korektif"}
            </button>
          </form>

          <aside className="space-y-4">
            <div className="rounded-[28px] border border-slate-200 bg-white/95 p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Ringkasan Korektif</div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-rose-50 p-3"><div className="text-xs text-rose-700">Laporan aktif</div><div className="text-2xl font-black">{reports.length}</div></div>
                <div className="rounded-2xl bg-cyan-50 p-3"><div className="text-xs text-cyan-700">Petugas</div><div className="text-2xl font-black">{correctiveUsers.length}</div></div>
                <div className="rounded-2xl bg-amber-50 p-3"><div className="text-xs text-amber-700">Baru</div><div className="text-2xl font-black">{reports.filter((report) => report.status === "new").length}</div></div>
                <div className="rounded-2xl bg-blue-50 p-3"><div className="text-xs text-blue-700">Diproses</div><div className="text-2xl font-black">{reports.filter((report) => report.status === "diproses").length}</div></div>
              </div>
            </div>
            <div className="rounded-[28px] border border-slate-200 bg-white/95 p-5 shadow-sm">
              <div className="mb-3 text-sm font-black text-slate-950">Laporan tersedia</div>
              <div className="max-h-[420px] space-y-2 overflow-auto">
                {reports.length === 0 ? <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Belum ada laporan aktif untuk korektif.</div> : null}
                {reports.map((report) => (
                  <button key={report.id} type="button" onClick={() => updateCorrective("reportId", report.id)} className={`block w-full rounded-2xl border p-3 text-left ${correctiveForm.reportId === report.id ? "border-rose-300 bg-rose-50" : "border-slate-200 bg-white"}`}>
                    <div className="text-sm font-bold text-slate-950">{report.title || "Laporan Kerusakan"}</div>
                    <div className="mt-1 text-xs text-slate-500">{report.location || report.idTitik || "-"} • {report.status}</div>
                    <div className="mt-1 line-clamp-2 text-xs text-slate-500">{report.description || "-"}</div>
                  </button>
                ))}
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

export default function OMDistribusiTugasPage() {
  const { user } = useAuth();
  const isMobileRole = isMobileOmRole(user?.role);

  return (
    <ProtectedRoute>
      {isMobileRole ? (
        <PreventiveOMTaskList />
      ) : (
      <OMPageShell
        eyebrow="Distribusi Tugas"
        title="Distribusi tugas O&M dengan komposisi yang siap untuk kontrol lapangan."
        description="Halaman ini diarahkan untuk pembagian pekerjaan, pemantauan petugas, dan kontrol distribusi agar admin bisa melihat alokasi tugas secara cepat."
        statusTitle="Area distribusi disiapkan untuk alur kerja lapangan."
        statusDescription="Saat fitur pembagian tugas ditambahkan, layout ini sudah siap menampung daftar petugas, detail pekerjaan, dan histori assignment dalam satu workspace."
        metaCards={[
          { label: "Fungsi", value: "Assign", hint: "Bagikan pekerjaan ke petugas", tone: "teal" },
          { label: "Mode", value: "Control", hint: "Kelola alokasi tugas", tone: "cyan" },
          { label: "Target", value: "Petugas", hint: "Distribusi dibuat lebih terarah", tone: "slate" },
          { label: "Tahap", value: "Draft", hint: "Struktur siap dipakai modul inti", tone: "emerald" },
        ]}
      >
        <TaskDistributionWorkspace />
      </OMPageShell>
      )}
    </ProtectedRoute>
  );
}
