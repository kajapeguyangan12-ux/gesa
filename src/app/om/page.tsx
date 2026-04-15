"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import OMDashboard from "@/components/OMDashboard";

export default function OMPetugasPage() {
  return (
    <ProtectedRoute>
      <OMDashboard />
    </ProtectedRoute>
  );
}
