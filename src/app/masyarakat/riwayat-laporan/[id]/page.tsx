"use client";

import { useParams } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import { PublicReportDetail } from "@/components/masyarakat/MasyarakatMobile";

export default function MasyarakatDetailLaporanPage() {
  const params = useParams<{ id: string }>();
  return (
    <ProtectedRoute allowedRoles={["masyarakat-umum"]}>
      <PublicReportDetail reportId={decodeURIComponent(params.id)} />
    </ProtectedRoute>
  );
}
