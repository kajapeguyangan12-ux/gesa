import { buildTaskUpdateRow } from "@/lib/supabaseHybrid";

type GenericPayload = Record<string, unknown>;

type SupportedTaskType = "existing" | "propose" | "pra-existing";

type PendingTaskRow = {
  fb_doc_id: string | null;
  type: string | null;
  raw_payload?: GenericPayload | null;
};

const SURVEY_TABLE_BY_TYPE: Record<SupportedTaskType, string> = {
  existing: "survey_existing",
  propose: "survey_apj_propose",
  "pra-existing": "survey_pra_existing",
};

function normalizeTaskType(type: string | null | undefined): SupportedTaskType | null {
  if (type === "existing" || type === "propose" || type === "pra-existing") {
    return type;
  }

  return null;
}

export async function syncPendingTasksWithSubmittedSurveys(
  supabase: any,
  tasks: PendingTaskRow[]
) {
  const pendingTasks = tasks.filter((task) => task.fb_doc_id && task.type && normalizeTaskType(task.type));
  if (pendingTasks.length === 0) {
    return new Set<string>();
  }

  const idsByType = new Map<SupportedTaskType, string[]>();

  for (const task of pendingTasks) {
    const normalizedType = normalizeTaskType(task.type);
    if (!normalizedType || !task.fb_doc_id) {
      continue;
    }

    const entries = idsByType.get(normalizedType) || [];
    entries.push(task.fb_doc_id);
    idsByType.set(normalizedType, entries);
  }

  const matchedTaskIds = new Set<string>();
  const earliestCreatedAtByTaskId = new Map<string, string>();

  for (const [taskType, taskIds] of idsByType.entries()) {
    if (taskIds.length === 0) {
      continue;
    }

    const surveyTable = SURVEY_TABLE_BY_TYPE[taskType];
    const { data, error } = await supabase
      .from(surveyTable)
      .select("task_id, created_at")
      .in("task_id", taskIds);

    if (error) {
      throw new Error(error.message);
    }

    for (const row of data || []) {
      const taskId = row.task_id || "";
      if (!taskId) {
        continue;
      }

      matchedTaskIds.add(taskId);
      const existingCreatedAt = earliestCreatedAtByTaskId.get(taskId);
      if (!existingCreatedAt || ((row.created_at || "") && (row.created_at || "") < existingCreatedAt)) {
        earliestCreatedAtByTaskId.set(taskId, row.created_at || new Date().toISOString());
      }
    }
  }

  if (matchedTaskIds.size === 0) {
    return matchedTaskIds;
  }

  for (const task of pendingTasks) {
    const taskId = task.fb_doc_id || "";
    if (!taskId || !matchedTaskIds.has(taskId)) {
      continue;
    }

    const existingRawPayload = (task.raw_payload as GenericPayload | null | undefined) || {};
    const startedAt =
      typeof existingRawPayload.startedAt === "string" && existingRawPayload.startedAt
        ? existingRawPayload.startedAt
        : earliestCreatedAtByTaskId.get(taskId) || new Date().toISOString();

    const row = buildTaskUpdateRow(existingRawPayload, {
      status: "in-progress",
      startedAt,
    });

    const { error } = await supabase.from("tasks").update(row).eq("fb_doc_id", taskId);
    if (error) {
      throw new Error(error.message);
    }
  }

  return matchedTaskIds;
}
