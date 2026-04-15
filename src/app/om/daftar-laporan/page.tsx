"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function OMDaftarLaporanPage() {
  const router = useRouter();

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-4xl px-4 py-8">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 shadow-sm hover:bg-gray-100"
          >
            ← Kembali
          </button>
          <div className="mt-6 rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">Daftar Laporan O&M</h1>
                <p className="mt-2 text-sm text-gray-500">Halaman ini akan menampilkan semua laporan O&M.</p>
              </div>
              <div className="relative h-16 w-16">
                <Image src="/BDG1.png" alt="Logo" fill className="object-contain" />
              </div>
            </div>
            <div className="mt-10 rounded-3xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-gray-600">
              <p className="text-lg font-medium text-gray-900">Halaman dalam pengembangan</p>
              <p className="mt-3 text-sm">Fitur daftar laporan O&M akan tersedia segera.</p>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
