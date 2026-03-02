import { SurveyData } from "@/types/survey";

/**
 * Format date to Indonesian format
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const options: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "long",
    year: "numeric",
  };
  return d.toLocaleDateString("id-ID", options);
}

/**
 * Format time to HH:MM format
 */
export function formatTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Get initials from name
 */
export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

/**
 * Filter surveys by search term
 */
export function filterSurveysBySearch(
  surveys: SurveyData[],
  searchTerm: string
): SurveyData[] {
  if (!searchTerm.trim()) return surveys;
  
  const term = searchTerm.toLowerCase();
  return surveys.filter(
    (survey) =>
      survey.title.toLowerCase().includes(term) ||
      survey.location.toLowerCase().includes(term) ||
      survey.officer.toLowerCase().includes(term)
  );
}

/**
 * Get status badge color
 */
export function getStatusColor(status: string): {
  bg: string;
  text: string;
} {
  switch (status) {
    case "approved":
      return { bg: "bg-green-100", text: "text-green-800" };
    case "rejected":
      return { bg: "bg-red-100", text: "text-red-800" };
    case "pending":
    default:
      return { bg: "bg-yellow-100", text: "text-yellow-800" };
  }
}
