import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";

interface SurveyPayload {
  surveyorUid?: unknown;
  status?: unknown;
  createdAt?: { toDate?: () => Date } | null;
}

interface TaskPayload {
  surveyorId?: unknown;
  type?: unknown;
  status?: unknown;
}

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId")?.trim();
    if (!userId) {
      return NextResponse.json({ error: "userId wajib diisi." }, { status: 400 });
    }

    const adminDb = getAdminDb();
    const [taskSnapshot, surveySnapshot] = await Promise.all([
      adminDb.collection("tasks").where("surveyorId", "==", userId).where("type", "==", "pra-existing").get(),
      adminDb.collection("survey-pra-existing").where("surveyorUid", "==", userId).get(),
    ]);

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const tasks = taskSnapshot.docs.map((doc) => doc.data() as TaskPayload);
    const surveys = surveySnapshot.docs.map((doc) => doc.data() as SurveyPayload);

    const surveyHariIni = surveys.filter((survey) => {
      const createdAt = survey.createdAt;
      if (!createdAt || typeof createdAt !== "object" || !("toDate" in createdAt) || typeof createdAt.toDate !== "function") {
        return false;
      }

      return createdAt.toDate() >= startOfToday;
    }).length;

    return NextResponse.json({
      source: "firestore",
      totalSurvey: surveys.length,
      surveyHariIni,
      menungguValidasi: surveys.filter((survey) => survey.status === "menunggu").length,
      totalTugas: tasks.length,
      tugasSelesai: tasks.filter((task) => task.status === "completed").length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memuat panel pra-existing dari Firestore." },
      { status: 500 }
    );
  }
}
