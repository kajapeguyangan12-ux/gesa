"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import RiwayatList from "@/components/kontruksi/RiwayatList";

export default function RiwayatPenggalianPage() {
  return (
    <ProtectedRoute>
      <RiwayatList
        title="Penggalian"
        backHref="/kontruksi/riwayat/penggalian"
        storageSection="penggalian"
        storageSubKey="penggalian"
        listLabel="List Hasil Penggalian"
        emptyTitle="Belum ada hasil penggalian"
        emptyDesc="Hasil penggalian akan muncul setelah petugas mengirim data penggalian."
        flowTitle="Alur Riwayat Penggalian"
        flowSteps={[
          "Pilih tugas dan titik penggalian.",
          "Isi form penggalian dan foto pendukung.",
          "Kirim data penggalian ke sistem.",
          "Riwayat hasil penggalian tampil di sini.",
        ]}
      />
    </ProtectedRoute>
  );
}
