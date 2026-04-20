import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

interface ResolveIdentifierRow {
  email: string | null;
}

export async function GET(request: NextRequest) {
  try {
    const identifier = request.nextUrl.searchParams.get("identifier")?.trim().toLowerCase() || "";

    if (!identifier) {
      return NextResponse.json({ error: "Identifier wajib diisi." }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("user_admin")
      .select("email")
      .or(`username.eq.${identifier},email.eq.${identifier}`)
      .limit(1);

    if (error) {
      throw new Error(error.message);
    }

    const row = ((data || []) as ResolveIdentifierRow[])[0];
    if (!row?.email) {
      return NextResponse.json({ error: "Username atau email tidak ditemukan." }, { status: 404 });
    }

    return NextResponse.json({ email: row.email });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal mencari identifier user." },
      { status: 500 }
    );
  }
}
