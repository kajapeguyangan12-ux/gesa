"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { OMPageShell, OMPlaceholderPanel } from "@/components/om/OMPageShell";

export default function OMDistribusiTugasPage() {
  return (
    <ProtectedRoute>
      <OMPageShell
        eyebrow="Distribusi Tugas"
        title="Distribusi tugas O&M dengan komposisi yang siap untuk kontrol lapangan."
        description="Halaman ini diarahkan untuk pembagian pekerjaan, pemantauan petugas, dan kontrol distribusi agar admin bisa melihat alokasi tugas secara cepat."
        statusTitle="Area distribusi disiapkan untuk alur kerja lapangan."
        statusDescription="Saat fitur pembagian tugas ditambahkan, layout ini sudah siap menampung daftar petugas, detail pekerjaan, dan histori assignment dalam satu workspace."
        metaCards={[
          { label: "Fungsi", value: "Assign", hint: "Bagikan pekerjaan ke petugas", tone: "teal" },
          { label: "Mode", value: "Control", hint: "Kelola alokasi tugas", tone: "cyan" },
          { label: "Target", value: "Petugas", hint: "Distribusi dibuat lebih terarah", tone: "slate" },
          { label: "Tahap", value: "Draft", hint: "Struktur siap dipakai modul inti", tone: "emerald" },
        ]}
      >
        <OMPlaceholderPanel
          label="Distribusi Tugas"
          title="Assignment workspace akan diletakkan di area ini."
          description="Bagian ini ideal untuk daftar pekerjaan, pemilihan petugas, status distribusi, dan ringkasan kapasitas tim agar pembagian tugas lebih seimbang."
          note="Fitur distribusi sedang dibangun."
        />
      </OMPageShell>
    </ProtectedRoute>
  );
}
