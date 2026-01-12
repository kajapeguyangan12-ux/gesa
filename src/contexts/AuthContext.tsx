"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface User {
  email: string;
  username: string;
  displayName: string;
  role: "admin" | "super-admin" | "petugas-existing" | "petugas-apj-propose" | "petugas-survey-cahaya" | "petugas-kontruksi" | "petugas-om" | "petugas-bmd-gudang";
  uid: string;
  name: string;
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

  // Check localStorage on mount
  useEffect(() => {
    const storedUser = localStorage.getItem("gesa_user");
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (error) {
        console.error("Error parsing stored user:", error);
        localStorage.removeItem("gesa_user");
      }
    }
    setLoading(false);
  }, []);

  const signIn = async (identifier: string, password: string) => {
    try {
      if (!identifier || !password) {
        throw new Error("Username/Email dan password harus diisi");
      }

      // Query Firestore untuk mencari user berdasarkan email atau username
      const usersRef = collection(db, "User-Admin");
      
      // Coba cari berdasarkan email dulu
      let q = query(usersRef, where("email", "==", identifier.toLowerCase()));
      let querySnapshot = await getDocs(q);
      
      // Jika tidak ketemu, coba cari berdasarkan username
      if (querySnapshot.empty) {
        q = query(usersRef, where("username", "==", identifier.toLowerCase()));
        querySnapshot = await getDocs(q);
      }

      if (querySnapshot.empty) {
        throw new Error("Username atau email tidak ditemukan");
      }

      // Ambil data user pertama yang ditemukan
      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data();

      // Validasi password (dalam production, gunakan hash!)
      if (userData.password !== password) {
        throw new Error("Password salah");
      }

      console.log("=== LOGIN SUCCESS ===");
      console.log("User data from Firestore:", userData);
      console.log("Document ID:", userDoc.id);
      console.log("UID field in doc:", userData.uid);

      // Buat object user - prioritas gunakan uid dari field dokumen
      const authenticatedUser: User = {
        email: userData.email,
        username: userData.username,
        displayName: userData.name,
        name: userData.name,
        role: userData.role,
        uid: userData.uid || userDoc.id, // Gunakan field uid jika ada, fallback ke document ID
      };

      console.log("Authenticated user object:", authenticatedUser);

      // Save to localStorage
      localStorage.setItem("gesa_user", JSON.stringify(authenticatedUser));
      setUser(authenticatedUser);
      
    } catch (error: any) {
      console.error("Login error:", error);
      throw new Error(error.message || "Login gagal. Silakan coba lagi.");
    }
  };

  const signOut = async () => {
    try {
      localStorage.removeItem("gesa_user");
      setUser(null);
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
