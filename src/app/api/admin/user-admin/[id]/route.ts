import { NextRequest, NextResponse } from "next/server";
import { deleteUserAdminById } from "@/lib/userAdminDelete";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const result = await deleteUserAdminById(id);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal menghapus user admin." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const payload = (await request.json()) as Record<string, unknown>;
    const name = normalizeString(payload.name);
    const username = normalizeString(payload.username).toLowerCase();
    const email = normalizeString(payload.email).toLowerCase();
    const role = normalizeString(payload.role);
    const kabupaten = normalizeString(payload.kabupaten).toLowerCase() || "tabanan";
    const phoneNumber = normalizeString(payload.phoneNumber);
    const password = normalizeString(payload.password);

    if (!id || !name || !username || !email || !role) {
      return NextResponse.json({ error: "Data user belum lengkap." }, { status: 400 });
    }

    if (!["tabanan", "denpasar"].includes(kabupaten)) {
      return NextResponse.json({ error: "Kabupaten user tidak valid." }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient() as any;
    const { data: duplicates, error: duplicateError } = await supabase
      .from("user_admin")
      .select("uid, fb_doc_id, email, username")
      .or(`email.eq.${email},username.eq.${username}`)
      .limit(10);

    if (duplicateError) {
      throw new Error(duplicateError.message);
    }

    const hasDuplicate = Array.isArray(duplicates)
      ? duplicates.some((row) => {
          const rowId = row.uid || row.fb_doc_id || "";
          return rowId !== id;
        })
      : false;

    if (hasDuplicate) {
      return NextResponse.json({ error: "Email atau username sudah dipakai user lain." }, { status: 409 });
    }

    const authPayload: Record<string, unknown> = {
      email,
      user_metadata: {
        name,
        username,
        role,
        kabupaten,
        phone_number: phoneNumber,
      },
    };
    if (password) {
      authPayload.password = password;
    }

    const authUpdate = await supabase.auth.admin.updateUserById(id, authPayload);
    if (authUpdate.error) {
      throw new Error(authUpdate.error.message);
    }

    const profileUpdate = await supabase
      .from("user_admin")
      .update({
        name,
        username,
        email,
        role,
        kabupaten,
        phone_number: phoneNumber,
      })
      .or(`uid.eq.${id},fb_doc_id.eq.${id}`);

    if (profileUpdate.error) {
      throw new Error(profileUpdate.error.message);
    }

    return NextResponse.json({
      ok: true,
      user: {
        id,
        uid: id,
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
      { error: error instanceof Error ? error.message : "Gagal memperbarui user admin." },
      { status: 500 }
    );
  }
}
