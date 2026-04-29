export const WITA_TIME_ZONE = "Asia/Makassar";

export type DateInput =
  | Date
  | string
  | number
  | null
  | undefined
  | {
      toDate?: () => Date;
      seconds?: number;
    };

export function toDateValue(value: DateInput) {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "object") {
    if ("toDate" in value && typeof value.toDate === "function") {
      const parsed = value.toDate();
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    if ("seconds" in value && typeof value.seconds === "number") {
      const parsed = new Date(value.seconds * 1000);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatWitaDateTime(value: DateInput, options?: Intl.DateTimeFormatOptions) {
  const date = toDateValue(value);
  if (!date) return "";

  return date.toLocaleString("id-ID", {
    timeZone: WITA_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...options,
  });
}

export function formatWitaDate(value: DateInput, options?: Intl.DateTimeFormatOptions) {
  const date = toDateValue(value);
  if (!date) return "";

  return date.toLocaleDateString("id-ID", {
    timeZone: WITA_TIME_ZONE,
    day: "2-digit",
    month: "long",
    year: "numeric",
    ...options,
  });
}

export function formatWitaTime(value: DateInput, options?: Intl.DateTimeFormatOptions) {
  const date = toDateValue(value);
  if (!date) return "";

  return date.toLocaleTimeString("id-ID", {
    timeZone: WITA_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    ...options,
  });
}

export function getCurrentWitaDate() {
  const now = new Date();
  const witaNow = new Intl.DateTimeFormat("sv-SE", {
    timeZone: WITA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(now);

  return new Date(witaNow.replace(" ", "T"));
}
