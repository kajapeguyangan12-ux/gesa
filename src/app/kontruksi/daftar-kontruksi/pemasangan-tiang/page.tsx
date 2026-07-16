"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import KontruksiSubmissionForm from "@/components/kontruksi/KontruksiSubmissionForm";

export default function FormPemasanganTiangPage() {
  return (
    <ProtectedRoute>
      <KontruksiSubmissionForm
        title="Form Pemasangan ARM/Tiang & Lampu"
        stage="pemasangan-tiang"
        backHref="/kontruksi/daftar-kontruksi"
        successHref="/kontruksi/riwayat/pemasangan-tiang"
        fields={[
          { key: "fotoPerakitanDibawah", label: "Foto Perakitan Di Bawah", placeholder: "Masukkan Foto Perakitan Dibawah", type: "file", required: true },
          { key: "fotoHasilPemasangan", label: "Foto Hasil Pemasangan", placeholder: "Masukkan Foto Hasil Pemasangan", type: "file", required: true },
        ]}
      />
    </ProtectedRoute>
  );
}
