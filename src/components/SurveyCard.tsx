"use client";

import React from "react";
import { SurveyData } from "@/types/survey";

interface SurveyCardProps {
  survey: SurveyData;
  onClick?: (survey: SurveyData) => void;
}

export default function SurveyCard({ survey, onClick }: SurveyCardProps) {
  return (
    <div
      className="group bg-white rounded-2xl shadow-lg p-7 hover:shadow-2xl transition-all duration-300 cursor-pointer border border-gray-100 hover:border-blue-200 transform hover:-translate-y-1"
      onClick={() => onClick?.(survey)}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-5">
        <h3 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
          {survey.title}
        </h3>
        {survey.modifiedBy && (
          <span className="text-xs bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-800 px-3 py-1.5 rounded-full flex items-center gap-1.5 font-semibold shadow-sm">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span className="italic">by {survey.modifiedBy}</span>
          </span>
        )}
      </div>

      {/* Details */}
      <div className="space-y-3.5">
        {/* Date and Time - Modern Design */}
        <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl">
          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="flex-1">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Waktu Survey</div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-sm font-bold text-gray-900">{survey.date}</span>
              <span className="text-gray-400">•</span>
              <span className="text-sm font-semibold text-gray-700">{survey.time}</span>
            </div>
          </div>
        </div>

        {/* Location */}
        <div className="flex items-center gap-3 text-gray-700">
          <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            </svg>
          </div>
          <span className="text-sm font-medium">{survey.location}</span>
        </div>

        {/* Officer */}
        <div className="flex items-center gap-3 text-gray-700">
          <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <span className="text-sm font-medium">{survey.officer}</span>
        </div>

        {/* Specs Grid */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100">
          {/* Power */}
          <div className="text-center p-2 bg-yellow-50 rounded-lg">
            <svg className="w-5 h-5 text-yellow-600 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <div className="text-xs font-bold text-gray-900">{survey.power}</div>
            <div className="text-xs text-gray-500">Power</div>
          </div>

          {/* Meter */}
          <div className="text-center p-2 bg-blue-50 rounded-lg">
            <svg className="w-5 h-5 text-blue-600 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <div className="text-xs font-bold text-gray-900">{survey.meter}</div>
            <div className="text-xs text-gray-500">Jarak</div>
          </div>

          {/* Voltage */}
          <div className="text-center p-2 bg-orange-50 rounded-lg">
            <svg className="w-5 h-5 text-orange-600 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <div className="text-xs font-bold text-gray-900">{survey.voltage}</div>
            <div className="text-xs text-gray-500">Tegangan</div>
          </div>
        </div>
      </div>
    </div>
  );
}
