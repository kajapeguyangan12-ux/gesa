import { NextRequest, NextResponse } from "next/server";
import { deleteUserAdminById } from "@/lib/userAdminDelete";

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
