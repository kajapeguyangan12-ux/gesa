"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import RiwayatList from "@/components/kontruksi/RiwayatList";

export default function RiwayatPemasanganKabelPage() {
  return (
    <ProtectedRoute>
      <RiwayatList
        title="Pemasangan Kabel"
        backHref="/kontruksi/riwayat"
        storageSection="pemasangan-kabel"
        listLabel="List Hasil Pemasangan Kabel"
        emptyTitle="Belum ada hasil pemasangan kabel"
        emptyDesc="Hasil pemasangan kabel akan muncul setelah petugas mengirim data."
        flowTitle="Alur Riwayat Pemasangan Kabel"
        flowSteps={[
          "Pilih tugas pemasangan kabel.",
          "Lengkapi form pemasangan kabel.",
          "Kirim data hasil pemasangan kabel.",
          "Riwayat hasil pemasangan tampil di sini.",
        ]}
      />
    </ProtectedRoute>
  );
}
