import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { buildTaskInsertRow, createHybridId } from "@/lib/supabaseHybrid";
import { syncPendingTasksWithSubmittedSurveys } from "@/lib/taskStatusSync";

interface TaskRow {
  fb_doc_id: string | null;
  title: string | null;
  description: string | null;
  surveyor_id: string | null;
  surveyor_name: string | null;
  surveyor_email: string | null;
  status: string | null;
  type: string | null;
  kabupaten?: string | null;
  kmz_file_url: string | null;
  kmz_file_url_2: string | null;
  offline_enabled: boolean | null;
  created_at: string | null;
  raw_payload?: Record<string, unknown> | null;
}

type TaskInsertRow = ReturnType<typeof buildTaskInsertRow>;

interface TaskUpsertResult {
  error: { message: string } | null;
}

interface TaskListSummary {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
}

interface TaskTypeSummary {
  all: number;
  existing: number;
  propose: number;
  proposeExisting: number;
  praExisting: number;
}

function parsePositiveInteger(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeKabupatenLabel(value: unknown) {
  if (typeof value !== "string") return "";
  return value
    .trim()
    .toLowerCase()
    .replace(/^kabupaten\s+/i, "")
    .replace(/^kab\.\s*/i, "")
    .replace(/^kab\s+/i, "");
}

function applyTaskFilters<TQuery extends {
  eq: (column: string, value: string) => TQuery;
  or: (filters: string) => TQuery;
  ilike: (column: string, value: string) => TQuery;
}>(query: TQuery, options: {
  adminId?: string;
  adminEmail?: string;
  kabupaten?: string;
  includeAll: boolean;
  search?: string;
  status?: string;
  type?: string;
}) {
  const { adminId, adminEmail, kabupaten, includeAll, search, status, type } = options;
  let nextQuery = query;

  if (!includeAll && (adminId || adminEmail)) {
    if (adminId && adminEmail) {
      nextQuery = nextQuery.or(`created_by_admin_id.eq.${adminId},created_by_admin_email.eq.${adminEmail}`);
    } else if (adminId) {
      nextQuery = nextQuery.eq("created_by_admin_id", adminId);
    } else if (adminEmail) {
      nextQuery = nextQuery.eq("created_by_admin_email", adminEmail);
    }
  }

  if (search) {
    const escaped = search.replace(/[%_]/g, "");
    nextQuery = nextQuery.or(
      [
        `title.ilike.%${escaped}%`,
        `description.ilike.%${escaped}%`,
        `surveyor_name.ilike.%${escaped}%`,
        `surveyor_email.ilike.%${escaped}%`,
        `type.ilike.%${escaped}%`,
        `status.ilike.%${escaped}%`,
      ].join(",")
    );
  }

  if (status) {
    nextQuery = nextQuery.eq("status", status);
  }

  if (type) {
    nextQuery = nextQuery.eq("type", type);
  }

  if (kabupaten) {
    nextQuery = nextQuery.ilike("kabupaten", `%${kabupaten}%`);
  }

  return nextQuery;
}

function mapTaskRow(row: TaskRow) {
  return {
    id: row.fb_doc_id || "",
    title: row.title || "Tanpa Judul",
    description: row.description || "",
    surveyorId: row.surveyor_id || "",
    surveyorName: row.surveyor_name || "",
    surveyorEmail: row.surveyor_email || "",
    status: row.status || "",
    type: row.type || "",
    kmzFileUrl: row.kmz_file_url || "",
    kmzFileUrl2: row.kmz_file_url_2 || "",
    offlineEnabled: Boolean(row.offline_enabled),
    createdAt: row.created_at,
    startedAt: row.raw_payload?.startedAt || null,
    completedAt: row.raw_payload?.completedAt || null,
    kabupaten:
      typeof row.kabupaten === "string"
        ? row.kabupaten
        : typeof row.raw_payload?.kabupaten === "string"
          ? row.raw_payload.kabupaten
          : "",
    kabupatenName:
      typeof row.raw_payload?.kabupatenName === "string"
        ? row.raw_payload.kabupatenName
        : typeof row.kabupaten === "string"
          ? row.kabupaten
          : "",
    excelFileUrl:
      typeof row.raw_payload?.excelFileUrl === "string"
        ? row.raw_payload.excelFileUrl
        : typeof row.raw_payload?.excel_file_url === "string"
          ? row.raw_payload.excel_file_url
          : "",
  };
}

async function fetchAllTaskRows(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  options: {
    adminId?: string;
    adminEmail?: string;
    includeAll: boolean;
    search?: string;
  }
) {
  const pageSize = 500;
  const rows: TaskRow[] = [];
  let offset = 0;

  while (true) {
    const query = applyTaskFilters(
      supabase
        .from("tasks")
        .select(
          "fb_doc_id, title, description, surveyor_id, surveyor_name, surveyor_email, status, type, kabupaten, kmz_file_url, kmz_file_url_2, offline_enabled, created_at, raw_payload"
        )
        .order("created_at", { ascending: false })
        .range(offset, offset + pageSize - 1),
      options
    );

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const batch = (data || []) as TaskRow[];
    rows.push(...batch);

    if (batch.length < pageSize) break;
    offset += batch.length;
  }

  return rows;
}

function filterTaskRowsByKabupaten(rows: TaskRow[], kabupaten?: string) {
  if (!kabupaten) return rows;
  const target = normalizeKabupatenLabel(kabupaten);
  return rows.filter((row) => {
    const candidates = [
      row.kabupaten,
      row.raw_payload?.kabupaten,
      row.raw_payload?.kabupatenName,
    ];
    return candidates.some((value) => normalizeKabupatenLabel(value) === target);
  });
}

async function loadMatchingTaskIdsFromSurveyTables(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  rows: TaskRow[],
  kabupaten?: string
) {
  if (!kabupaten) return new Set<string>();

  const target = normalizeKabupatenLabel(kabupaten);
  const taskIds = Array.from(
    new Set(
      rows
        .map((row) => (typeof row.fb_doc_id === "string" ? row.fb_doc_id.trim() : ""))
        .filter(Boolean)
    )
  );

  if (taskIds.length === 0) return new Set<string>();

  const matchingTaskIds = new Set<string>();
  const surveyTables = ["survey_existing", "survey_apj_propose", "survey_pra_existing"] as const;

  for (const taskIdChunkStart of Array.from({ length: Math.ceil(taskIds.length / 200) }, (_, index) => index * 200)) {
    const taskIdChunk = taskIds.slice(taskIdChunkStart, taskIdChunkStart + 200);

    for (const table of surveyTables) {
      const { data, error } = await supabase
        .from(table)
        .select("task_id, kabupaten, raw_payload")
        .in("task_id", taskIdChunk);

      if (error) throw new Error(error.message);

      for (const row of (data || []) as Array<{
        task_id?: string | null;
        kabupaten?: string | null;
        raw_payload?: Record<string, unknown> | null;
      }>) {
        const taskId = typeof row.task_id === "string" ? row.task_id.trim() : "";
        if (!taskId) continue;

        const candidates = [
          row.kabupaten,
          row.raw_payload?.kabupaten,
          row.raw_payload?.kabupatenName,
        ];

        if (candidates.some((value) => normalizeKabupatenLabel(value) === target)) {
          matchingTaskIds.add(taskId);
        }
      }
    }
  }

  return matchingTaskIds;
}

export async function GET(request: NextRequest) {
  try {
    const adminId = request.nextUrl.searchParams.get("adminId")?.trim();
    const adminEmail = request.nextUrl.searchParams.get("adminEmail")?.trim().toLowerCase();
    const kabupaten = request.nextUrl.searchParams.get("kabupaten")?.trim();
    const search = request.nextUrl.searchParams.get("q")?.trim();
    const includeAll = request.nextUrl.searchParams.get("includeAll") === "true";
    const status = request.nextUrl.searchParams.get("status")?.trim();
    const type = request.nextUrl.searchParams.get("type")?.trim();
    const offset = Math.max(0, parsePositiveInteger(request.nextUrl.searchParams.get("offset"), 0) - 0);
    const requestedLimit = parsePositiveInteger(request.nextUrl.searchParams.get("limit"), includeAll ? 100 : 50);
    const limit = Math.min(requestedLimit, includeAll ? 250 : 100);
    const supabase = getSupabaseAdminClient();
    const pendingTasksResult = await applyTaskFilters(
      supabase
        .from("tasks")
        .select("fb_doc_id, type, raw_payload, status")
        .eq("status", "pending"),
      { adminId, adminEmail, kabupaten, includeAll, search }
    );

    if (pendingTasksResult.error) {
      throw new Error(pendingTasksResult.error.message);
    }

    await syncPendingTasksWithSubmittedSurveys(supabase, (pendingTasksResult.data || []) as TaskRow[]);
    const fetchedRows = await fetchAllTaskRows(supabase, {
      adminId,
      adminEmail,
      includeAll,
      search,
    });
    const directlyMatchedRows = filterTaskRowsByKabupaten(fetchedRows, kabupaten);
    const surveyMatchedTaskIds = await loadMatchingTaskIdsFromSurveyTables(supabase, fetchedRows, kabupaten);
    const directMatchedIds = new Set(
      directlyMatchedRows
        .map((row) => (typeof row.fb_doc_id === "string" ? row.fb_doc_id.trim() : ""))
        .filter(Boolean)
    );
    const allRows = kabupaten
      ? fetchedRows.filter((row) => {
          const taskId = typeof row.fb_doc_id === "string" ? row.fb_doc_id.trim() : "";
          const hasKnownKabupatenSignal =
            Boolean(normalizeKabupatenLabel(row.kabupaten)) ||
            Boolean(normalizeKabupatenLabel(row.raw_payload?.kabupaten)) ||
            Boolean(normalizeKabupatenLabel(row.raw_payload?.kabupatenName));
          const matchesDirect = taskId ? directMatchedIds.has(taskId) : false;
          const matchesSurvey = taskId ? surveyMatchedTaskIds.has(taskId) : false;
          const isLegacyUnassignedTabanan = kabupaten === "tabanan" && !hasKnownKabupatenSignal && !matchesSurvey;
          return matchesDirect || matchesSurvey || isLegacyUnassignedTabanan;
        })
      : fetchedRows;

    const summary: TaskListSummary = {
      total: allRows.length,
      pending: allRows.filter((row) => row.status === "pending").length,
      inProgress: allRows.filter((row) => row.status === "in-progress").length,
      completed: allRows.filter((row) => row.status === "completed").length,
    };
    const statusFilteredRows =
      status && status !== "all" ? allRows.filter((row) => row.status === status) : allRows;
    const typeSummary: TaskTypeSummary = {
      all: statusFilteredRows.length,
      existing: statusFilteredRows.filter((row) => row.type === "existing").length,
      propose: statusFilteredRows.filter((row) => row.type === "propose").length,
      proposeExisting: statusFilteredRows.filter((row) => row.type === "propose-existing").length,
      praExisting: statusFilteredRows.filter((row) => row.type === "pra-existing").length,
    };
    const typeFilteredRows =
      type && type !== "all" ? statusFilteredRows.filter((row) => row.type === type) : statusFilteredRows;
    const filteredCount = typeFilteredRows.length;
    const tasks = typeFilteredRows.slice(offset, offset + limit).map(mapTaskRow);

    return NextResponse.json({
      source: "supabase",
      scope: includeAll ? "all" : adminId || adminEmail ? "admin" : "default",
      tasks,
      summary,
      typeSummary,
      pagination: {
        offset,
        limit,
        totalCount: filteredCount,
        hasMore: offset + tasks.length < filteredCount,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memuat tugas admin dari Supabase." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const taskId = createHybridId();
    const row = buildTaskInsertRow(taskId, payload);
    const supabase = getSupabaseAdminClient();
    const taskTable = supabase.from("tasks") as unknown as {
      upsert: (values: TaskInsertRow, options?: { onConflict?: string }) => Promise<TaskUpsertResult>;
    };
    const { error } = await taskTable.upsert(row, { onConflict: "fb_doc_id" });
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, id: taskId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal membuat tugas di Supabase." },
      { status: 500 }
    );
  }
}
