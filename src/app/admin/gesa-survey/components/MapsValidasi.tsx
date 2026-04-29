"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import JSZip from "jszip";
import { useAuth } from "@/hooks/useAuth";
import { PRA_EXISTING_TABANAN_DATA } from "@/app/survey-pra-existing/location-data";
import { formatPanelUpdatedAt, getReadableDataSourceLabel } from "@/utils/panelDataSource";
import { parseLocalKmzOrKml } from "@/utils/localKmzParser";
import type { ParsedTaskGeometries } from "@/utils/taskNavigation";
import { fetchAdminSurveyRows, type AdminSurveyStatus } from "./supabaseSurveyClient";

// Import Map component dynamically to avoid SSR issues
const MapsValidasiMap = dynamic(
  () => import("./MapsValidasiMap"),
  { 
    ssr: false,
    loading: () => (
      <div className="h-full flex flex-col items-center justify-center bg-gray-50">
        <div className="w-16 h-16 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mb-4"></div>
        <p className="text-gray-600">Menyiapkan peta...</p>
      </div>
    )
  }
);

interface Survey {
  id: string;
  title: string;
  type: string;
  status: string;
  surveyorName: string;
  validatedBy: string;
  latitude: number;
  longitude: number;
  adminLatitude?: number;
  adminLongitude?: number;
  createdAt: TimestampLike;
  validatedAt: TimestampLike;
  // Data sesuai modal
  namaJalan?: string;
  zona?: string;
  kategori?: string;
  statusIdTitik?: string;
  idTitik?: string;
  dayaLampu?: string;
  dataTiang?: string;
  dataRuas?: string;
  subRuas?: string;
  jarakAntarTiang?: string;
  keterangan?: string;
  kabupaten?: string;
  kecamatan?: string;
  desa?: string;
  banjar?: string;
  kepemilikanDisplay?: string;
  tipeTiangPLN?: string;
  jenisLampu?: string;
  jumlahLampu?: string;
  fungsiLampu?: string;
  garduStatus?: string;
  kodeGardu?: string;
  finalLatitude?: number;
  finalLongitude?: number;
}

type TimestampLike =
  | { toDate?: () => Date; seconds?: number }
  | Date
  | string
  | number
  | null
  | undefined;

function resolveTimestamp(value: TimestampLike) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "object") {
    if ("toDate" in value && typeof value.toDate === "function") {
      const parsed = value.toDate();
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    if ("seconds" in value && typeof value.seconds === "number") {
      const parsed = new Date(value.seconds * 1000);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function escapeXml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatExportDate(value: TimestampLike) {
  const date = resolveTimestamp(value);
  return date ? date.toISOString() : "-";
}

function buildSurveyDescription(survey: Survey) {
  const fields: Array<[string, unknown]> = [
    ["ID", survey.id],
    ["Judul", survey.title || "-"],
    ["Tipe", survey.type || "-"],
    ["Status", survey.status || "-"],
    ["Surveyor", survey.surveyorName || "-"],
    ["Kabupaten", survey.kabupaten || "-"],
    ["Kecamatan", survey.kecamatan || "-"],
    ["Desa", survey.desa || "-"],
    ["Banjar", survey.banjar || "-"],
    ["Nama Jalan", survey.namaJalan || "-"],
    ["Kategori", survey.kategori || "-"],
    ["Zona", survey.zona || "-"],
    ["Jenis Lampu", survey.jenisLampu || "-"],
    ["Jumlah Lampu", survey.jumlahLampu || "-"],
    ["Daya Lampu", survey.dayaLampu || "-"],
    ["Petugas Validasi", survey.validatedBy || "-"],
    ["Tanggal Data", formatExportDate(survey.validatedAt || survey.createdAt)],
  ];

  return fields
    .map(([label, fieldValue]) => `${escapeXml(label)}: ${escapeXml(fieldValue || "-")}`)
    .join("&#10;");
}

function buildSurveyKmlDocument(surveys: Survey[], documentName: string) {
  const placemarks = surveys.map((survey) => {
    const name = survey.title?.trim() || `${survey.type || "survey"}-${survey.id}`;
    return `
    <Placemark>
      <name>${escapeXml(name)}</name>
      <description>${buildSurveyDescription(survey)}</description>
      <ExtendedData>
        <Data name="id"><value>${escapeXml(survey.id)}</value></Data>
        <Data name="type"><value>${escapeXml(survey.type || "-")}</value></Data>
        <Data name="status"><value>${escapeXml(survey.status || "-")}</value></Data>
        <Data name="surveyor"><value>${escapeXml(survey.surveyorName || "-")}</value></Data>
        <Data name="kabupaten"><value>${escapeXml(survey.kabupaten || "-")}</value></Data>
        <Data name="kecamatan"><value>${escapeXml(survey.kecamatan || "-")}</value></Data>
      </ExtendedData>
      <Point>
        <coordinates>${survey.longitude},${survey.latitude},0</coordinates>
      </Point>
    </Placemark>`;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${escapeXml(documentName)}</name>
    <description>${escapeXml(`Export titik survey (${surveys.length} data)`)}</description>
    ${placemarks}
  </Document>
</kml>`;
}

export default function MapsValidasi({ activeKabupaten }: { activeKabupaten?: string | null }) {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super-admin";
  const targetStatus = isSuperAdmin ? "tervalidasi" : "diverifikasi";
  const pageTitle = isSuperAdmin ? "Maps Valid" : "Maps Terverifikasi";
  const pageDescription = isSuperAdmin
    ? "Visualisasi bersama titik koordinat survey yang telah divalidasi dalam peta interaktif"
    : "Visualisasi bersama titik koordinat survey yang telah diverifikasi dalam peta interaktif";
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [selectedKecamatan, setSelectedKecamatan] = useState("Semua Kecamatan");
  const [showPendingSurveys, setShowPendingSurveys] = useState(false);
  const [showRejectedSurveys, setShowRejectedSurveys] = useState(false);
  const [overviewLoaded, setOverviewLoaded] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [dataSource, setDataSource] = useState<string>("Belum ada");
  const [kmzOverlay, setKmzOverlay] = useState<ParsedTaskGeometries | null>(null);
  const [kmzOverlayName, setKmzOverlayName] = useState("");
  const [kmzOverlayError, setKmzOverlayError] = useState("");
  const [kmzUploading, setKmzUploading] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<"kml" | "kmz" | null>(null);
  const [stats, setStats] = useState({
    total: 0,
    visible: 0,
    pending: 0,
    rejected: 0,
    primaryStatus: 0,
    existing: 0,
    propose: 0,
    praExisting: 0,
  });

  const selectedStatuses = useMemo<AdminSurveyStatus[]>(
    () => {
      const statuses: AdminSurveyStatus[] = [targetStatus];
      if (showPendingSurveys) statuses.push("menunggu");
      if (showRejectedSurveys) statuses.push("ditolak");
      return statuses;
    },
    [showPendingSurveys, showRejectedSurveys, targetStatus]
  );

  const kecamatanOptions = activeKabupaten === "tabanan"
    ? ["Semua Kecamatan", ...Object.keys(PRA_EXISTING_TABANAN_DATA).sort()]
    : ["Semua Kecamatan"];

  const kmzOverlayStats = useMemo(() => ({
    points: kmzOverlay?.points.length || 0,
    polylines: kmzOverlay?.polylines.length || 0,
    polygons: kmzOverlay?.polygons.length || 0,
  }), [kmzOverlay]);

  const fetchSurveys = useCallback(async (filterKecamatan?: string) => {
    try {
      setLoading(true);
      const payload = await fetchAdminSurveyRows({
        activeKabupaten,
        adminId: null,
        statuses: selectedStatuses,
      });

      const allSurveys = (payload.rows as Survey[]).filter((survey) => {
        const lat = typeof survey.finalLatitude === "number"
          ? survey.finalLatitude
          : typeof survey.adminLatitude === "number"
            ? survey.adminLatitude
            : typeof survey.latitude === "number"
              ? survey.latitude
              : null;
        const lng = typeof survey.finalLongitude === "number"
          ? survey.finalLongitude
          : typeof survey.adminLongitude === "number"
            ? survey.adminLongitude
            : typeof survey.longitude === "number"
              ? survey.longitude
              : null;

        if (lat === null || lng === null) return false;
        return Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0;
      }).map((survey) => ({
        ...survey,
        latitude:
          typeof survey.finalLatitude === "number"
            ? survey.finalLatitude
            : typeof survey.adminLatitude === "number"
              ? survey.adminLatitude
              : survey.latitude,
        longitude:
          typeof survey.finalLongitude === "number"
            ? survey.finalLongitude
            : typeof survey.adminLongitude === "number"
            ? survey.adminLongitude
            : survey.longitude,
      }));

      const normalizedKecamatan = filterKecamatan && filterKecamatan !== "Semua Kecamatan" ? filterKecamatan : "";
      const filteredSurveys = normalizedKecamatan
        ? allSurveys.filter((survey) => survey.kecamatan === normalizedKecamatan)
        : allSurveys;

      setSurveys(filteredSurveys);
      setStats({
        total: allSurveys.length,
        visible: filteredSurveys.length,
        pending: filteredSurveys.filter((survey) => survey.status === "menunggu").length,
        rejected: filteredSurveys.filter((survey) => survey.status === "ditolak").length,
        primaryStatus: filteredSurveys.filter((survey) => survey.status === targetStatus).length,
        existing: filteredSurveys.filter((survey) => survey.type === "existing").length,
        propose: filteredSurveys.filter((survey) => survey.type === "propose").length,
        praExisting: filteredSurveys.filter((survey) => survey.type === "pra-existing").length,
      });
      setMapLoaded(true);
      setDataSource(payload.source);
      setOverviewLoaded(true);
      setLastUpdatedAt(payload.generatedAt ? new Date(payload.generatedAt) : new Date());
    } catch (error) {
      console.error("Error fetching surveys:", error);
      setMapLoaded(false);
    } finally {
      setLoading(false);
    }
  }, [activeKabupaten, selectedStatuses, targetStatus]);

  useEffect(() => {
    setSurveys([]);
    setMapLoaded(false);
    setOverviewLoaded(false);
    setSelectedKecamatan("Semua Kecamatan");
    setStats({
      total: 0,
      visible: 0,
      pending: 0,
      rejected: 0,
      primaryStatus: 0,
      existing: 0,
      propose: 0,
      praExisting: 0,
    });
    setDataSource("Belum ada");
    setLastUpdatedAt(null);
  }, [activeKabupaten, targetStatus, showPendingSurveys, showRejectedSurveys]);

  const handleResetView = () => {
    setSurveys([]);
    setMapLoaded(false);
    setSelectedKecamatan("Semua Kecamatan");
    setStats({
      total: 0,
      visible: 0,
      pending: 0,
      rejected: 0,
      primaryStatus: 0,
      existing: 0,
      propose: 0,
      praExisting: 0,
    });
    setDataSource("Belum ada");
    setLastUpdatedAt(null);
  };

  const handleKmzUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setKmzUploading(true);
      setKmzOverlayError("");
      const geometries = await parseLocalKmzOrKml(file);
      setKmzOverlay(geometries);
      setKmzOverlayName(file.name);
    } catch (error) {
      console.error("Gagal membaca file KMZ/KML:", error);
      setKmzOverlay(null);
      setKmzOverlayName("");
      setKmzOverlayError(error instanceof Error ? error.message : "Gagal membaca file KMZ/KML.");
    } finally {
      setKmzUploading(false);
      event.target.value = "";
    }
  }, []);

  const clearKmzOverlay = useCallback(() => {
    setKmzOverlay(null);
    setKmzOverlayName("");
    setKmzOverlayError("");
  }, []);

  const exportBaseName = useMemo(() => {
    const statusLabels = [targetStatus];
    if (showPendingSurveys) statusLabels.push("menunggu");
    if (showRejectedSurveys) statusLabels.push("ditolak");
    const modeLabel = statusLabels.join("-");
    const kecamatanLabel =
      selectedKecamatan !== "Semua Kecamatan"
        ? selectedKecamatan.toLowerCase().replace(/\s+/g, "-")
        : "semua-kecamatan";
    const kabupatenLabel = (activeKabupaten || "semua-kabupaten").toLowerCase().replace(/\s+/g, "-");
    return `maps-survey-${kabupatenLabel}-${kecamatanLabel}-${modeLabel}`;
  }, [activeKabupaten, selectedKecamatan, showPendingSurveys, showRejectedSurveys, targetStatus]);

  const triggerDownload = useCallback((blob: Blob, filename: string) => {
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = filename;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }, []);

  const handleExportMapPoints = useCallback(async (format: "kml" | "kmz") => {
    if (!surveys.length) {
      alert("Belum ada titik survey yang tampil untuk diexport.");
      return;
    }

    try {
      setExportingFormat(format);
      const documentName = `${pageTitle} - ${activeKabupaten || "Semua Kabupaten"} - ${selectedKecamatan}`;
      const kmlText = buildSurveyKmlDocument(surveys, documentName);

      if (format === "kml") {
        triggerDownload(
          new Blob([kmlText], { type: "application/vnd.google-earth.kml+xml;charset=utf-8" }),
          `${exportBaseName}.kml`
        );
        return;
      }

      const zip = new JSZip();
      zip.file("doc.kml", kmlText);
      const kmzBlob = await zip.generateAsync({ type: "blob", mimeType: "application/vnd.google-earth.kmz" });
      triggerDownload(kmzBlob, `${exportBaseName}.kmz`);
    } catch (error) {
      console.error("Gagal export titik survey map:", error);
      alert("Gagal export titik survey ke KML/KMZ.");
    } finally {
      setExportingFormat(null);
    }
  }, [activeKabupaten, exportBaseName, pageTitle, selectedKecamatan, surveys, triggerDownload]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">{pageTitle}</h1>
              <p className="text-sm text-gray-600 mt-1">{pageDescription}</p>
            </div>
          </div>
          <button 
            onClick={handleResetView}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Reset View
          </button>
        </div>
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Sumber Data Panel</div>
            <div className="mt-1 text-lg font-bold text-slate-900">{getReadableDataSourceLabel(dataSource)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Update Terakhir</div>
            <div className="mt-1 text-lg font-bold text-slate-900">{formatPanelUpdatedAt(lastUpdatedAt)}</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
        <div className="flex flex-col lg:flex-row lg:items-end gap-4">
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Kontrol Tampilan Map</h2>
            <p className="text-sm text-gray-600">Default map kosong. Tampilkan semua atau pilih kecamatan saat diperlukan.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setShowPendingSurveys(false);
                setShowRejectedSurveys(false);
              }}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                !showPendingSurveys && !showRejectedSurveys
                  ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200"
                  : "bg-gray-100 text-gray-500 ring-1 ring-gray-200"
              }`}
            >
              {isSuperAdmin ? "Hanya Tervalidasi" : "Hanya Diverifikasi"}
            </button>
            <button
              type="button"
              onClick={() => setShowPendingSurveys(true)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                showPendingSurveys
                  ? "bg-amber-100 text-amber-700 ring-1 ring-amber-200"
                  : "bg-gray-100 text-gray-500 ring-1 ring-gray-200"
              }`}
            >
              Tambahkan Belum Diverifikasi
            </button>
            <button
              type="button"
              onClick={() => setShowRejectedSurveys((current) => !current)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                showRejectedSurveys
                  ? "bg-rose-100 text-rose-700 ring-1 ring-rose-200"
                  : "bg-gray-100 text-gray-500 ring-1 ring-gray-200"
              }`}
            >
              Tampilkan Ditolak
            </button>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
            <button
              onClick={() => void fetchSurveys()}
              disabled={loading}
              className="px-4 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white font-semibold rounded-xl transition-colors"
            >
              Tampilkan Semua
            </button>
            <select
              value={selectedKecamatan}
              onChange={(event) => setSelectedKecamatan(event.target.value)}
              className="px-4 py-3 bg-white border border-gray-300 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {kecamatanOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <button
              onClick={() => void fetchSurveys(selectedKecamatan)}
              disabled={loading || selectedKecamatan === "Semua Kecamatan"}
              className="px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white font-semibold rounded-xl transition-colors"
            >
              Tampilkan Kecamatan
            </button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void handleExportMapPoints("kml")}
            disabled={loading || !surveys.length || exportingFormat !== null}
            className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {exportingFormat === "kml" ? "Menyiapkan KML..." : "Download KML Titik"}
          </button>
          <button
            type="button"
            onClick={() => void handleExportMapPoints("kmz")}
            disabled={loading || !surveys.length || exportingFormat !== null}
            className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {exportingFormat === "kmz" ? "Menyiapkan KMZ..." : "Download KMZ Titik"}
          </button>
          <div className="text-xs text-slate-500">
            Export mengikuti titik yang sedang tampil di map: {mapLoaded ? `${stats.visible} titik` : "belum dimuat"}.
          </div>
        </div>
        <div className="mt-5 rounded-2xl border border-dashed border-purple-200 bg-purple-50/60 p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-sm font-bold text-slate-900">Upload KMZ/KML Titik Survey</div>
              <div className="mt-1 text-sm text-slate-600">
                File akan ditampilkan sebagai overlay di atas titik survey yang sudah ada di map.
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-purple-700">
                {kmzUploading ? "Memproses..." : "Pilih File KMZ/KML"}
                <input
                  type="file"
                  accept=".kmz,.kml"
                  className="hidden"
                  onChange={handleKmzUpload}
                  disabled={kmzUploading}
                />
              </label>
              <button
                type="button"
                onClick={clearKmzOverlay}
                disabled={!kmzOverlay && !kmzOverlayError}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Hapus Overlay
              </button>
            </div>
          </div>
          {kmzOverlayName && (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-white px-4 py-3">
              <div className="text-sm font-semibold text-emerald-700">{kmzOverlayName}</div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
                <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">{kmzOverlayStats.points} titik</span>
                <span className="rounded-full bg-orange-100 px-3 py-1 text-orange-700">{kmzOverlayStats.polylines} garis</span>
                <span className="rounded-full bg-violet-100 px-3 py-1 text-violet-700">{kmzOverlayStats.polygons} polygon</span>
              </div>
            </div>
          )}
          {kmzOverlayError && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {kmzOverlayError}
            </div>
          )}
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-md border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-600 font-medium">{isSuperAdmin ? "Total Survey Valid" : "Total Survey Terverifikasi"}</p>
              <h3 className="text-3xl font-bold text-gray-900">{overviewLoaded ? stats.primaryStatus : "-"}</h3>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-md border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M4.93 19h14.14c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.2 16c-.77 1.33.19 3 1.73 3z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-600 font-medium">Belum Diverifikasi</p>
              <h3 className="text-3xl font-bold text-gray-900">{overviewLoaded ? stats.pending : "-"}</h3>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-md border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-rose-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-600 font-medium">Ditolak</p>
              <h3 className="text-3xl font-bold text-gray-900">{overviewLoaded ? stats.rejected : "-"}</h3>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-md border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-600 font-medium">Data Tampil</p>
              <h3 className="text-3xl font-bold text-gray-900">{mapLoaded ? stats.visible : "-"}</h3>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-md border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-600 font-medium">Survey Existing</p>
              <h3 className="text-3xl font-bold text-gray-900">{overviewLoaded ? stats.existing : "-"}</h3>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-md border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-600 font-medium">Survey APJ Propose</p>
              <h3 className="text-3xl font-bold text-gray-900">{overviewLoaded ? stats.propose : "-"}</h3>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-md border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-600 font-medium">Survey Pra Existing</p>
              <h3 className="text-3xl font-bold text-gray-900">{overviewLoaded ? stats.praExisting : "-"}</h3>
            </div>
          </div>
        </div>
      </div>

      {/* Map Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              <div>
                <h3 className="font-bold text-gray-900 text-lg">{pageTitle}</h3>
                <p className="text-sm text-gray-600">
                  {mapLoaded
                    ? `Menampilkan ${stats.visible} titik koordinat survey ${[
                        isSuperAdmin ? "tervalidasi" : "terverifikasi",
                        showPendingSurveys ? "belum diverifikasi" : null,
                        showRejectedSurveys ? "ditolak" : null,
                      ]
                        .filter(Boolean)
                        .join(", ")}`
                    : "Map belum dimuat. Pilih Tampilkan Semua atau filter kecamatan."}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Map Container */}
        <div className="relative" style={{ height: "600px" }}>
          {loading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50">
              <div className="w-16 h-16 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mb-4"></div>
              <p className="text-gray-600">Memuat peta...</p>
            </div>
          ) : !mapLoaded ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50">
              <div className="w-16 h-16 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-2xl mb-4">M</div>
              <p className="text-gray-800 font-semibold mb-1">Map Belum Ditampilkan</p>
              <p className="text-gray-600 text-sm">Klik `Tampilkan Semua` atau pilih kecamatan terlebih dulu.</p>
            </div>
          ) : (
                    <MapsValidasiMap surveys={surveys} overlayGeometries={kmzOverlay} />
          )}
        </div>

        {/* Map Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
          <p className="text-xs text-gray-600 text-center">
            <span className="font-medium">Total Titik:</span> {overviewLoaded ? stats.total : "-"} • 
            <span className="font-medium"> Tampil:</span> {mapLoaded ? stats.visible : "-"} • 
            <span className="font-medium"> Belum Diverifikasi:</span> {overviewLoaded ? stats.pending : "-"} • 
            <span className="font-medium"> Ditolak:</span> {overviewLoaded ? stats.rejected : "-"} • 
            <span className="font-medium"> Zoom:</span> Drag untuk menggeser, scroll untuk zoom • 
            <span className="font-medium"> Filter:</span> {!mapLoaded ? "Belum dipilih" : selectedKecamatan === "Semua Kecamatan" ? "Semua Collection" : selectedKecamatan}
          </p>
        </div>
      </div>
    </div>
  );
}

