"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import PemkabDashboard from "@/components/pemkab/PemkabDashboard";

export default function PemkabPage() {
  return (
    <ProtectedRoute allowedRoles={["pemkab-gesa"]}>
      <PemkabDashboard />
    </ProtectedRoute>
  );
}
