"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import RiwayatList from "@/components/kontruksi/RiwayatList";

export default function RiwayatComissioningPage() {
  return (
    <ProtectedRoute>
      <RiwayatList
        title="Comissioning"
        backHref="/kontruksi/riwayat"
        storageSection="comissioning"
        listLabel="List Hasil Comissioning"
        emptyTitle="Belum ada hasil comissioning"
        emptyDesc="Hasil comissioning akan muncul setelah petugas mengirim data."
        flowTitle="Alur Riwayat Comissioning"
        flowSteps={[
          "Pilih tugas comissioning.",
          "Lengkapi form comissioning dan dokumentasi.",
          "Kirim data hasil comissioning.",
          "Riwayat hasil comissioning tampil di sini.",
        ]}
      />
    </ProtectedRoute>
  );
}
