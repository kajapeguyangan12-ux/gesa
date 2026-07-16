"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { MasyarakatDashboard } from "@/components/masyarakat/MasyarakatMobile";

export default function MasyarakatPage() {
  return (
    <ProtectedRoute allowedRoles={["masyarakat-umum"]}>
      <MasyarakatDashboard />
    </ProtectedRoute>
  );
}
