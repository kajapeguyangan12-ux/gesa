import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import {
  buildSurveyUpdateRow,
  resolveSurveyTable,
  type HybridSurveyType,
} from "@/lib/supabaseHybrid";

interface ExistingSurveyRecord {
  raw_payload?: Record<string, unknown> | null;
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
    const supabase = getSupabaseAdminClient() as any;
    const { data: existing, error: readError } = (await supabase
      .from(table)
      .select("raw_payload")
      .eq("fb_doc_id", id)
      .maybeSingle()) as { data: ExistingSurveyRecord | null; error: { message: string } | null };

    if (readError) throw new Error(readError.message);
    if (!existing) {
      return NextResponse.json({ error: "Survey tidak ditemukan." }, { status: 404 });
    }

    const row = buildSurveyUpdateRow(surveyType, (existing.raw_payload as Record<string, unknown> | null) || {}, patch);
    const { error } = await supabase.from(table).update(row).eq("fb_doc_id", id);
    if (error) throw new Error(error.message);

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
