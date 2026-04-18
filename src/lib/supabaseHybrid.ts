import { randomUUID } from "node:crypto";

export type HybridSurveyType = "existing" | "propose" | "pra-existing";

type GenericPayload = Record<string, unknown>;

function normalizeTimestamp(value: unknown, fallback?: string | null) {
  if (!value) return fallback ?? null;
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? fallback ?? null : parsed.toISOString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "object" && value && "seconds" in value) {
    const seconds = Number((value as { seconds?: number }).seconds);
    return Number.isFinite(seconds) ? new Date(seconds * 1000).toISOString() : fallback ?? null;
  }
  return fallback ?? null;
}

function normalizeNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const normalized = value.replace(",", ".").trim();
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function pickString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

export function createHybridId() {
  return randomUUID();
}

export function resolveSurveyTable(type: string) {
  if (type === "existing") return "survey_existing";
  if (type === "propose") return "survey_apj_propose";
  if (type === "pra-existing") return "survey_pra_existing";
  throw new Error(`Unsupported survey type: ${type}`);
}

export function buildTaskInsertRow(taskId: string, payload: GenericPayload) {
  const createdAt = normalizeTimestamp(payload.createdAt, new Date().toISOString());
  const rawPayload: GenericPayload = {
    ...payload,
    id: taskId,
    createdAt,
    updatedAt: normalizeTimestamp(payload.updatedAt, createdAt),
  };

  return {
    fb_doc_id: taskId,
    title: pickString(payload.title) || "Tanpa Judul",
    description: pickString(payload.description) || "",
    status: pickString(payload.status) || "pending",
    type: pickString(payload.type) || "",
    kmz_file_url: pickString(payload.kmzFileUrl, payload.kmz_file_url) || null,
    kmz_file_url_2: pickString(payload.kmzFileUrl2, payload.kmz_file_url2) || null,
    created_by_admin_id: pickString(payload.createdByAdminId) || null,
    created_by_admin_name: pickString(payload.createdByAdminName) || null,
    created_by_admin_email: pickString(payload.createdByAdminEmail) || null,
    surveyor_id: pickString(payload.surveyorId) || null,
    surveyor_name: pickString(payload.surveyorName) || null,
    surveyor_email: pickString(payload.surveyorEmail) || null,
    kabupaten: pickString(payload.kabupaten, payload.kabupatenName) || null,
    offline_enabled: typeof payload.offlineEnabled === "boolean" ? payload.offlineEnabled : false,
    due_date: normalizeTimestamp(payload.dueDate),
    created_at: createdAt,
    updated_at: normalizeTimestamp(payload.updatedAt, createdAt),
    raw_payload: rawPayload,
  };
}

export function buildTaskUpdateRow(existingRawPayload: GenericPayload | null | undefined, patch: GenericPayload) {
  const now = new Date().toISOString();
  const rawPayload: GenericPayload = {
    ...(existingRawPayload || {}),
    ...patch,
    updatedAt: normalizeTimestamp(patch.updatedAt, now),
  };

  return {
    title: pickString(rawPayload.title) || "Tanpa Judul",
    description: pickString(rawPayload.description) || "",
    status: pickString(rawPayload.status) || "pending",
    type: pickString(rawPayload.type) || "",
    kmz_file_url: pickString(rawPayload.kmzFileUrl, rawPayload.kmz_file_url) || null,
    kmz_file_url_2: pickString(rawPayload.kmzFileUrl2, rawPayload.kmz_file_url2) || null,
    created_by_admin_id: pickString(rawPayload.createdByAdminId) || null,
    created_by_admin_name: pickString(rawPayload.createdByAdminName) || null,
    created_by_admin_email: pickString(rawPayload.createdByAdminEmail) || null,
    surveyor_id: pickString(rawPayload.surveyorId) || null,
    surveyor_name: pickString(rawPayload.surveyorName) || null,
    surveyor_email: pickString(rawPayload.surveyorEmail) || null,
    kabupaten: pickString(rawPayload.kabupaten, rawPayload.kabupatenName) || null,
    offline_enabled: typeof rawPayload.offlineEnabled === "boolean" ? rawPayload.offlineEnabled : false,
    due_date: normalizeTimestamp(rawPayload.dueDate),
    updated_at: normalizeTimestamp(rawPayload.updatedAt, now),
    raw_payload: rawPayload,
  };
}

export function buildSurveyInsertRow(type: HybridSurveyType, surveyId: string, payload: GenericPayload) {
  const createdAt = normalizeTimestamp(payload.createdAt, new Date().toISOString());
  const rawPayload: GenericPayload = {
    ...payload,
    id: surveyId,
    type,
    createdAt,
    updatedAt: normalizeTimestamp(payload.updatedAt, createdAt),
  };

  return {
    fb_doc_id: surveyId,
    title: pickString(rawPayload.title) || `Survey ${type}`,
    type,
    status: pickString(rawPayload.status) || "menunggu",
    surveyor_name: pickString(rawPayload.surveyorName) || null,
    surveyor_email: pickString(rawPayload.surveyorEmail) || null,
    surveyor_uid: pickString(rawPayload.surveyorUid) || null,
    task_id: pickString(rawPayload.taskId) || null,
    task_title: pickString(rawPayload.taskTitle) || null,
    kmz_file_url: pickString(rawPayload.kmzFileUrl, rawPayload.kmz_file_url) || null,
    kabupaten: pickString(rawPayload.kabupaten, rawPayload.kabupatenName) || null,
    latitude: normalizeNumber(rawPayload.latitude),
    longitude: normalizeNumber(rawPayload.longitude),
    accuracy: normalizeNumber(rawPayload.accuracy),
    created_at: createdAt,
    verified_at: normalizeTimestamp(rawPayload.verifiedAt, normalizeTimestamp(rawPayload.validatedAt)),
    updated_at: normalizeTimestamp(rawPayload.updatedAt, createdAt),
    raw_payload: rawPayload,
  };
}

export function buildSurveyUpdateRow(
  type: HybridSurveyType,
  existingRawPayload: GenericPayload | null | undefined,
  patch: GenericPayload
) {
  const now = new Date().toISOString();
  const rawPayload: GenericPayload = {
    ...(existingRawPayload || {}),
    ...patch,
    type,
    updatedAt: normalizeTimestamp(patch.updatedAt, now),
  };

  return {
    title: pickString(rawPayload.title) || `Survey ${type}`,
    type,
    status: pickString(rawPayload.status) || "menunggu",
    surveyor_name: pickString(rawPayload.surveyorName) || null,
    surveyor_email: pickString(rawPayload.surveyorEmail) || null,
    surveyor_uid: pickString(rawPayload.surveyorUid) || null,
    task_id: pickString(rawPayload.taskId) || null,
    task_title: pickString(rawPayload.taskTitle) || null,
    kmz_file_url: pickString(rawPayload.kmzFileUrl, rawPayload.kmz_file_url) || null,
    kabupaten: pickString(rawPayload.kabupaten, rawPayload.kabupatenName) || null,
    latitude: normalizeNumber(rawPayload.latitude),
    longitude: normalizeNumber(rawPayload.longitude),
    accuracy: normalizeNumber(rawPayload.accuracy),
    verified_at: normalizeTimestamp(
      rawPayload.verifiedAt,
      normalizeTimestamp(rawPayload.validatedAt, normalizeTimestamp(rawPayload.rejectedAt))
    ),
    updated_at: normalizeTimestamp(rawPayload.updatedAt, now),
    raw_payload: rawPayload,
  };
}

export function buildTrackingInsertRow(sessionId: string, payload: GenericPayload) {
  const now = new Date().toISOString();
  const path = Array.isArray(payload.path) ? payload.path : [];
  const startTime = normalizeTimestamp(payload.startTime, now);
  const rawPayload: GenericPayload = {
    ...payload,
    id: sessionId,
    startTime,
    lastUpdate: normalizeTimestamp(payload.lastUpdate, startTime),
    endTime: normalizeTimestamp(payload.endTime),
  };

  return {
    fb_doc_id: sessionId,
    user_id: pickString(payload.userId) || null,
    user_name: pickString(payload.userName) || null,
    user_email: pickString(payload.userEmail) || null,
    status: pickString(payload.status) || "active",
    survey_type: pickString(payload.surveyType) || null,
    start_time: startTime,
    end_time: normalizeTimestamp(payload.endTime),
    last_update: normalizeTimestamp(payload.lastUpdate, startTime),
    total_distance: normalizeNumber(payload.totalDistance) ?? 0,
    points_count: normalizeNumber(payload.pointsCount) ?? path.length,
    duration: normalizeNumber(payload.duration) ?? 0,
    path,
    raw_payload: rawPayload,
  };
}

export function buildTrackingUpdateRow(existingRawPayload: GenericPayload | null | undefined, patch: GenericPayload) {
  const now = new Date().toISOString();
  const rawPayload: GenericPayload = {
    ...(existingRawPayload || {}),
    ...patch,
    lastUpdate: normalizeTimestamp(patch.lastUpdate, now),
    endTime:
      patch.endTime === null
        ? null
        : normalizeTimestamp(patch.endTime, normalizeTimestamp((existingRawPayload || {}).endTime)),
  };
  const path = Array.isArray(rawPayload.path) ? rawPayload.path : [];

  return {
    user_id: pickString(rawPayload.userId) || null,
    user_name: pickString(rawPayload.userName) || null,
    user_email: pickString(rawPayload.userEmail) || null,
    status: pickString(rawPayload.status) || "active",
    survey_type: pickString(rawPayload.surveyType) || null,
    start_time: normalizeTimestamp(rawPayload.startTime),
    end_time:
      rawPayload.endTime === null
        ? null
        : normalizeTimestamp(rawPayload.endTime),
    last_update: normalizeTimestamp(rawPayload.lastUpdate, now),
    total_distance: normalizeNumber(rawPayload.totalDistance) ?? 0,
    points_count: normalizeNumber(rawPayload.pointsCount) ?? path.length,
    duration: normalizeNumber(rawPayload.duration) ?? 0,
    path,
    raw_payload: rawPayload,
  };
}
