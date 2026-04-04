"use client";

function InfoMiniCard({ label, value, monospace = false }: { label: string; value: string; monospace?: boolean }) {
  return (
    <div className="rounded-xl bg-white/90 p-2 shadow-sm ring-1 ring-black/5">
      <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-0.5 text-xs font-medium text-slate-800 ${monospace ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}

export function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-2">
      <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-slate-800">{value}</p>
    </div>
  );
}

export function CompactTaskStatusPanel({
  isOutsideAssignedPolygon,
  isInsideAssignedPolygon,
  statusMessage,
  targetLabel,
  distanceLabel,
  coordinateLabel,
  accuracyLabel,
  googleMapsUrl,
}: {
  isOutsideAssignedPolygon: boolean;
  isInsideAssignedPolygon: boolean | null | undefined;
  statusMessage: string;
  targetLabel: string;
  distanceLabel: string;
  coordinateLabel: string;
  accuracyLabel: string;
  googleMapsUrl: string;
}) {
  const panelClassName = isOutsideAssignedPolygon
    ? "border-amber-300 bg-amber-50 text-amber-900"
    : isInsideAssignedPolygon
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : "border-slate-200 bg-slate-50 text-slate-700";

  const headingClassName = isOutsideAssignedPolygon
    ? "text-amber-900"
    : isInsideAssignedPolygon
      ? "text-emerald-800"
      : "text-slate-900";

  return (
    <div className={`rounded-2xl border p-2.5 text-sm ${panelClassName}`}>
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex-1 space-y-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Status Area Tugas</p>
            <p className={`mt-1 text-xs font-semibold ${headingClassName}`}>{statusMessage}</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <InfoMiniCard label="Target" value={targetLabel} />
            <InfoMiniCard label="Jarak" value={distanceLabel} />
            <InfoMiniCard label="Koordinat" value={coordinateLabel} monospace />
          </div>
          {accuracyLabel ? <p className="text-[11px] text-slate-500">{accuracyLabel}</p> : null}
        </div>
        <div className="flex w-full flex-col gap-2 lg:max-w-[210px]">
          <button
            type="button"
            onClick={() => {
              if (!googleMapsUrl) return;
              window.open(googleMapsUrl, "_blank", "noopener,noreferrer");
            }}
            disabled={!googleMapsUrl}
            className="rounded-xl bg-blue-600 px-3 py-2 text-[11px] font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Arahkan ke Google Maps
          </button>
          <p className="text-[11px] text-slate-500">Tujuan diarahkan ke titik tepi atau titik tugas terdekat.</p>
        </div>
      </div>
    </div>
  );
}

export function CompactRealtimePanel({
  trackingEnabled,
  hasGPS,
  coordinatesLabel,
  accuracyLabel,
  updatedAtLabel,
}: {
  trackingEnabled: boolean;
  hasGPS: boolean;
  coordinatesLabel: string;
  accuracyLabel: string;
  updatedAtLabel: string;
}) {
  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-2.5 text-sm text-slate-700">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-emerald-800">Pelacakan real time {trackingEnabled ? "aktif" : "siap"}</span>
        <span className="text-xs text-emerald-700">{hasGPS ? "Terverifikasi" : "Menunggu GPS"}</span>
      </div>
      <p className="mt-2 rounded-xl bg-white px-3 py-2 font-mono text-xs text-slate-900">{coordinatesLabel}</p>
      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
        <span>Akurasi: {accuracyLabel}</span>
        <span>Update: {updatedAtLabel}</span>
      </div>
    </div>
  );
}
