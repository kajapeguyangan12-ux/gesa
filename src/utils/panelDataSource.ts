export function getReadableDataSourceLabel(source?: string | null) {
  switch ((source || "").toLowerCase()) {
    case "supabase":
      return "Supabase";
    case "firestore":
      return "Firestore";
    case "storage-bundle":
      return "Bundle Storage";
    default:
      return source || "Belum ada";
  }
}

export function formatPanelUpdatedAt(value?: Date | string | number | null) {
  if (!value) return "Belum ada";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Belum ada";

  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
