import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import {
  buildSurveyUpdateRow,
  resolveSurveyTable,
  type HybridSurveyType,
} from "@/lib/supabaseHybrid";

interface ExistingSurveyRecord {
  fb_doc_id?: string | null;
  title?: string | null;
  task_id?: string | null;
  surveyor_uid?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  status?: string | null;
  updated_at?: string | null;
  raw_payload?: Record<string, unknown> | null;
}

function normalizeStatus(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeTimestampValue(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return "";
  const parsed = new Date(value);
  const time = parsed.getTime();
  return Number.isNaN(time) ? "" : parsed.toISOString();
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ type: string; id: string }> }
) {
  try {
    const { type, id } = await context.params;
    const surveyType = type as HybridSurveyType;
    const table = resolveSurveyTable(surveyType);
    const patch = (await request.json()) as Record<string, unknown>;
    const expectedStatus = normalizeStatus(patch.expectedStatus);
    const expectedUpdatedAt = normalizeTimestampValue(patch.expectedUpdatedAt);
    const preserveCurrentStatus = patch.preserveCurrentStatus === true;
    const supabase = getSupabaseAdminClient() as any;
    const { data: existing, error: readError } = (await supabase
      .from(table)
      .select("fb_doc_id, title, task_id, surveyor_uid, latitude, longitude, status, updated_at, raw_payload")
      .eq("fb_doc_id", id)
      .maybeSingle()) as { data: ExistingSurveyRecord | null; error: { message: string } | null };

    if (readError) throw new Error(readError.message);
    if (!existing) {
      return NextResponse.json({ error: "Survey tidak ditemukan." }, { status: 404 });
    }

    const currentStatus = normalizeStatus(existing.status);
    const currentUpdatedAt = normalizeTimestampValue(existing.updated_at);

    if (expectedStatus && currentStatus !== expectedStatus) {
      return NextResponse.json(
        { error: "Data survey sudah diproses admin lain. Silakan muat ulang data terbaru." },
        { status: 409 }
      );
    }

    if (expectedUpdatedAt && currentUpdatedAt && currentUpdatedAt !== expectedUpdatedAt) {
      return NextResponse.json(
        { error: "Data survey berubah saat Anda membuka panel ini. Silakan muat ulang lalu ulangi proses." },
        { status: 409 }
      );
    }

    const sanitizedPatch = { ...patch };
    delete sanitizedPatch.expectedStatus;
    delete sanitizedPatch.expectedUpdatedAt;
    delete sanitizedPatch.preserveCurrentStatus;

    if (preserveCurrentStatus) {
      sanitizedPatch.status = existing.status || currentStatus || "menunggu";
    }

    const row = buildSurveyUpdateRow(
      surveyType,
      (existing.raw_payload as Record<string, unknown> | null) || {},
      sanitizedPatch
    );
    let updateQuery = supabase.from(table).update(row).eq("fb_doc_id", id);
    if (typeof existing.status === "string" && existing.status.trim()) {
      updateQuery = updateQuery.eq("status", existing.status);
    }
    if (existing.updated_at) {
      updateQuery = updateQuery.eq("updated_at", existing.updated_at);
    }
    const { data: updatedRows, error } = await updateQuery.select("fb_doc_id");
    if (error) throw new Error(error.message);
    if (!Array.isArray(updatedRows) || updatedRows.length === 0) {
      return NextResponse.json(
        { error: "Data survey baru saja berubah oleh admin lain. Silakan muat ulang data terbaru." },
        { status: 409 }
      );
    }

    if (
      surveyType === "pra-existing" &&
      typeof sanitizedPatch.status === "string" &&
      ["diverifikasi", "ditolak", "tervalidasi"].includes(sanitizedPatch.status) &&
      typeof existing.task_id === "string" &&
      typeof existing.surveyor_uid === "string" &&
      typeof existing.title === "string" &&
      typeof existing.latitude === "number" &&
      typeof existing.longitude === "number"
    ) {
      const { data: duplicates, error: duplicateReadError } = await supabase
        .from(table)
        .select("fb_doc_id, raw_payload")
        .eq("task_id", existing.task_id)
        .eq("surveyor_uid", existing.surveyor_uid)
        .eq("title", existing.title)
        .eq("latitude", existing.latitude)
        .eq("longitude", existing.longitude)
        .eq("status", "menunggu");

      if (duplicateReadError) {
        throw new Error(duplicateReadError.message);
      }

      const duplicateIds = ((duplicates || []) as Array<{ fb_doc_id?: string | null; raw_payload?: Record<string, unknown> | null }>)
        .map((item) => (typeof item.fb_doc_id === "string" ? item.fb_doc_id : ""))
        .filter((duplicateId) => duplicateId && duplicateId !== id);

      for (const duplicate of (duplicates || []) as Array<{ fb_doc_id?: string | null; raw_payload?: Record<string, unknown> | null }>) {
        const duplicateId = typeof duplicate.fb_doc_id === "string" ? duplicate.fb_doc_id : "";
        if (!duplicateId || duplicateId === id) continue;
        const duplicateRow = buildSurveyUpdateRow(
          surveyType,
          (duplicate.raw_payload as Record<string, unknown> | null) || {},
          sanitizedPatch
        );
        const { error: duplicateUpdateError } = await supabase.from(table).update(duplicateRow).eq("fb_doc_id", duplicateId);
        if (duplicateUpdateError) {
          throw new Error(duplicateUpdateError.message);
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memperbarui survey di Supabase." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ type: string; id: string }> }
) {
  try {
    const { type, id } = await context.params;
    const surveyType = type as HybridSurveyType;
    const table = resolveSurveyTable(surveyType);
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase.from(table).delete().eq("fb_doc_id", id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal menghapus survey di Supabase." },
      { status: 500 }
    );
  }
}
