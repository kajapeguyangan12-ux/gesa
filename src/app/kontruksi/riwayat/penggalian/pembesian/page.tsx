"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import RiwayatList from "@/components/kontruksi/RiwayatList";

export default function RiwayatPembesianPage() {
  return (
    <ProtectedRoute>
      <RiwayatList
        title="Pembesian & Grounding"
        backHref="/kontruksi/riwayat/penggalian"
        storageSection="penggalian"
        storageSubKey="pembesian"
        listLabel="List Hasil Pembesian"
        emptyTitle="Belum ada hasil pembesian"
        emptyDesc="Hasil pembesian akan muncul setelah petugas mengirim data pembesian."
        flowTitle="Alur Riwayat Pembesian"
        flowSteps={[
          "Pilih tugas dan titik pembesian.",
          "Isi form pembesian dan foto pendukung.",
          "Kirim data pembesian ke sistem.",
          "Riwayat hasil pembesian tampil di sini.",
        ]}
      />
    </ProtectedRoute>
  );
}
