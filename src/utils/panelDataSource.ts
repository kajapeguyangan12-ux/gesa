import { formatWitaDateTime } from "@/utils/dateTime";

export function getReadableDataSourceLabel(source?: string | null) {
  switch ((source || "").toLowerCase()) {
    case "supabase":
      return "Supabase";
    case "firestore":
      return "Firestore";
    default:
      return source || "Belum ada";
  }
}

export function formatPanelUpdatedAt(value?: Date | string | number | null) {
  if (!value) return "Belum ada";
  return (
    formatWitaDateTime(value, {
      second: "2-digit",
    }) || "Belum ada"
  );
}
