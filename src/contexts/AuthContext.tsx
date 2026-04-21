"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

interface User {
  email: string;
  username: string;
  displayName: string;
  role:
    | "admin"
    | "super-admin"
    | "petugas-existing"
    | "petugas-apj-propose"
    | "petugas-pra-existing"
    | "petugas-survey-cahaya"
    | "petugas-kontruksi"
    | "petugas-om"
    | "petugas-bmd-gudang";
  uid: string;
  name: string;
  phoneNumber?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (identifier: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signIn: async () => {},
  signOut: async () => {},
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const authProvider = (process.env.NEXT_PUBLIC_AUTH_PROVIDER || "supabase").trim().toLowerCase();
  const useLegacyAuth = authProvider === "legacy";

  const persistUser = (nextUser: User | null) => {
    if (nextUser) {
      localStorage.setItem("gesa_user", JSON.stringify(nextUser));
    } else {
      localStorage.removeItem("gesa_user");
    }
    setUser(nextUser);
  };

  const fetchSupabaseProfile = async (params: { uid?: string; email?: string }) => {
    const queryParams = new URLSearchParams();
    if (params.uid) queryParams.set("uid", params.uid);
    if (params.email) queryParams.set("email", params.email);

    const response = await fetch(`/api/auth/profile?${queryParams.toString()}`, {
      cache: "no-store",
    });
    const payload = (await response.json()) as {
      error?: string;
      user?: {
        email?: string;
        username?: string;
        name?: string;
        role?: User["role"];
        uid?: string;
        phoneNumber?: string;
      };
    };

    if (!response.ok || !payload.user) {
      throw new Error(payload.error || "Profil user tidak ditemukan.");
    }

    const profile = payload.user;
    return {
      email: profile.email || "",
      username: profile.username || "",
      displayName: profile.name || profile.username || profile.email || "",
      name: profile.name || profile.username || profile.email || "",
      role: (profile.role || "petugas-existing") as User["role"],
      uid: profile.uid || "",
      phoneNumber: profile.phoneNumber || "",
    } satisfies User;
  };

  const restoreLegacyUser = () => {
    const storedUser = localStorage.getItem("gesa_user");
    if (!storedUser) return null;

    try {
      return JSON.parse(storedUser) as User;
    } catch (error) {
      console.error("Error parsing stored user:", error);
      localStorage.removeItem("gesa_user");
      return null;
    }
  };

  useEffect(() => {
    let isMounted = true;

    const restoreAuthState = async () => {
      try {
        if (useLegacyAuth) {
          const legacyUser = restoreLegacyUser();
          if (isMounted) {
            setUser(legacyUser);
          }
          return;
        }

        const supabase = getSupabaseBrowserClient();
        if (!supabase) {
          throw new Error(
            "Supabase auth client belum aktif. Isi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY."
          );
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user && isMounted) {
          const nextUser = await fetchSupabaseProfile({
            uid: session.user.id,
            email: session.user.email,
          });
          if (isMounted) {
            persistUser(nextUser);
          }
          return;
        }

        if (isMounted) {
          persistUser(null);
        }
      } catch (error) {
        console.error("Error restoring auth state:", error);
        if (isMounted) {
          persistUser(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void restoreAuthState();

    return () => {
      isMounted = false;
    };
  }, [useLegacyAuth]);

  const signIn = async (identifier: string, password: string) => {
    try {
      if (!identifier || !password) {
        throw new Error("Username/Email dan password harus diisi");
      }

      const normalizedIdentifier = identifier.trim().toLowerCase();
      if (useLegacyAuth) {
        throw new Error("Legacy auth Firestore sudah dimatikan. Gunakan Supabase Auth.");
      }

      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        throw new Error(
          "Supabase auth client belum aktif. Isi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY."
        );
      }

      let email = normalizedIdentifier;
      if (!normalizedIdentifier.includes("@")) {
        const resolveResponse = await fetch(
          `/api/auth/resolve-identifier?identifier=${encodeURIComponent(normalizedIdentifier)}`,
          { cache: "no-store" }
        );
        const resolvePayload = (await resolveResponse.json()) as {
          email?: string;
          error?: string;
        };

        if (!resolveResponse.ok || !resolvePayload.email) {
          throw new Error(resolvePayload.error || "Username atau email tidak ditemukan");
        }

        email = resolvePayload.email;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw new Error(error.message || "Login Supabase gagal.");
      }

      const authenticatedUser = await fetchSupabaseProfile({
        uid: data.user?.id,
        email: data.user?.email || email,
      });
      persistUser(authenticatedUser);
    } catch (error: unknown) {
      console.error("Login error:", error);
      throw new Error(error instanceof Error ? error.message : "Login gagal. Silakan coba lagi.");
    }
  };

  const signOut = async () => {
    try {
      if (!useLegacyAuth) {
        const supabase = getSupabaseBrowserClient();
        if (supabase) {
          const { error } = await supabase.auth.signOut();
          if (error) {
            console.error("Supabase logout error:", error);
          }
        }
      } else {
        localStorage.removeItem("gesa_user");
      }

      persistUser(null);
      router.push("/");
    } catch (error) {
      console.error("Logout error:", error);
      throw error;
    }
  };

  const value = {
    user,
    loading,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
