"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import ProtectedRoute from "@/components/ProtectedRoute";

function qrImageUrl(value: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=700x700&margin=28&ecc=H&data=${encodeURIComponent(value)}`;
}

function loadCanvasImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Gagal memuat gambar untuk QR."));
    image.src = source;
  });
}

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.fill();
}

function QrPageContent({ idTitik }: { idTitik: string }) {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const reportUrl = useMemo(() => {
    const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
    const origin = configuredOrigin || (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");
    return `${origin}/lapor-apj?idTitik=${encodeURIComponent(idTitik)}`;
  }, [idTitik]);

  const downloadDesignedQr = async () => {
    setDownloading(true);
    setDownloadError("");
    try {
      const [qrImage, logoImage] = await Promise.all([
        loadCanvasImage(qrImageUrl(reportUrl)),
        loadCanvasImage("/BDG1.png"),
      ]);
      const canvas = document.createElement("canvas");
      canvas.width = 900;
      canvas.height = 1160;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Browser tidak mendukung pembuatan gambar QR.");

      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);

      context.fillStyle = "#ef233c";
      roundedRect(context, 35, 35, 830, 190, 34);
      context.textAlign = "center";
      context.fillStyle = "#ffe4e6";
      context.font = "700 24px Arial, sans-serif";
      context.fillText("TITIK LAMPU APJ", 450, 92);
      context.fillStyle = "#ffffff";
      context.font = "900 54px Arial, sans-serif";
      context.fillText(idTitik, 450, 165);

      context.fillStyle = "#f8fafc";
      roundedRect(context, 70, 250, 760, 760, 34);
      context.drawImage(qrImage, 100, 280, 700, 700);

      const qrCenterX = 450;
      const qrCenterY = 630;
      context.beginPath();
      context.arc(qrCenterX, qrCenterY, 82, 0, Math.PI * 2);
      context.fillStyle = "#ffffff";
      context.fill();
      const logoRatio = logoImage.width / logoImage.height;
      const maxLogoWidth = 122;
      const maxLogoHeight = 122;
      const logoWidth = logoRatio >= maxLogoWidth / maxLogoHeight ? maxLogoWidth : maxLogoHeight * logoRatio;
      const logoHeight = logoRatio >= maxLogoWidth / maxLogoHeight ? maxLogoWidth / logoRatio : maxLogoHeight;
      context.drawImage(logoImage, qrCenterX - logoWidth / 2, qrCenterY - logoHeight / 2, logoWidth, logoHeight);

      context.fillStyle = "#0f172a";
      context.font = "700 22px Arial, sans-serif";
      context.fillText("Scan QR untuk melaporkan gangguan lampu", 450, 1050);
      context.fillStyle = "#475569";
      let linkFontSize = 19;
      do {
        context.font = `500 ${linkFontSize}px Arial, sans-serif`;
        linkFontSize -= 1;
      } while (context.measureText(reportUrl).width > 800 && linkFontSize > 11);
      context.fillText(reportUrl, 450, 1095);

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png", 1));
      if (!blob) throw new Error("Gagal membuat file QR.");
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `qr-apj-${idTitik}.png`;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : "Gagal mengunduh desain QR.");
    } finally {
      setDownloading(false);
    }
  };

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
            <div className="relative h-72 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white p-3">
              <img src={qrImageUrl(reportUrl)} alt={`QR laporan ${idTitik}`} className="h-full w-full object-contain" />
              <div className="absolute left-1/2 top-1/2 flex h-[68px] w-[68px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white p-2">
                <img src="/BDG1.png" alt="Logo BGD" className="h-full w-full object-contain" />
              </div>
            </div>
            <div className="mt-4 break-all rounded-2xl bg-slate-50 p-3 text-center text-xs leading-5 text-slate-600">{reportUrl}</div>
          </div>

          {downloadError ? <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{downloadError}</div> : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => void downloadDesignedQr()} disabled={downloading} className="rounded-2xl bg-slate-950 px-4 py-3 text-center text-sm font-bold text-white disabled:opacity-60">
              {downloading ? "Membuat Desain..." : "Unduh QR Berdesain"}
            </button>
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
