import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { buildTrackingUpdateRow } from "@/lib/supabaseHybrid";

interface ExistingTrackingRecord {
  raw_payload?: Record<string, unknown> | null;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const patch = (await request.json()) as Record<string, unknown>;
    const supabase = getSupabaseAdminClient() as any;
    const { data: existing, error: readError } = (await supabase
      .from("tracking_sessions")
      .select("raw_payload")
      .eq("fb_doc_id", id)
      .maybeSingle()) as { data: ExistingTrackingRecord | null; error: { message: string } | null };

    if (readError) throw new Error(readError.message);
    if (!existing) {
      return NextResponse.json({ error: "Tracking session tidak ditemukan." }, { status: 404 });
    }

    const row = buildTrackingUpdateRow(existing.raw_payload || {}, patch);
    const { error } = await supabase.from("tracking_sessions").update(row).eq("fb_doc_id", id);
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memperbarui tracking session di Supabase." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase.from("tracking_sessions").delete().eq("fb_doc_id", id);
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal menghapus tracking session di Supabase." },
      { status: 500 }
    );
  }
}
