"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import ProtectedRoute from "@/components/ProtectedRoute";

type ReportData = any;

function ReportViewContent() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const reportId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<ReportData | null>(null);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        setLoading(true);
        const ref = doc(db, "reports", reportId);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setReport({ id: snap.id, ...snap.data() });
        } else {
          setReport(null);
        }
      } catch (e) {
        console.error("Failed to load report:", e);
        setReport(null);
      } finally {
        setLoading(false);
      }
    };
    if (reportId) fetchReport();
  }, [reportId]);

  const toDateValue = (value: any): Date | null => {
    if (!value) return null;
    if (value?.toDate && typeof value.toDate === "function") return value.toDate();
    if (value instanceof Date) return value;
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed;
  };

  const pickFirstString = (...vals: any[]) => {
    for (const v of vals) {
      if (v === null || v === undefined) continue;
      const s = String(v).trim();
      if (s) return s;
    }
    return "-";
  };

  const formatWatt = (val: any) => {
    if (val === null || val === undefined || val === "") return "-";
    const n = typeof val === "number" ? val : parseFloat(String(val).replace(",", "."));
    if (!isNaN(n) && isFinite(n)) return `${n}W`;
    return String(val);
  };

  const formatMeter = (val: any) => {
    if (val === null || val === undefined || val === "") return "-";
    const n = typeof val === "number" ? val : parseFloat(String(val).replace(",", "."));
    if (!isNaN(n) && isFinite(n)) return `${n} Meter`;
    return String(val);
  };

  const formatVoltage = (val: any) => {
    if (val === null || val === undefined || val === "") return "-";
    const n = typeof val === "number" ? val : parseFloat(String(val).replace(",", "."));
    if (!isNaN(n) && isFinite(n)) return `${n}V`;
    return String(val);
  };

  const formatLuxNumber = (num: number) => {
    if (!isFinite(num) || isNaN(num)) return "0";
    const rounded = Math.round(num * 10) / 10;
    return rounded.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  };

  const parseGridData = (data: any): number[][] => {
    if (!data) return [];
    let gd = data.gridData ?? data.grid ?? data.dataGrid;
    if (typeof gd === "string") {
      try {
        gd = JSON.parse(gd);
      } catch (e) {
        return [];
      }
    }
    if (!Array.isArray(gd)) return [];
    return gd.map((row: any) =>
      Array.isArray(row)
        ? row.map((cell: any) => {
            if (typeof cell === "number") return cell;
            if (typeof cell === "string") {
              const n = parseFloat(cell.replace(/[^0-9.+-eE]/g, ""));
              return isNaN(n) ? 0 : n;
            }
            if (typeof cell === "object" && cell) {
              const candidates = ["lux", "LUX", "value", "valor", "reading", "illuminance", "v", "val", "measurement", "nilai"];
              for (const k of candidates) {
                if (k in cell) {
                  const v = (cell as any)[k];
                  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^0-9.+-eE]/g, ""));
                  return isNaN(n) ? 0 : n;
                }
              }
            }
            return 0;
          })
        : []
    );
  };

  const gridData = useMemo(() => parseGridData(report), [report]);
  const rows = gridData.length;
  const cols = gridData[0]?.length || 0;

  const stats = useMemo(() => {
    const values = gridData.flat().filter((n) => typeof n === "number" && isFinite(n) && n > 0);
    if (values.length === 0) return { min: 0, max: 0, avg: 0 };
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    return { min, max, avg };
  }, [gridData]);

  const getCellColor = (numValue: number) => {
    if (numValue >= 50) return "bg-red-400 text-white shadow-sm";
    if (numValue >= 40) return "bg-orange-400 text-white";
    if (numValue >= 30) return "bg-yellow-300 text-gray-900";
    if (numValue >= 20) return "bg-yellow-200 text-gray-800";
    if (numValue >= 10) return "bg-yellow-100 text-gray-700";
    if (numValue >= 5) return "bg-orange-50 text-gray-600";
    return "bg-white text-gray-500";
  };

  const createdAt = toDateValue(report?.createdAt);
  const projectDate = toDateValue(report?.projectDate);
  const dateDisplay = pickFirstString(
    report?.date,
    report?.tanggal,
    projectDate ? projectDate.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" }) : "",
    createdAt ? createdAt.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" }) : ""
  );
  const timeRaw = report?.time ?? report?.waktu ?? report?.jam;
  const timeDisplay = pickFirstString(
    timeRaw ? String(timeRaw).replace(":", ".") : "",
    projectDate ? projectDate.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }).replace(":", ".") : "",
    createdAt ? createdAt.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }).replace(":", ".") : ""
  );

  const lamp = report?.lamp || report?.lampu || report?.spesifikasi || report?.spec || {};
  const title = pickFirstString(
    report?.projectTitle,
    report?.title,
    report?.judul,
    report?.name,
    report?.nama,
    report?.namaLampu,
    report?.lampName,
    report?.lokasiJalan,
    report?.namaJalan
  );
  const location = pickFirstString(
    report?.projectLocation,
    report?.location,
    report?.lokasi,
    report?.place,
    report?.lokasiJalan,
    report?.namaJalan,
    report?.namaGang,
    report?.alamatJalan,
    report?.alamat
  );
  const officer = pickFirstString(
    report?.officer,
    report?.petugas,
    report?.reporterName,
    report?.nama_pelapor,
    report?.petugasSurvey,
    report?.surveyor,
    report?.userName,
    report?.displayName,
    report?.modifiedBy,
    report?.createdBy,
    report?.user,
    report?.reporter
  );
  const watt = formatWatt(
    report?.watt ??
      report?.power ??
      report?.daya ??
      report?.dayaLampu ??
      report?.lampPower ??
      report?.lamp_watt ??
      lamp?.watt ??
      lamp?.power ??
      lamp?.daya
  );
  const meter = formatMeter(
    report?.meter ??
      report?.poleHeight ??
      report?.tinggiTiang ??
      report?.tinggi_tiang ??
      report?.tinggi_tiang_m ??
      lamp?.poleHeight ??
      lamp?.height ??
      lamp?.tinggi
  );
  const voltage = formatVoltage(
    report?.voltage ??
      report?.tegangan ??
      report?.teganganAwal ??
      report?.initialVoltage ??
      report?.volt ??
      report?.lamp_voltage ??
      lamp?.voltage
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-600 font-medium">Memuat laporan...</div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
          <p className="text-gray-700 font-semibold mb-4">Laporan tidak ditemukan</p>
          <button
            onClick={() => router.push("/admin")}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold"
          >
            Kembali ke Daftar Laporan
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-[1920px] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/admin")}
              className="w-10 h-10 flex items-center justify-center text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div className="hidden sm:block">
              <div className="text-lg font-bold text-gray-900">{title}</div>
              <div className="text-sm text-gray-600">{location}</div>
            </div>
          </div>
          <button
            onClick={() => router.push("/admin")}
            className="hidden sm:inline-flex items-center gap-2 px-4 py-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-all"
          >
            Kembali ke Daftar Laporan
          </button>
        </div>
      </header>

      <main className="max-w-[1920px] mx-auto px-4 py-4">
        <div className="flex gap-4 items-start">
          {/* Sidebar */}
          <aside className="w-80 flex-shrink-0 space-y-4">
            <button
              onClick={() => router.push("/admin")}
              className="w-full flex items-center gap-2 px-4 py-3 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-all font-semibold"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Kembali ke Daftar Laporan
            </button>

            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden p-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Lokasi Proyek</label>
                <div className="flex items-start gap-2 mt-2 px-3 py-2 bg-gray-50 rounded-xl border border-gray-200">
                  <svg className="w-4 h-4 text-gray-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <p className="text-sm text-gray-700">{location}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span className="text-xs font-semibold text-gray-500">Petugas</span>
                  </div>
                  <p className="text-sm font-bold text-gray-900 truncate">{officer}</p>
                </div>
                <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span className="text-xs font-semibold text-gray-500">Tegangan</span>
                  </div>
                  <p className="text-sm font-bold text-gray-900">{voltage}</p>
                </div>
                <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-xs font-semibold text-gray-500">Tanggal</span>
                  </div>
                  <p className="text-sm font-bold text-gray-900">{dateDisplay}</p>
                </div>
                <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                    </svg>
                    <span className="text-xs font-semibold text-gray-500">Tinggi Tiang</span>
                  </div>
                  <p className="text-sm font-bold text-gray-900">{meter}</p>
                </div>
                <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    <span className="text-xs font-semibold text-gray-500">Daya</span>
                  </div>
                  <p className="text-sm font-bold text-gray-900">{watt}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden p-4">
              <h3 className="text-lg font-bold text-gray-900 mb-3">Statistik (Lux)</h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <p className="text-xs font-semibold text-gray-500 mb-1">L-Min</p>
                  <p className="text-xl font-bold text-blue-600">{stats.min.toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs font-semibold text-gray-500 mb-1">L-Max</p>
                  <p className="text-xl font-bold text-green-600">{stats.max.toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs font-semibold text-gray-500 mb-1">L-Avg</p>
                  <p className="text-xl font-bold text-amber-600">{stats.avg.toFixed(2)}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-gray-900">Legenda Warna</h3>
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden p-4">
              <h3 className="text-base font-bold text-gray-900 mb-3">Aksi</h3>
              <div className="space-y-2">
                <button className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold transition-all">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14m7-7H5" />
                  </svg>
                  Export Laporan Ini (ZIP)
                </button>
                <button className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold transition-all">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14m7-7H5" />
                  </svg>
                  Dokumentasi
                </button>
                <button className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold transition-all">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Bersihkan Grid
                </button>
              </div>
            </div>
          </aside>

          {/* Grid */}
          <div className="flex-1 min-w-0">
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-x-auto">
              <div className="p-4">
                <div
                  className="grid gap-2 p-4 bg-gradient-to-br from-gray-50 to-red-50 rounded-xl shadow-inner"
                  style={{ gridTemplateColumns: `80px repeat(${cols}, minmax(70px, 1fr))` }}
                >
                  <div className="bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center text-xs font-bold text-white p-3 rounded-lg shadow-md">
                    <div className="text-center leading-tight">
                      <div>Jarak</div>
                      <div>Tiang (m)</div>
                    </div>
                  </div>

                  {Array.from({ length: cols }, (_, i) => (
                    <div key={`header-${i}`} className="bg-gradient-to-b from-red-500 to-red-600 flex items-center justify-center font-bold text-sm text-white p-3 rounded-lg shadow-md">
                      {i + 1}
                    </div>
                  ))}

                  {gridData.map((row, rowIndex) => (
                    <div key={`row-${rowIndex}`} className="contents">
                      <div className="bg-gradient-to-r from-red-500 to-red-600 flex items-center justify-center font-bold text-sm text-white p-3 rounded-lg shadow-md">
                        {rowIndex + 1}
                      </div>
                      {row.map((cell, colIndex) => {
                        const numValue = typeof cell === "number" ? cell : 0;
                        return (
                          <div
                            key={`${rowIndex}-${colIndex}`}
                            className={`h-14 px-2 flex items-center justify-center border-2 border-gray-200 rounded-lg text-sm font-bold transition-all ${getCellColor(numValue)}`}
                            title={`Row ${rowIndex + 1}, Col ${colIndex + 1}: ${formatLuxNumber(numValue)}`}
                          >
                            {formatLuxNumber(numValue)}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>

                {rows === 0 || cols === 0 ? (
                  <div className="text-center text-gray-500 py-10">Grid belum tersedia pada laporan ini.</div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function ReportViewPage() {
  return (
    <ProtectedRoute>
      <ReportViewContent />
    </ProtectedRoute>
  );
}
