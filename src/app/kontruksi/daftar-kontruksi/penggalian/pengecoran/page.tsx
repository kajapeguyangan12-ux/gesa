"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import KontruksiSubmissionForm from "@/components/kontruksi/KontruksiSubmissionForm";

export default function FormPengecoranPage() {
  return (
    <ProtectedRoute>
      <KontruksiSubmissionForm
        title="Pengecoran"
        stage="pengecoran"
        backHref="/kontruksi/daftar-kontruksi/penggalian"
        successHref="/kontruksi/riwayat/penggalian/pengecoran"
        fields={[
          { key: "fotoUjiSlumpTest", label: "Foto Uji Slump Test", placeholder: "Masukkan Foto Uji Slump Test", type: "file", required: true },
          { key: "fotoHasilPengecoran", label: "Foto Hasil Pengecoran", placeholder: "Masukkan Foto Hasil Pengecoran", type: "file", required: true },
        ]}
      />
    </ProtectedRoute>
  );
}
