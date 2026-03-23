"use client";

import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";

function PilihJenisSurveyContent() {
  const router = useRouter();

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-4 mb-8">
          <button 
            onClick={() => router.push('/pra-existing-panel')}
            className="w-10 h-10 flex items-center justify-center bg-white rounded-full shadow-sm border border-gray-200 hover:bg-gray-100 transition-colors"
          >
            <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-2xl font-bold text-gray-800">Pilih Jenis Survey</h1>
        </div>

        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => router.push("/survey-pra-existing")}
            className="w-full bg-white rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-300 p-6 sm:p-8 group border border-gray-200 hover:border-gray-300 active:scale-[0.98] relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-green-50 to-teal-100 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            
            <div className="relative flex items-center justify-between gap-4">
              <div className="flex items-center gap-5">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-green-50 to-teal-100 flex items-center justify-center text-4xl shadow-lg group-hover:shadow-xl group-hover:scale-110 transition-all duration-300">
                  📝
                </div>
                <div className="text-left">
                  <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 group-hover:text-teal-700 transition-colors">
                    Survey Pra Existing
                  </h3>
                  <p className="text-sm sm:text-base text-gray-600 font-medium">Survey sederhana untuk pendataan awal</p>
                </div>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-gray-800 to-gray-900 group-hover:from-teal-600 group-hover:to-teal-700 flex items-center justify-center shadow-lg transition-all group-hover:scale-110 group-hover:rotate-0 flex-shrink-0">
                <svg className="w-6 h-6 text-white group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </button>
        </div>
      </main>
    </div>
  );
}

export default function PraExistingSurveysPage() {
  return (
    <ProtectedRoute>
      <PilihJenisSurveyContent />
    </ProtectedRoute>
  );
}