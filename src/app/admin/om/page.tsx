"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import OMDashboard from "@/components/OMDashboard";

export default function OMAdminPage() {
  return (
    <ProtectedRoute>
      <OMDashboard />
    </ProtectedRoute>
  );
}
