"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { PreventiveOMProfile } from "@/components/om/PreventiveOMMobile";

export default function OMProfilePage() {
  return (
    <ProtectedRoute>
      <PreventiveOMProfile />
    </ProtectedRoute>
  );
}
