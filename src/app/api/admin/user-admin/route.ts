import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

interface UserAdminRow {
  fb_doc_id: string | null;
  uid: string | null;
  name: string | null;
  username: string | null;
  email: string | null;
  role: string | null;
  phone_number: string | null;
  created_at: string | null;
}

export async function GET(request: NextRequest) {
  try {
    const limitParam = Number.parseInt(request.nextUrl.searchParams.get("limit") || "50", 10);
    const offsetParam = Number.parseInt(request.nextUrl.searchParams.get("offset") || "0", 10);
    const searchParam = request.nextUrl.searchParams.get("q")?.trim() || "";
    const safeLimit = Number.isFinite(limitParam) ? Math.max(1, Math.min(limitParam, 200)) : 50;
    const safeOffset = Number.isFinite(offsetParam) ? Math.max(0, offsetParam) : 0;
    const supabase = getSupabaseAdminClient() as any;

    let query = supabase
      .from("user_admin")
      .select("fb_doc_id, uid, name, username, email, role, phone_number, created_at", {
        count: "exact",
      })
      .order("created_at", { ascending: false })
      .range(safeOffset, safeOffset + safeLimit - 1);

    if (searchParam) {
      const escapedSearch = searchParam
        .replace(/\\/g, "\\\\")
        .replace(/%/g, "\\%")
        .replace(/_/g, "\\_");
      query = query.or(
        `name.ilike.%${escapedSearch}%,username.ilike.%${escapedSearch}%,email.ilike.%${escapedSearch}%,role.ilike.%${escapedSearch}%`
      );
    }

    const { data, error, count } = await query;

    if (error) {
      throw new Error(error.message);
    }

    const users = ((data || []) as UserAdminRow[]).map((row) => ({
      id: row.fb_doc_id || row.uid || "",
      uid: row.uid || "",
      name: row.name || "",
      username: row.username || "",
      email: row.email || "",
      role: row.role || "",
      phoneNumber: row.phone_number || "",
      createdAt: row.created_at,
    }));

    return NextResponse.json({
      source: "supabase",
      query: searchParam,
      users,
      hasMore: safeOffset + users.length < (count || 0),
      nextOffset: safeOffset + users.length,
      total: count || users.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memuat user admin dari Supabase." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as {
      name?: string;
      username?: string;
      email?: string;
      password?: string;
      role?: string;
    };

    const name = payload.name?.trim() || "";
    const username = payload.username?.trim().toLowerCase() || "";
    const email = payload.email?.trim().toLowerCase() || "";
    const password = payload.password || "";
    const role = payload.role?.trim() || "";

    if (!name || !username || !email || !password || !role) {
      return NextResponse.json({ error: "Data user belum lengkap." }, { status: 400 });
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
      },
    });

    if (authError || !authData.user) {
      throw new Error(authError?.message || "Gagal membuat user auth Supabase.");
    }

    const authUserId = authData.user.id;
    const createdAt = new Date().toISOString();

    const { error: profileError } = await supabase.from("user_admin").upsert(
      {
        fb_doc_id: authUserId,
        uid: authUserId,
        name,
        username,
        email,
        role,
        created_at: createdAt,
      },
      { onConflict: "fb_doc_id" }
    );

    if (profileError) {
      await supabase.auth.admin.deleteUser(authUserId);
      throw new Error(profileError.message);
    }

    let firebaseMirrorWarning: string | null = null;
    try {
      await getAdminDb().collection("User-Admin").doc(authUserId).set({
        uid: authUserId,
        name,
        username,
        email,
        password,
        role,
        createdAt,
      });
    } catch (firebaseError) {
      firebaseMirrorWarning =
        firebaseError instanceof Error
          ? firebaseError.message
          : "Sinkronisasi user ke Firestore gagal.";
      console.warn("[user-admin] Firebase mirror create failed:", firebaseMirrorWarning);
    }

    return NextResponse.json({
      ok: true,
      warning: firebaseMirrorWarning,
      user: {
        id: authUserId,
        uid: authUserId,
        name,
        username,
        email,
        role,
        createdAt,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal membuat user admin." },
      { status: 500 }
    );
  }
}
