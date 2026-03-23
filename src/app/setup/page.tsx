"use client";

import { useState } from "react";
import { createInitialSuperAdmin } from "@/lib/createSuperAdmin";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function SetupPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const router = useRouter();

  const handleCreateSuperAdmin = async () => {
    if (!confirm("Apakah Anda yakin ingin membuat Super Admin?")) {
      return;
    }

    setLoading(true);
    try {
      const res = await createInitialSuperAdmin();
      setResult(res);
    } catch (error: any) {
      setResult({ success: false, message: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-100">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="mb-6 flex justify-center">
              <Image
                src="/Logo_BGD.png"
                alt="Logo BGD"
                width={120}
                height={120}
                className="object-contain"
                priority
              />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Setup Super Admin
            </h1>
            <p className="text-gray-600">
              Buat akun Super Admin untuk pertama kali
            </p>
          </div>

          {/* Warning Banner */}
          <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-6 mb-6">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div>
                <h3 className="font-bold text-yellow-900 mb-2">⚠️ Penting!</h3>
                <ul className="text-sm text-yellow-800 space-y-1">
                  <li>• Halaman ini hanya digunakan sekali untuk setup awal</li>
                  <li>• Super Admin akan dibuat dengan kredensial default</li>
                  <li>• Segera ganti password setelah login pertama</li>
                  <li>• Setelah setup, halaman ini tidak diperlukan lagi</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 mb-6">
            <h3 className="font-bold text-blue-900 mb-3">Kredensial Default:</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-blue-900 w-24">Email:</span>
                <code className="bg-white px-3 py-1 rounded border border-blue-200 text-blue-900 font-mono">
                  superadmin@gesa.com
                </code>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-blue-900 w-24">Username:</span>
                <code className="bg-white px-3 py-1 rounded border border-blue-200 text-blue-900 font-mono">
                  superadmin
                </code>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-blue-900 w-24">Password:</span>
                <code className="bg-white px-3 py-1 rounded border border-blue-200 text-blue-900 font-mono">
                  SuperAdmin123!
                </code>
              </div>
            </div>
          </div>

          {/* Result Message */}
          {result && (
            <div className={`rounded-xl p-6 mb-6 border-2 ${
              result.success 
                ? 'bg-green-50 border-green-200' 
                : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-start gap-3">
                {result.success ? (
                  <svg className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                )}
                <div>
                  <h3 className={`font-bold mb-1 ${result.success ? 'text-green-900' : 'text-red-900'}`}>
                    {result.success ? '✅ Berhasil!' : '❌ Gagal'}
                  </h3>
                  <p className={`text-sm ${result.success ? 'text-green-800' : 'text-red-800'}`}>
                    {result.message}
                  </p>
                  {result.success && result.credentials && (
                    <div className="mt-4 space-y-1 text-sm text-green-900">
                      <p className="font-semibold">Gunakan kredensial ini untuk login:</p>
                      <p>📧 Email: {result.credentials.email}</p>
                      <p>👤 Username: {result.credentials.username}</p>
                      <p>🔑 Password: {result.credentials.password}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleCreateSuperAdmin}
              disabled={loading || (result && result.success)}
              className="flex-1 bg-gradient-to-r from-purple-600 to-purple-700 text-white py-4 rounded-xl font-bold hover:from-purple-700 hover:to-purple-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Membuat Super Admin...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                  Buat Super Admin
                </>
              )}
            </button>

            {result && result.success && (
              <button
                onClick={() => router.push('/admin/login')}
                className="flex-1 bg-gradient-to-r from-green-600 to-green-700 text-white py-4 rounded-xl font-bold hover:from-green-700 hover:to-green-800 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                Login Sekarang
              </button>
            )}
          </div>

          {/* Back to Home */}
          <div className="mt-6 text-center">
            <button
              onClick={() => router.push('/')}
              className="text-gray-600 hover:text-gray-800 text-sm font-medium transition-colors"
            >
              ← Kembali ke Halaman Utama
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
