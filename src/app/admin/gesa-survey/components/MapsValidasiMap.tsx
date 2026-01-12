"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface Survey {
  id: string;
  title: string;
  type: string;
  status: string;
  surveyorName: string;
  validatedBy: string;
  latitude: number;
  longitude: number;
  createdAt: any;
  validatedAt: any;
  // Data sesuai modal
  namaJalan: string;
  zona: string;
  kategori: string;
  statusIdTitik: string;
  idTitik: string;
  dayaLampu: string;
  dataTiang: string;
  dataRuas: string;
  subRuas: string;
  jarakAntarTiang: string;
  keterangan: string;
}

interface MapsValidasiMapProps {
  surveys: Survey[];
}

export default function MapsValidasiMap({ surveys }: MapsValidasiMapProps) {
  const [isReady, setIsReady] = useState(false);
  const [legendOpen, setLegendOpen] = useState(true);

  useEffect(() => {
    // Fix default marker icon issue
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
      iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
      shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
    });
    setIsReady(true);
  }, []);

  // Create custom icons
  const getCustomIcon = (type: string) => {
    const iconHtml = type === "existing" 
      ? `<div style="background-color: #EF4444; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`
      : `<div style="background-color: #3B82F6; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`;
    
    return L.divIcon({
      html: iconHtml,
      className: "custom-marker",
      iconSize: [24, 24],
      iconAnchor: [12, 12],
      popupAnchor: [0, -12],
    });
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "N/A";
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch (error) {
      return "N/A";
    }
  };

  if (!isReady) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="w-16 h-16 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <>
      <MapContainer
        center={[-8.65, 115.21]}
        zoom={10}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {surveys.map((survey) => (
          <Marker
            key={survey.id}
            position={[survey.latitude, survey.longitude]}
            icon={getCustomIcon(survey.type)}
          >
            <Popup>
              <div className="p-2 min-w-[280px] max-w-[320px]">
                <h4 className="font-bold text-gray-900 mb-1 text-sm">{survey.title}</h4>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  survey.type === "existing" 
                    ? "bg-red-100 text-red-700" 
                    : "bg-blue-100 text-blue-700"
                }`}>
                  {survey.kategori}
                </span>
                
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2 text-xs">
                  <div><span className="text-gray-500">1. Nama Jalan</span><br/><span className="font-medium text-gray-800">{survey.namaJalan}</span></div>
                  <div><span className="text-gray-500">2. Surveyor</span><br/><span className="font-medium text-gray-800">{survey.surveyorName}</span></div>
                  
                  <div><span className="text-gray-500">3. Latitude</span><br/><span className="font-medium text-gray-800">{survey.latitude}</span></div>
                  <div><span className="text-gray-500">4. Longitude</span><br/><span className="font-medium text-gray-800">{survey.longitude}</span></div>
                  
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
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Legend */}
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
            className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${legendOpen ? 'rotate-180' : ''}`} 
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
            </div>
            <p className="text-xs text-gray-500 mt-3">
              Klik marker untuk melihat detail survey
            </p>
          </div>
        )}
      </div>
    </>
  );
}
