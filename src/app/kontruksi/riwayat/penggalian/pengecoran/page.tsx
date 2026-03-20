"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import RiwayatList from "@/components/kontruksi/RiwayatList";

export default function RiwayatPengecoranPage() {
  return (
    <ProtectedRoute>
      <RiwayatList
        title="Pengecoran"
        backHref="/kontruksi/riwayat/penggalian"
        storageSection="penggalian"
        storageSubKey="pengecoran"
        listLabel="List Hasil Pengecoran"
        emptyTitle="Belum ada hasil pengecoran"
        emptyDesc="Hasil pengecoran akan muncul setelah petugas mengirim data pengecoran."
        flowTitle="Alur Riwayat Pengecoran"
        flowSteps={[
          "Pilih tugas dan titik pengecoran.",
          "Isi form pengecoran dan foto pendukung.",
          "Kirim data pengecoran ke sistem.",
          "Riwayat hasil pengecoran tampil di sini.",
        ]}
      />
    </ProtectedRoute>
  );
}
