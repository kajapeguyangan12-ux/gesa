"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import KontruksiSubmissionForm from "@/components/kontruksi/KontruksiSubmissionForm";

export default function FormPemasanganKabelPage() {
  return (
    <ProtectedRoute>
      <KontruksiSubmissionForm
        title="Form Pemasangan Kabel"
        stage="pemasangan-kabel"
        backHref="/kontruksi/daftar-kontruksi"
        successHref="/kontruksi/riwayat/pemasangan-kabel"
        fields={[
          { key: "fotoJalurKabel", label: "Foto Jalur Kabel", placeholder: "Masukkan Foto Jalur Kabel", type: "file", required: true },
          { key: "fotoInstalasiPerTitik", label: "Foto Instalasi Per Titik", placeholder: "Masukkan Foto Instalasi Per Titik", type: "file", required: true },
        ]}
      />
    </ProtectedRoute>
  );
}
