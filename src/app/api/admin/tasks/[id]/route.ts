import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { buildTaskUpdateRow } from "@/lib/supabaseHybrid";

interface ExistingTaskRecord {
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
      .from("tasks")
      .select("raw_payload")
      .eq("fb_doc_id", id)
      .maybeSingle()) as { data: ExistingTaskRecord | null; error: { message: string } | null };

    if (readError) throw new Error(readError.message);
    if (!existing) {
      return NextResponse.json({ error: "Task tidak ditemukan." }, { status: 404 });
    }

    const row = buildTaskUpdateRow((existing.raw_payload as Record<string, unknown> | null) || {}, patch);
    const { error } = await supabase.from("tasks").update(row).eq("fb_doc_id", id);
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memperbarui tugas di Supabase." },
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
    const { error } = await supabase.from("tasks").delete().eq("fb_doc_id", id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal menghapus tugas di Supabase." },
      { status: 500 }
    );
  }
}
