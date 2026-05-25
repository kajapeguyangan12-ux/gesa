import { NextRequest, NextResponse } from "next/server";
import { deleteUserAdminById } from "@/lib/userAdminDelete";

interface BulkDeletePayload {
  ids?: string[];
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as BulkDeletePayload;
    const ids = Array.isArray(payload.ids)
      ? Array.from(new Set(payload.ids.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean)))
      : [];

    if (ids.length === 0) {
      return NextResponse.json({ error: "Tidak ada user yang dipilih." }, { status: 400 });
    }

    const results = [];
    for (const id of ids) {
      const result = await deleteUserAdminById(id);
      results.push({ id, ...result });
    }

    return NextResponse.json({
      ok: true,
      processed: results.length,
      results,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal menghapus user secara massal." },
      { status: 500 }
    );
  }
}
