"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";

export default function AdminLogin() {
  const [showPassword, setShowPassword] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const { signIn, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (user) {
      // Admin login page - untuk admin dan super-admin
      if (user.role === "admin" || user.role === "super-admin") {
        // Redirect ke admin module selection
        router.push("/admin/module-selection");
      } else {
        // Jika bukan admin/super-admin (berarti petugas), redirect ke halaman petugas
        setError("Anda tidak memiliki akses admin. Silakan gunakan login petugas.");
        setTimeout(() => {
          router.push("/");
        }, 2000);
      }
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    
    try {
      await signIn(identifier, password);
      // Validasi role setelah login
      // Note: The actual check will be done in the useEffect above
    } catch (error: any) {
      console.error("Login error:", error);
      setError(error.message || "Login gagal. Silakan cek kredensial Anda.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToMain = () => {
    router.push("/");
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Left Sidebar - Red Section with Logo and Info */}
      <div className={`hidden lg:flex lg:w-2/5 bg-gradient-to-br from-red-600 via-red-700 to-red-800 relative overflow-hidden transition-all duration-1000 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
        {/* Decorative Corners */}
        <div className="absolute top-0 right-0">
          <svg width="200" height="200" viewBox="0 0 200 200" className="text-white opacity-10">
            <polygon points="200,0 200,200 0,0" fill="currentColor" />
          </svg>
        </div>
        
        <div className="absolute bottom-0 left-0">
          <svg width="200" height="200" viewBox="0 0 200 200" className="text-white opacity-10">
            <polygon points="0,200 200,200 0,0" fill="currentColor" />
          </svg>
        </div>

        <div className="absolute bottom-0 right-0 w-1 h-64 bg-white/20"></div>

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center justify-center w-full p-12">
          <div className={`transition-all duration-1000 delay-300 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            {/* Logo */}
            <div className="mb-12 flex justify-center">
              <div className="bg-white p-8 rounded-2xl shadow-2xl">
                <Image
                  src="/Logo_BGD.png"
                  alt="Logo BGD"
                  width={140}
                  height={140}
                  className="object-contain"
                  priority
                />
              </div>
            </div>
            
            {/* Text */}
            <div className="text-center text-white space-y-3">
              <h2 className="text-xl font-semibold">System By:</h2>
              <h1 className="text-3xl font-bold">Bali Gerbang Digital</h1>
            </div>
            
            <div className="mt-16 text-center">
              <p className="text-2xl font-bold text-white mb-1">Admin Panel</p>
              <p className="text-xl text-white/90">Sistem Uji Sinar</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Section - Login Card */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className={`w-full max-w-md transition-all duration-1000 delay-500 ${isLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
          {/* Login Card */}
          <div className="bg-white rounded-2xl shadow-2xl p-10 border border-gray-100">
            {/* Back Button */}
            <button
              onClick={handleBackToMain}
              className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="text-sm font-medium">Kembali</span>
            </button>

            {/* Logo and Header */}
            <div className="text-center mb-8">
              <div className="mb-6 flex justify-center">
                <Image
                  src="/Logo_BGD.png"
                  alt="Logo BGD"
                  width={100}
                  height={100}
                  className="object-contain"
                  priority
                />
              </div>
              <h1 className="text-2xl font-bold text-gray-800">
                Login Admin
              </h1>
              <p className="text-sm text-gray-600 mt-2">
                Silakan masukkan kredensial admin Anda
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Admin Access Notice */}
              <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
                <p className="text-sm font-semibold mb-1">🔒 Admin & Super Admin Access</p>
                <p className="text-xs">
                  Masukkan username/email dan password yang telah dibuat oleh Super Admin
                </p>
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-start gap-2">
                  <svg
                    className="w-5 h-5 mt-0.5 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-sm">{error}</span>
                </div>
              )}

              {/* Email/Username Input */}
              <div>
                <label htmlFor="identifier" className="block text-sm font-semibold text-gray-700 mb-2">
                  Email Admin
                </label>
                <input
                  type="text"
                  id="identifier"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-lg focus:border-red-400 focus:ring-4 focus:ring-red-100 outline-none transition-all duration-200 text-gray-900 placeholder-gray-500 hover:border-gray-300"
                  placeholder="admin@example.com"
                  required
                />
              </div>

              {/* Password Input */}
              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-lg focus:border-red-400 focus:ring-4 focus:ring-red-100 outline-none transition-all duration-200 text-gray-900 placeholder-gray-500 hover:border-gray-300"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Login Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-red-500 to-red-600 text-white py-3.5 rounded-lg font-semibold hover:from-red-600 hover:to-red-700 transition-all duration-200 transform hover:scale-[1.02] active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Memproses...</span>
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <span>LOGIN SEBAGAI ADMIN</span>
                  </span>
                )}
              </button>

              {/* Info Text */}
              <div className="mt-4 text-center">
                <p className="text-xs text-gray-500">
                  Pastikan Anda memiliki hak akses administrator
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
