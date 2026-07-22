"use client";

import { useEffect, useState } from "react";

type RoadType = "arterial" | "kolektor" | "lokal" | "lingkungan";
type ReportData = Record<string, any>;
type ResultRow = {
  distance: number;
  min: number;
  max: number;
  avg: number;
  ratio: number;
  passed: boolean;
  coverage: boolean;
  reason: string;
  grid: number[][];
};

type LampAnalysisResult = {
  slot: number;
  reportId: string;
  label: string;
  report: ReportData;
  results: ResultRow[];
  maximum: ResultRow | null;
  safeDistance: number | null;
};

const ROAD_OPTIONS: Array<{ id: RoadType; name: string; description: string }> = [
  { id: "arterial", name: "Arteri", description: "L-Avg min. 17 lux, rasio maks. 3,99" },
  { id: "kolektor", name: "Kolektor", description: "L-Avg min. 12 lux, rasio maks. 5,99" },
  { id: "lokal", name: "Lokal", description: "L-Avg min. 9 lux, rasio maks. 6,99" },
  { id: "lingkungan", name: "Lingkungan", description: "L-Avg min. 6 lux, rasio maks. 6,99" },
];

const ROAD_STANDARDS: Record<RoadType, { avgMin: number; ratioMax: number }> = {
  arterial: { avgMin: 17, ratioMax: 3.99 },
  kolektor: { avgMin: 12, ratioMax: 5.99 },
  lokal: { avgMin: 9, ratioMax: 6.99 },
  lingkungan: { avgMin: 6, ratioMax: 6.99 },
};

// Samakan posisi titik api dengan modul Analisis Kemerataan biasa.
// Data report dimulai dari titik api (indeks 0), lalu dibentangkan ke kanan.
// Pada grid analisis, titik api berada di kolom ke-3 (indeks 2), sehingga dua
// kolom di kirinya harus merupakan mirror dari sebaran di sebelah kanan.
const TITIK_API_COL_INDEX = 2;

function numeric(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return fallback;
  const parsed = Number.parseFloat(value.replace(",", ".").replace(/[^0-9.+-]/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function safeLux(value: unknown) {
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    for (const key of ["lux", "LUX", "value", "reading", "illuminance", "nilai"]) {
      if (key in object) return safeLux(object[key]);
    }
  }
  const parsed = numeric(value);
  return parsed > 0 && parsed <= 200 ? parsed : 0;
}

function normalizeGrid(report: ReportData | null): number[][] {
  if (!report) return [];
  let source: any = report.gridData ?? report.rawPayload?.gridData;
  if (typeof source === "string") {
    try { source = JSON.parse(source); } catch { return []; }
  }
  if (Array.isArray(source)) {
    return source.filter(Array.isArray).map((row: any[]) => row.map(safeLux));
  }
  if (!source || typeof source !== "object") return [];
  const rows = Math.max(0, Number.parseInt(String(source.rows || 0), 10));
  const cols = Math.max(0, Number.parseInt(String(source.cols || 0), 10));
  if (!rows || !cols) return [];
  const grid = Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));
  for (const cell of Array.isArray(source.cells) ? source.cells : []) {
    const row = Number.parseInt(String(cell?.row ?? ""), 10);
    const col = Number.parseInt(String(cell?.col ?? ""), 10);
    if (row >= 0 && row < rows && col >= 0 && col < cols) grid[row][col] = safeLux(cell);
  }
  return grid;
}

function mirrorGridLikeUniformity(grid: number[][]): number[][] {
  if (grid.length === 0) return [];

  return grid.map((sourceRow) => {
    if (!Array.isArray(sourceRow) || sourceRow.length === 0) return [];

    const columns = sourceRow.length;
    const fireColumn = Math.max(0, Math.min(columns - 1, TITIK_API_COL_INDEX));
    const aligned = Array.from({ length: columns }, () => 0);

    // Sama dengan alignGridToSize(..., "top", "left") pada kemerataan biasa:
    // nilai pertama report ditempatkan tepat di titik api.
    for (let sourceColumn = 0; sourceColumn < sourceRow.length; sourceColumn += 1) {
      const targetColumn = fireColumn + sourceColumn;
      if (targetColumn >= columns) break;
      aligned[targetColumn] = safeLux(sourceRow[sourceColumn]);
    }

    // Sama dengan mirrorColsForLampSide(..., "left") pada kemerataan biasa.
    for (let offset = 1; fireColumn - offset >= 0; offset += 1) {
      const sourceColumn = fireColumn + offset;
      if (sourceColumn >= columns) break;
      aligned[fireColumn - offset] = aligned[sourceColumn];
    }

    return aligned;
  });
}

function pickReferenceSpan(report: ReportData | null, grid: number[][]) {
  const raw = report?.rawPayload || {};
  for (const value of [report?.jarakTiang, report?.span, raw.jarakTiang, raw.jarak_tiang, raw.span, raw.jarak, raw.panjangGrid]) {
    const parsed = numeric(value);
    if (parsed > 0) return parsed;
  }
  return Math.max(1, grid.length - 1);
}

function interpolateRow(grid: number[][], physicalDistance: number, referenceSpan: number, column: number, poleHeight: number) {
  if (grid.length === 0 || referenceSpan <= 0) return 0;
  const maxRow = grid.length - 1;
  const rowPosition = physicalDistance / referenceSpan * maxRow;
  if (rowPosition <= maxRow) {
    const lower = Math.max(0, Math.floor(rowPosition));
    const upper = Math.min(maxRow, Math.ceil(rowPosition));
    const fraction = rowPosition - lower;
    const lowerValue = safeLux(grid[lower]?.[column]);
    const upperValue = safeLux(grid[upper]?.[column]);
    if (!lowerValue && !upperValue) return 0;
    return lowerValue + (upperValue - lowerValue) * fraction;
  }
  const edgeValue = safeLux(grid[maxRow]?.[column]);
  if (!edgeValue) return 0;
  const referenceRadius = Math.sqrt(referenceSpan ** 2 + poleHeight ** 2);
  const targetRadius = Math.sqrt(physicalDistance ** 2 + poleHeight ** 2);
  return edgeValue * (referenceRadius / targetRadius) ** 2;
}

function calculateCandidate(grid: number[][], distance: number, width: number, referenceSpan: number, poleHeight: number, standard: { avgMin: number; ratioMax: number }): ResultRow {
  const columns = Math.ceil(width);
  const availableColumns = Math.max(0, ...grid.map((row) => row.length));
  if (columns <= 0 || columns > availableColumns) {
    return { distance, min: 0, max: 0, avg: 0, ratio: 0, passed: false, coverage: false, reason: `Grid hanya mencakup ${availableColumns} m lebar jalan`, grid: [] };
  }
  const candidateGrid: number[][] = [];
  const values: number[] = [];
  let coverage = true;
  for (let longitudinal = 0; longitudinal <= distance; longitudinal += 1) {
    const row: number[] = [];
    for (let col = 0; col < columns; col += 1) {
      const fromFirstPole = interpolateRow(grid, longitudinal, referenceSpan, col, poleHeight);
      const fromSecondPole = interpolateRow(grid, distance - longitudinal, referenceSpan, col, poleHeight);
      const lux = fromFirstPole + fromSecondPole;
      row.push(lux);
      if (lux <= 0) coverage = false;
      else values.push(lux);
    }
    candidateGrid.push(row);
  }
  if (!coverage || values.length !== (distance + 1) * columns) {
    return { distance, min: 0, max: Math.max(0, ...values), avg: 0, ratio: 0, passed: false, coverage: false, reason: "Ada area jalan tanpa data lux", grid: candidateGrid };
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  const ratio = min > 0 ? avg / min : Number.POSITIVE_INFINITY;
  const avgPassed = avg >= standard.avgMin;
  const ratioPassed = ratio <= standard.ratioMax;
  return {
    distance,
    min,
    max,
    avg,
    ratio,
    coverage: true,
    passed: avgPassed && ratioPassed,
    reason: !avgPassed ? `L-Avg di bawah ${standard.avgMin} lux` : !ratioPassed ? `Rasio di atas ${standard.ratioMax}` : "Memenuhi standar",
    grid: candidateGrid,
  };
}

export default function LampDistanceAnalysis() {
  const [roadType, setRoadType] = useState<RoadType>("arterial");
  const [roadWidth, setRoadWidth] = useState("7");
  const [reports, setReports] = useState<ReportData[]>([]);
  const [reportIds, setReportIds] = useState<string[]>(["", "", ""]);
  const [referenceSpans, setReferenceSpans] = useState<string[]>(["", "", ""]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [resultSets, setResultSets] = useState<LampAnalysisResult[]>([]);
  const [activeSlot, setActiveSlot] = useState(0);
  const [selectedDistances, setSelectedDistances] = useState<Record<number, number>>({});
  const standard = ROAD_STANDARDS[roadType];

  const reportLabel = (report: ReportData) => `${report.title || report.projectTitle || report.id} · ${report.watt || "-"} · Tiang ${report.meter || "-"}`;
  const clearResults = () => {
    setResultSets([]);
    setSelectedDistances({});
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/admin/reports?limit=300&includeData=1&sort=desc", { cache: "no-store" });
        const payload = await response.json() as { reports?: ReportData[]; error?: string };
        if (!response.ok) throw new Error(payload.error || "Gagal memuat data lampu.");
        const available = (payload.reports || []).filter((item) => normalizeGrid(item).length > 0);
        const initialReports = available.slice(0, 3);
        setReports(available);
        setReportIds(initialReports.map((item) => String(item.id)).concat(["", "", ""]).slice(0, 3));
        setReferenceSpans(initialReports.map((item) => String(pickReferenceSpan(item, normalizeGrid(item)))).concat(["", "", ""]).slice(0, 3));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Gagal memuat data lampu.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const selectReport = (slot: number, reportId: string) => {
    const nextIds = [...reportIds];
    nextIds[slot] = reportId;
    setReportIds(nextIds);

    const nextSpans = [...referenceSpans];
    const selected = reports.find((item) => String(item.id) === reportId) || null;
    nextSpans[slot] = selected ? String(pickReferenceSpan(selected, normalizeGrid(selected))) : "";
    setReferenceSpans(nextSpans);
    clearResults();
  };

  const runAnalysis = () => {
    setError("");
    const width = numeric(roadWidth);
    if (width <= 0) return setError("Lebar jalan wajib lebih dari 0 meter.");

    const selectedIds = reportIds.filter(Boolean);
    if (selectedIds.length === 0) return setError("Pilih minimal satu data lampu yang memiliki grid lux.");
    if (new Set(selectedIds).size !== selectedIds.length) return setError("Data lampu yang sama tidak boleh dipilih lebih dari sekali.");

    const nextResults: LampAnalysisResult[] = [];
    for (let slot = 0; slot < reportIds.length; slot += 1) {
      const reportId = reportIds[slot];
      if (!reportId) continue;
      const report = reports.find((item) => String(item.id) === reportId);
      if (!report) continue;
      const sourceGrid = normalizeGrid(report);
      const span = numeric(referenceSpans[slot]) || pickReferenceSpan(report, sourceGrid);
      if (sourceGrid.length === 0 || span <= 0) return setError(`Data Lampu ${slot + 1} belum memiliki grid atau span yang valid.`);
      const analysisGrid = mirrorGridLikeUniformity(sourceGrid);
      const poleHeight = numeric(report.meter ?? report.rawPayload?.poleHeight ?? report.rawPayload?.tinggiTiang, 9) || 9;
      const results = Array.from({ length: 41 }, (_, index) => calculateCandidate(analysisGrid, 20 + index, width, span, poleHeight, standard));
      const maximum = [...results].reverse().find((item) => item.passed) || null;
      nextResults.push({
        slot,
        reportId,
        label: reportLabel(report),
        report,
        results,
        maximum,
        safeDistance: maximum ? Math.max(20, maximum.distance - 2) : null,
      });
    }
    setResultSets(nextResults);
    setSelectedDistances(Object.fromEntries(nextResults.map((item) => [item.slot, item.maximum?.distance || item.results.find((row) => row.coverage)?.distance || 20])));
    setActiveSlot(nextResults[0]?.slot || 0);
  };

  const activeResult = resultSets.find((item) => item.slot === activeSlot) || resultSets[0] || null;
  const maximum = activeResult?.maximum || null;
  const results = activeResult?.results || [];
  const selectedDistance = activeResult ? selectedDistances[activeResult.slot] : undefined;
  const heatmap = results.find((item) => item.distance === selectedDistance) || maximum || results.find((item) => item.coverage) || null;
  const heatValues = heatmap?.grid.flat().filter((value) => value > 0) || [];
  const heatMin = heatValues.length ? Math.min(...heatValues) : 0;
  const heatMax = heatValues.length ? Math.max(...heatValues) : 0;
  const bestDistance = Math.max(0, ...resultSets.map((item) => item.maximum?.distance || 0));

  return (
    <div className="min-h-[calc(100vh-58px)] bg-gradient-to-br from-slate-50 via-red-50 to-orange-50 p-4 sm:p-6">
      <div className="mx-auto max-w-[1700px]">
        <div className="grid gap-5 xl:grid-cols-[390px_minmax(0,1fr)]">
          <aside className="h-fit rounded-3xl border border-slate-200 bg-white p-5 shadow-sm xl:sticky xl:top-20">
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-red-600">Input Analisa</div>
            <h2 className="mt-2 text-xl font-black text-slate-950">Bandingkan sampai 3 lampu</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Fungsi dan lebar jalan dipakai bersama. Setiap lampu dihitung terpisah pada rentang 20–60 meter.</p>

            <label className="mt-5 block text-sm font-bold text-slate-700">Fungsi Jalan
              <select value={roadType} onChange={(event) => { setRoadType(event.target.value as RoadType); clearResults(); }} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm">
                {ROAD_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
              </select>
              <span className="mt-1 block text-xs font-normal text-slate-500">{ROAD_OPTIONS.find((item) => item.id === roadType)?.description}</span>
            </label>

            <label className="mt-4 block text-sm font-bold text-slate-700">Lebar Jalan (m)
              <input type="number" min="1" step="0.5" value={roadWidth} onChange={(event) => { setRoadWidth(event.target.value); clearResults(); }} className="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-3 text-sm" />
            </label>

            <div className="mt-5 space-y-3">
              {reportIds.map((reportId, slot) => {
                const selected = reports.find((item) => String(item.id) === reportId) || null;
                const grid = normalizeGrid(selected);
                return <div key={slot} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-2 flex items-center justify-between"><span className="text-xs font-black uppercase tracking-[0.14em] text-slate-600">Lampu {slot + 1}</span>{selected ? <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-slate-500">{selected.watt || "-"}</span> : null}</div>
                  <select disabled={loading} value={reportId} onChange={(event) => selectReport(slot, event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold">
                    <option value="">Tidak dipilih</option>
                    {reports.map((item) => <option key={String(item.id)} value={String(item.id)} disabled={reportIds.some((id, index) => index !== slot && id === String(item.id))}>{reportLabel(item)}</option>)}
                  </select>
                  {selected ? <div className="mt-2 grid grid-cols-[1fr_90px] items-end gap-2"><div className="text-[10px] leading-4 text-slate-500">Grid {grid.length} × {Math.max(0, ...grid.map((row) => row.length))}<br />Tiang {selected.meter || "-"}</div><label className="text-[10px] font-bold text-slate-500">Span awal (m)<input type="number" min="1" step="1" value={referenceSpans[slot]} onChange={(event) => { const next = [...referenceSpans]; next[slot] = event.target.value; setReferenceSpans(next); clearResults(); }} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-800" /></label></div> : null}
                </div>;
              })}
            </div>
            <span className="mt-2 block text-xs text-slate-500">{loading ? "Memuat report..." : `${reports.length} report memiliki grid lux`}</span>
            {error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
            <button type="button" onClick={runAnalysis} disabled={loading || !reportIds.some(Boolean)} className="mt-5 w-full rounded-2xl bg-red-600 px-4 py-3 text-sm font-black text-white shadow-sm hover:bg-red-700 disabled:opacity-50">Analisis Lampu Terpilih</button>
          </aside>

          <section className="min-w-0 space-y-5">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-red-600">Perbandingan Kemampuan Lampu</div>
              <h2 className="mt-2 text-2xl font-black text-slate-950">{resultSets.length ? `${resultSets.length} lampu selesai dianalisis` : "Belum dihitung"}</h2>
              <p className="mt-2 text-sm text-slate-600">Semua lampu memakai fungsi dan lebar jalan yang sama, sedangkan grid dan tinggi tiang dihitung masing-masing.</p>
              {resultSets.length ? <div className="mt-5 grid gap-3 lg:grid-cols-3">{resultSets.map((item) => {
                const isBest = Boolean(item.maximum && item.maximum.distance === bestDistance);
                return <button key={item.slot} type="button" onClick={() => setActiveSlot(item.slot)} className={`rounded-2xl border p-4 text-left transition ${activeResult?.slot === item.slot ? "border-red-500 ring-2 ring-red-100" : "border-slate-200 hover:border-red-200"} ${isBest ? "bg-emerald-50" : "bg-slate-50"}`}>
                  <div className="flex items-center justify-between gap-2"><span className="text-xs font-black uppercase tracking-[0.14em] text-red-600">Lampu {item.slot + 1}</span>{isBest ? <span className="rounded-full bg-emerald-600 px-2 py-1 text-[10px] font-black text-white">Terbaik</span> : null}</div>
                  <div className="mt-2 truncate text-xs font-bold text-slate-600" title={item.label}>{item.label}</div>
                  <div className="mt-3 text-2xl font-black text-slate-950">{item.maximum ? `${item.maximum.distance} m` : "Tidak lulus"}</div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] text-slate-500"><span>Aman<br /><b className="text-slate-800">{item.safeDistance ? `${item.safeDistance} m` : "-"}</b></span><span>L-Avg<br /><b className="text-slate-800">{item.maximum?.avg.toFixed(2) || "-"}</b></span><span>Rasio<br /><b className="text-slate-800">{item.maximum?.ratio.toFixed(2) || "-"}</b></span></div>
                </button>;
              })}</div> : null}
            </div>

            {activeResult ? <>
              <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap gap-2">{resultSets.map((item) => <button key={item.slot} type="button" onClick={() => setActiveSlot(item.slot)} className={`rounded-xl px-4 py-2 text-xs font-black ${activeResult.slot === item.slot ? "bg-red-600 text-white" : "bg-slate-100 text-slate-600"}`}>Lampu {item.slot + 1}</button>)}</div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Stat label="Jarak maksimal" value={maximum ? `${maximum.distance} m` : "Tidak lulus"} /><Stat label="Jarak aman" value={activeResult.safeDistance ? `${activeResult.safeDistance} m` : "-"} /><Stat label="L-Min" value={maximum ? `${maximum.min.toFixed(2)} lux` : "-"} /><Stat label="Rasio" value={maximum ? maximum.ratio.toFixed(2) : "-"} /></div>
              </div>
              <div className="grid gap-5 2xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 p-4"><h3 className="font-black text-slate-950">Pengujian Lampu {activeResult.slot + 1}: 20–60 meter</h3><p className="mt-1 truncate text-xs text-slate-500" title={activeResult.label}>{activeResult.label} · Klik baris untuk melihat sebaran jaraknya.</p></div><div className="max-h-[620px] overflow-auto"><table className="min-w-full text-left text-xs"><thead className="sticky top-0 bg-slate-50 text-slate-500"><tr>{["Jarak", "L-Avg", "L-Min", "Rasio", "Hasil"].map((item) => <th key={item} className="px-3 py-2 font-bold">{item}</th>)}</tr></thead><tbody>{results.map((row) => {
                  const isSelected = row.distance === selectedDistance;
                  return <tr key={row.distance} role="button" tabIndex={0} aria-selected={isSelected} onClick={() => setSelectedDistances((current) => ({ ...current, [activeResult.slot]: row.distance }))} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedDistances((current) => ({ ...current, [activeResult.slot]: row.distance })); } }} className={`cursor-pointer border-t transition focus:outline-none focus:ring-2 focus:ring-inset focus:ring-red-400 ${isSelected ? "border-red-200 bg-red-50" : row.distance === maximum?.distance ? "border-emerald-100 bg-emerald-50" : "border-slate-100 hover:bg-slate-50"}`} title={`${row.reason}. Klik untuk menampilkan heatmap ${row.distance} meter.`}><td className="px-3 py-2 font-black"><span className={isSelected ? "text-red-700" : ""}>{row.distance} m</span>{isSelected ? <span className="ml-2 rounded-full bg-red-600 px-1.5 py-0.5 text-[9px] font-bold text-white">Dilihat</span> : null}</td><td className="px-3 py-2">{row.avg.toFixed(2)}</td><td className="px-3 py-2">{row.min.toFixed(2)}</td><td className="px-3 py-2">{Number.isFinite(row.ratio) ? row.ratio.toFixed(2) : "-"}</td><td className="px-3 py-2"><span className={`rounded-full px-2 py-1 font-bold ${row.passed ? "bg-emerald-100 text-emerald-700" : "bg-red-50 text-red-700"}`}>{row.passed ? "Lulus" : "Tidak"}</span></td></tr>;
                })}</tbody></table></div></div>
                <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"><div><h3 className="font-black text-slate-950">Heatmap Lampu {activeResult.slot + 1} {heatmap ? `· ${heatmap.distance} meter` : ""}</h3><p className="mt-1 text-xs text-slate-500">Sebaran mirror yang sama dengan Analisis Kemerataan biasa.</p></div>{heatmap ? <div className="mt-4 max-h-[620px] overflow-auto rounded-2xl bg-slate-50 p-3"><div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${heatmap.grid[0]?.length || 1}, minmax(34px, 1fr))` }}>{heatmap.grid.flatMap((row, rowIndex) => row.map((value, colIndex) => { const normalized = heatMax > heatMin ? (value - heatMin) / (heatMax - heatMin) : 0.5; const hue = 220 - normalized * 220; return <div key={`${rowIndex}-${colIndex}`} title={`Posisi ${rowIndex} m, lebar ${colIndex + 1} m: ${value.toFixed(2)} lux`} className="flex h-8 items-center justify-center rounded text-[9px] font-bold" style={{ backgroundColor: `hsl(${hue} 82% 72%)`, color: normalized > 0.55 ? "#3f0b0b" : "#0f172a" }}>{value.toFixed(1)}</div>; }))}</div></div> : null}</div>
              </div>
            </> : <div className="flex min-h-[430px] items-center justify-center rounded-3xl border-2 border-dashed border-slate-300 bg-white/70 p-8 text-center"><div><div className="text-5xl">↔</div><h3 className="mt-4 text-xl font-black text-slate-800">Siap membandingkan tiga lampu</h3><p className="mt-2 max-w-lg text-sm leading-6 text-slate-500">Pilih satu sampai tiga data lampu, lalu sistem menghitung semua kandidat jarak secara bersamaan.</p></div></div>}
          </section>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3"><div className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">{label}</div><div className="mt-2 text-xl font-black text-slate-950">{value}</div></div>;
}
