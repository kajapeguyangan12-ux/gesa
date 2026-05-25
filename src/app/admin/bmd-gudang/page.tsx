"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import BmdGudangDashboard from "@/components/bmd-gudang/BmdGudangDashboard";

export default function BmdGudangAdminPage() {
  return (
    <ProtectedRoute
      allowedRoles={["admin", "super-admin"]}
      unauthorizedRedirect="/admin/module-selection"
    >
      <BmdGudangDashboard adminMode />
    </ProtectedRoute>
  );
}
