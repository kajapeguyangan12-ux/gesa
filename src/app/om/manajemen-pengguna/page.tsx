"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { OMPageShell, OMPlaceholderPanel } from "@/components/om/OMPageShell";

export default function OMManajemenPenggunaPage() {
  return (
    <ProtectedRoute>
      <OMPageShell
        eyebrow="Manajemen Pengguna"
        title="Pengelolaan akun petugas O&M yang lebih selaras dengan panel admin utama."
        description="Halaman ini disiapkan untuk kontrol akun, peran, dan akses petugas agar pengelolaan user O&M terasa satu sistem dengan dashboard utamanya."
        statusTitle="Administrasi pengguna dipersiapkan lebih tertib."
        statusDescription="Struktur halaman ini cocok untuk daftar akun, pengaturan role, status aktif, dan aksi administratif tanpa terasa seperti panel sementara."
        metaCards={[
          { label: "Fungsi", value: "Users", hint: "Kelola akun dan akses", tone: "teal" },
          { label: "Mode", value: "Admin", hint: "Kontrol struktur pengguna", tone: "cyan" },
          { label: "Target", value: "Akses", hint: "Role petugas lebih tertata", tone: "slate" },
          { label: "Tahap", value: "Draft", hint: "Siap dikembangkan lebih lanjut", tone: "emerald" },
        ]}
      >
        <OMPlaceholderPanel
          label="Manajemen Pengguna"
          title="Panel akun petugas akan hadir di area ini."
          description="Bagian ini bisa menampung daftar user, status akses, aksi edit, reset, atau pengaturan role, dengan hierarki visual yang tetap bersih dan mudah dipindai."
          note="Manajemen pengguna masih dalam pengembangan."
        />
      </OMPageShell>
    </ProtectedRoute>
  );
}
