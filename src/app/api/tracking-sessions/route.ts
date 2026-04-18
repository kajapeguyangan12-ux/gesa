import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { buildTrackingInsertRow, createHybridId } from "@/lib/supabaseHybrid";

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const sessionId = createHybridId();
    const row = buildTrackingInsertRow(sessionId, payload);
    const supabase = getSupabaseAdminClient() as any;
    const { error } = await supabase.from("tracking_sessions").upsert(row, { onConflict: "fb_doc_id" });
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, id: sessionId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal membuat tracking session di Supabase." },
      { status: 500 }
    );
  }
}
