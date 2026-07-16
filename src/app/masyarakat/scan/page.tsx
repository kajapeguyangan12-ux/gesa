"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { PublicScanPage } from "@/components/masyarakat/MasyarakatMobile";

export default function MasyarakatScanPage() {
  return (
    <ProtectedRoute allowedRoles={["masyarakat-umum"]}>
      <PublicScanPage />
    </ProtectedRoute>
  );
}
