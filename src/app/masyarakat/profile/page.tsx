"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { PublicProfilePage } from "@/components/masyarakat/MasyarakatMobile";

export default function MasyarakatProfilePage() {
  return (
    <ProtectedRoute allowedRoles={["masyarakat-umum"]}>
      <PublicProfilePage />
    </ProtectedRoute>
  );
}
