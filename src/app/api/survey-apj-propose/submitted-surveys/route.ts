import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

interface SurveyApjProposeRow {
  fb_doc_id: string | null;
  kabupaten: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string | null;
  surveyor_name: string | null;
  id_titik: string | null;
  nama_jalan: string | null;
  daya_lampu: string | null;
}

export async function GET(request: NextRequest) {
  try {
    const kabupaten = request.nextUrl.searchParams.get("kabupaten")?.trim();

    if (!kabupaten) {
      return NextResponse.json({ error: "kabupaten wajib diisi." }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("survey_apj_propose")
      .select("fb_doc_id, kabupaten, latitude, longitude, created_at, surveyor_name, id_titik, nama_jalan, daya_lampu")
      .eq("kabupaten", kabupaten)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      source: "supabase",
      surveys: ((data || []) as SurveyApjProposeRow[])
        .map((row) => ({
          id: String(row.fb_doc_id || ""),
          latitude: Number(row.latitude || 0),
          longitude: Number(row.longitude || 0),
          idTitik: row.id_titik || "",
          namaJalan: row.nama_jalan || "",
          dayaLampu: row.daya_lampu || "",
          surveyorName: row.surveyor_name || "",
          createdAt: row.created_at,
        }))
        .filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude) && item.latitude !== 0 && item.longitude !== 0),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memuat survey APJ propose dari Supabase." },
      { status: 500 }
    );
  }
}
