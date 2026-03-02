"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DataSurveyValidPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header Section */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Data Survey Valid</h1>
                <p className="text-sm text-gray-600 mt-1">Kelola dan pantau aktivitas survey</p>
              </div>
            </div>
            <button className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:-translate-y-0.5">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Ekspor Semua (Excel)
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Title Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Data Survey Valid</h2>
          <p className="text-gray-600">Akses data survey yang telah tervalidasi berdasarkan kategori dan zona</p>
        </div>

        {/* Survey Category Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Survey Existing Card */}
          <div className="group bg-white rounded-2xl shadow-md hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 border border-gray-200 overflow-hidden">
            <div className="p-8">
              <div className="flex flex-col items-center text-center">
                {/* Icon */}
                <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg mb-6 group-hover:scale-110 transition-transform duration-300">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                </div>

                {/* Title */}
                <h3 className="text-2xl font-bold text-gray-900 mb-3">Survey Existing</h3>
                
                {/* Description */}
                <p className="text-gray-600 text-sm mb-6 leading-relaxed">
                  Data Survey Existing yang telah tervalidasi
                </p>

                {/* Button */}
                <button 
                  onClick={() => router.push('/admin/data-survey-valid/existing')}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg group-hover:gap-3"
                >
                  Klik untuk melihat data
                  <svg className="w-5 h-5 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Survey Tiang APJ Propose Card */}
          <div className="group bg-white rounded-2xl shadow-md hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 border border-gray-200 overflow-hidden">
            <div className="p-8">
              <div className="flex flex-col items-center text-center">
                {/* Icon */}
                <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center shadow-lg mb-6 group-hover:scale-110 transition-transform duration-300">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                </div>

                {/* Title */}
                <h3 className="text-2xl font-bold text-gray-900 mb-3">Survey Tiang APJ Propose</h3>
                
                {/* Description */}
                <p className="text-gray-600 text-sm mb-6 leading-relaxed">
                  Data Survey Tiang APJ Propose yang telah tervalidasi
                </p>

                {/* Button */}
                <button 
                  onClick={() => router.push('/admin/data-survey-valid/propose')}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg group-hover:gap-3"
                >
                  Klik untuk melihat data
                  <svg className="w-5 h-5 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Information Box */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-500 rounded-xl p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="flex-1">
              <h4 className="text-lg font-bold text-gray-900 mb-3">Informasi Kategori Survey</h4>
              <div className="space-y-2 text-sm text-gray-700">
                <p className="flex items-start gap-2">
                  <span className="font-semibold text-blue-700 min-w-[180px]">Survey Existing:</span>
                  <span>Survey yang berkaitan dengan data existing yang sudah ada</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="font-semibold text-green-700 min-w-[180px]">Survey Tiang APJ Propose:</span>
                  <span>Survey tiang APJ untuk usulan atau rencana baru</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Statistics Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-600 font-medium">Total Survey Valid</p>
                <h3 className="text-2xl font-bold text-gray-900">0</h3>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-600 font-medium">Survey Existing</p>
                <h3 className="text-2xl font-bold text-gray-900">0</h3>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-600 font-medium">Survey APJ Propose</p>
                <h3 className="text-2xl font-bold text-gray-900">0</h3>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
