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
  kabupaten: string | null;
}

function isMissingKabupatenColumnError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const message = "message" in error && typeof error.message === "string" ? error.message : "";
  const normalized = message.toLowerCase();
  return normalized.includes("kabupaten") && (normalized.includes("does not exist") || normalized.includes("schema cache"));
}

export async function GET(request: NextRequest) {
  try {
    const uid = request.nextUrl.searchParams.get("uid")?.trim() || "";
    const email = request.nextUrl.searchParams.get("email")?.trim().toLowerCase() || "";

    if (!uid && !email) {
      return NextResponse.json({ error: "Parameter uid atau email wajib diisi." }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const applyFilters = (query: any) => {
      if (uid && email) {
        return query.or(`uid.eq.${uid},fb_doc_id.eq.${uid},email.eq.${email}`);
      }
      if (uid) {
        return query.or(`uid.eq.${uid},fb_doc_id.eq.${uid}`);
      }
      return query.eq("email", email);
    };

    let data: UserAdminProfileRow[] | null = null;
    const withKabupaten = await applyFilters(
      supabase
        .from("user_admin")
        .select("fb_doc_id, uid, name, username, email, role, phone_number, kabupaten")
        .limit(1)
    );
    if (withKabupaten.error && !isMissingKabupatenColumnError(withKabupaten.error)) {
      throw new Error(withKabupaten.error.message);
    }

    if (withKabupaten.error && isMissingKabupatenColumnError(withKabupaten.error)) {
      const fallback = await applyFilters(
        supabase
          .from("user_admin")
          .select("fb_doc_id, uid, name, username, email, role, phone_number")
          .limit(1)
      );
      if (fallback.error) {
        throw new Error(fallback.error.message);
      }
      data = (fallback.data || []) as UserAdminProfileRow[];
    } else {
      data = (withKabupaten.data || []) as UserAdminProfileRow[];
    }

    const row = (data || [])[0];
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
        kabupaten: row.role === "super-admin" ? "" : row.kabupaten || "tabanan",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memuat profil user." },
      { status: 500 }
    );
  }
}
