import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isMissingKabupatenColumnError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const message = "message" in error && typeof error.message === "string" ? error.message : "";
  const normalized = message.toLowerCase();
  return normalized.includes("kabupaten") && (normalized.includes("does not exist") || normalized.includes("schema cache"));
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const name = normalizeString(payload.name);
    const username = normalizeString(payload.username).toLowerCase();
    const email = normalizeString(payload.email).toLowerCase();
    const phoneNumber = normalizeString(payload.phoneNumber);
    const password = normalizeString(payload.password);
    const role = "masyarakat-umum";
    const kabupaten = "tabanan";

    if (!name || !username || !email || !phoneNumber || !password) {
      return NextResponse.json({ error: "Nama, username, email, nomor HP, dan password wajib diisi." }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Password minimal 6 karakter." }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient() as any;
    const { data: duplicates, error: duplicateError } = await supabase
      .from("user_admin")
      .select("uid, email, username")
      .or(`email.eq.${email},username.eq.${username}`)
      .limit(1);

    if (duplicateError) {
      throw new Error(duplicateError.message);
    }

    if (Array.isArray(duplicates) && duplicates.length > 0) {
      return NextResponse.json({ error: "Email atau username sudah terdaftar." }, { status: 409 });
    }

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        username,
        role,
        kabupaten,
        phone_number: phoneNumber,
      },
    });

    if (authError || !authData.user) {
      throw new Error(authError?.message || "Gagal membuat akun.");
    }

    const authUserId = authData.user.id;
    const createdAt = new Date().toISOString();
    const profilePayload = {
      fb_doc_id: authUserId,
      uid: authUserId,
      name,
      username,
      email,
      role,
      phone_number: phoneNumber,
      kabupaten,
      created_at: createdAt,
    };

    let profileError: { message: string } | null = null;
    const firstUpsert = await supabase.from("user_admin").upsert(profilePayload, { onConflict: "fb_doc_id" });
    if (firstUpsert.error && !isMissingKabupatenColumnError(firstUpsert.error)) {
      profileError = firstUpsert.error;
    } else if (firstUpsert.error && isMissingKabupatenColumnError(firstUpsert.error)) {
      const fallbackUpsert = await supabase.from("user_admin").upsert(
        {
          fb_doc_id: authUserId,
          uid: authUserId,
          name,
          username,
          email,
          role,
          phone_number: phoneNumber,
          created_at: createdAt,
        },
        { onConflict: "fb_doc_id" }
      );
      profileError = fallbackUpsert.error;
    }

    if (profileError) {
      await supabase.auth.admin.deleteUser(authUserId);
      throw new Error(profileError.message);
    }

    return NextResponse.json({
      ok: true,
      user: {
        uid: authUserId,
        name,
        username,
        email,
        role,
        phoneNumber,
        kabupaten,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal mendaftarkan akun masyarakat umum." },
      { status: 500 }
    );
  }
}
