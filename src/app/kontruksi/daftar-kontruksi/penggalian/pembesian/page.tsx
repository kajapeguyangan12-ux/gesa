"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import KontruksiSubmissionForm from "@/components/kontruksi/KontruksiSubmissionForm";

export default function FormPembesianPage() {
  return (
    <ProtectedRoute>
      <KontruksiSubmissionForm
        title="Pembesian & Grounding"
        stage="pembesian"
        backHref="/kontruksi/daftar-kontruksi/penggalian"
        successHref="/kontruksi/riwayat/penggalian/pembesian"
        fields={[
          { key: "fotoPemasanganBesi", label: "Foto Pemasangan Besi", placeholder: "Masukkan Foto Pemasangan Besi", type: "file", required: true },
          { key: "fotoGrounding", label: "Foto Grounding", placeholder: "Masukkan Foto Grounding", type: "file", required: true },
        ]}
      />
    </ProtectedRoute>
  );
}
