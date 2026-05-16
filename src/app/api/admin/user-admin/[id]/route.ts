import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

interface UserAdminRow {
  fb_doc_id: string | null;
  uid: string | null;
  name?: string | null;
  username?: string | null;
  email?: string | null;
  role?: string | null;
  phone_number?: string | null;
  created_at?: string | null;
}

function normalizeValue(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function isAuthUserNotFoundError(message: string) {
  return /not found|user.*not.*exist|unable to find user/i.test(message);
}

async function findAuthUserIdByEmail(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  email: string
) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return "";

  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error(error.message);
    }

    const users = Array.isArray(data?.users) ? data.users : [];
    const match = users.find((item) => normalizeValue(item.email).toLowerCase() === normalizedEmail);
    if (match?.id) {
      return match.id;
    }

    if (users.length < perPage) {
      return "";
    }

    page += 1;
  }
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
      .select("fb_doc_id, uid, name, username, email, role, phone_number, created_at")
      .or(`fb_doc_id.eq.${userId},uid.eq.${userId}`)
      .limit(1);

    if (readError) {
      throw new Error(readError.message);
    }

    const existingRow = ((existingRows || []) as UserAdminRow[])[0] || null;
    if (!existingRow) {
      return NextResponse.json({ error: "User tidak ditemukan." }, { status: 404 });
    }

    const profileId = normalizeValue(existingRow.fb_doc_id) || normalizeValue(existingRow.uid) || userId;
    const email = normalizeValue(existingRow.email).toLowerCase();
    const candidateAuthIds = Array.from(
      new Set([
        normalizeValue(existingRow.uid),
        normalizeValue(existingRow.fb_doc_id),
        userId,
        email ? await findAuthUserIdByEmail(supabase, email) : "",
      ].filter(Boolean))
    );

    let authDeleted = false;

    for (const authUserId of candidateAuthIds) {
      const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(authUserId);
      if (deleteAuthError) {
        if (isAuthUserNotFoundError(deleteAuthError.message)) {
          continue;
        }

        throw new Error(deleteAuthError.message);
      }

      authDeleted = true;
      break;
    }

    if (!authDeleted && candidateAuthIds.length === 0) {
      throw new Error("User auth Supabase tidak bisa diidentifikasi untuk dihapus.");
    }

    const deleteClauses = [`fb_doc_id.eq.${userId}`, `uid.eq.${userId}`];
    if (email) {
      deleteClauses.push(`email.eq.${email}`);
    }

    const { error: deleteProfileError } = await supabase
      .from("user_admin")
      .delete()
      .or(deleteClauses.join(","));

    if (deleteProfileError) {
      throw new Error(deleteProfileError.message);
    }

    return NextResponse.json({
      ok: true,
      deletedProfileId: profileId,
      deletedAuthUser: authDeleted,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal menghapus user admin." },
      { status: 500 }
    );
  }
}
