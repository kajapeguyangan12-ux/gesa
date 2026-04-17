import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId")?.trim();
    if (!userId) {
      return NextResponse.json({ error: "userId wajib diisi." }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [
      totalSurveyResult,
      surveyHariIniResult,
      menungguValidasiResult,
      totalTugasResult,
      tugasSelesaiResult,
    ] = await Promise.all([
      supabase.from("survey_pra_existing").select("*", { count: "exact", head: true }).eq("surveyor_uid", userId),
      supabase.from("survey_pra_existing").select("*", { count: "exact", head: true }).eq("surveyor_uid", userId).gte("created_at", startOfToday.toISOString()),
      supabase.from("survey_pra_existing").select("*", { count: "exact", head: true }).eq("surveyor_uid", userId).eq("status", "menunggu"),
      supabase.from("tasks").select("*", { count: "exact", head: true }).eq("surveyor_id", userId).eq("type", "pra-existing"),
      supabase.from("tasks").select("*", { count: "exact", head: true }).eq("surveyor_id", userId).eq("type", "pra-existing").eq("status", "completed"),
    ]);

    const errors = [
      totalSurveyResult.error,
      surveyHariIniResult.error,
      menungguValidasiResult.error,
      totalTugasResult.error,
      tugasSelesaiResult.error,
    ].filter(Boolean);

    if (errors.length > 0) {
      throw new Error(errors[0]?.message || "Gagal memuat panel pra-existing dari Supabase.");
    }

    return NextResponse.json({
      source: "supabase",
      totalSurvey: totalSurveyResult.count || 0,
      surveyHariIni: surveyHariIniResult.count || 0,
      menungguValidasi: menungguValidasiResult.count || 0,
      totalTugas: totalTugasResult.count || 0,
      tugasSelesai: tugasSelesaiResult.count || 0,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memuat panel pra-existing." },
      { status: 500 }
    );
  }
}
