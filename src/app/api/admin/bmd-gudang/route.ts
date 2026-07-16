import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import {
  createDocId,
  mapBmdAssetRow,
  mapMaterialRow,
  mapRequestRow,
  mapTransactionRow,
  normalizeNumber,
  normalizeString,
} from "@/lib/bmdGudang";

const TABLES = {
  materials: "mst_gudang_material",
  requests: "gudang_material_requests",
  transactions: "log_inventory_trxs",
  bmdAssets: "bmd_assets",
};

type MutationResult = Promise<{ error: { message: string } | null }>;
type SelectResult = Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>;

async function createInventoryTransaction(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  payload: {
    materialId: string;
    materialName: string;
    type: string;
    jumlah: number;
    referensi: string;
    sourceModule: string;
    status: string;
  }
) {
  const now = new Date().toISOString();
  const { data: existingRows, error: existingError } = await (
    supabase.from(TABLES.transactions) as unknown as {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          eq: (column: string, value: string) => {
            eq: (column: string, value: string) => {
              eq: (column: string, value: string) => {
                limit: (count: number) => SelectResult;
              };
            };
          };
        };
      };
    }
  )
    .select("fb_doc_id")
    .eq("material_id", payload.materialId)
    .eq("tipe_transaksi", payload.type)
    .eq("id_referensi", payload.referensi)
    .eq("source_module", payload.sourceModule)
    .limit(1);
  if (existingError) throw new Error(existingError.message);
  const existing = Array.isArray(existingRows) ? existingRows[0] : null;
  if (existing?.fb_doc_id) return String(existing.fb_doc_id);

  const id = createDocId("gudang_trx");
  const trxRow = {
    fb_doc_id: id,
    material_id: payload.materialId,
    material_name: payload.materialName,
    tipe_transaksi: payload.type,
    jumlah: payload.jumlah,
    id_referensi: payload.referensi,
    source_module: payload.sourceModule,
    status: payload.status,
    raw_payload: {
      id,
      type: payload.type,
      jumlah: payload.jumlah,
      referensi: payload.referensi,
      sourceModule: payload.sourceModule,
      status: payload.status,
      createdAt: now,
      updatedAt: now,
    },
    created_at: now,
    updated_at: now,
  };

  const { error: trxError } = await (
    supabase.from(TABLES.transactions) as unknown as {
      insert: (values: Record<string, unknown>) => MutationResult;
    }
  ).insert(trxRow);
  if (trxError) throw new Error(trxError.message);

  const { data: materialRows, error: materialError } = await (
    supabase.from(TABLES.materials) as unknown as {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          limit: (count: number) => SelectResult;
        };
      };
    }
  )
    .select("fb_doc_id, stok_tersedia, raw_payload")
    .eq("fb_doc_id", payload.materialId)
    .limit(1);
  if (materialError) throw new Error(materialError.message);

  const material = Array.isArray(materialRows) ? materialRows[0] : null;
  if (!material) return id;

  const currentStock = normalizeNumber(material.stok_tersedia, 0);
  const nextStock =
    payload.type === "MASUK" || payload.type === "RETUR"
      ? currentStock + payload.jumlah
      : payload.type === "KELUAR"
        ? Math.max(0, currentStock - payload.jumlah)
        : currentStock;

  const rawPayload = ((material.raw_payload as Record<string, unknown> | null) || {});
  const { error: updateError } = await (
    supabase.from(TABLES.materials) as unknown as {
      update: (values: Record<string, unknown>) => {
        eq: (column: string, value: string) => MutationResult;
      };
    }
  )
    .update({
      stok_tersedia: nextStock,
      raw_payload: {
        ...rawPayload,
        stokTersedia: nextStock,
        updatedAt: now,
      },
      updated_at: now,
    })
    .eq("fb_doc_id", payload.materialId);
  if (updateError) throw new Error(updateError.message);

  return id;
}

export async function GET(request: NextRequest) {
  try {
    const resource = normalizeString(request.nextUrl.searchParams.get("resource")) || "materials";
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

    if (resource === "transactions") {
      const { data, error } = await supabase.from(TABLES.transactions).select("*").order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return NextResponse.json({ items: ((data || []) as Record<string, unknown>[]).map(mapTransactionRow) });
    }

    if (resource === "requests") {
      const { data, error } = await supabase.from(TABLES.requests).select("*").order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return NextResponse.json({ items: ((data || []) as Record<string, unknown>[]).map(mapRequestRow) });
    }

    return NextResponse.json({ error: "Resource admin BMD & Gudang tidak dikenali." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memuat data admin BMD & Gudang." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const action = normalizeString(payload.action);
    const supabase = getSupabaseAdminClient();
    const now = new Date().toISOString();

    if (action === "create-material") {
      const id = createDocId("material");
      const row = {
        fb_doc_id: id,
        kode_barang: normalizeString(payload.kodeBarang),
        nama_barang: normalizeString(payload.namaBarang),
        kategori: normalizeString(payload.kategori),
        stok_tersedia: normalizeNumber(payload.stokTersedia, 0),
        stok_minimum: normalizeNumber(payload.stokMinimum, 0),
        lokasi_gudang: normalizeString(payload.lokasiGudang) || "Gudang Utama",
        foto_label: normalizeString(payload.fotoLabel),
        raw_payload: {
          ...payload,
          id,
          createdAt: now,
          updatedAt: now,
        },
        created_at: now,
        updated_at: now,
      };

      if (!row.kode_barang || !row.nama_barang || !row.kategori) {
        return NextResponse.json({ error: "Data master barang belum lengkap." }, { status: 400 });
      }

      const { error } = await (
        supabase.from(TABLES.materials) as unknown as {
          insert: (values: Record<string, unknown>) => MutationResult;
        }
      ).insert(row);
      if (error) throw new Error(error.message);
      return NextResponse.json({ id });
    }

    if (action === "create-bmd-asset") {
      const id = createDocId("bmd_asset");
      const row = {
        fb_doc_id: id,
        nomor_register: normalizeString(payload.nomorRegister),
        nama_aset: normalizeString(payload.namaAset),
        kategori: normalizeString(payload.kategori),
        kondisi: normalizeString(payload.kondisi) || "Baik",
        status_keberadaan: normalizeString(payload.status) || "Di Gudang",
        lokasi: normalizeString(payload.lokasi) || "Rak BMD A-01",
        peminjam: normalizeString(payload.peminjam) || "-",
        estimasi_kembali: normalizeString(payload.estimasiKembali) || "-",
        raw_payload: {
          ...payload,
          id,
          status: normalizeString(payload.status) || "Di Gudang",
          createdAt: now,
          updatedAt: now,
        },
        created_at: now,
        updated_at: now,
      };

      if (!row.nomor_register || !row.nama_aset) {
        return NextResponse.json({ error: "Data register aset belum lengkap." }, { status: 400 });
      }

      const { error } = await (
        supabase.from(TABLES.bmdAssets) as unknown as {
          insert: (values: Record<string, unknown>) => MutationResult;
        }
      ).insert(row);
      if (error) throw new Error(error.message);
      return NextResponse.json({ id });
    }

    if (action === "create-transaction") {
      const type = normalizeString(payload.type) || "MASUK";
      const materialId = normalizeString(payload.materialId);
      const materialName = normalizeString(payload.materialName);
      const jumlah = normalizeNumber(payload.jumlah, 0);
      const referensi = normalizeString(payload.referensi) || "-";
      const sourceModule = normalizeString(payload.sourceModule) || "Gudang";
      const status = normalizeString(payload.status) || "Posted";

      if (!materialId || !materialName || jumlah <= 0) {
        return NextResponse.json({ error: "Data transaksi gudang belum lengkap." }, { status: 400 });
      }

      const id = await createInventoryTransaction(supabase, {
        materialId,
        materialName,
        type,
        jumlah,
        referensi,
        sourceModule,
        status,
      });
      return NextResponse.json({ id });
    }

    if (action === "update-request-status") {
      const requestId = normalizeString(payload.requestId);
      const nextStatus = normalizeString(payload.status);
      if (!requestId || !nextStatus) {
        return NextResponse.json({ error: "Request dan status wajib diisi." }, { status: 400 });
      }

      const { data, error } = await (
        supabase.from(TABLES.requests) as unknown as {
          select: (columns: string) => {
            eq: (column: string, value: string) => {
              limit: (count: number) => SelectResult;
            };
          };
        }
      ).select("*").eq("fb_doc_id", requestId).limit(1);
      if (error) throw new Error(error.message);
      const row = Array.isArray(data) ? data[0] : null;
      if (!row) {
        return NextResponse.json({ error: "Pengajuan tidak ditemukan." }, { status: 404 });
      }

      const rawPayload = ((row.raw_payload as Record<string, unknown> | null) || {});
      const auditTrail = Array.isArray(rawPayload.auditTrail) ? rawPayload.auditTrail : [];
      const actorId = normalizeString(payload.actorId);
      const actorName = normalizeString(payload.actorName) || "Admin Gudang";
      const note = normalizeString(payload.note) || `Status diubah menjadi ${nextStatus}`;
      const { error: updateError } = await (
        supabase.from(TABLES.requests) as unknown as {
          update: (values: Record<string, unknown>) => {
            eq: (column: string, value: string) => MutationResult;
          };
        }
      )
        .update({
          status: nextStatus,
          raw_payload: {
            ...rawPayload,
            status: nextStatus,
            auditTrail: [
              ...auditTrail,
              {
                status: nextStatus,
                actorId,
                actorName,
                note,
                at: now,
              },
            ],
            lastStatusActorId: actorId,
            lastStatusActorName: actorName,
            lastStatusNote: note,
            lastStatusAt: now,
            updatedAt: now,
          },
          updated_at: now,
        })
        .eq("fb_doc_id", requestId);
      if (updateError) throw new Error(updateError.message);

      if (nextStatus === "Disetujui" && normalizeString(row.request_type) === "Pengajuan Barang") {
        await createInventoryTransaction(supabase, {
          materialId: normalizeString(row.material_id),
          materialName: normalizeString(row.material_name),
          type: "BOOKED",
          jumlah: normalizeNumber(row.quantity, 1),
          referensi: requestId,
          sourceModule: "Gudang",
          status: "Booked",
        });
      }

      return NextResponse.json({ ok: true });
    }

    if (action === "update-bmd-status") {
      const assetId = normalizeString(payload.assetId);
      if (!assetId) {
        return NextResponse.json({ error: "Aset BMD tidak valid." }, { status: 400 });
      }

      const { data, error } = await (
        supabase.from(TABLES.bmdAssets) as unknown as {
          select: (columns: string) => {
            eq: (column: string, value: string) => {
              limit: (count: number) => SelectResult;
            };
          };
        }
      ).select("*").eq("fb_doc_id", assetId).limit(1);
      if (error) throw new Error(error.message);
      const row = Array.isArray(data) ? data[0] : null;
      if (!row) {
        return NextResponse.json({ error: "Aset BMD tidak ditemukan." }, { status: 404 });
      }

      const rawPayload = ((row.raw_payload as Record<string, unknown> | null) || {});
      const nextStatus = normalizeString(payload.status) || normalizeString(row.status_keberadaan);
      const nextLokasi = normalizeString(payload.lokasi) || normalizeString(row.lokasi);
      const nextPeminjam = normalizeString(payload.peminjam) || normalizeString(row.peminjam) || "-";
      const nextEstimasi = normalizeString(payload.estimasiKembali) || normalizeString(row.estimasi_kembali) || "-";

      const { error: updateError } = await (
        supabase.from(TABLES.bmdAssets) as unknown as {
          update: (values: Record<string, unknown>) => {
            eq: (column: string, value: string) => MutationResult;
          };
        }
      )
        .update({
          status_keberadaan: nextStatus,
          lokasi: nextLokasi,
          peminjam: nextPeminjam,
          estimasi_kembali: nextEstimasi,
          raw_payload: {
            ...rawPayload,
            status: nextStatus,
            lokasi: nextLokasi,
            peminjam: nextPeminjam,
            estimasiKembali: nextEstimasi,
            updatedAt: now,
          },
          updated_at: now,
        })
        .eq("fb_doc_id", assetId);
      if (updateError) throw new Error(updateError.message);

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Aksi admin BMD & Gudang tidak dikenali." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal menyimpan data admin BMD & Gudang." },
      { status: 500 }
    );
  }
}
