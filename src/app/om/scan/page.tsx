"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { PreventiveOMScan } from "@/components/om/PreventiveOMMobile";

export default function OMScanPage() {
  return (
    <ProtectedRoute>
      <PreventiveOMScan />
    </ProtectedRoute>
  );
}
