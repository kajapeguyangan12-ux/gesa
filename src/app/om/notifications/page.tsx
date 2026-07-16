"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { PreventiveOMNotifications } from "@/components/om/PreventiveOMMobile";

export default function OMNotificationsPage() {
  return (
    <ProtectedRoute>
      <PreventiveOMNotifications />
    </ProtectedRoute>
  );
}
