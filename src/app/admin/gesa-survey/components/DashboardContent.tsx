"use client";

interface DashboardContentProps {
  setActiveMenu: (menu: string) => void;
}

export default function DashboardContent({ setActiveMenu }: DashboardContentProps) {
  return (
    <>
      {/* Dashboard Content */}
      <div className="mb-6 bg-gradient-to-r from-green-600 to-green-700 rounded-2xl shadow-lg p-4 lg:p-6">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl lg:text-2xl font-bold text-white mb-1">
                Dashboard Survey
              </h2>
              <p className="text-sm text-green-100">
                Kelola dan pantau aktivitas survey
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-lg transition-all border border-gray-200">
          <h3 className="text-lg font-bold text-gray-800 mb-2">Distribusi Tugas</h3>
          <p className="text-sm text-gray-600 mb-4">Kelola distribusi tugas survey kepada petugas</p>
          <div className="flex items-center justify-between">
            <div className="text-2xl font-bold text-green-600">0</div>
            <button 
              onClick={() => setActiveMenu("distribusi-tugas")}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all text-sm font-medium"
            >
              Kelola
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-lg transition-all border border-gray-200">
          <h3 className="text-lg font-bold text-gray-800 mb-2">Validasi Survey</h3>
          <p className="text-sm text-gray-600 mb-4">Review dan validasi hasil survey</p>
          <div className="flex items-center justify-between">
            <div className="text-2xl font-bold text-blue-600">0</div>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all text-sm font-medium">
              Kelola
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-lg transition-all border border-gray-200">
          <h3 className="text-lg font-bold text-gray-800 mb-2">Progress Surveyor</h3>
          <p className="text-sm text-gray-600 mb-4">Monitor progress petugas survey</p>
          <div className="flex items-center justify-between">
            <div className="text-2xl font-bold text-purple-600">0</div>
            <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all text-sm font-medium">
              Lihat
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
