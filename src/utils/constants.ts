// API endpoints
export const API_ENDPOINTS = {
  SURVEYS: "/api/surveys",
  AUTH: "/api/auth",
} as const;

// Firebase collections
export const FIREBASE_COLLECTIONS = {
  SURVEYS: "surveyCahaya",
  USERS: "users",
} as const;

// Survey status
export const SURVEY_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
} as const;

// Filter options
export const FILTER_OPTIONS = {
  STATUS: [
    { value: "semua", label: "Semua" },
    { value: "pending", label: "Pending" },
    { value: "approved", label: "Approved" },
    { value: "rejected", label: "Rejected" },
  ],
} as const;

// Routes
export const ROUTES = {
  HOME: "/",
  ADMIN: "/admin",
  LOGIN: "/",
} as const;
