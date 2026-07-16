"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import KontruksiSubmissionForm from "@/components/kontruksi/KontruksiSubmissionForm";

export default function FormPenggalianPage() {
  return (
    <ProtectedRoute>
      <KontruksiSubmissionForm
        title="Form Penggalian"
        stage="penggalian"
        backHref="/kontruksi/daftar-kontruksi/penggalian"
        successHref="/kontruksi/riwayat/penggalian/penggalian"
        fields={[
          { key: "kedalamanGalian", label: "Kedalaman Galian", placeholder: "Masukkan Kedalaman Galian", required: true },
          { key: "fotoKedalaman", label: "Foto Kedalaman", placeholder: "Masukkan Foto Kedalaman", type: "file", required: true },
          { key: "fotoTitikLokasi", label: "Foto Titik Lokasi", placeholder: "Masukkan Foto Titik Lokasi", type: "file", required: true },
        ]}
      />
    </ProtectedRoute>
  );
}
