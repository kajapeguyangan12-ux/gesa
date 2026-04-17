import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

interface TrackingSessionRow {
  fb_doc_id: string | null;
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  start_time: string | null;
  end_time: string | null;
  status: string | null;
  path: Array<{ lat: number; lng: number; timestamp?: number }> | null;
  total_distance: number | null;
  points_count: number | null;
  duration: number | null;
  survey_type: string | null;
}

export async function GET() {
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("tracking_sessions")
      .select("fb_doc_id, user_id, user_name, user_email, start_time, end_time, status, path, total_distance, points_count, duration, survey_type")
      .order("start_time", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    const sessions = ((data || []) as TrackingSessionRow[]).map((row) => ({
      id: row.fb_doc_id || "",
      userId: row.user_id || "",
      userName: row.user_name || "",
      userEmail: row.user_email || "",
      startTime: row.start_time,
      endTime: row.end_time,
      status: row.status || "",
      path: Array.isArray(row.path) ? row.path : [],
      totalDistance: typeof row.total_distance === "number" ? row.total_distance : 0,
      pointsCount: typeof row.points_count === "number" ? row.points_count : Array.isArray(row.path) ? row.path.length : 0,
      duration: typeof row.duration === "number" ? row.duration : 0,
      surveyType: row.survey_type || "",
    }));

    return NextResponse.json({
      source: "supabase",
      sessions,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memuat tracking sessions dari Supabase." },
      { status: 500 }
    );
  }
}
