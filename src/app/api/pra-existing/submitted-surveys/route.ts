import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

interface SurveyPraExistingRow {
  fb_doc_id: string | null;
  surveyor_uid: string | null;
  kabupaten: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  created_at: string | null;
  raw_payload: Record<string, unknown> | null;
}

export async function GET(request: NextRequest) {
  try {
    const surveyorUid = request.nextUrl.searchParams.get("surveyorUid")?.trim();
    const kabupaten = request.nextUrl.searchParams.get("kabupaten")?.trim() || "";

    if (!surveyorUid) {
      return NextResponse.json({ error: "surveyorUid wajib diisi." }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    let query = supabase
      .from("survey_pra_existing")
      .select("fb_doc_id, surveyor_uid, kabupaten, latitude, longitude, accuracy, created_at, raw_payload")
      .eq("surveyor_uid", surveyorUid)
      .order("created_at", { ascending: false });

    if (kabupaten) {
      query = query.eq("kabupaten", kabupaten);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(error.message);
    }

    const surveys = ((data || []) as SurveyPraExistingRow[])
      .map((row) => {
        const rawPayload = row.raw_payload || {};
        return {
          id: String(row.fb_doc_id || ""),
          latitude: Number(row.latitude || 0),
          longitude: Number(row.longitude || 0),
          title: typeof rawPayload.title === "string" ? rawPayload.title : "",
          kecamatan: typeof rawPayload.kecamatan === "string" ? rawPayload.kecamatan : "",
          desa: typeof rawPayload.desa === "string" ? rawPayload.desa : "",
          banjar: typeof rawPayload.banjar === "string" ? rawPayload.banjar : "",
          kepemilikanTiang:
            typeof rawPayload.keteranganTiang === "string"
              ? rawPayload.keteranganTiang
              : typeof rawPayload.kepemilikanDisplay === "string"
                ? rawPayload.kepemilikanDisplay
                : typeof rawPayload.kepemilikanTiang === "string"
                  ? rawPayload.kepemilikanTiang
                  : "",
          surveyorName: typeof rawPayload.surveyorName === "string" ? rawPayload.surveyorName : "",
          createdAt: row.created_at,
          status: typeof rawPayload.status === "string" ? rawPayload.status : "",
          rejectedAt: typeof rawPayload.rejectedAt === "string" ? rawPayload.rejectedAt : null,
          rejectedBy: typeof rawPayload.rejectedBy === "string" ? rawPayload.rejectedBy : "",
          rejectionReason: typeof rawPayload.rejectionReason === "string" ? rawPayload.rejectionReason : "",
        };
      })
      .filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude) && item.latitude !== 0 && item.longitude !== 0);

    return NextResponse.json({
      source: "supabase",
      surveys,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memuat survey pra-existing dari Supabase." },
      { status: 500 }
    );
  }
}
