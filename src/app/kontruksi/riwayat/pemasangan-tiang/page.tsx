"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import RiwayatList from "@/components/kontruksi/RiwayatList";

export default function RiwayatPemasanganTiangPage() {
  return (
    <ProtectedRoute>
      <RiwayatList
        title="Pemasangan Tiang, Arm & Lampu"
        backHref="/kontruksi/riwayat"
        storageSection="pemasangan-tiang"
        listLabel="List Hasil Pemasangan Tiang"
        emptyTitle="Belum ada hasil pemasangan tiang"
        emptyDesc="Hasil pemasangan tiang akan muncul setelah petugas mengirim data."
        flowTitle="Alur Riwayat Pemasangan Tiang"
        flowSteps={[
          "Pilih tugas pemasangan tiang.",
          "Lengkapi form pemasangan tiang, arm, dan lampu.",
          "Kirim data hasil pemasangan.",
          "Riwayat hasil pemasangan tampil di sini.",
        ]}
      />
    </ProtectedRoute>
  );
}
