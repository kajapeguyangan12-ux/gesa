"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/hooks/useAuth";
import { OMPageShell, OMPlaceholderPanel } from "@/components/om/OMPageShell";
import { isMobileOmRole, PreventiveOMReportsList } from "@/components/om/PreventiveOMMobile";

export default function OMHistoryLaporanPage() {
  const { user } = useAuth();
  const isMobileRole = isMobileOmRole(user?.role);

  return (
    <ProtectedRoute>
      {isMobileRole ? (
        <PreventiveOMReportsList mode="reports" />
      ) : (
      <OMPageShell
        eyebrow="Riwayat Laporan"
        title="Riwayat laporan O&M dengan struktur yang siap untuk audit dan penelusuran."
        description="Halaman ini diarahkan untuk membaca histori pekerjaan, melihat kronologi update, dan membantu admin menelusuri keputusan dari laporan lama."
        statusTitle="Riwayat akan dipusatkan di satu alur baca."
        statusDescription="Tampilan disiapkan untuk menangani histori yang panjang tanpa terlihat berantakan, sehingga cocok untuk audit internal dan evaluasi operasional."
        metaCards={[
          { label: "Fungsi", value: "Log", hint: "Jejak laporan dan perubahan", tone: "teal" },
          { label: "Mode", value: "Trace", hint: "Fokus penelusuran histori", tone: "cyan" },
          { label: "Target", value: "Admin", hint: "Audit pekerjaan lebih mudah", tone: "slate" },
          { label: "Tahap", value: "Draft", hint: "Siap diisi data riwayat", tone: "emerald" },
        ]}
      >
        <OMPlaceholderPanel
          label="Riwayat Laporan"
          title="Panel histori akan dimuat di area ini."
          description="Ruang ini cocok untuk timeline, daftar catatan, perubahan status, dan identitas petugas atau admin yang terlibat di setiap tahapan laporan."
          note="Halaman riwayat sedang dipersiapkan."
        />
      </OMPageShell>
      )}
    </ProtectedRoute>
  );
}
