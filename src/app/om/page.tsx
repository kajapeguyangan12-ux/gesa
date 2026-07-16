"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import OMDashboard from "@/components/OMDashboard";
import { useAuth } from "@/hooks/useAuth";
import { isMobileOmRole, PreventiveOMDashboard } from "@/components/om/PreventiveOMMobile";

function OMRoleDashboard() {
  const { user } = useAuth();

  if (isMobileOmRole(user?.role)) {
    return <PreventiveOMDashboard />;
  }

  return <OMDashboard />;
}

export default function OMPetugasPage() {
  return (
    <ProtectedRoute>
      <OMRoleDashboard />
    </ProtectedRoute>
  );
}
