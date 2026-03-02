"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import { KemeratanCahayaContent } from "@/app/kemerataan-cahaya/page";

function AdminKemeratanCahayaPage() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && user.role !== "admin") {
      router.push("/dashboard-pengukuran");
    }
  }, [user, router]);

  return (
    <ProtectedRoute>
      <KemeratanCahayaContent />
    </ProtectedRoute>
  );
}

export default AdminKemeratanCahayaPage;
