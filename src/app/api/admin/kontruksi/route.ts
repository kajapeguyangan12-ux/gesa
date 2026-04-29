import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

type Resource =
  | "users"
  | "design-uploads"
  | "design-tasks"
  | "submissions"
  | "valid"
  | "rejected"
  | "history"
  | "map-data";

const TABLES = {
  designUploads: "kontruksi_design_uploads",
  designTasks: "kontruksi_design_tasks",
  submissions: "kontruksi_submissions",
  valid: "kontruksi_valid",
  rejected: "kontruksi_rejected",
};

function createDocId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function parseNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseFloat(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeDate(value: unknown) {
  if (typeof value === "string" || typeof value === "number" || value instanceof Date) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  if (value && typeof value === "object" && "seconds" in value) {
    const seconds = Number((value as { seconds?: unknown }).seconds);
    return Number.isFinite(seconds) ? new Date(seconds * 1000).toISOString() : null;
  }
  return null;
}

function mapDesignUploadRow(row: Record<string, unknown>) {
  const raw = (row.raw_payload as Record<string, unknown> | null) || {};
  return {
    ...raw,
    id: String(row.fb_doc_id || row.id || ""),
    fileName: row.file_name || raw.fileName || "",
    sheetName: row.sheet_name || raw.sheetName || "",
    uploadedById: row.uploaded_by_id || raw.uploadedById || "",
    uploadedByName: row.uploaded_by_name || raw.uploadedByName || "",
    zones: Array.isArray(row.zones) ? row.zones : Array.isArray(raw.zones) ? raw.zones : [],
    createdAt: row.created_at || raw.createdAt || null,
    updatedAt: row.updated_at || raw.updatedAt || null,
  };
}

function mapDesignTaskRow(row: Record<string, unknown>) {
  const raw = (row.raw_payload as Record<string, unknown> | null) || {};
  return {
    ...raw,
    id: String(row.fb_doc_id || row.id || ""),
    assigneeId: row.assignee_id || raw.assigneeId || "",
    assigneeName: row.assignee_name || raw.assigneeName || "",
    designUploadId: row.design_upload_id || raw.designUploadId || "",
    zones: Array.isArray(row.zones) ? row.zones : Array.isArray(raw.zones) ? raw.zones : [],
    status: row.status || raw.status || "",
    createdById: row.created_by_id || raw.createdById || "",
    createdByName: row.created_by_name || raw.createdByName || "",
    createdAt: row.created_at || raw.createdAt || null,
    updatedAt: row.updated_at || raw.updatedAt || null,
  };
}

function mapKontruksiDataRow(row: Record<string, unknown>, source?: string) {
  const raw = (row.raw_payload as Record<string, unknown> | null) || {};
  return {
    ...raw,
    id: String(row.fb_doc_id || row.id || ""),
    sourceSubmissionId: row.source_submission_id || raw.sourceSubmissionId || "",
    sourceTaskId: row.source_task_id || raw.sourceTaskId || "",
    submittedById: row.submitted_by_id || raw.submittedById || "",
    submittedByName: row.submitted_by_name || raw.submittedByName || "",
    createdById: raw.createdById || "",
    assigneeId: raw.assigneeId || "",
    namaTitik: row.nama_titik || raw.namaTitik || "",
    idTitik: row.id_titik || raw.idTitik || "",
    zona: row.zona || raw.zona || raw.group || "",
    stage: row.stage || raw.stage || raw.tahap || raw.type || "",
    kontruksiStatus: row.status || raw.kontruksiStatus || raw.status || "",
    status: row.status || raw.status || "",
    rejectReason: row.reject_reason || raw.rejectReason || "",
    rejectedById: row.rejected_by_id || raw.rejectedById || "",
    rejectedByName: row.rejected_by_name || raw.rejectedByName || "",
    latitude: row.latitude ?? raw.latitude ?? raw.lat ?? 0,
    longitude: row.longitude ?? raw.longitude ?? raw.lng ?? raw.lon ?? 0,
    createdAt: row.created_at || raw.createdAt || null,
    updatedAt: row.updated_at || raw.updatedAt || null,
    validatedAt: row.validated_at || raw.validatedAt || null,
    rejectedAt: row.rejected_at || raw.rejectedAt || null,
    source,
  };
}

function toDesignUploadInsert(payload: Record<string, unknown>) {
  const now = new Date().toISOString();
  const id = typeof payload.id === "string" && payload.id ? payload.id : createDocId("design_upload");
  return {
    fb_doc_id: id,
    file_name: typeof payload.fileName === "string" ? payload.fileName : "",
    sheet_name: typeof payload.sheetName === "string" ? payload.sheetName : "",
    uploaded_by_id: typeof payload.uploadedById === "string" ? payload.uploadedById : "",
    uploaded_by_name: typeof payload.uploadedByName === "string" ? payload.uploadedByName : "",
    zones: Array.isArray(payload.zones) ? payload.zones : [],
    raw_payload: { ...payload, id, createdAt: payload.createdAt || now, updatedAt: payload.updatedAt || now },
    created_at: normalizeDate(payload.createdAt) || now,
    updated_at: normalizeDate(payload.updatedAt) || now,
  };
}

function toDesignTaskInsert(payload: Record<string, unknown>) {
  const now = new Date().toISOString();
  const id = typeof payload.id === "string" && payload.id ? payload.id : createDocId("design_task");
  return {
    fb_doc_id: id,
    assignee_id: typeof payload.assigneeId === "string" ? payload.assigneeId : "",
    assignee_name: typeof payload.assigneeName === "string" ? payload.assigneeName : "",
    design_upload_id: typeof payload.designUploadId === "string" ? payload.designUploadId : "",
    zones: Array.isArray(payload.zones) ? payload.zones : [],
    status: typeof payload.status === "string" ? payload.status : "assigned",
    created_by_id: typeof payload.createdById === "string" ? payload.createdById : "",
    created_by_name: typeof payload.createdByName === "string" ? payload.createdByName : "",
    raw_payload: { ...payload, id, createdAt: payload.createdAt || now, updatedAt: payload.updatedAt || now },
    created_at: normalizeDate(payload.createdAt) || now,
    updated_at: normalizeDate(payload.updatedAt) || now,
  };
}

function toKontruksiInsert(payload: Record<string, unknown>, statusOverride?: string) {
  const now = new Date().toISOString();
  const id = typeof payload.id === "string" && payload.id ? payload.id : createDocId("kontruksi");
  const status = statusOverride || (typeof payload.status === "string" ? payload.status : typeof payload.kontruksiStatus === "string" ? payload.kontruksiStatus : "");
  return {
    fb_doc_id: id,
    source_submission_id: typeof payload.sourceSubmissionId === "string" ? payload.sourceSubmissionId : "",
    source_task_id: typeof payload.sourceTaskId === "string" ? payload.sourceTaskId : "",
    submitted_by_id: typeof payload.submittedById === "string" ? payload.submittedById : "",
    submitted_by_name: typeof payload.submittedByName === "string" ? payload.submittedByName : "",
    nama_titik: typeof payload.namaTitik === "string" ? payload.namaTitik : "",
    id_titik: typeof payload.idTitik === "string" ? payload.idTitik : "",
    zona: typeof payload.zona === "string" ? payload.zona : typeof payload.group === "string" ? payload.group : "",
    stage: typeof payload.stage === "string" ? payload.stage : typeof payload.tahap === "string" ? payload.tahap : "",
    status,
    latitude: parseNumber(payload.latitude ?? payload.lat),
    longitude: parseNumber(payload.longitude ?? payload.lng ?? payload.lon),
    raw_payload: { ...payload, id, status, kontruksiStatus: status, updatedAt: payload.updatedAt || now },
    created_at: normalizeDate(payload.createdAt) || now,
    updated_at: normalizeDate(payload.updatedAt) || now,
  };
}

async function selectRows(table: string, orderColumn: string, limit: number) {
  const supabase = getSupabaseAdminClient() as any;
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .order(orderColumn, { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data || []) as Record<string, unknown>[];
}

export async function GET(request: NextRequest) {
  try {
    const resource = (request.nextUrl.searchParams.get("resource") || "submissions") as Resource;
    const assigneeId = request.nextUrl.searchParams.get("assigneeId") || "";
    const ownerId = request.nextUrl.searchParams.get("ownerId") || "";
    const limit = Math.min(Math.max(Number.parseInt(request.nextUrl.searchParams.get("limit") || "200", 10) || 200, 1), 1000);
    const supabase = getSupabaseAdminClient() as any;

    if (resource === "users") {
      const { data, error } = await supabase
        .from("user_admin")
        .select("*")
        .eq("role", "petugas-kontruksi")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return NextResponse.json({
        users: ((data || []) as Record<string, unknown>[]).map((row) => ({
          id: row.fb_doc_id || row.uid || row.id,
          uid: row.uid || row.fb_doc_id || row.id,
          name: row.name || row.display_name || row.username || "",
          displayName: row.display_name || row.name || "",
          username: row.username || "",
          email: row.email || "",
          role: row.role || "",
          createdAt: row.created_at || null,
        })),
      });
    }

    if (resource === "design-uploads") {
      const rows = await selectRows(TABLES.designUploads, "created_at", limit);
      return NextResponse.json({ items: rows.map(mapDesignUploadRow) });
    }

    if (resource === "design-tasks") {
      let query = supabase.from(TABLES.designTasks).select("*").order("created_at", { ascending: false }).limit(limit);
      if (assigneeId) query = query.eq("assignee_id", assigneeId);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return NextResponse.json({ items: ((data || []) as Record<string, unknown>[]).map(mapDesignTaskRow) });
    }

    if (resource === "valid") {
      const rows = await selectRows(TABLES.valid, "validated_at", limit);
      return NextResponse.json({ items: rows.map((row) => mapKontruksiDataRow(row, "valid")) });
    }

    if (resource === "rejected") {
      const rows = await selectRows(TABLES.rejected, "rejected_at", limit);
      return NextResponse.json({ items: rows.map((row) => mapKontruksiDataRow(row, "rejected")) });
    }

    if (resource === "history" || resource === "map-data") {
      const [submissions, valid] = await Promise.all([
        selectRows(TABLES.submissions, "created_at", limit),
        selectRows(TABLES.valid, "validated_at", limit),
      ]);
      let items = [
        ...submissions.map((row) => mapKontruksiDataRow(row, "submission")),
        ...valid.map((row) => mapKontruksiDataRow(row, "valid")),
      ];
      if (ownerId) {
        items = items.filter((item) => item.submittedById === ownerId || item.createdById === ownerId || item.assigneeId === ownerId);
      }
      return NextResponse.json({ items });
    }

    const rows = await selectRows(TABLES.submissions, "created_at", limit);
    return NextResponse.json({ items: rows.map((row) => mapKontruksiDataRow(row, "submission")) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memuat data konstruksi dari Supabase." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const resource = String(payload.resource || "");
    const action = String(payload.action || "");
    const supabase = getSupabaseAdminClient() as any;

    if (resource === "design-upload") {
      const row = toDesignUploadInsert(payload);
      const { error } = await supabase.from(TABLES.designUploads).upsert(row, { onConflict: "fb_doc_id" });
      if (error) throw new Error(error.message);
      return NextResponse.json({ id: row.fb_doc_id });
    }

    if (resource === "design-task") {
      const row = toDesignTaskInsert(payload);
      const { error } = await supabase.from(TABLES.designTasks).upsert(row, { onConflict: "fb_doc_id" });
      if (error) throw new Error(error.message);
      return NextResponse.json({ id: row.fb_doc_id });
    }

    if (resource === "submission") {
      const row = toKontruksiInsert(payload);
      const { error } = await supabase.from(TABLES.submissions).upsert(row, { onConflict: "fb_doc_id" });
      if (error) throw new Error(error.message);
      return NextResponse.json({ id: row.fb_doc_id });
    }

    if (action === "validate") {
      const item = (payload.item || {}) as Record<string, unknown>;
      const sourceId = String(item.id || "");
      const row = {
        ...toKontruksiInsert({ ...item, sourceSubmissionId: sourceId }, "valid"),
        fb_doc_id: sourceId || createDocId("kontruksi_valid"),
        validated_at: new Date().toISOString(),
      };
      const { error: upsertError } = await supabase.from(TABLES.valid).upsert(row, { onConflict: "fb_doc_id" });
      if (upsertError) throw new Error(upsertError.message);
      if (sourceId) {
        const { error: deleteError } = await supabase.from(TABLES.submissions).delete().eq("fb_doc_id", sourceId);
        if (deleteError) throw new Error(deleteError.message);
      }
      return NextResponse.json({ id: row.fb_doc_id });
    }

    if (action === "reject") {
      const item = (payload.item || {}) as Record<string, unknown>;
      const sourceId = String(item.id || "");
      const now = new Date().toISOString();
      const row = {
        ...toKontruksiInsert({ ...item, sourceSubmissionId: sourceId }, "rejected"),
        fb_doc_id: sourceId || createDocId("kontruksi_rejected"),
        reject_reason: typeof payload.rejectReason === "string" ? payload.rejectReason : "-",
        rejected_by_id: typeof payload.rejectedById === "string" ? payload.rejectedById : "",
        rejected_by_name: typeof payload.rejectedByName === "string" ? payload.rejectedByName : "Admin",
        rejected_at: now,
      };
      const { error: upsertError } = await supabase.from(TABLES.rejected).upsert(row, { onConflict: "fb_doc_id" });
      if (upsertError) throw new Error(upsertError.message);
      if (sourceId) {
        const { error: deleteError } = await supabase.from(TABLES.submissions).delete().eq("fb_doc_id", sourceId);
        if (deleteError) throw new Error(deleteError.message);
      }
      return NextResponse.json({ id: row.fb_doc_id });
    }

    return NextResponse.json({ error: "Resource konstruksi tidak dikenali." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal menyimpan data konstruksi ke Supabase." },
      { status: 500 }
    );
  }
}
