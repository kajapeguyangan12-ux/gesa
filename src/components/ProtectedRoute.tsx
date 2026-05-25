"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

export default function ProtectedRoute({
  children,
  allowedRoles,
  unauthorizedRedirect = "/module-selection",
}: {
  children: React.ReactNode;
  allowedRoles?: string[];
  unauthorizedRedirect?: string;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
    }

    if (!loading && user && allowedRoles && !allowedRoles.includes(user.role)) {
      router.push(unauthorizedRedirect);
    }
  }, [user, loading, router, allowedRoles, unauthorizedRedirect]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
          <p className="mt-2 text-xs text-gray-500">🚧 Development Mode</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return null;
  }

  return <>{children}</>;
}
