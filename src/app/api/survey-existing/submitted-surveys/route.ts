import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

interface SurveyExistingRow {
  fb_doc_id: string | null;
  surveyor_uid: string | null;
  kabupaten: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string | null;
  status: string | null;
  nama_jalan: string | null;
  nama_gang: string | null;
  keterangan_tiang: string | null;
  surveyor_name: string | null;
}

export async function GET(request: NextRequest) {
  try {
    const surveyorUid = request.nextUrl.searchParams.get("surveyorUid")?.trim();
    const kabupaten = request.nextUrl.searchParams.get("kabupaten")?.trim();

    if (!surveyorUid || !kabupaten) {
      return NextResponse.json({ error: "surveyorUid dan kabupaten wajib diisi." }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("survey_existing")
      .select("fb_doc_id, surveyor_uid, kabupaten, latitude, longitude, created_at, status, nama_jalan, nama_gang, keterangan_tiang, surveyor_name")
      .eq("surveyor_uid", surveyorUid)
      .eq("kabupaten", kabupaten)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      source: "supabase",
      surveys: ((data || []) as SurveyExistingRow[])
        .map((row) => ({
          id: String(row.fb_doc_id || ""),
          latitude: Number(row.latitude || 0),
          longitude: Number(row.longitude || 0),
          namaJalan: row.nama_jalan || "",
          namaGang: row.nama_gang || "",
          keteranganTiang: row.keterangan_tiang || "",
          surveyorName: row.surveyor_name || "",
          status: row.status || "",
          createdAt: row.created_at,
        }))
        .filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude) && item.latitude !== 0 && item.longitude !== 0),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memuat survey existing dari Supabase." },
      { status: 500 }
    );
  }
}
