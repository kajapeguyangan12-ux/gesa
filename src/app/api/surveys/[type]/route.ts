import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import {
  buildSurveyInsertRow,
  createHybridId,
  resolveSurveyTable,
  type HybridSurveyType,
} from "@/lib/supabaseHybrid";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ type: string }> }
) {
  try {
    const { type } = await context.params;
    const surveyType = type as HybridSurveyType;
    const table = resolveSurveyTable(surveyType);
    const payload = (await request.json()) as Record<string, unknown>;
    const surveyId =
      typeof payload.clientSubmissionId === "string" && payload.clientSubmissionId.trim()
        ? payload.clientSubmissionId.trim()
        : createHybridId();
    const row = buildSurveyInsertRow(surveyType, surveyId, payload);
    const supabase = getSupabaseAdminClient() as any;
    const { error } = await supabase.from(table).upsert(row, { onConflict: "fb_doc_id" });
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, id: surveyId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal menyimpan survey ke Supabase." },
      { status: 500 }
    );
  }
}
