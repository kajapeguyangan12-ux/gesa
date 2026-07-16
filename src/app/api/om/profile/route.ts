import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

type UserAdminRow = {
  fb_doc_id: string | null;
  uid: string | null;
  name: string | null;
  username: string | null;
  email: string | null;
  role: string | null;
  kabupaten: string | null;
  phone_number: string | null;
};

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function PATCH(request: NextRequest) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const uid = normalizeString(payload.uid);
    const username = normalizeString(payload.username).toLowerCase();
    const email = normalizeString(payload.email).toLowerCase();
    const name = normalizeString(payload.name);
    const phoneNumber = normalizeString(payload.phoneNumber);
    const newPassword = normalizeString(payload.newPassword);

    if (!uid || !username || !email || !name) {
      return NextResponse.json({ error: "uid, username, email, dan nama wajib diisi." }, { status: 400 });
    }

    if (newPassword && newPassword.length < 6) {
      return NextResponse.json({ error: "Kata sandi baru minimal 6 karakter." }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient() as any;
    const profileQuery = await supabase
      .from("user_admin")
      .select("fb_doc_id, uid, name, username, email, role, kabupaten, phone_number")
      .or(`uid.eq.${uid},fb_doc_id.eq.${uid}`)
      .limit(1);

    if (profileQuery.error) {
      throw new Error(profileQuery.error.message);
    }

    const existing = (profileQuery.data?.[0] || null) as UserAdminRow | null;
    if (!existing) {
      return NextResponse.json({ error: "Profil user tidak ditemukan." }, { status: 404 });
    }

    const duplicateQuery = await supabase
      .from("user_admin")
      .select("fb_doc_id, uid, username, email")
      .or(`email.eq.${email},username.eq.${username}`)
      .limit(10);

    if (duplicateQuery.error) {
      throw new Error(duplicateQuery.error.message);
    }

    const duplicates = (duplicateQuery.data || []) as UserAdminRow[];
    const hasConflict = duplicates.some((row) => {
      const rowId = row.uid || row.fb_doc_id || "";
      return rowId !== uid;
    });

    if (hasConflict) {
      return NextResponse.json({ error: "Email atau username sudah dipakai user lain." }, { status: 409 });
    }

    const role = existing.role || "petugas-om-preventif";
    const kabupaten = existing.kabupaten || "tabanan";
    const authUpdatePayload: Record<string, unknown> = {
      email,
      user_metadata: {
        name,
        username,
        role,
        kabupaten,
        phone_number: phoneNumber,
      },
    };

    if (newPassword) {
      authUpdatePayload.password = newPassword;
    }

    const authResult = await supabase.auth.admin.updateUserById(uid, authUpdatePayload);
    if (authResult.error) {
      throw new Error(authResult.error.message);
    }

    const profileUpdate = await supabase
      .from("user_admin")
      .update({
        name,
        username,
        email,
        phone_number: phoneNumber,
      })
      .or(`uid.eq.${uid},fb_doc_id.eq.${uid}`);

    if (profileUpdate.error) {
      throw new Error(profileUpdate.error.message);
    }

    return NextResponse.json({
      ok: true,
      user: {
        uid,
        username,
        email,
        name,
        displayName: name,
        role,
        kabupaten,
        phoneNumber,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memperbarui profil O&M." },
      { status: 500 }
    );
  }
}
