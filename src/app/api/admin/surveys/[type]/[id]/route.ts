import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import {
  buildSurveyUpdateRow,
  resolveSurveyTable,
  type HybridSurveyType,
} from "@/lib/supabaseHybrid";
import { cleanupSupabaseStorageObjects } from "@/lib/supabaseStorageCleanup";

interface SurveyExistingRow {
  fb_doc_id: string | null;
  title: string | null;
  task_id: string | null;
  surveyor_uid: string | null;
  latitude: number | null;
  longitude: number | null;
  status: string | null;
  updated_at: string | null;
  raw_payload: Record<string, unknown> | null;
}

interface SurveyDuplicateRow {
  fb_doc_id?: string | null;
  raw_payload?: Record<string, unknown> | null;
}

interface SurveyCleanupRow {
  kmz_file_url: string | null;
  foto_tiang_arm: string | null;
  foto_titik_actual: string | null;
  foto_kemerataan: string | null;
  foto_aktual: string | null;
  raw_payload: Record<string, unknown> | null;
}

type SurveyUpdateRow = ReturnType<typeof buildSurveyUpdateRow>;

type SurveyUpdateQuery = {
  eq: (column: string, value: string) => SurveyUpdateQuery;
  select: (columns: string) => Promise<{ data: Array<{ fb_doc_id: string | null }> | null; error: { message: string } | null }>;
};

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
    const supabase = getSupabaseAdminClient();
    const { data, error: readError } = await supabase
      .from(table)
      .select("fb_doc_id, title, task_id, surveyor_uid, latitude, longitude, status, updated_at, raw_payload")
      .eq("fb_doc_id", id)
      .maybeSingle();

    if (readError) throw new Error(readError.message);
    const existing = data as SurveyExistingRow | null;
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

    const row: SurveyUpdateRow = buildSurveyUpdateRow(
      surveyType,
      (existing.raw_payload as Record<string, unknown> | null) || {},
      sanitizedPatch
    );
    const surveyTable = supabase.from(table) as unknown as {
      update: (values: SurveyUpdateRow) => SurveyUpdateQuery;
    };
    let updateQuery: SurveyUpdateQuery = surveyTable.update(row).eq("fb_doc_id", id);
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

      for (const duplicate of (duplicates || []) as SurveyDuplicateRow[]) {
        const duplicateId = typeof duplicate.fb_doc_id === "string" ? duplicate.fb_doc_id : "";
        if (!duplicateId || duplicateId === id) continue;
        const duplicateRow: SurveyUpdateRow = buildSurveyUpdateRow(
          surveyType,
          (duplicate.raw_payload as Record<string, unknown> | null) || {},
          sanitizedPatch
        );
        const duplicateTable = supabase.from(table) as unknown as {
          update: (values: SurveyUpdateRow) => {
            eq: (column: string, value: string) => Promise<{ error: { message: string } | null }>;
          };
        };
        const { error: duplicateUpdateError } = await duplicateTable.update(duplicateRow).eq("fb_doc_id", duplicateId);
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
    const { data, error: readError } = await supabase
      .from(table)
      .select("kmz_file_url, foto_tiang_arm, foto_titik_actual, foto_kemerataan, foto_aktual, raw_payload")
      .eq("fb_doc_id", id)
      .maybeSingle();

    if (readError) throw new Error(readError.message);
    const existing = data as SurveyCleanupRow | null;
    if (!existing) {
      return NextResponse.json({ error: "Survey tidak ditemukan." }, { status: 404 });
    }

    await cleanupSupabaseStorageObjects(
      existing.kmz_file_url,
      existing.foto_tiang_arm,
      existing.foto_titik_actual,
      existing.foto_kemerataan,
      existing.foto_aktual,
      existing.raw_payload
    );

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
