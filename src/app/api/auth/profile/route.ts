import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

interface UserAdminProfileRow {
  fb_doc_id: string | null;
  uid: string | null;
  name: string | null;
  username: string | null;
  email: string | null;
  role: string | null;
  phone_number: string | null;
}

export async function GET(request: NextRequest) {
  try {
    const uid = request.nextUrl.searchParams.get("uid")?.trim() || "";
    const email = request.nextUrl.searchParams.get("email")?.trim().toLowerCase() || "";

    if (!uid && !email) {
      return NextResponse.json({ error: "Parameter uid atau email wajib diisi." }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    let query = supabase
      .from("user_admin")
      .select("fb_doc_id, uid, name, username, email, role, phone_number")
      .limit(1);

    if (uid && email) {
      query = query.or(`uid.eq.${uid},fb_doc_id.eq.${uid},email.eq.${email}`);
    } else if (uid) {
      query = query.or(`uid.eq.${uid},fb_doc_id.eq.${uid}`);
    } else {
      query = query.eq("email", email);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(error.message);
    }

    const row = ((data || []) as UserAdminProfileRow[])[0];
    if (!row) {
      return NextResponse.json({ error: "Profil user tidak ditemukan." }, { status: 404 });
    }

    return NextResponse.json({
      user: {
        uid: row.uid || row.fb_doc_id || "",
        email: row.email || "",
        username: row.username || "",
        name: row.name || "",
        role: row.role || "",
        phoneNumber: row.phone_number || "",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memuat profil user." },
      { status: 500 }
    );
  }
}
