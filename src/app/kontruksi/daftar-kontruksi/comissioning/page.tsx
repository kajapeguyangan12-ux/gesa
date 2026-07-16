"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import KontruksiSubmissionForm from "@/components/kontruksi/KontruksiSubmissionForm";

export default function FormComissioningPage() {
  return (
    <ProtectedRoute>
      <KontruksiSubmissionForm
        title="Form Comissioning"
        stage="comissioning"
        backHref="/kontruksi/daftar-kontruksi"
        successHref="/kontruksi/riwayat/comissioning"
        fields={[
          { key: "fotoJalurKabel", label: "Foto Jalur Kabel", placeholder: "Masukkan Foto Jalur Kabel", type: "file", required: true },
          { key: "fotoInstalasiPerTitik", label: "Foto Instalasi Per Titik", placeholder: "Masukkan Foto Instalasi Per Titik", type: "file", required: true },
        ]}
      />
    </ProtectedRoute>
  );
}
