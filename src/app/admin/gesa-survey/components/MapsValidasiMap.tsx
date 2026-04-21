"use client";

import { memo, useMemo, useState } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";

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

interface MapsValidasiMapProps {
  surveys: Survey[];
}

const TYPE_STYLES: Record<string, { fillColor: string; label: string; badgeClass: string }> = {
  existing: {
    fillColor: "#EF4444",
    label: "Survey Existing",
    badgeClass: "bg-red-100 text-red-700",
  },
  propose: {
    fillColor: "#3B82F6",
    label: "Survey APJ Propose",
    badgeClass: "bg-blue-100 text-blue-700",
  },
  "pra-existing": {
    fillColor: "#10B981",
    label: "Survey Pra Existing",
    badgeClass: "bg-emerald-100 text-emerald-700",
  },
};

const fallbackTypeStyle = TYPE_STYLES["pra-existing"];

const SurveyPopupContent = memo(function SurveyPopupContent({ survey }: { survey: Survey }) {
  const style = TYPE_STYLES[survey.type] ?? fallbackTypeStyle;

  return (
    <div className="p-2 min-w-[280px] max-w-[320px]">
      <h4 className="font-bold text-gray-900 mb-1 text-sm">{survey.title}</h4>
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${style.badgeClass}`}>
        {survey.kategori}
      </span>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2 text-xs">
        {survey.type === "pra-existing" ? (
          <>
            <div><span className="text-gray-500">1. Kabupaten</span><br/><span className="font-medium text-gray-800">{survey.kabupaten || "-"}</span></div>
            <div><span className="text-gray-500">2. Surveyor</span><br/><span className="font-medium text-gray-800">{survey.surveyorName}</span></div>

            <div><span className="text-gray-500">3. Kecamatan</span><br/><span className="font-medium text-gray-800">{survey.kecamatan || "-"}</span></div>
            <div><span className="text-gray-500">4. Desa</span><br/><span className="font-medium text-gray-800">{survey.desa || "-"}</span></div>

            <div><span className="text-gray-500">5. Banjar</span><br/><span className="font-medium text-gray-800">{survey.banjar || "-"}</span></div>
            <div><span className="text-gray-500">6. Kepemilikan Tiang</span><br/><span className="font-medium text-gray-800">{survey.kepemilikanDisplay || "-"}</span></div>

            <div><span className="text-gray-500">7. Jenis Lampu</span><br/><span className="font-medium text-gray-800">{survey.jenisLampu || "-"}</span></div>
            <div><span className="text-gray-500">8. Jumlah Lampu</span><br/><span className="font-medium text-gray-800">{survey.jumlahLampu || "-"}</span></div>

            <div><span className="text-gray-500">9. Daya Lampu</span><br/><span className="font-medium text-gray-800">{survey.dayaLampu || "-"}</span></div>
            <div><span className="text-gray-500">10. Tipe Tiang PLN</span><br/><span className="font-medium text-gray-800">{survey.tipeTiangPLN || "-"}</span></div>

            <div><span className="text-gray-500">11. Fungsi Lampu</span><br/><span className="font-medium text-gray-800">{survey.fungsiLampu || "-"}</span></div>
            <div><span className="text-gray-500">12. Gardu</span><br/><span className="font-medium text-gray-800">{survey.garduStatus || "-"}</span></div>

            <div><span className="text-gray-500">13. Kode Gardu</span><br/><span className="font-medium text-gray-800">{survey.kodeGardu || "-"}</span></div>
            <div><span className="text-gray-500">14. Koordinat Final</span><br/><span className="font-medium text-gray-800">{survey.finalLatitude || survey.adminLatitude || survey.latitude}, {survey.finalLongitude || survey.adminLongitude || survey.longitude}</span></div>

            <div className="col-span-2"><span className="text-gray-500">15. Keterangan</span><br/><span className="font-medium text-gray-800">{survey.keterangan}</span></div>
          </>
        ) : (
          <>
            <div><span className="text-gray-500">1. Nama Jalan</span><br/><span className="font-medium text-gray-800">{survey.namaJalan}</span></div>
            <div><span className="text-gray-500">2. Surveyor</span><br/><span className="font-medium text-gray-800">{survey.surveyorName}</span></div>

            <div><span className="text-gray-500">3. Latitude</span><br/><span className="font-medium text-gray-800">{survey.finalLatitude || survey.adminLatitude || survey.latitude}</span></div>
            <div><span className="text-gray-500">4. Longitude</span><br/><span className="font-medium text-gray-800">{survey.finalLongitude || survey.adminLongitude || survey.longitude}</span></div>

            <div><span className="text-gray-500">5. Zona</span><br/><span className="font-medium text-gray-800">{survey.zona}</span></div>
            <div><span className="text-gray-500">6. Kategori</span><br/><span className="font-medium text-gray-800">{survey.kategori}</span></div>

            <div><span className="text-gray-500">7. Status ID Titik</span><br/><span className="font-medium text-gray-800">{survey.statusIdTitik}</span></div>
            <div><span className="text-gray-500">8. ID Titik</span><br/><span className="font-medium text-gray-800">{survey.idTitik}</span></div>

            <div><span className="text-gray-500">9. Daya Lampu (W)</span><br/><span className="font-medium text-gray-800">{survey.dayaLampu}</span></div>
            <div><span className="text-gray-500">10. Data Tiang</span><br/><span className="font-medium text-gray-800">{survey.dataTiang}</span></div>

            <div><span className="text-gray-500">11. Data Ruas</span><br/><span className="font-medium text-gray-800">{survey.dataRuas}</span></div>
            <div><span className="text-gray-500">12. Sub Ruas</span><br/><span className="font-medium text-gray-800">{survey.subRuas}</span></div>

            <div><span className="text-gray-500">13. Jarak Antar Tiang (m)</span><br/><span className="font-medium text-gray-800">{survey.jarakAntarTiang}</span></div>
            <div><span className="text-gray-500">14. Keterangan</span><br/><span className="font-medium text-gray-800">{survey.keterangan}</span></div>
          </>
        )}
      </div>
    </div>
  );
});

const MapLegend = memo(function MapLegend() {
  const [legendOpen, setLegendOpen] = useState(true);

  return (
    <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg border border-gray-200 z-[1000] transition-all duration-200">
      <button
        onClick={() => setLegendOpen(!legendOpen)}
        className="w-full flex items-center justify-between gap-2 p-3 hover:bg-gray-50 rounded-lg transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-bold text-gray-900">Legenda</span>
        </div>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${legendOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {legendOpen && (
        <div className="px-4 pb-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-500 rounded-full border-2 border-white shadow"></div>
              <span className="text-sm text-gray-700">Survey Existing</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow"></div>
              <span className="text-sm text-gray-700">Survey APJ Propose</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-emerald-500 rounded-full border-2 border-white shadow"></div>
              <span className="text-sm text-gray-700">Survey Pra Existing</span>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Klik marker untuk melihat detail survey
          </p>
        </div>
      )}
    </div>
  );
});

export default function MapsValidasiMap({ surveys }: MapsValidasiMapProps) {
  const mapPoints = useMemo(
    () =>
      surveys.map((survey) => ({
        survey,
        style: TYPE_STYLES[survey.type] ?? fallbackTypeStyle,
      })).filter(({ survey }) => Number.isFinite(survey.latitude) && Number.isFinite(survey.longitude)),
    [surveys]
  );

  return (
    <>
      <MapContainer
        center={[-8.65, 115.21]}
        zoom={10}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={true}
        preferCanvas={true}
        markerZoomAnimation={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {mapPoints.map(({ survey, style }) => (
          <CircleMarker
            key={`${survey.id}-${survey.latitude}-${survey.longitude}`}
            center={[survey.latitude, survey.longitude]}
            radius={8}
            pathOptions={{
              color: "#FFFFFF",
              weight: 2,
              fillColor: style.fillColor,
              fillOpacity: 0.95,
            }}
          >
            <Popup>
              <SurveyPopupContent survey={survey} />
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>

      <MapLegend />
    </>
  );
}
