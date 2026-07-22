import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

interface UserAdminRow {
  fb_doc_id: string | null;
  uid: string | null;
  name: string | null;
  username: string | null;
  email: string | null;
  role: string | null;
  phone_number: string | null;
  kabupaten: string | null;
  created_at: string | null;
}

function isMissingKabupatenColumnError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const message = "message" in error && typeof error.message === "string" ? error.message : "";
  const normalized = message.toLowerCase();
  return normalized.includes("kabupaten") && (normalized.includes("does not exist") || normalized.includes("schema cache"));
}

export async function GET(request: NextRequest) {
  try {
    const limitParam = Number.parseInt(request.nextUrl.searchParams.get("limit") || "50", 10);
    const offsetParam = Number.parseInt(request.nextUrl.searchParams.get("offset") || "0", 10);
    const searchParam = request.nextUrl.searchParams.get("q")?.trim() || "";
    const kabupatenParam = request.nextUrl.searchParams.get("kabupaten")?.trim().toLowerCase() || "";
    const safeLimit = Number.isFinite(limitParam) ? Math.max(1, Math.min(limitParam, 200)) : 50;
    const safeOffset = Number.isFinite(offsetParam) ? Math.max(0, offsetParam) : 0;
    const supabase = getSupabaseAdminClient() as any;

    const escapedSearch = searchParam
      ? searchParam.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_")
      : "";
    const applySearch = (query: any, includeKabupaten: boolean) => {
      if (!searchParam) return query;
      return query.or(
        includeKabupaten
          ? `name.ilike.%${escapedSearch}%,username.ilike.%${escapedSearch}%,email.ilike.%${escapedSearch}%,role.ilike.%${escapedSearch}%,kabupaten.ilike.%${escapedSearch}%`
          : `name.ilike.%${escapedSearch}%,username.ilike.%${escapedSearch}%,email.ilike.%${escapedSearch}%,role.ilike.%${escapedSearch}%`
      );
    };

    let userQuery = supabase
        .from("user_admin")
        .select("fb_doc_id, uid, name, username, email, role, phone_number, kabupaten, created_at", {
          count: "exact",
        })
        .order("created_at", { ascending: false });
    if (kabupatenParam) userQuery = userQuery.eq("kabupaten", kabupatenParam);
    const withKabupaten = await applySearch(
      userQuery.range(safeOffset, safeOffset + safeLimit - 1),
      true
    );

    let data = withKabupaten.data;
    let count = withKabupaten.count;
    if (withKabupaten.error && !isMissingKabupatenColumnError(withKabupaten.error)) {
      throw new Error(withKabupaten.error.message);
    }

    if (withKabupaten.error && isMissingKabupatenColumnError(withKabupaten.error)) {
      const fallback = await applySearch(
        supabase
          .from("user_admin")
          .select("fb_doc_id, uid, name, username, email, role, phone_number, created_at", {
            count: "exact",
          })
          .order("created_at", { ascending: false })
          .range(safeOffset, safeOffset + safeLimit - 1),
        false
      );
      if (fallback.error) {
        throw new Error(fallback.error.message);
      }
      data = fallback.data;
      count = fallback.count;
    }

    const users = ((data || []) as UserAdminRow[]).map((row) => ({
      id: row.fb_doc_id || row.uid || "",
      uid: row.uid || "",
      name: row.name || "",
      username: row.username || "",
      email: row.email || "",
      role: row.role || "",
      phoneNumber: row.phone_number || "",
      kabupaten: row.role === "super-admin" ? "" : row.kabupaten || "tabanan",
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
      kabupaten?: string;
      actorRole?: string;
      actorKabupaten?: string;
      phoneNumber?: string;
    };

    const name = payload.name?.trim() || "";
    const username = payload.username?.trim().toLowerCase() || "";
    const email = payload.email?.trim().toLowerCase() || "";
    const password = payload.password || "";
    const role = payload.role?.trim() || "";
    const phoneNumber = payload.phoneNumber?.trim() || "";
    const isSuperAdminRole = role === "super-admin";
    const actorRole = payload.actorRole?.trim() || "";
    const actorKabupaten = payload.actorKabupaten?.trim().toLowerCase() || "";
    const requestedKabupaten = payload.kabupaten?.trim().toLowerCase() || "tabanan";
    const kabupaten = isSuperAdminRole ? "" : actorRole === "admin" && actorKabupaten ? actorKabupaten : requestedKabupaten;

    if (!name || !username || !email || !password || !role || (!isSuperAdminRole && !kabupaten)) {
      return NextResponse.json({ error: "Data user belum lengkap." }, { status: 400 });
    }

    if (!isSuperAdminRole && !["tabanan", "denpasar"].includes(kabupaten)) {
      return NextResponse.json({ error: "Kabupaten user tidak valid." }, { status: 400 });
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
        phone_number: phoneNumber,
        ...(isSuperAdminRole ? {} : { kabupaten }),
      },
    });

    if (authError || !authData.user) {
      throw new Error(authError?.message || "Gagal membuat user auth Supabase.");
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
      kabupaten: isSuperAdminRole ? null : kabupaten,
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
        id: authUserId,
        uid: authUserId,
        name,
        username,
        email,
        role,
        phoneNumber,
        kabupaten: isSuperAdminRole ? "" : kabupaten,
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
