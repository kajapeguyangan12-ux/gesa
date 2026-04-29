import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

function createDocId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const title = normalizeString(payload.title);
    const description = normalizeString(payload.description);
    const reportType = normalizeString(payload.reportType) || "preventif";
    const reporterUid = normalizeString(payload.reporterUid);

    if (!title || !description) {
      return NextResponse.json({ error: "Judul dan deskripsi laporan wajib diisi." }, { status: 400 });
    }

    if (!reporterUid) {
      return NextResponse.json({ error: "Reporter tidak valid." }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient() as any;
    const now = new Date().toISOString();
    const reportId = createDocId("om_report");
    const reporterName = normalizeString(payload.reporterName) || "Petugas O&M";

    const reportRow = {
      fb_doc_id: reportId,
      title,
      description,
      report_type: reportType,
      location: normalizeString(payload.location) || "-",
      reporter_uid: reporterUid,
      reporter_name: reporterName,
      reporter_role: normalizeString(payload.reporterRole) || "petugas-om",
      status: "new",
      raw_payload: {
        ...payload,
        id: reportId,
        title,
        description,
        reportType,
        reporterUid,
        reporterName,
        status: "new",
        createdAt: now,
        updatedAt: now,
      },
      created_at: now,
      updated_at: now,
    };

    const { error: reportError } = await supabase.from("om_reports").insert(reportRow);
    if (reportError) throw new Error(reportError.message);

    const notificationId = createDocId("notification");
    const notificationTitle = reportType === "preventif" ? "Laporan Preventif" : "Laporan Korektif";
    const notificationRow = {
      fb_doc_id: notificationId,
      title: notificationTitle,
      message: `${reporterName} mengirim laporan O&M: ${title}`,
      category: "O&M",
      source: "om-report",
      report_id: reportId,
      target_roles: ["admin", "super-admin"],
      raw_payload: {
        id: notificationId,
        title: notificationTitle,
        message: `${reporterName} mengirim laporan O&M: ${title}`,
        category: "O&M",
        source: "om-report",
        reportId,
        targetRoles: ["admin", "super-admin"],
        createdAt: now,
      },
      created_at: now,
    };

    const { error: notificationError } = await supabase.from("app_notifications").insert(notificationRow);
    if (notificationError) throw new Error(notificationError.message);

    return NextResponse.json({ id: reportId, notificationId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal mengirim laporan O&M ke Supabase." },
      { status: 500 }
    );
  }
}
