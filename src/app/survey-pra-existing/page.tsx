"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { addDoc, collection, getDocs, serverTimestamp, where, query } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/hooks/useAuth";
import { db, storage } from "@/lib/firebase";
import { KABUPATEN_OPTIONS } from "@/utils/constants";
import { getActiveKabupatenFromStorage, setActiveKabupatenToStorage } from "@/utils/helpers";
import { PRA_EXISTING_TABANAN_DATA } from "./location-data";

type DynamicMapProps = {
  latitude: number | null;
  longitude: number | null;
  accuracy: number;
  hasGPS: boolean;
  kmzFileUrl?: string;
  completedPoints?: string[];
  trackingPath?: Array<{ lat: number; lng: number }>;
  onPointComplete?: (pointId: string, pointName: string, lat: number, lng: number) => void;
};

const DynamicTrackingMap = dynamic<DynamicMapProps>(() => import("@/components/GPSMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[500px] items-center justify-center rounded-2xl border border-slate-200 bg-slate-100">
      <div className="text-center">
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
        <p className="text-sm text-slate-500">Memuat peta tracking...</p>
      </div>
    </div>
  ),
});

const DynamicSubmittedMap = dynamic(() => import("@/components/SurveyPraExistingSubmittedMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[460px] items-center justify-center rounded-2xl border border-emerald-200 bg-slate-100">
      <div className="text-center">
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-b-2 border-emerald-600" />
        <p className="text-sm text-slate-500">Memuat peta survey...</p>
      </div>
    </div>
  ),
});

interface GPSCoordinates {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

interface ActiveTask {
  id: string;
  title?: string;
  description?: string;
  type?: string;
  status?: string;
  kmzFileUrl?: string;
  kmzFileUrl2?: string;
}

interface FormState {
  kabupaten: string;
  kecamatan: string;
  desa: string;
  banjar: string;
  kepemilikanTiang: string;
  tipeTiangPLN: string;
  jenisTiang: string;
  jenisLampu: string;
  jumlahLampu: string;
  dayaLampu: string;
  fungsiLampu: string;
  garduStatus: string;
  kodeGardu: string;
  keterangan: string;
}

interface SubmittedSurveyItem {
  id: string;
  latitude: number;
  longitude: number;
  kecamatan?: string;
  desa?: string;
  banjar?: string;
  namaJalan?: string;
  kepemilikanTiang?: string;
  surveyorName?: string;
  createdAt?: { toDate?: () => Date } | Date | string | number | null;
  status?: string;
}

const initialFormState: FormState = {
  kabupaten: "",
  kecamatan: "",
  desa: "",
  banjar: "",
  kepemilikanTiang: "",
  tipeTiangPLN: "",
  jenisTiang: "",
  jenisLampu: "",
  jumlahLampu: "",
  dayaLampu: "",
  fungsiLampu: "APJ",
  garduStatus: "",
  kodeGardu: "",
  keterangan: "",
};

declare global {
  interface Window {
    completeTaskPoint?: (pointId: string, pointName: string, lat: number, lng: number) => void;
  }
}

function SurveyPraExistingContent() {
  const router = useRouter();
  const { user } = useAuth();

  const [gpsCoords, setGpsCoords] = useState<GPSCoordinates | null>(null);
  const [trackingPath, setTrackingPath] = useState<Array<{ lat: number; lng: number }>>([]);
  const [trackingEnabled, setTrackingEnabled] = useState(false);
  const [isGPSActive, setIsGPSActive] = useState(false);
  const [activeKabupaten, setActiveKabupaten] = useState<string | null>(null);
  const [activeTask, setActiveTask] = useState<ActiveTask | null>(null);
  const [completedPoints, setCompletedPoints] = useState<string[]>([]);
  const [submittedSurveys, setSubmittedSurveys] = useState<SubmittedSurveyItem[]>([]);
  const [loadingSubmittedSurveys, setLoadingSubmittedSurveys] = useState(false);
  const [formData, setFormData] = useState<FormState>(initialFormState);
  const [fotoAktual, setFotoAktual] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const storedKabupaten = getActiveKabupatenFromStorage(user?.uid || "") || getActiveKabupatenFromStorage();
    if (storedKabupaten) {
      setActiveKabupaten(storedKabupaten);
      setFormData((previous) => ({ ...previous, kabupaten: storedKabupaten }));
    }
  }, [user?.uid]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storedTask = window.localStorage.getItem("activeTask");
    if (!storedTask) {
      return;
    }

    try {
      const parsedTask = JSON.parse(storedTask) as ActiveTask;
      setActiveTask(parsedTask);

      const storageKey = `completed_points_${parsedTask.id}`;
      const storedPoints = window.localStorage.getItem(storageKey);
      if (storedPoints) {
        setCompletedPoints(JSON.parse(storedPoints));
      }
    } catch (error) {
      console.error("Gagal membaca tugas aktif:", error);
    }
  }, []);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      return;
    }

    setIsGPSActive(true);

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const nextCoords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        };

        setGpsCoords(nextCoords);
        if (trackingEnabled) {
          setTrackingPath((previous) => {
            const nextPoint = { lat: nextCoords.latitude, lng: nextCoords.longitude };
            if (previous.length === 0) {
              return [nextPoint];
            }

            const lastPoint = previous[previous.length - 1];
            const moved = getDistanceMeters(lastPoint.lat, lastPoint.lng, nextPoint.lat, nextPoint.lng);
            if (moved < 5) {
              return previous;
            }

            return [...previous, nextPoint];
          });
        }
      },
      (error) => {
        console.error("GPS error:", error);
        if (error.code === 1) {
          setIsGPSActive(false);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 10000,
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [trackingEnabled]);

  useEffect(() => {
    const loadSubmittedSurveys = async () => {
      if (!user?.uid) {
        setSubmittedSurveys([]);
        return;
      }

      try {
        setLoadingSubmittedSurveys(true);
        const surveysRef = collection(db, "survey-pra-existing");
        const q = query(surveysRef, where("surveyorUid", "==", user.uid));
        const snapshot = await getDocs(q);
        const selectedKabupaten = formData.kabupaten || activeKabupaten;
        const rawRows = snapshot.docs.map((entry) => ({ id: entry.id, ...(entry.data() as Record<string, unknown>) })) as Array<Record<string, unknown> & { id: string }>;
        const rows = rawRows
          .filter((item) => !selectedKabupaten || item.kabupaten === selectedKabupaten)
          .map((item) => ({
            id: String(item.id),
            latitude: Number(item.latitude || 0),
            longitude: Number(item.longitude || 0),
            kecamatan: typeof item.kecamatan === "string" ? item.kecamatan : "",
            desa: typeof item.desa === "string" ? item.desa : "",
            banjar: typeof item.banjar === "string" ? item.banjar : "",
            kepemilikanTiang: typeof item.keteranganTiang === "string" ? item.keteranganTiang : typeof item.kepemilikanDisplay === "string" ? item.kepemilikanDisplay : typeof item.kepemilikanTiang === "string" ? item.kepemilikanTiang : "",
            surveyorName: typeof item.surveyorName === "string" ? item.surveyorName : "",
            createdAt: item.createdAt as SubmittedSurveyItem["createdAt"],
            status: typeof item.status === "string" ? item.status : "",
          }))
          .filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude) && item.latitude !== 0 && item.longitude !== 0);

        setSubmittedSurveys(rows);
      } catch (error) {
        console.error("Gagal memuat survey pra-existing:", error);
      } finally {
        setLoadingSubmittedSurveys(false);
      }
    };

    loadSubmittedSurveys();
  }, [user?.uid, formData.kabupaten, activeKabupaten]);

  const handleCompletePoint = useCallback(
    (pointId: string, pointName: string, lat: number, lng: number) => {
      setCompletedPoints((previous) => {
        if (previous.includes(pointId)) {
          return previous;
        }

        const confirmed = window.confirm(`Tandai titik "${pointName}" sebagai selesai?\nKoordinat: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
        if (!confirmed) {
          return previous;
        }

        const next = [...previous, pointId];
        if (activeTask?.id) {
          window.localStorage.setItem(`completed_points_${activeTask.id}`, JSON.stringify(next));
        }

        return next;
      });
    },
    [activeTask?.id]
  );

  useEffect(() => {
    window.completeTaskPoint = handleCompletePoint;
    return () => {
      delete window.completeTaskPoint;
    };
  }, [handleCompletePoint]);

  const handleInputChange = (field: keyof FormState, value: string) => {
    setFormData((previous) => {
      const next = { ...previous, [field]: value };

      if (field === "kabupaten") {
        next.kecamatan = "";
        next.desa = "";
        next.banjar = "";
        setActiveKabupaten(value || null);
        setActiveKabupatenToStorage(user?.uid || "", value);
      }

      if (field === "kecamatan") {
        next.desa = "";
        next.banjar = "";
      }

      if (field === "desa") {
        next.banjar = "";
      }

      if (field === "kepemilikanTiang" && value !== "PLN") {
        next.tipeTiangPLN = "";
      }

      if (field === "garduStatus" && value !== "Ada") {
        next.kodeGardu = "";
      }

      return next;
    });
  };

  const handlePhotoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setFotoAktual(file);

    if (!file) {
      setFotoPreview((previous) => {
        if (previous) {
          URL.revokeObjectURL(previous);
        }
        return "";
      });
      return;
    }

    const previewFile = gpsCoords ? await createGeoStampedImage(file, gpsCoords) : file;
    const url = URL.createObjectURL(previewFile);
    setFotoPreview((previous) => {
      if (previous) {
        URL.revokeObjectURL(previous);
      }
      return url;
    });
  };

  useEffect(() => {
    return () => {
      if (fotoPreview) {
        URL.revokeObjectURL(fotoPreview);
      }
    };
  }, [fotoPreview]);

  const taskPolygonUrl = useMemo(() => activeTask?.kmzFileUrl || activeTask?.kmzFileUrl2, [activeTask]);
  const selectedKabupatenOption = useMemo(() => KABUPATEN_OPTIONS.find((item) => item.id === formData.kabupaten), [formData.kabupaten]);
  const districtOptions = useMemo(() => (formData.kabupaten === "tabanan" ? Object.keys(PRA_EXISTING_TABANAN_DATA) : []), [formData.kabupaten]);
  const desaOptions = useMemo(() => (formData.kecamatan ? Object.keys(PRA_EXISTING_TABANAN_DATA[formData.kecamatan] || {}) : []), [formData.kecamatan]);
  const banjarOptions = useMemo(() => (formData.kecamatan && formData.desa ? PRA_EXISTING_TABANAN_DATA[formData.kecamatan]?.[formData.desa] || [] : []), [formData.kecamatan, formData.desa]);

  const gpsStatusLabel = !isGPSActive ? "GPS belum aktif" : gpsCoords ? `Akurasi +/-${gpsCoords.accuracy.toFixed(1)} m` : "Mencari posisi GPS";
  const currentGeoStamp = gpsCoords ? `Lat ${gpsCoords.latitude.toFixed(6)} | Lng ${gpsCoords.longitude.toFixed(6)} | ${new Date(gpsCoords.timestamp).toLocaleString("id-ID")}` : "Geostamp akan muncul setelah GPS terbaca";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user) return alert("User tidak ditemukan. Silakan login ulang.");
    if (!activeTask?.id) return alert("Tugas aktif tidak ditemukan. Buka dari daftar tugas terlebih dahulu.");
    if (!gpsCoords) return alert("GPS belum siap. Tunggu sampai posisi terbaca.");
    if (!formData.kabupaten) return alert("Kabupaten wajib dipilih agar data masuk ke wilayah yang benar.");
    if (!formData.kecamatan || !formData.desa || !formData.banjar.trim()) return alert("Kecamatan, desa, dan banjar wajib diisi.");
    if (!formData.kepemilikanTiang || !formData.jenisTiang || !formData.jenisLampu || !formData.jumlahLampu || !formData.garduStatus || !formData.keterangan.trim()) return alert("Lengkapi semua field wajib pada form pra-existing.");
    if (formData.kepemilikanTiang === "PLN" && !formData.tipeTiangPLN) return alert("Tipe Tiang PLN wajib dipilih jika kepemilikan PLN.");
    if (formData.garduStatus === "Ada" && !formData.kodeGardu.trim()) return alert("Kode Gardu wajib diisi jika gardu tersedia.");
    if (!fotoAktual) return alert("Foto titik aktual wajib diunggah.");

    setSaving(true);

    try {
      let fotoAktualUrl = "";
      if (fotoAktual) {
        const stampedFile = await createGeoStampedImage(fotoAktual, gpsCoords);
        const fileName = `${user.uid}-${Date.now()}-${stampedFile.name}`;
        const fotoRef = ref(storage, `survey-pra-existing/${fileName}`);
        await uploadBytes(fotoRef, stampedFile);
        fotoAktualUrl = await getDownloadURL(fotoRef);
      }

      const kepemilikanDisplay = formData.kepemilikanTiang === "PLN" && formData.tipeTiangPLN ? `PLN - ${formData.tipeTiangPLN}` : formData.kepemilikanTiang;

      await addDoc(collection(db, "survey-pra-existing"), {
        ...formData,
        lokasiLengkap: [selectedKabupatenOption?.name, formData.kecamatan, formData.desa, formData.banjar].filter(Boolean).join(" - "),
        kabupaten: formData.kabupaten,
        kabupatenName: selectedKabupatenOption?.name || "",
        keteranganTiang: kepemilikanDisplay,
        kepemilikanDisplay,
        latitude: gpsCoords.latitude,
        longitude: gpsCoords.longitude,
        accuracy: gpsCoords.accuracy,
        trackingPath,
        fotoAktual: fotoAktualUrl,
        geostamp: {
          latitude: gpsCoords.latitude,
          longitude: gpsCoords.longitude,
          accuracy: gpsCoords.accuracy,
          capturedAt: new Date(gpsCoords.timestamp).toISOString(),
        },
        type: "pra-existing",
        status: "menunggu",
        taskId: activeTask.id,
        taskTitle: activeTask.title || "",
        kmzFileUrl: taskPolygonUrl || "",
        completedPoints,
        surveyorUid: user.uid,
        surveyorEmail: user.email || "",
        surveyorName: user.displayName || user.email || "Unknown",
        title: `Survey Pra Existing - ${formData.desa} - ${formData.banjar}`,
        createdAt: serverTimestamp(),
      });

      alert("Survey pra-existing berhasil disimpan.");
      router.push("/tugas-survey-pra-existing");
    } catch (error) {
      console.error("Gagal menyimpan survey pra-existing:", error);
      alert("Gagal menyimpan survey. Silakan coba lagi.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-slate-50">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => router.push("/tugas-survey-pra-existing")} className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 transition hover:bg-slate-200">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <div>
                <h1 className="text-lg font-semibold text-slate-900">Survey Pra Existing</h1>
                <p className="text-sm text-slate-500">Form pra-existing dengan peta hasil survey, tracking, dan polygon tugas.</p>
              </div>
            </div>
            <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">{gpsStatusLabel}</div>
          </div>
        </header>

        <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 xl:grid-cols-[1.08fr_0.92fr]">
          <section className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{activeTask?.title || "Belum ada tugas aktif"}</p>
                  <p className="mt-1 text-sm text-slate-500">{activeTask?.description || "Buka dari daftar tugas pra-existing agar polygon atau titik dari admin tampil di sini."}</p>
                </div>
                <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{activeTask?.status || "draft"}</div>
              </div>
              <div className="grid gap-3 text-sm text-slate-600 sm:grid-cols-4">
                <StatCard label="Kabupaten" value={selectedKabupatenOption?.name || "-"} />
                <StatCard label="Polygon KMZ" value={taskPolygonUrl ? "Tersedia" : "Belum ada"} />
                <StatCard label="Titik Selesai" value={String(completedPoints.length)} />
                <StatCard label="Tracking" value={`${trackingPath.length} titik`} />
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Peta Survey Pra Existing</h2>
                  <p className="text-sm text-slate-500">Lokasi survey yang sudah diinput. Data akan mengikuti kabupaten yang kamu pilih.</p>
                </div>
                <div className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">{loadingSubmittedSurveys ? "Memuat..." : `${submittedSurveys.length} Titik`}</div>
              </div>
              <DynamicSubmittedMap surveyData={submittedSurveys} />
              <div className="mt-4 rounded-xl bg-blue-50 p-4 text-sm text-blue-800">
                <p className="font-semibold">Informasi Peta:</p>
                <ul className="mt-1 list-disc pl-5">
                  <li>Marker hijau menunjukkan lokasi survey yang sudah diinput.</li>
                  <li>Klik marker untuk melihat detail survey.</li>
                  <li>Data otomatis terfilter oleh kabupaten terpilih.</li>
                </ul>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Titik Koordinat & Tracking</h2>
                  <p className="text-sm text-slate-500">Lihat posisi saat ini, jejak tracking, dan polygon atau titik tugas dari admin.</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className={`rounded-xl px-4 py-3 text-sm font-semibold ${isGPSActive ? "bg-emerald-500 text-white" : "bg-amber-100 text-amber-800"}`}>{isGPSActive ? "GPS Aktif" : "GPS Belum Aktif"}</div>
                  <button type="button" onClick={() => setTrackingEnabled((previous) => !previous)} className={`rounded-xl px-4 py-3 text-sm font-semibold text-white transition ${trackingEnabled ? "bg-red-500 hover:bg-red-600" : "bg-blue-600 hover:bg-blue-700"}`}>
                    {trackingEnabled ? "Hentikan Tracking" : "Mulai Tracking"}
                  </button>
                </div>
              </div>
              <DynamicTrackingMap latitude={gpsCoords?.latitude ?? null} longitude={gpsCoords?.longitude ?? null} accuracy={gpsCoords?.accuracy ?? 0} hasGPS={isGPSActive} kmzFileUrl={taskPolygonUrl} completedPoints={completedPoints} trackingPath={trackingPath} onPointComplete={handleCompletePoint} />
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-slate-700">
                <div className="flex items-center justify-between gap-4"><span className="font-semibold text-emerald-800">Pelacakan real time {trackingEnabled ? "aktif" : "siap"}</span><span className="text-emerald-700">{gpsCoords ? "Terverifikasi" : "Menunggu GPS"}</span></div>
                <p className="mt-3 rounded-xl bg-white px-4 py-3 font-mono text-base text-slate-900">{gpsCoords ? `${gpsCoords.latitude.toFixed(6)}, ${gpsCoords.longitude.toFixed(6)}` : "Koordinat belum tersedia"}</p>
                <div className="mt-3 flex items-center justify-between text-xs text-slate-500"><span>Akurasi: {gpsCoords ? `+/-${gpsCoords.accuracy.toFixed(1)}m` : "-"}</span><span>Terakhir diperbarui: {gpsCoords ? new Date(gpsCoords.timestamp).toLocaleTimeString("id-ID") : "-"}</span></div>
              </div>
            </div>
          </section>

          <section>
            <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Form Pra Existing</h2>
                <p className="text-sm text-slate-500">Kabupaten wajib dipilih agar data tidak nyasar dan terbaca di panel wilayah yang benar.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField label="Kabupaten" value={formData.kabupaten} onChange={(value) => handleInputChange("kabupaten", value)} options={KABUPATEN_OPTIONS.map((item) => item.id)} optionLabelMap={Object.fromEntries(KABUPATEN_OPTIONS.map((item) => [item.id, item.name]))} required />
                <SelectField label="Kecamatan" value={formData.kecamatan} onChange={(value) => handleInputChange("kecamatan", value)} options={districtOptions} required disabled={formData.kabupaten !== "tabanan"} />
                <SelectField label="Desa" value={formData.desa} onChange={(value) => handleInputChange("desa", value)} options={desaOptions} required disabled={!formData.kecamatan} />
                <SelectField label="Banjar" value={formData.banjar} onChange={(value) => handleInputChange("banjar", value)} options={banjarOptions} required disabled={!formData.desa} />
                <SelectField label="Kepemilikan Tiang" value={formData.kepemilikanTiang} onChange={(value) => handleInputChange("kepemilikanTiang", value)} options={["PLN", "Pemkab", "Swadaya"]} required />
                <SelectField label="Tipe Tiang PLN" value={formData.tipeTiangPLN} onChange={(value) => handleInputChange("tipeTiangPLN", value)} options={["Tiang TM", "Tiang TR"]} disabled={formData.kepemilikanTiang !== "PLN"} required={formData.kepemilikanTiang === "PLN"} />
                <SelectField label="Jenis Tiang" value={formData.jenisTiang} onChange={(value) => handleInputChange("jenisTiang", value)} options={["Beton", "Besi", "Kayu"]} required />
                <SelectField label="Jenis Lampu" value={formData.jenisLampu} onChange={(value) => handleInputChange("jenisLampu", value)} options={["LED", "Konvensional", "Panel Surya", "Swadaya"]} required />
                <SelectField label="Jumlah Lampu" value={formData.jumlahLampu} onChange={(value) => handleInputChange("jumlahLampu", value)} options={["1", "2", "3", "4"]} required />
                <SelectField label="Daya Lampu" value={formData.dayaLampu} onChange={(value) => handleInputChange("dayaLampu", value)} options={["30", "60", "80", "90", "125", "150", "250"]} />
                <Field label="Fungsi Lampu" value={formData.fungsiLampu} onChange={() => undefined} disabled required />
                <SelectField label="Gardu" value={formData.garduStatus} onChange={(value) => handleInputChange("garduStatus", value)} options={["Ada", "Tidak Ada"]} required />
                {formData.garduStatus === "Ada" && <Field label="Kode Gardu" value={formData.kodeGardu} onChange={(value) => handleInputChange("kodeGardu", value)} required />}
              </div>
              {formData.kabupaten && formData.kabupaten !== "tabanan" && <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Data kecamatan dan desa detail saat ini baru disiapkan untuk Kabupaten Tabanan.</div>}
              <TextAreaField label="Keterangan" value={formData.keterangan} onChange={(value) => handleInputChange("keterangan", value)} required />
              <div className="space-y-3 rounded-2xl border border-dashed border-slate-300 p-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Foto Titik Aktual <span className="ml-1 text-red-500">*</span></label>
                  <input type="file" accept="image/*" capture="environment" onChange={(event) => void handlePhotoChange(event)} className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-sm file:font-medium file:text-slate-700" />
                  <p className="mt-2 text-xs text-slate-500">Gunakan kamera perangkat. Saat upload, foto akan diberi geostamp koordinat dan waktu.</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600"><span className="font-semibold text-slate-800">Geostamp:</span> {currentGeoStamp}</div>
                {fotoPreview && <div className="space-y-2 overflow-hidden rounded-xl border border-slate-200 bg-white p-2"><p className="px-2 text-xs font-medium text-emerald-700">Preview hasil geostamp</p><Image src={fotoPreview} alt="Preview foto aktual" width={1200} height={800} className="h-56 w-full rounded-lg object-cover" unoptimized /></div>}
              </div>
              <button type="submit" disabled={saving} className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300">{saving ? "Menyimpan..." : "Simpan Survey Pra Existing"}</button>
            </form>
          </section>
        </main>
      </div>
    </ProtectedRoute>
  );
}

function getDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371e3;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function createGeoStampedImage(file: File, gps: GPSCoordinates): Promise<File> {
  const dataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;

  ctx.drawImage(image, 0, 0);
  const margin = Math.max(20, Math.round(image.width * 0.028));
  const paddingX = Math.max(18, Math.round(image.width * 0.022));
  const paddingY = Math.max(14, Math.round(image.height * 0.018));
  const titleFontSize = Math.max(20, Math.round(image.width * 0.022));
  const bodyFontSize = Math.max(18, Math.round(image.width * 0.018));
  const lineGap = Math.max(10, Math.round(bodyFontSize * 0.4));
  const title = "GeoTag Survey Pra Existing";
  const lines = [
    `Koordinat : ${gps.latitude.toFixed(6)}, ${gps.longitude.toFixed(6)}`,
    `Akurasi    : +/-${gps.accuracy.toFixed(1)} m`,
    `Waktu      : ${new Date(gps.timestamp).toLocaleString("id-ID")}`,
  ];

  ctx.save();
  ctx.textBaseline = "top";

  ctx.font = `700 ${titleFontSize}px Arial`;
  const titleWidth = ctx.measureText(title).width;
  ctx.font = `${bodyFontSize}px Arial`;
  const contentWidth = Math.max(...lines.map((line) => ctx.measureText(line).width));
  const boxWidth = Math.min(image.width - margin * 2, Math.max(titleWidth, contentWidth) + paddingX * 2);
  const boxHeight = paddingY * 2 + titleFontSize + 10 + lines.length * bodyFontSize + (lines.length - 1) * lineGap;
  const boxX = margin;
  const boxY = image.height - boxHeight - margin;

  drawRoundedRect(ctx, boxX, boxY, boxWidth, boxHeight, Math.max(14, Math.round(image.width * 0.015)));
  ctx.fillStyle = "rgba(15, 23, 42, 0.78)";
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#F8FAFC";
  ctx.font = `700 ${titleFontSize}px Arial`;
  ctx.fillText(title, boxX + paddingX, boxY + paddingY);

  let currentY = boxY + paddingY + titleFontSize + 10;
  ctx.font = `${bodyFontSize}px Arial`;
  lines.forEach((line) => {
    ctx.fillText(line, boxX + paddingX, currentY);
    currentY += bodyFontSize + lineGap;
  });
  ctx.restore();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
  if (!blob) return file;

  const stampedName = file.name.replace(/\.(jpg|jpeg|png|webp)$/i, "") + "-geostamp.jpg";
  return new File([blob], stampedName, { type: "image/jpeg" });
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.lineTo(x + width - safeRadius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  ctx.lineTo(x + width, y + height - safeRadius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  ctx.lineTo(x + safeRadius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  ctx.lineTo(x, y + safeRadius);
  ctx.quadraticCurveTo(x, y, x + safeRadius, y);
  ctx.closePath();
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function StatCard({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 font-medium text-slate-800">{value}</p></div>;
}

interface BaseFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
}

function Field({ label, value, onChange, required, disabled }: BaseFieldProps) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}{required ? <span className="ml-1 text-red-500">*</span> : null}</span>
      <input type="text" value={value} onChange={(event) => onChange(event.target.value)} required={required} disabled={disabled} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100" />
    </label>
  );
}

interface SelectFieldProps extends BaseFieldProps {
  options: string[];
  optionLabelMap?: Record<string, string>;
}

function SelectField({ label, value, onChange, options, optionLabelMap, required, disabled }: SelectFieldProps) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}{required ? <span className="ml-1 text-red-500">*</span> : null}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} required={required} disabled={disabled} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100">
        <option value="">Pilih</option>
        {options.map((option) => <option key={option} value={option}>{optionLabelMap?.[option] || option}</option>)}
      </select>
    </label>
  );
}

function TextAreaField({ label, value, onChange, required }: BaseFieldProps) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}{required ? <span className="ml-1 text-red-500">*</span> : null}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} required={required} rows={4} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
    </label>
  );
}

export default function SurveyPraExistingPage() {
  return <SurveyPraExistingContent />;
}





