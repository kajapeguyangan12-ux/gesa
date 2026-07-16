"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { PublicApjMapPage } from "@/components/masyarakat/MasyarakatMobile";

export default function MasyarakatPetaApjPage() {
  return (
    <ProtectedRoute allowedRoles={["masyarakat-umum"]}>
      <PublicApjMapPage />
    </ProtectedRoute>
  );
}
