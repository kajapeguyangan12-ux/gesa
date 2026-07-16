"use client";

import { use } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { PreventiveOMApjPoint } from "@/components/om/PreventiveOMMobile";

export default function OMApjPointPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <ProtectedRoute>
      <PreventiveOMApjPoint idTitik={decodeURIComponent(id)} />
    </ProtectedRoute>
  );
}
