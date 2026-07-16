"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import KontruksiSubmissionForm from "@/components/kontruksi/KontruksiSubmissionForm";

export default function FormUjiBetonPage() {
  return (
    <ProtectedRoute>
      <KontruksiSubmissionForm
        title="Uji Beton"
        stage="uji-beton"
        backHref="/kontruksi/daftar-kontruksi/penggalian"
        successHref="/kontruksi/riwayat/penggalian/uji-beton"
        fields={[
          { key: "fotoUjiKekuatanBeton", label: "Foto Uji Kekuatan Beton", placeholder: "Masukkan Foto Uji Kekuatan Beton", type: "file", required: true },
          { key: "fotoTitikLokasi", label: "Foto Titik Lokasi", placeholder: "Masukkan Foto Titik Lokasi", type: "file", required: true },
        ]}
      />
    </ProtectedRoute>
  );
}
