"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { PublicReportForm } from "@/components/masyarakat/MasyarakatMobile";

export default function MasyarakatLaporanKerusakanPage() {
  return (
    <ProtectedRoute allowedRoles={["masyarakat-umum"]}>
      <PublicReportForm />
    </ProtectedRoute>
  );
}
