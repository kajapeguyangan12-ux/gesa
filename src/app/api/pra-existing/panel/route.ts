import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

interface TaskRow {
  status: string | null;
}

interface SurveyRow {
  created_at: string | null;
  raw_payload: Record<string, unknown> | null;
}

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId")?.trim();
    if (!userId) {
      return NextResponse.json({ error: "userId wajib diisi." }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const [taskResult, surveyResult] = await Promise.all([
      supabase
        .from("tasks")
        .select("status")
        .eq("surveyor_id", userId)
        .eq("type", "pra-existing"),
      supabase
        .from("survey_pra_existing")
        .select("created_at, raw_payload")
        .eq("surveyor_uid", userId),
    ]);

    if (taskResult.error) {
      throw new Error(taskResult.error.message);
    }
    if (surveyResult.error) {
      throw new Error(surveyResult.error.message);
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const tasks = (taskResult.data || []) as TaskRow[];
    const surveys = (surveyResult.data || []) as SurveyRow[];

    const surveyHariIni = surveys.filter((survey) => {
      if (typeof survey.created_at !== "string") return false;
      const createdAt = new Date(survey.created_at);
      return !Number.isNaN(createdAt.getTime()) && createdAt >= startOfToday;
    }).length;

    const menungguValidasi = surveys.filter((survey) => {
      const status = survey.raw_payload?.status;
      return typeof status === "string" && status === "menunggu";
    }).length;

    const tugasSelesai = tasks.filter((task) => task.status === "completed").length;

    return NextResponse.json({
      source: "supabase",
      totalSurvey: surveys.length,
      surveyHariIni,
      menungguValidasi,
      totalTugas: tasks.length,
      tugasSelesai,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memuat panel pra-existing dari Supabase." },
      { status: 500 }
    );
  }
}
