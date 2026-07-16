"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { PublicReportsHistory } from "@/components/masyarakat/MasyarakatMobile";

export default function MasyarakatRiwayatLaporanPage() {
  return (
    <ProtectedRoute allowedRoles={["masyarakat-umum"]}>
      <PublicReportsHistory />
    </ProtectedRoute>
  );
}
