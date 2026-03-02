"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useState, useEffect } from "react";

function SurveySelectionContent() {
  const router = useRouter();
  const { user } = useAuth();
  const [availableSurveys, setAvailableSurveys] = useState<string[]>([]);
  const [activeTask, setActiveTask] = useState<any>(null);

  useEffect(() => {
    // Get active task from localStorage
    const activeTaskStr = localStorage.getItem("activeTask");
    if (activeTaskStr) {
      try {
        const task = JSON.parse(activeTaskStr);
        setActiveTask(task);
        
        // Determine available surveys based on task type
        if (task.type === "propose-existing") {
          setAvailableSurveys(["existing", "apj-propose"]);
        } else if (task.type === "propose") {
          setAvailableSurveys(["apj-propose"]);
        } else if (task.type === "existing") {
          setAvailableSurveys(["existing"]);
        } else {
          // Default: show all if type is unknown
          setAvailableSurveys(["existing", "apj-propose"]);
        }
      } catch (error) {
        console.error("Error parsing activeTask:", error);
        setAvailableSurveys(["existing", "apj-propose"]);
      }
    } else {
      // No active task, show all surveys
      setAvailableSurveys(["existing", "apj-propose"]);
    }
  }, []);

  const allSurveyTypes = [
    {
      id: "existing",
      title: "Survey Existing",
      icon: "📋",
      description: "Survey untuk penerangan jalan existing",
      route: "/survey-existing",
      color: "from-blue-50 to-blue-100",
      borderColor: "border-blue-200",
      hoverColor: "hover:border-blue-400",
    },
    {
      id: "apj-propose",
      title: "Survey APJ Propose",
      icon: "💡",
      description: "Survey untuk usulan tiang penerangan baru",
      route: "/survey-apj-propose",
      color: "from-amber-50 to-yellow-100",
      borderColor: "border-yellow-200",
      hoverColor: "hover:border-yellow-400",
    },
  ];

  // Filter survey types based on available surveys
  const surveyTypes = allSurveyTypes.filter(survey => availableSurveys.includes(survey.id));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-gray-200/50 shadow-lg">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex items-center justify-between">
            {/* Back Button & Title */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push("/gesa-survey")}
                className="w-11 h-11 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 flex items-center justify-center shadow-md hover:shadow-lg transition-all active:scale-95"
              >
                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-indigo-900 bg-clip-text text-transparent">Survey</h1>
                <p className="text-xs sm:text-sm text-gray-600 font-medium mt-0.5">Pilih jenis survey</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-5">
        {/* Active Task Banner */}
        {activeTask && (
          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl p-5 shadow-lg text-white">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold mb-1">Tugas Aktif: {activeTask.title}</h3>
                <p className="text-sm text-blue-100">Pilih jenis survey yang ingin dikerjakan</p>
              </div>
            </div>
          </div>
        )}

        {/* Page Title */}
        <div className="mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Pilih Jenis Survey</h2>
          <p className="text-sm sm:text-base text-gray-600">Pilih survey sesuai dengan kebutuhan pekerjaan Anda</p>
        </div>

        {/* Survey Cards */}
        <div className="space-y-5">
          {surveyTypes.map((survey) => (
            <button
              key={survey.id}
              onClick={() => router.push(survey.route)}
              className="w-full bg-white rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-300 p-6 sm:p-8 group border border-gray-200 hover:border-gray-300 active:scale-[0.98] relative overflow-hidden"
            >
              {/* Gradient Background on Hover */}
              <div className={`absolute inset-0 bg-gradient-to-br ${survey.color} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
              
              <div className="relative flex items-center justify-between gap-4">
                {/* Left: Icon & Content */}
                <div className="flex items-center gap-5">
                  <div className={`w-20 h-20 rounded-3xl bg-gradient-to-br ${survey.color} flex items-center justify-center text-4xl shadow-lg group-hover:shadow-xl group-hover:scale-110 transition-all duration-300`}>
                    {survey.icon}
                  </div>
                  <div className="text-left">
                    <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 group-hover:text-blue-700 transition-colors">
                      {survey.title}
                    </h3>
                    <p className="text-sm sm:text-base text-gray-600 font-medium">{survey.description}</p>
                  </div>
                </div>

                {/* Right: Arrow Button */}
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-gray-800 to-gray-900 group-hover:from-blue-600 group-hover:to-blue-700 flex items-center justify-center shadow-lg transition-all group-hover:scale-110 group-hover:rotate-0 flex-shrink-0">
                  <svg className="w-6 h-6 text-white group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Info Card */}
        <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 border-2 border-blue-200/50 rounded-3xl p-6 sm:p-8 mt-10 shadow-lg">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-lg">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h4 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">Informasi</h4>
              <p className="text-sm sm:text-base text-gray-700 leading-relaxed">
                Pilih jenis survey yang sesuai dengan kebutuhan Anda. <span className="font-semibold text-blue-700">Survey Existing</span> untuk mengukur penerangan jalan yang sudah ada, 
                sedangkan <span className="font-semibold text-yellow-700">Survey Tiang APJ Propose</span> untuk mengusulkan lokasi tiang penerangan baru.
              </p>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-4 mt-8">
          <div className="bg-white rounded-2xl shadow-md p-5 border border-gray-200">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">0</p>
                <p className="text-xs text-gray-600 font-semibold">Survey Aktif</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-md p-5 border border-gray-200">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-100 to-emerald-200 flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">0</p>
                <p className="text-xs text-gray-600 font-semibold">Survey Selesai</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function SurveySelectionPage() {
  return (
    <ProtectedRoute>
      <SurveySelectionContent />
    </ProtectedRoute>
  );
}

export default SurveySelectionPage;
