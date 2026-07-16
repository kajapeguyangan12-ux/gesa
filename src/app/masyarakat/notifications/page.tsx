"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { PublicNotifications } from "@/components/masyarakat/MasyarakatMobile";

export default function MasyarakatNotificationsPage() {
  return (
    <ProtectedRoute allowedRoles={["masyarakat-umum"]}>
      <PublicNotifications />
    </ProtectedRoute>
  );
}
