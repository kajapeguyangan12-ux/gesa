"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { OMPageShell, OMPlaceholderPanel } from "@/components/om/OMPageShell";

export default function OMDaftarLaporanPage() {
  return (
    <ProtectedRoute>
      <OMPageShell
        eyebrow="Monitoring Laporan"
        title="Daftar laporan O&M dalam tampilan yang lebih rapi dan mudah dipantau."
        description="Halaman ini disiapkan sebagai pusat monitoring laporan masuk, status tindak lanjut, dan pembacaan pekerjaan harian petugas O&M."
        statusTitle="Monitoring dibuat lebih tenang dan fokus."
        statusDescription="Ketika data daftar laporan dihubungkan nanti, struktur halaman ini sudah siap untuk tabel, filter, dan ringkasan status tanpa terasa seperti halaman transisi."
        metaCards={[
          { label: "Fungsi", value: "List", hint: "Pusat daftar laporan kerja", tone: "teal" },
          { label: "Mode", value: "Read", hint: "Fokus pada monitoring data", tone: "cyan" },
          { label: "Target", value: "Admin", hint: "Pantau status masuk dengan cepat", tone: "slate" },
          { label: "Tahap", value: "Draft", hint: "Struktur siap untuk diisi fitur", tone: "emerald" },
        ]}
      >
        <OMPlaceholderPanel
          label="Daftar Laporan"
          title="Workspace laporan akan ditempatkan di area ini."
          description="Nantinya bagian ini cocok untuk tabel laporan, pencarian cepat, filter status, tanggal, dan ringkasan progres agar admin tidak perlu berpindah halaman terlalu sering."
          note="Modul daftar laporan sedang disiapkan."
        />
      </OMPageShell>
    </ProtectedRoute>
  );
}
