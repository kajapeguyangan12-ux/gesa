import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

let inMemoryTaskRows: TaskRow[] = [];

function createDocId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeRole(role: string) {
  return role === "petugas-om" ? "petugas-om-preventif" : role;
}

function extractArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function isMissingNotificationsTable(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : error && typeof error === "object" && "message" in error && typeof error.message === "string"
        ? error.message
        : String(error || "");
  const normalized = message.toLowerCase();
  return (
    normalized.includes("app_notifications") ||
    normalized.includes("schema cache") ||
    normalized.includes('relation "public.app_notifications" does not exist')
  );
}

type TaskRow = {
  fb_doc_id: string | null;
  title: string | null;
  message: string | null;
  source: string | null;
  report_id: string | null;
  target_roles: unknown;
  raw_payload: Record<string, unknown> | null;
  created_at: string | null;
};

function serializeTask(row: TaskRow) {
  const raw = row.raw_payload || {};
  return {
    ...raw,
    id: row.fb_doc_id || "",
    title: row.title || normalizeString(raw.title) || "Tugas O&M",
    message: row.message || normalizeString(raw.description),
    source: row.source || "om-task",
    taskId: row.fb_doc_id || "",
    taskType: normalizeString(raw.taskType) || "preventif",
    scope: normalizeString(raw.scope) || "group",
    groupId: normalizeString(raw.groupId),
    groupName: normalizeString(raw.groupName),
    pointId: normalizeString(raw.pointId),
    pointName: normalizeString(raw.pointName),
    assignedUid: normalizeString(raw.assignedUid),
    assignedName: normalizeString(raw.assignedName),
    repeatMode: normalizeString(raw.repeatMode) || "mingguan",
    luxTarget: normalizeString(raw.luxTarget),
    status: normalizeString(raw.status) || "assigned",
    createdAt: row.created_at || normalizeString(raw.createdAt),
    targetRoles: extractArray(row.target_roles).map(normalizeRole),
  };
}

export async function GET(request: NextRequest) {
  try {
    const role = normalizeRole(normalizeString(request.nextUrl.searchParams.get("role")));
    const uid = normalizeString(request.nextUrl.searchParams.get("uid"));
    const limit = Math.min(Math.max(Number.parseInt(request.nextUrl.searchParams.get("limit") || "100", 10) || 100, 1), 300);
    const supabase = getSupabaseAdminClient();

    let data: TaskRow[] = [];
    const dbResult = await supabase
      .from("app_notifications")
      .select("fb_doc_id, title, message, source, report_id, target_roles, raw_payload, created_at")
      .like("source", "om-task%")
      .order("created_at", { ascending: false })
      .limit(limit * 3);

    if (dbResult.error) {
      if (!isMissingNotificationsTable(dbResult.error)) {
        throw new Error(dbResult.error.message);
      }
      data = inMemoryTaskRows;
    } else {
      data = (dbResult.data || []) as TaskRow[];
    }

    const tasks = data
      .map(serializeTask)
      .filter((task) => {
        if (uid && task.assignedUid && task.assignedUid !== uid) return false;
        if (!role) return true;
        return task.targetRoles.includes(role) || task.targetRoles.includes("petugas-om-preventif");
      })
      .slice(0, limit);

    return NextResponse.json({
      tasks,
      summary: {
        total: tasks.length,
        assigned: tasks.filter((task) => task.status === "assigned").length,
        dikerjakan: tasks.filter((task) => task.status === "dikerjakan").length,
        selesai: tasks.filter((task) => task.status === "selesai").length,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal memuat tugas O&M." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const taskType = normalizeString(payload.taskType) || "preventif";
    const title = normalizeString(payload.title) || "Tugas Preventif O&M";
    const description = normalizeString(payload.description);
    const scope = normalizeString(payload.scope) || "group";
    const groupId = normalizeString(payload.groupId);
    const groupName = normalizeString(payload.groupName) || groupId;
    const pointId = normalizeString(payload.pointId);
    const pointName = normalizeString(payload.pointName) || pointId;
    const assignedUid = normalizeString(payload.assignedUid);
    const assignedName = normalizeString(payload.assignedName);

    if (!["preventif", "korektif"].includes(taskType)) return NextResponse.json({ error: "Jenis tugas O&M tidak valid." }, { status: 400 });
    if (scope === "group" && !groupId) return NextResponse.json({ error: "Grup APJ wajib dipilih." }, { status: 400 });
    if (scope === "point" && !pointId) return NextResponse.json({ error: "Titik APJ wajib dipilih." }, { status: 400 });
    if (scope === "report" && !normalizeString(payload.reportId || payload.sourceReportId)) {
      return NextResponse.json({ error: "Laporan wajib dipilih untuk tugas korektif." }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient() as any;
    const now = new Date().toISOString();
    const taskId = createDocId("om_task");
    const targetRoles = taskType === "korektif" ? ["petugas-om-correctif", "petugas-om-corrective"] : ["petugas-om-preventif"];
    const targetLabel = scope === "point" ? pointId : groupName;
    const reportLabel = normalizeString(payload.reportTitle) || normalizeString(payload.reportId || payload.sourceReportId);
    const message =
      description ||
      (taskType === "korektif"
        ? `Tugas korektif dari laporan ${reportLabel}.`
        : `Tugas preventif untuk ${scope === "point" ? "titik" : "grup"} ${targetLabel}.`);

    const rawPayload = {
      ...payload,
      id: taskId,
      taskId,
      taskType,
      title,
      description: message,
      scope,
      groupId,
      groupName,
      pointId,
      pointName,
      assignedUid,
      assignedName,
      repeatMode: normalizeString(payload.repeatMode) || "mingguan",
      luxTarget: normalizeString(payload.luxTarget),
      status: "assigned",
      sourceModule: "O&M",
      createdAt: now,
      updatedAt: now,
    };

    const insertRow = {
      fb_doc_id: taskId,
      title,
      message,
      category: "O&M",
      source: taskType === "korektif" ? "om-task-corrective" : "om-task-preventive",
      report_id: taskId,
      target_roles: targetRoles,
      raw_payload: {
        ...rawPayload,
        targetRoles,
        targetUserUid: assignedUid,
      },
      created_at: now,
    };
    const { error } = await supabase.from("app_notifications").insert(insertRow);
    if (error) {
      if (!isMissingNotificationsTable(error)) {
        throw new Error(error.message);
      }
      inMemoryTaskRows = [insertRow as TaskRow, ...inMemoryTaskRows].slice(0, 300);
    }

    return NextResponse.json({ id: taskId, task: rawPayload, message: "Tugas preventif berhasil dikirim." });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal membuat tugas O&M." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const taskId = normalizeString(payload.id || payload.taskId);
    const status = normalizeString(payload.status);
    if (!taskId || !status) return NextResponse.json({ error: "ID tugas dan status wajib diisi." }, { status: 400 });

    const supabase = getSupabaseAdminClient() as any;
    const { data, error } = await supabase
      .from("app_notifications")
      .select("raw_payload")
      .eq("fb_doc_id", taskId)
      .limit(1);
    if (error && !isMissingNotificationsTable(error)) throw new Error(error.message);
    const row = Array.isArray(data) ? (data[0] as { raw_payload?: Record<string, unknown> } | undefined) : undefined;
    const fallbackRow = row || inMemoryTaskRows.find((item) => item.fb_doc_id === taskId);
    if (!fallbackRow) return NextResponse.json({ error: "Tugas tidak ditemukan." }, { status: 404 });

    const now = new Date().toISOString();
    const nextRawPayload = {
      ...((fallbackRow as { raw_payload?: Record<string, unknown> }).raw_payload || {}),
      status,
      lastReportId: normalizeString(payload.reportId),
      updatedAt: now,
    };
    const { error: updateError } = await supabase
      .from("app_notifications")
      .update({ raw_payload: nextRawPayload })
      .eq("fb_doc_id", taskId);
    if (updateError) {
      if (!isMissingNotificationsTable(updateError)) {
        throw new Error(updateError.message);
      }
      inMemoryTaskRows = inMemoryTaskRows.map((item) =>
        item.fb_doc_id === taskId ? ({ ...item, raw_payload: nextRawPayload } as TaskRow) : item
      );
    }

    return NextResponse.json({ ok: true, status });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal mengubah status tugas." }, { status: 500 });
  }
}
