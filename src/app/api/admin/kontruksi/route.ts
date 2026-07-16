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
  materials: "mst_gudang_material",
  transactions: "log_inventory_trxs",
};

const STAGE_MATERIAL_REQUIREMENTS: Record<string, { category: string; quantity: number }[]> = {
  "pemasangan-tiang": [
    { category: "TIANG", quantity: 1 },
    { category: "ARM", quantity: 1 },
    { category: "LAMPU", quantity: 1 },
  ],
  "pemasangan-kabel": [{ category: "KABEL", quantity: 1 }],
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

async function markDesignTaskSubmitted(
  supabase: any,
  payload: Record<string, unknown>,
  submissionId: string
) {
  const sourceTaskId = typeof payload.sourceTaskId === "string" ? payload.sourceTaskId.trim() : "";
  if (!sourceTaskId) return;

  const now = new Date().toISOString();
  const idTitik = typeof payload.idTitik === "string" ? payload.idTitik.trim() : "";
  const stage = typeof payload.stage === "string" ? payload.stage.trim() : typeof payload.tahap === "string" ? payload.tahap.trim() : "";

  const { data, error } = await supabase
    .from(TABLES.designTasks)
    .select("*")
    .eq("fb_doc_id", sourceTaskId)
    .limit(1);
  if (error) throw new Error(error.message);

  const existing = Array.isArray(data) ? data[0] : null;
  if (!existing) return;

  const rawPayload = ((existing.raw_payload as Record<string, unknown> | null) || {});
  const zones = Array.isArray(existing.zones)
    ? existing.zones
    : Array.isArray(rawPayload.zones)
      ? rawPayload.zones
      : [];
  const currentSubmittedStages = Array.isArray(rawPayload.submittedStages) ? rawPayload.submittedStages : [];
  const currentSubmittedPoints = Array.isArray(rawPayload.submittedPoints) ? rawPayload.submittedPoints : [];
  const nextSubmittedStages = Array.from(new Set([...currentSubmittedStages, stage].filter(Boolean)));
  const nextSubmittedPoints = Array.from(new Set([...currentSubmittedPoints, idTitik].filter(Boolean)));

  const nextZones = zones.map((zone: unknown) => {
    if (!zone || typeof zone !== "object") return zone;
    const record = zone as Record<string, unknown>;
    if (idTitik && record.idTitik !== idTitik) return record;
    return {
      ...record,
      kontruksiStatus: "submitted",
      status: "submitted",
      submittedStage: stage,
      submissionId,
      submittedAt: now,
    };
  });

  const totalZones = zones.length;
  const submittedCount = nextZones.filter((zone: unknown) => {
    if (!zone || typeof zone !== "object") return false;
    const status = String((zone as Record<string, unknown>).status || (zone as Record<string, unknown>).kontruksiStatus || "");
    return status === "submitted" || status === "valid";
  }).length;
  const nextStatus = totalZones > 0 && submittedCount >= totalZones ? "submitted" : "in-progress";

  const { error: updateError } = await supabase
    .from(TABLES.designTasks)
    .update({
      zones: nextZones,
      status: nextStatus,
      raw_payload: {
        ...rawPayload,
        zones: nextZones,
        status: nextStatus,
        submittedStages: nextSubmittedStages,
        submittedPoints: nextSubmittedPoints,
        lastSubmissionId: submissionId,
        lastSubmittedStage: stage,
        lastSubmittedPoint: idTitik,
        updatedAt: now,
      },
      updated_at: now,
    })
    .eq("fb_doc_id", sourceTaskId);
  if (updateError) throw new Error(updateError.message);
}

async function markDesignTaskDecision(
  supabase: any,
  payload: Record<string, unknown>,
  decision: "valid" | "rejected",
  submissionId: string
) {
  const sourceTaskId = typeof payload.sourceTaskId === "string" ? payload.sourceTaskId.trim() : "";
  if (!sourceTaskId) return;

  const now = new Date().toISOString();
  const idTitik = typeof payload.idTitik === "string" ? payload.idTitik.trim() : "";
  const stage =
    typeof payload.stage === "string"
      ? payload.stage.trim()
      : typeof payload.tahap === "string"
        ? payload.tahap.trim()
        : "";

  const { data, error } = await supabase
    .from(TABLES.designTasks)
    .select("*")
    .eq("fb_doc_id", sourceTaskId)
    .limit(1);
  if (error) throw new Error(error.message);

  const existing = Array.isArray(data) ? data[0] : null;
  if (!existing) return;

  const rawPayload = ((existing.raw_payload as Record<string, unknown> | null) || {});
  const zones = Array.isArray(existing.zones)
    ? existing.zones
    : Array.isArray(rawPayload.zones)
      ? rawPayload.zones
      : [];
  const currentDecisionStages = Array.isArray(rawPayload[`${decision}Stages`])
    ? (rawPayload[`${decision}Stages`] as unknown[])
    : [];
  const currentDecisionPoints = Array.isArray(rawPayload[`${decision}Points`])
    ? (rawPayload[`${decision}Points`] as unknown[])
    : [];
  const nextDecisionStages = Array.from(new Set([...currentDecisionStages, stage].filter(Boolean)));
  const nextDecisionPoints = Array.from(new Set([...currentDecisionPoints, idTitik].filter(Boolean)));

  const nextZones = zones.map((zone: unknown) => {
    if (!zone || typeof zone !== "object") return zone;
    const record = zone as Record<string, unknown>;
    if (idTitik && record.idTitik !== idTitik) return record;
    return {
      ...record,
      kontruksiStatus: decision,
      status: decision,
      [`${decision}Stage`]: stage,
      [`${decision}SubmissionId`]: submissionId,
      [`${decision}At`]: now,
    };
  });

  const statuses: string[] = nextZones
    .filter((zone: unknown) => zone && typeof zone === "object")
    .map((zone: unknown) => {
      const record = zone as Record<string, unknown>;
      return String(record.status || record.kontruksiStatus || "");
    });
  const totalZones = statuses.length;
  const validCount = statuses.filter((status) => status === "valid").length;
  const rejectedCount = statuses.filter((status) => status === "rejected").length;
  const hasProgress = statuses.some((status) => status === "submitted" || status === "valid" || status === "rejected");
  const nextStatus =
    totalZones > 0 && validCount >= totalZones
      ? "valid"
      : rejectedCount > 0
        ? "needs-revision"
        : hasProgress
          ? "in-progress"
          : String(existing.status || rawPayload.status || "assigned");

  const { error: updateError } = await supabase
    .from(TABLES.designTasks)
    .update({
      zones: nextZones,
      status: nextStatus,
      raw_payload: {
        ...rawPayload,
        zones: nextZones,
        status: nextStatus,
        [`${decision}Stages`]: nextDecisionStages,
        [`${decision}Points`]: nextDecisionPoints,
        lastDecision: decision,
        lastDecisionSubmissionId: submissionId,
        lastDecisionStage: stage,
        lastDecisionPoint: idTitik,
        lastDecisionAt: now,
        updatedAt: now,
      },
      updated_at: now,
    })
    .eq("fb_doc_id", sourceTaskId);
  if (updateError) throw new Error(updateError.message);
}

async function findDuplicateSubmission(supabase: any, payload: Record<string, unknown>) {
  if (payload.allowDuplicate === true) return null;

  const sourceTaskId = typeof payload.sourceTaskId === "string" ? payload.sourceTaskId.trim() : "";
  const idTitik = typeof payload.idTitik === "string" ? payload.idTitik.trim() : "";
  const stage =
    typeof payload.stage === "string"
      ? payload.stage.trim()
      : typeof payload.tahap === "string"
        ? payload.tahap.trim()
        : "";
  if (!sourceTaskId || !idTitik || !stage) return null;

  const { data, error } = await supabase
    .from(TABLES.submissions)
    .select("fb_doc_id")
    .eq("source_task_id", sourceTaskId)
    .eq("id_titik", idTitik)
    .eq("stage", stage)
    .limit(1);
  if (error) throw new Error(error.message);

  return Array.isArray(data) ? data[0] || null : null;
}

async function createConstructionMaterialOut(
  supabase: any,
  payload: {
    materialId: string;
    materialName: string;
    quantity: number;
    reference: string;
    stage: string;
    idTitik: string;
  }
) {
  const now = new Date().toISOString();
  const existingReference = `${payload.reference}:${payload.materialId}`;
  const { data: existingRows, error: existingError } = await supabase
    .from(TABLES.transactions)
    .select("fb_doc_id")
    .eq("id_referensi", existingReference)
    .limit(1);
  if (existingError) throw new Error(existingError.message);
  if (Array.isArray(existingRows) && existingRows.length > 0) return;

  const trxId = createDocId("gudang_trx");
  const { error: trxError } = await supabase.from(TABLES.transactions).insert({
    fb_doc_id: trxId,
    material_id: payload.materialId,
    material_name: payload.materialName,
    tipe_transaksi: "KELUAR",
    jumlah: payload.quantity,
    id_referensi: existingReference,
    source_module: "Konstruksi",
    status: "Posted",
    raw_payload: {
      id: trxId,
      type: "KELUAR",
      jumlah: payload.quantity,
      referensi: existingReference,
      sourceModule: "Konstruksi",
      status: "Posted",
      stage: payload.stage,
      idTitik: payload.idTitik,
      createdAt: now,
      updatedAt: now,
    },
    created_at: now,
    updated_at: now,
  });
  if (trxError) throw new Error(trxError.message);

  const { data: materialRows, error: materialError } = await supabase
    .from(TABLES.materials)
    .select("stok_tersedia, raw_payload")
    .eq("fb_doc_id", payload.materialId)
    .limit(1);
  if (materialError) throw new Error(materialError.message);

  const material = Array.isArray(materialRows) ? materialRows[0] : null;
  if (!material) return;

  const rawPayload = ((material.raw_payload as Record<string, unknown> | null) || {});
  const currentStock = parseNumber(material.stok_tersedia) || 0;
  const nextStock = Math.max(0, currentStock - payload.quantity);
  const { error: updateError } = await supabase
    .from(TABLES.materials)
    .update({
      stok_tersedia: nextStock,
      raw_payload: {
        ...rawPayload,
        stokTersedia: nextStock,
        updatedAt: now,
      },
      updated_at: now,
    })
    .eq("fb_doc_id", payload.materialId);
  if (updateError) throw new Error(updateError.message);
}

async function consumeConstructionMaterials(
  supabase: any,
  payload: Record<string, unknown>,
  submissionId: string
) {
  const stage =
    typeof payload.stage === "string"
      ? payload.stage.trim()
      : typeof payload.tahap === "string"
        ? payload.tahap.trim()
        : "";
  const requirements = STAGE_MATERIAL_REQUIREMENTS[stage] || [];
  if (requirements.length === 0) return;

  const idTitik = typeof payload.idTitik === "string" ? payload.idTitik.trim() : "";
  for (const requirement of requirements) {
    const { data, error } = await supabase
      .from(TABLES.materials)
      .select("fb_doc_id, nama_barang, stok_tersedia")
      .eq("kategori", requirement.category)
      .order("stok_tersedia", { ascending: false })
      .limit(1);
    if (error) throw new Error(error.message);

    const material = Array.isArray(data) ? data[0] : null;
    const stock = parseNumber(material?.stok_tersedia) || 0;
    if (!material || stock <= 0) continue;

    await createConstructionMaterialOut(supabase, {
      materialId: String(material.fb_doc_id || ""),
      materialName: String(material.nama_barang || requirement.category),
      quantity: Math.min(requirement.quantity, stock),
      reference: submissionId,
      stage,
      idTitik,
    });
  }
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
      const duplicate = await findDuplicateSubmission(supabase, payload);
      if (duplicate) {
        return NextResponse.json(
          {
            error: "Data titik dan tahap ini sudah pernah dikirim. Konfirmasi pengiriman ulang terlebih dahulu.",
            duplicateId: duplicate.fb_doc_id,
          },
          { status: 409 }
        );
      }
      const row = toKontruksiInsert(payload);
      const { error } = await supabase.from(TABLES.submissions).upsert(row, { onConflict: "fb_doc_id" });
      if (error) throw new Error(error.message);
      await markDesignTaskSubmitted(supabase, payload, row.fb_doc_id);
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
      await markDesignTaskDecision(supabase, item, "valid", row.fb_doc_id);
      await consumeConstructionMaterials(supabase, item, row.fb_doc_id);
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
      await markDesignTaskDecision(supabase, item, "rejected", row.fb_doc_id);
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
