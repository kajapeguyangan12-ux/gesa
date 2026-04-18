import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";

interface TaskPayload {
  title?: unknown;
  description?: unknown;
  surveyorId?: unknown;
  surveyorName?: unknown;
  surveyorEmail?: unknown;
  status?: unknown;
  type?: unknown;
  kmzFileUrl?: unknown;
  kmzFileUrl2?: unknown;
  offlineEnabled?: unknown;
  createdAt?: { toDate?: () => Date } | string | number | null;
  startedAt?: { toDate?: () => Date } | string | number | null;
}

function normalizeTimestamp(value: TaskPayload["createdAt"] | TaskPayload["startedAt"]) {
  if (!value) return null;
  if (typeof value === "object" && value !== null && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  return null;
}

export async function GET(request: NextRequest) {
  try {
    const surveyorId = request.nextUrl.searchParams.get("surveyorId")?.trim();
    if (!surveyorId) {
      return NextResponse.json({ error: "surveyorId wajib diisi." }, { status: 400 });
    }

    const adminDb = getAdminDb();
    const snapshot = await adminDb
      .collection("tasks")
      .where("surveyorId", "==", surveyorId)
      .where("type", "==", "pra-existing")
      .get();

    const tasks = snapshot.docs
      .map((doc) => {
        const data = doc.data() as TaskPayload;
        return {
          id: doc.id,
          title: typeof data.title === "string" ? data.title : "Tanpa Judul",
          description: typeof data.description === "string" ? data.description : "",
          surveyorId: typeof data.surveyorId === "string" ? data.surveyorId : "",
          surveyorName: typeof data.surveyorName === "string" ? data.surveyorName : "",
          surveyorEmail: typeof data.surveyorEmail === "string" ? data.surveyorEmail : "",
          status: typeof data.status === "string" ? data.status : "",
          type: typeof data.type === "string" ? data.type : "",
          kmzFileUrl: typeof data.kmzFileUrl === "string" ? data.kmzFileUrl : "",
          kmzFileUrl2: typeof data.kmzFileUrl2 === "string" ? data.kmzFileUrl2 : "",
          offlineEnabled: typeof data.offlineEnabled === "boolean" ? data.offlineEnabled : false,
          createdAt: normalizeTimestamp(data.createdAt),
          startedAt: normalizeTimestamp(data.startedAt),
        };
      })
      .sort((left, right) => {
        const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
        const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;
        return rightTime - leftTime;
      });

    return NextResponse.json({
      source: "firestore",
      tasks,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memuat tugas pra-existing dari Firestore." },
      { status: 500 }
    );
  }
}
