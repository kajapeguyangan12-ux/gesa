import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

interface UserAdminIdentityRow {
  fb_doc_id: string | null;
  uid: string | null;
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const userId = id.trim();

    if (!userId) {
      return NextResponse.json({ error: "User ID tidak valid." }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const { data: existingRows, error: readError } = await supabase
      .from("user_admin")
      .select("fb_doc_id, uid")
      .or(`fb_doc_id.eq.${userId},uid.eq.${userId}`)
      .limit(1);

    if (readError) {
      throw new Error(readError.message);
    }

    const existingRow = ((existingRows || []) as UserAdminIdentityRow[])[0] || null;
    const authUserId =
      (existingRow?.uid && existingRow.uid.trim()) ||
      (existingRow?.fb_doc_id && existingRow.fb_doc_id.trim()) ||
      userId;

    const { error: deleteProfileError } = await supabase
      .from("user_admin")
      .delete()
      .or(`fb_doc_id.eq.${userId},uid.eq.${userId}`);

    if (deleteProfileError) {
      throw new Error(deleteProfileError.message);
    }

    const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(authUserId);
    if (deleteAuthError && !/not found/i.test(deleteAuthError.message)) {
      throw new Error(deleteAuthError.message);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal menghapus user admin." },
      { status: 500 }
    );
  }
}
