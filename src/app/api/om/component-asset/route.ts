import { NextRequest, NextResponse } from "next/server";
import { findApjComponentAsset, type AssetOwnership } from "@/lib/apjComponentAsset";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export async function GET(request: NextRequest) {
  try {
    const serial = request.nextUrl.searchParams.get("serial")?.trim() || "";
    const ownership: AssetOwnership = request.nextUrl.searchParams.get("ownership") === "Pemerintah"
      ? "Pemerintah"
      : "Perusahaan";
    if (!serial) return NextResponse.json({ error: "Nomor seri wajib diisi." }, { status: 400 });
    const item = await findApjComponentAsset(getSupabaseAdminClient(), serial, ownership);
    if (!item) {
      return NextResponse.json({ error: `Nomor seri tidak ditemukan di ${ownership === "Pemerintah" ? "BMD" : "Gudang"}.` }, { status: 404 });
    }
    return NextResponse.json({ item });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal mencari detail barang." }, { status: 500 });
  }
}
