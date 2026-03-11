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
    if (!user) return;
    if (user.role !== "admin" && user.role !== "super-admin") {
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
