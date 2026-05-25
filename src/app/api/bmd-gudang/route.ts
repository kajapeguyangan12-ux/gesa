import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import {
  createDocId,
  mapBmdAssetRow,
  mapMaterialRow,
  mapRequestRow,
  normalizeNumber,
  normalizeString,
} from "@/lib/bmdGudang";

const TABLES = {
  materials: "mst_gudang_material",
  requests: "gudang_material_requests",
  bmdAssets: "bmd_assets",
};

type MutationResult = Promise<{ error: { message: string } | null }>;

export async function GET(request: NextRequest) {
  try {
    const resource = normalizeString(request.nextUrl.searchParams.get("resource")) || "materials";
    const requesterId = normalizeString(request.nextUrl.searchParams.get("requesterId"));
    const supabase = getSupabaseAdminClient();

    if (resource === "materials") {
      const { data, error } = await supabase.from(TABLES.materials).select("*").order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return NextResponse.json({ items: ((data || []) as Record<string, unknown>[]).map(mapMaterialRow) });
    }

    if (resource === "bmd-assets") {
      const { data, error } = await supabase.from(TABLES.bmdAssets).select("*").order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return NextResponse.json({ items: ((data || []) as Record<string, unknown>[]).map(mapBmdAssetRow) });
    }

    if (resource === "requests") {
      let query = supabase.from(TABLES.requests).select("*").order("created_at", { ascending: false });
      if (requesterId) {
        query = query.eq("requester_id", requesterId);
      }
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return NextResponse.json({ items: ((data || []) as Record<string, unknown>[]).map(mapRequestRow) });
    }

    return NextResponse.json({ error: "Resource BMD & Gudang tidak dikenali." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memuat data BMD & Gudang." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const action = normalizeString(payload.action);
    const supabase = getSupabaseAdminClient();

    if (action === "create-request") {
      const requestType = normalizeString(payload.requestType) as "Pengajuan Barang" | "Peminjaman BMD";
      const materialId = normalizeString(payload.materialId);
      const materialName = normalizeString(payload.materialName);
      const requesterId = normalizeString(payload.requesterId);
      const requesterName = normalizeString(payload.requesterName);
      const quantity = normalizeNumber(payload.quantity, 1);

      if (!requestType || !materialId || !materialName || !requesterId || !requesterName || quantity <= 0) {
        return NextResponse.json({ error: "Data pengajuan belum lengkap." }, { status: 400 });
      }

      const now = new Date().toISOString();
      const id = createDocId("gudang_request");
      const row = {
        fb_doc_id: id,
        material_id: materialId,
        material_name: materialName,
        quantity,
        request_type: requestType,
        requester_id: requesterId,
        requester_name: requesterName,
        note: normalizeString(payload.note) || "-",
        status: "Diajukan",
        location_hint: normalizeString(payload.locationHint) || "-",
        raw_payload: {
          ...payload,
          id,
          quantity,
          status: "Diajukan",
          createdAt: now,
          updatedAt: now,
        },
        created_at: now,
        updated_at: now,
      };

      const { error } = await (
        supabase.from(TABLES.requests) as unknown as {
          insert: (values: Record<string, unknown>) => MutationResult;
        }
      ).insert(row);
      if (error) throw new Error(error.message);
      return NextResponse.json({ id });
    }

    return NextResponse.json({ error: "Aksi BMD & Gudang tidak dikenali." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal menyimpan pengajuan BMD & Gudang." },
      { status: 500 }
    );
  }
}
