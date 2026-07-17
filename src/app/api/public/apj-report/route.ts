import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { isValidNotificationEmail } from "@/lib/reportProgressEmail";

function createDocId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function pointExists(supabase: any, idTitik: string) {
  const { data: constructionRows, error: constructionError } = await supabase
    .from("kontruksi_valid")
    .select("fb_doc_id, stage, raw_payload")
    .eq("id_titik", idTitik)
    .limit(20);
  if (constructionError) throw new Error(constructionError.message);

  const hasCommissioning = ((constructionRows || []) as Record<string, unknown>[]).some((row) => {
    const raw = row.raw_payload && typeof row.raw_payload === "object" ? (row.raw_payload as Record<string, unknown>) : {};
    const stage = String(row.stage || raw.stage || raw.tahap || "").toLowerCase();
    return stage.includes("comission") || stage.includes("commission");
  });
  if (hasCommissioning) return true;

  const { data: surveyRows, error: surveyError } = await supabase
    .from("survey_apj_propose")
    .select("fb_doc_id")
    .eq("id_titik", idTitik)
    .limit(1);
  if (surveyError) throw new Error(surveyError.message);
  return Array.isArray(surveyRows) && surveyRows.length > 0;
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const idTitik = normalizeString(payload.idTitik);
    const reporterName = normalizeString(payload.reporterName);
    const reporterEmail = normalizeString(payload.reporterEmail).toLowerCase();
    const phoneNumber = normalizeString(payload.phoneNumber);
    const damageType = normalizeString(payload.damageType);
    const description = normalizeString(payload.description);

    if (!idTitik || !reporterName || !reporterEmail || !phoneNumber || !damageType || !description) {
      return NextResponse.json({ error: "ID titik, nama, email, no HP, jenis kerusakan, dan deskripsi wajib diisi." }, { status: 400 });
    }
    if (!isValidNotificationEmail(reporterEmail)) {
      return NextResponse.json({ error: "Format email notifikasi tidak valid." }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient() as any;
    const exists = await pointExists(supabase, idTitik);
    if (!exists) return NextResponse.json({ error: "ID titik APJ tidak terdaftar di sistem." }, { status: 404 });

    const now = new Date().toISOString();
    const reportId = createDocId("public_apj_report");
    const title = `${damageType} - ${idTitik}`;
    const reporterUid = `public-qr-${phoneNumber.replace(/\D/g, "").slice(-8) || "anonymous"}`;
    const rawPayload = {
      ...payload,
      id: reportId,
      title,
      idTitik,
      location: idTitik,
      reportType: "masyarakat",
      reporterUid,
      reporterName,
      reporterEmail,
      notificationEmail: reporterEmail,
      emailNotificationsEnabled: true,
      reporterRole: "masyarakat-qr",
      phoneNumber,
      damageType,
      description,
      status: "new",
      source: "qr-apj",
      statusTimeline: [
        {
          status: "new",
          actorId: reporterUid,
          actorName: reporterName,
          note: "Laporan masyarakat dibuat dari scan QR titik APJ.",
          at: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    const { error: reportError } = await supabase.from("om_reports").insert({
      fb_doc_id: reportId,
      title,
      description,
      report_type: "masyarakat",
      location: idTitik,
      reporter_uid: reporterUid,
      reporter_name: reporterName,
      reporter_role: "masyarakat-qr",
      status: "new",
      raw_payload: rawPayload,
      created_at: now,
      updated_at: now,
    });
    if (reportError) throw new Error(reportError.message);

    const notificationId = createDocId("notification");
    const { error: notificationError } = await supabase.from("app_notifications").insert({
      fb_doc_id: notificationId,
      title: "Laporan Masyarakat dari QR APJ",
      message: `${reporterName} melapor ${damageType} pada ${idTitik}.`,
      category: "O&M",
      source: "public-qr-apj",
      report_id: reportId,
      target_roles: ["admin", "super-admin", "petugas-om", "petugas-om-preventif", "petugas-om-correctif"],
      raw_payload: {
        id: notificationId,
        title: "Laporan Masyarakat dari QR APJ",
        message: `${reporterName} melapor ${damageType} pada ${idTitik}.`,
        category: "O&M",
        source: "public-qr-apj",
        reportId,
        createdAt: now,
      },
      created_at: now,
    });
    if (notificationError) throw new Error(notificationError.message);

    return NextResponse.json({ id: reportId });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal mengirim laporan publik APJ." }, { status: 500 });
  }
}
