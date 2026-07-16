"use client";

import { use, useMemo } from "react";
import Link from "next/link";
import ProtectedRoute from "@/components/ProtectedRoute";

function qrImageUrl(value: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=12&data=${encodeURIComponent(value)}`;
}

function QrPageContent({ idTitik }: { idTitik: string }) {
  const reportUrl = useMemo(() => {
    const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
    const origin = configuredOrigin || (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");
    return `${origin}/lapor-apj?idTitik=${encodeURIComponent(idTitik)}`;
  }, [idTitik]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(239,68,68,0.18),_transparent_30%),linear-gradient(180deg,_#fff7f7_0%,_#f8fafc_100%)] px-4 py-6">
      <div className="mx-auto max-w-xl overflow-hidden rounded-[32px] border border-red-100 bg-white shadow-[0_24px_70px_rgba(127,29,29,0.14)]">
        <div className="bg-gradient-to-r from-red-600 to-rose-600 p-5 text-white">
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-red-100">QR Laporan APJ</div>
          <h1 className="mt-2 text-2xl font-black">Generate QR Titik Lampu</h1>
          <p className="mt-1 text-sm text-red-50">QR ini membawa masyarakat ke form laporan tanpa login.</p>
        </div>

        <div className="space-y-5 p-5">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">ID Titik</div>
            <div className="mt-1 text-2xl font-black text-slate-950">{idTitik}</div>
          </div>

          <div className="flex flex-col items-center rounded-[28px] border border-slate-200 bg-white p-5">
            <img src={qrImageUrl(reportUrl)} alt={`QR laporan ${idTitik}`} className="h-72 w-72 rounded-2xl border border-slate-200 bg-white p-3" />
            <div className="mt-4 break-all rounded-2xl bg-slate-50 p-3 text-center text-xs leading-5 text-slate-600">{reportUrl}</div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <a href={qrImageUrl(reportUrl)} download={`qr-${idTitik}.png`} className="rounded-2xl bg-slate-950 px-4 py-3 text-center text-sm font-bold text-white">
              Unduh QR
            </a>
            <Link href={`/lapor-apj?idTitik=${encodeURIComponent(idTitik)}`} className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm font-bold text-red-700">
              Test Form Masyarakat
            </Link>
          </div>

          <Link href={`/om/apj-point/${encodeURIComponent(idTitik)}/manage`} className="block text-center text-sm font-semibold text-slate-600">
            Kembali ke kelola titik
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function OMApjPointQrPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <ProtectedRoute>
      <QrPageContent idTitik={decodeURIComponent(id)} />
    </ProtectedRoute>
  );
}
