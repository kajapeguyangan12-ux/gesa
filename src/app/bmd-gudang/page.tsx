"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import BmdGudangDashboard from "@/components/bmd-gudang/BmdGudangDashboard";

export default function BmdGudangPetugasPage() {
  return (
    <ProtectedRoute
      allowedRoles={["petugas-bmd-gudang", "super-admin"]}
      unauthorizedRedirect="/module-selection"
    >
      <BmdGudangDashboard />
    </ProtectedRoute>
  );
}
