import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

interface UserAdminRow {
  fb_doc_id: string | null;
  uid: string | null;
  name: string | null;
  username: string | null;
  email: string | null;
  password: string | null;
  role: string | null;
  phone_number: string | null;
  created_at: string | null;
}

export async function GET(request: NextRequest) {
  try {
    const limitParam = Number.parseInt(request.nextUrl.searchParams.get("limit") || "50", 10);
    const offsetParam = Number.parseInt(request.nextUrl.searchParams.get("offset") || "0", 10);
    const safeLimit = Number.isFinite(limitParam) ? Math.max(1, Math.min(limitParam, 200)) : 50;
    const safeOffset = Number.isFinite(offsetParam) ? Math.max(0, offsetParam) : 0;
    const supabase = getSupabaseAdminClient();

    const { data, error, count } = await supabase
      .from("user_admin")
      .select("fb_doc_id, uid, name, username, email, password, role, phone_number, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(safeOffset, safeOffset + safeLimit - 1);

    if (error) {
      throw new Error(error.message);
    }

    const users = ((data || []) as UserAdminRow[]).map((row) => ({
      id: row.fb_doc_id || row.uid || "",
      uid: row.uid || "",
      name: row.name || "",
      username: row.username || "",
      email: row.email || "",
      password: row.password || "",
      role: row.role || "",
      phoneNumber: row.phone_number || "",
      createdAt: row.created_at,
    }));

    return NextResponse.json({
      source: "supabase",
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
