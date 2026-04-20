import { NextRequest, NextResponse } from "next/server";
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

export async function DELETE(request: NextRequest) {
  try {
    const payload = (await request.json().catch(() => ({}))) as {
      status?: string;
      userEmail?: string;
      surveyType?: string;
    };

    const status = typeof payload.status === "string" ? payload.status.trim() : "";
    const userEmail = typeof payload.userEmail === "string" ? payload.userEmail.trim() : "";
    const surveyType = typeof payload.surveyType === "string" ? payload.surveyType.trim() : "";

    const supabase = getSupabaseAdminClient() as any;
    let query = supabase.from("tracking_sessions").delete();

    if (status && status !== "all") {
      query = query.eq("status", status);
    }
    if (userEmail && userEmail !== "all") {
      query = query.eq("user_email", userEmail);
    }
    if (surveyType && surveyType !== "all") {
      query = query.eq("survey_type", surveyType);
    }

    if ((!status || status === "all") && (!userEmail || userEmail === "all") && (!surveyType || surveyType === "all")) {
      query = query.not("fb_doc_id", "is", null);
    }

    const { error } = await query;
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal menghapus tracking sessions dari Supabase." },
      { status: 500 }
    );
  }
}
