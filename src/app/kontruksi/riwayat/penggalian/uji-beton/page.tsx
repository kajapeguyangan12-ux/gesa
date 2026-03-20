"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import RiwayatList from "@/components/kontruksi/RiwayatList";

export default function RiwayatUjiBetonPage() {
  return (
    <ProtectedRoute>
      <RiwayatList
        title="Uji Beton"
        backHref="/kontruksi/riwayat/penggalian"
        storageSection="penggalian"
        storageSubKey="uji-beton"
        listLabel="List Hasil Uji Beton"
        emptyTitle="Belum ada hasil uji beton"
        emptyDesc="Hasil uji beton akan muncul setelah petugas mengirim data uji beton."
        flowTitle="Alur Riwayat Uji Beton"
        flowSteps={[
          "Pilih tugas dan titik uji beton.",
          "Isi form uji beton dan foto pendukung.",
          "Kirim data uji beton ke sistem.",
          "Riwayat hasil uji beton tampil di sini.",
        ]}
      />
    </ProtectedRoute>
  );
}
