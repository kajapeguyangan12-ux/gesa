import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

const DEFAULT_SUPER_ADMIN = {
  name: "Super Admin",
  username: "superadmin",
  email: "superadmin@gesa.com",
  password: "SuperAdmin123!",
  role: "super-admin",
} as const;

export async function POST() {
  try {
    const supabase = getSupabaseAdminClient() as any;

    const { data: existingRows, error: existingError } = await supabase
      .from("user_admin")
      .select("uid")
      .eq("role", DEFAULT_SUPER_ADMIN.role)
      .limit(1);

    if (existingError) {
      throw new Error(existingError.message);
    }

    if (Array.isArray(existingRows) && existingRows.length > 0) {
      return NextResponse.json({ success: false, message: "Super Admin sudah ada" }, { status: 409 });
    }

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: DEFAULT_SUPER_ADMIN.email,
      password: DEFAULT_SUPER_ADMIN.password,
      email_confirm: true,
      user_metadata: {
        name: DEFAULT_SUPER_ADMIN.name,
        username: DEFAULT_SUPER_ADMIN.username,
        role: DEFAULT_SUPER_ADMIN.role,
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
        name: DEFAULT_SUPER_ADMIN.name,
        username: DEFAULT_SUPER_ADMIN.username,
        email: DEFAULT_SUPER_ADMIN.email,
        role: DEFAULT_SUPER_ADMIN.role,
        created_at: createdAt,
      },
      { onConflict: "fb_doc_id" }
    );

    if (profileError) {
      await supabase.auth.admin.deleteUser(authUserId);
      throw new Error(profileError.message);
    }

    return NextResponse.json({
      success: true,
      message: "Super Admin berhasil dibuat",
      credentials: {
        email: DEFAULT_SUPER_ADMIN.email,
        username: DEFAULT_SUPER_ADMIN.username,
        password: DEFAULT_SUPER_ADMIN.password,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Gagal membuat Super Admin via Supabase.",
      },
      { status: 500 }
    );
  }
}
