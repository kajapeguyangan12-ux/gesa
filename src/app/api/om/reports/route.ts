import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { isValidNotificationEmail, sendReportProgressEmail } from "@/lib/reportProgressEmail";

function createDocId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeLux(value: unknown) {
  const match = normalizeString(value).replace(",", ".").match(/-?\d+(?:\.\d+)?/)?.[0];
  if (!match) return null;
  const parsed = Number.parseFloat(match);
  return Number.isFinite(parsed) ? parsed : null;
}

function getRawPayload(record: Record<string, unknown> | null | undefined) {
  return record?.raw_payload && typeof record.raw_payload === "object"
    ? record.raw_payload as Record<string, unknown>
    : {};
}

async function resolvePointLuxPresets(supabase: any, pointId: string) {
  if (!pointId) return { initialLux: null, limitLux: null };

  const { data: constructionRows, error: constructionError } = await supabase
    .from("kontruksi_valid")
    .select("raw_payload, stage, validated_at")
    .eq("id_titik", pointId)
    .order("validated_at", { ascending: false })
    .limit(20);
  if (constructionError) throw new Error(constructionError.message);

  const constructionRecord = (Array.isArray(constructionRows) ? constructionRows : []).find((row: Record<string, unknown>) => {
    const raw = getRawPayload(row);
    const stage = normalizeString(row.stage || raw.stage || raw.tahap || raw.type).toLowerCase();
    return stage.includes("comission") || stage.includes("commission");
  }) as Record<string, unknown> | undefined;

  let raw = getRawPayload(constructionRecord);
  if (!constructionRecord) {
    const { data: surveyRows, error: surveyError } = await supabase
      .from("survey_apj_propose")
      .select("raw_payload, created_at")
      .eq("id_titik", pointId)
      .order("created_at", { ascending: false })
      .limit(1);
    if (surveyError) throw new Error(surveyError.message);
    raw = getRawPayload(Array.isArray(surveyRows) ? surveyRows[0] as Record<string, unknown> | undefined : undefined);
  }

  return {
    initialLux: normalizeLux(raw.presetIluminasiAwal ?? raw.preset_iluminasi_awal),
    limitLux: normalizeLux(raw.presetIluminasiBatas ?? raw.preset_iluminasi_batas),
  };
}

const OM_REPORT_STATUSES = new Set(["new", "diproses", "selesai", "ditolak"]);
const OM_STATUS_LABELS: Record<string, string> = {
  new: "Baru",
  diproses: "Diproses",
  selesai: "Selesai",
  ditolak: "Ditolak",
};

function inferOmMaterialCategory(payload: Record<string, unknown>) {
  const text = [
    normalizeString(payload.damageType),
    normalizeString(payload.repairAction),
    normalizeString(payload.description),
    normalizeString(payload.title),
  ].join(" ").toLowerCase();

  if (text.includes("kabel")) return "KABEL";
  if (text.includes("tiang")) return "TIANG";
  if (text.includes("arm")) return "ARM";
  if (text.includes("panel")) return "KABEL";
  if (text.includes("lampu") || text.includes("padam")) return "LAMPU";
  return "";
}

async function createOmMaterialRequestIfNeeded(
  supabase: any,
  reportId: string,
  reportPayload: Record<string, unknown>,
  now: string
) {
  const category = inferOmMaterialCategory(reportPayload);
  if (!category) return;

  const { data: existingRows, error: existingError } = await supabase
    .from("gudang_material_requests")
    .select("fb_doc_id")
    .eq("source_report_id", reportId)
    .limit(1);
  if (existingError) throw new Error(existingError.message);
  if (Array.isArray(existingRows) && existingRows.length > 0) return;

  const { data: materialRows, error: materialError } = await supabase
    .from("mst_gudang_material")
    .select("fb_doc_id, nama_barang, lokasi_gudang")
    .eq("kategori", category)
    .order("stok_tersedia", { ascending: false })
    .limit(1);
  if (materialError) throw new Error(materialError.message);

  const material = (Array.isArray(materialRows) ? materialRows[0] : null) as Record<string, unknown> | null;
  if (!material) return;

  const reporterUid = normalizeString(reportPayload.reporterUid);
  const reporterName = normalizeString(reportPayload.reporterName) || "Petugas O&M";
  const reportType = normalizeString(reportPayload.reportType) || "preventif";
  const requestId = createDocId("gudang_request");
  const requestNote = `Kebutuhan otomatis dari laporan O&M ${reportId}: ${normalizeString(reportPayload.damageType) || normalizeString(reportPayload.title) || category}`;

  const { error: insertError } = await supabase.from("gudang_material_requests").insert({
    fb_doc_id: requestId,
    material_id: normalizeString(material.fb_doc_id),
    material_name: normalizeString(material.nama_barang) || category,
    quantity: 1,
    request_type: "Pengajuan Barang",
    requester_id: reporterUid || "om-system",
    requester_name: reporterName,
    note: requestNote,
    status: "Diajukan",
    location_hint: normalizeString(material.lokasi_gudang) || normalizeString(reportPayload.location) || "-",
    source_report_id: reportId,
    raw_payload: {
      id: requestId,
      materialId: normalizeString(material.fb_doc_id),
      materialName: normalizeString(material.nama_barang) || category,
      quantity: 1,
      requestType: "Pengajuan Barang",
      requesterId: reporterUid || "om-system",
      requesterName: reporterName,
      note: requestNote,
      status: "Diajukan",
      locationHint: normalizeString(material.lokasi_gudang) || normalizeString(reportPayload.location) || "-",
      sourceReportId: reportId,
      sourceModule: "O&M",
      workType: reportType === "korektif" ? "om-corrective" : "om-preventive",
      allowedCategories: reportType === "korektif" ? ["TIANG", "LAMPU", "ARM", "KABEL"] : ["LAMPU", "ARM", "KABEL"],
      auditTrail: [
        {
          status: "Diajukan",
          actorId: reporterUid || "om-system",
          actorName: reporterName,
          note: requestNote,
          at: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    },
    created_at: now,
    updated_at: now,
  });
  if (insertError) throw new Error(insertError.message);
}

type OMReportRow = {
  fb_doc_id: string | null;
  title: string | null;
  description: string | null;
  report_type: string | null;
  location: string | null;
  reporter_uid: string | null;
  reporter_name: string | null;
  reporter_role: string | null;
  status: string | null;
  raw_payload: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
};

export async function GET(request: NextRequest) {
  try {
    const limitParam = Number.parseInt(request.nextUrl.searchParams.get("limit") || "100", 10);
    const status = normalizeString(request.nextUrl.searchParams.get("status"));
    const reportType = normalizeString(request.nextUrl.searchParams.get("reportType"));
    const kabupaten = normalizeString(request.nextUrl.searchParams.get("kabupaten")).toLowerCase();
    const safeLimit = Number.isFinite(limitParam) ? Math.max(1, Math.min(limitParam, 500)) : 100;
    const supabase = getSupabaseAdminClient();

    let query = supabase
      .from("om_reports")
      .select("fb_doc_id, title, description, report_type, location, reporter_uid, reporter_name, reporter_role, status, raw_payload, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(safeLimit);

    if (status) query = query.eq("status", status);
    if (reportType) query = query.eq("report_type", reportType);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const rows = (data || []) as OMReportRow[];
    const areaByPoint = new Map<string, string>();
    if (kabupaten) {
      const pointIds = Array.from(new Set(rows.map((row) => normalizeString(row.raw_payload?.idTitik || row.raw_payload?.id_titik)).filter(Boolean)));
      if (pointIds.length > 0) {
        const { data: pointRows, error: pointError } = await supabase
          .from("kontruksi_valid")
          .select("id_titik, raw_payload")
          .in("id_titik", pointIds)
          .limit(5000);
        if (pointError) throw new Error(pointError.message);
        for (const pointRow of Array.isArray(pointRows) ? pointRows as Record<string, unknown>[] : []) {
          const raw = pointRow.raw_payload && typeof pointRow.raw_payload === "object" ? pointRow.raw_payload as Record<string, unknown> : {};
          const pointId = normalizeString(pointRow.id_titik);
          const pointArea = normalizeString(raw.kabupaten || raw.area).toLowerCase();
          if (pointId && pointArea && !areaByPoint.has(pointId)) areaByPoint.set(pointId, pointArea);
        }
      }
    }
    const reports = rows.map((row) => ({
      ...(row.raw_payload || {}),
      id: row.fb_doc_id || "",
      title: row.title || "",
      description: row.description || "",
      reportType: row.report_type || "",
      location: row.location || "-",
      reporterUid: row.reporter_uid || "",
      reporterName: row.reporter_name || "",
      reporterRole: row.reporter_role || "",
      status: row.status || "new",
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      kabupaten: normalizeString(row.raw_payload?.kabupaten || row.raw_payload?.reporterKabupaten).toLowerCase()
        || areaByPoint.get(normalizeString(row.raw_payload?.idTitik || row.raw_payload?.id_titik))
        || "",
    })).filter((report) => !kabupaten || report.kabupaten === kabupaten);

    return NextResponse.json({
      reports,
      summary: {
        total: reports.length,
        new: reports.filter((report) => report.status === "new").length,
        diproses: reports.filter((report) => report.status === "diproses").length,
        selesai: reports.filter((report) => report.status === "selesai").length,
        ditolak: reports.filter((report) => report.status === "ditolak").length,
        processed: reports.filter((report) => !["", "new"].includes(report.status)).length,
        preventif: reports.filter((report) => report.reportType === "preventif").length,
        korektif: reports.filter((report) => report.reportType === "korektif").length,
        masyarakat: reports.filter((report) => report.reportType === "masyarakat").length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memuat laporan O&M dari Supabase." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const title = normalizeString(payload.title);
    const description = normalizeString(payload.description);
    const reportType = normalizeString(payload.reportType) || "preventif";
    const reporterUid = normalizeString(payload.reporterUid);
    const reporterEmail = normalizeString(payload.reporterEmail).toLowerCase();
    const reporterKabupaten = normalizeString(payload.reporterKabupaten || payload.kabupaten).toLowerCase();

    if (!title || !description) {
      return NextResponse.json({ error: "Judul dan deskripsi laporan wajib diisi." }, { status: 400 });
    }

    if (!reporterUid) {
      return NextResponse.json({ error: "Reporter tidak valid." }, { status: 400 });
    }
    if (reportType === "masyarakat" && !isValidNotificationEmail(reporterEmail)) {
      return NextResponse.json({ error: "Email notifikasi masyarakat wajib diisi dengan format yang valid." }, { status: 400 });
    }
    const supabase = getSupabaseAdminClient() as any;
    const pointId = normalizeString(payload.idTitik);
    if (pointId && reporterKabupaten && reportType !== "masyarakat") {
      const { data: pointRows, error: pointError } = await supabase
        .from("kontruksi_valid")
        .select("raw_payload")
        .eq("id_titik", pointId)
        .order("validated_at", { ascending: false })
        .limit(1);
      if (pointError) throw new Error(pointError.message);
      const pointRaw = Array.isArray(pointRows) && pointRows[0]?.raw_payload && typeof pointRows[0].raw_payload === "object"
        ? pointRows[0].raw_payload as Record<string, unknown>
        : {};
      const pointKabupaten = normalizeString(pointRaw.kabupaten || pointRaw.area).toLowerCase();
      if (pointKabupaten && pointKabupaten !== reporterKabupaten) {
        return NextResponse.json({ error: `Titik APJ berada di ${pointKabupaten}, sedangkan petugas berasal dari ${reporterKabupaten}.` }, { status: 403 });
      }
    }
    if (reportType === "preventif" && normalizeString(payload.formVariant) === "preventive-task") {
      const initialLux = normalizeLux(payload.luxTitikApi);
      const pointPresets = await resolvePointLuxPresets(supabase, normalizeString(payload.idTitik));
      const standardLux = pointPresets.initialLux;
      const lowerLimitLux = pointPresets.limitLux;
      payload.standardLux = standardLux;
      payload.lowerLimitLux = lowerLimitLux;
      const afterLux = normalizeLux(payload.luxAfterAdjustment);
      const adjustment = normalizeString(payload.adjustmentAction);
      if (initialLux !== null && lowerLimitLux !== null && initialLux < lowerLimitLux) {
        if (adjustment !== "penaikan" || afterLux === null || !normalizeString(payload.luxAfterPhotoUrl)) {
          return NextResponse.json({ error: `Lux awal di bawah batas preset titik APJ (${lowerLimitLux} lux). Penaikan, lux sesudah, dan foto bukti wajib diisi.` }, { status: 400 });
        }
        if (afterLux < lowerLimitLux) {
          return NextResponse.json({ error: `Lux sesudah penaikan masih di bawah batas preset titik APJ (${lowerLimitLux} lux).` }, { status: 400 });
        }
      }
    }

    const now = new Date().toISOString();
    const reportId = createDocId("om_report");
    const reporterName = normalizeString(payload.reporterName) || "Petugas O&M";
    const initialTimeline = [
      {
        status: "new",
        actorId: reporterUid,
        actorName: reporterName,
        note: "Laporan dibuat dan menunggu tindak lanjut admin.",
        at: now,
      },
    ];

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
        reporterEmail,
        kabupaten: reporterKabupaten,
        reporterKabupaten,
        notificationEmail: reporterEmail,
        emailNotificationsEnabled: reportType === "masyarakat",
        status: "new",
        statusTimeline: initialTimeline,
        createdAt: now,
        updatedAt: now,
      },
      created_at: now,
      updated_at: now,
    };

    const { error: reportError } = await supabase.from("om_reports").insert(reportRow);
    if (reportError) throw new Error(reportError.message);

    const notificationTitle =
      reportType === "masyarakat" ? "Laporan Masyarakat" : reportType === "preventif" ? "Laporan Preventif" : "Laporan Korektif";
    const adminNotificationId = createDocId("notification");
    const reporterNotificationId = createDocId("notification");
    const reporterRole = normalizeString(payload.reporterRole) || "petugas-om";
    const notificationRows = [
      {
        fb_doc_id: adminNotificationId,
        title: notificationTitle,
        message: `${reporterName} mengirim laporan O&M: ${title}`,
        category: "O&M",
        source: "om-report",
        report_id: reportId,
        target_roles: ["admin", "super-admin"],
        raw_payload: {
          id: adminNotificationId,
          title: notificationTitle,
          message: `${reporterName} mengirim laporan O&M: ${title}`,
          category: "O&M",
          source: "om-report",
          reportId,
          targetRoles: ["admin", "super-admin"],
          createdAt: now,
        },
        created_at: now,
      },
      {
        fb_doc_id: reporterNotificationId,
        title: "Laporan Berhasil Dikirim",
        message: `Laporan "${title}" sudah masuk ke sistem dan menunggu tindak lanjut admin.`,
        category: "O&M",
        source: "om-report-self",
        report_id: reportId,
        target_roles: [reporterRole],
        raw_payload: {
          id: reporterNotificationId,
          title: "Laporan Berhasil Dikirim",
          message: `Laporan "${title}" sudah masuk ke sistem dan menunggu tindak lanjut admin.`,
          category: "O&M",
          source: "om-report-self",
          reportId,
          targetRoles: [reporterRole],
          targetUserUid: reporterUid,
          createdAt: now,
        },
        created_at: now,
      },
    ];

    const { error: notificationError } = await supabase.from("app_notifications").insert(notificationRows);
    if (notificationError) throw new Error(notificationError.message);

    return NextResponse.json({ id: reportId, notificationId: adminNotificationId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal mengirim laporan O&M ke Supabase." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const reportId = normalizeString(payload.id);
    const nextStatus = normalizeString(payload.status);
    if (!reportId || !OM_REPORT_STATUSES.has(nextStatus)) {
      return NextResponse.json({ error: "ID laporan dan status valid wajib diisi." }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient() as any;
    const { data, error } = await supabase
      .from("om_reports")
      .select("fb_doc_id, title, reporter_uid, reporter_role, raw_payload")
      .eq("fb_doc_id", reportId)
      .limit(1);
    if (error) throw new Error(error.message);

    const row = Array.isArray(data) ? data[0] : null;
    if (!row) {
      return NextResponse.json({ error: "Laporan O&M tidak ditemukan." }, { status: 404 });
    }

    const now = new Date().toISOString();
    const rawPayload = ((row.raw_payload as Record<string, unknown> | null) || {});
    const actorRole = normalizeString(payload.actorRole);
    const actorKabupaten = normalizeString(payload.actorKabupaten).toLowerCase();
    let reportKabupaten = normalizeString(rawPayload.kabupaten || rawPayload.reporterKabupaten).toLowerCase();
    if (!reportKabupaten && normalizeString(rawPayload.idTitik)) {
      const { data: reportPointRows } = await supabase
        .from("kontruksi_valid")
        .select("raw_payload")
        .eq("id_titik", normalizeString(rawPayload.idTitik))
        .order("validated_at", { ascending: false })
        .limit(1);
      const reportPointRaw = Array.isArray(reportPointRows) && reportPointRows[0]?.raw_payload && typeof reportPointRows[0].raw_payload === "object"
        ? reportPointRows[0].raw_payload as Record<string, unknown>
        : {};
      reportKabupaten = normalizeString(reportPointRaw.kabupaten || reportPointRaw.area).toLowerCase();
    }
    if (actorRole === "admin" && (!actorKabupaten || reportKabupaten !== actorKabupaten)) {
      return NextResponse.json({ error: "Admin hanya dapat memproses laporan dari wilayah akunnya." }, { status: 403 });
    }
    const statusTimeline = Array.isArray(rawPayload.statusTimeline) ? rawPayload.statusTimeline : [];
    const actorId = normalizeString(payload.actorId);
    const actorName = normalizeString(payload.actorName) || "Admin O&M";
    const note = normalizeString(payload.note) || `Status laporan diubah menjadi ${nextStatus}.`;
    const reportTitle = normalizeString(row.title) || normalizeString(rawPayload.title) || "Laporan O&M";
    const reporterUid = normalizeString(row.reporter_uid) || normalizeString(rawPayload.reporterUid);
    const reporterRole = normalizeString(row.reporter_role) || normalizeString(rawPayload.reporterRole) || "petugas-om";
    const nextRawPayload = {
      ...rawPayload,
      status: nextStatus,
      statusTimeline: [
        ...statusTimeline,
        {
          status: nextStatus,
          actorId,
          actorName,
          note,
          at: now,
        },
      ],
      lastStatusActorId: actorId,
      lastStatusActorName: actorName,
      lastStatusNote: note,
      lastStatusAt: now,
      updatedAt: now,
    };

    const { error: updateError } = await supabase
      .from("om_reports")
      .update({
        status: nextStatus,
        raw_payload: nextRawPayload,
        updated_at: now,
      })
      .eq("fb_doc_id", reportId);
    if (updateError) throw new Error(updateError.message);

    if (nextStatus === "diproses") {
      await createOmMaterialRequestIfNeeded(supabase, reportId, nextRawPayload, now);
    }

    if (reporterUid) {
      const notificationId = createDocId("notification");
      const notificationTitle = `Status laporan ${OM_STATUS_LABELS[nextStatus] || nextStatus}`;
      const notificationMessage = `Laporan "${reportTitle}" sekarang berstatus ${OM_STATUS_LABELS[nextStatus] || nextStatus}.`;
      const { error: notificationError } = await supabase.from("app_notifications").insert({
        fb_doc_id: notificationId,
        title: notificationTitle,
        message: notificationMessage,
        category: "O&M",
        source: "om-report-status",
        report_id: reportId,
        target_roles: [reporterRole],
        raw_payload: {
          id: notificationId,
          title: notificationTitle,
          message: notificationMessage,
          category: "O&M",
          source: "om-report-status",
          reportId,
          status: nextStatus,
          targetRoles: [reporterRole],
          targetUserUid: reporterUid,
          actorId,
          actorName,
          note,
          createdAt: now,
        },
        created_at: now,
      });
      if (notificationError) throw new Error(notificationError.message);
    }

    const reporterEmail = normalizeString(rawPayload.notificationEmail) || normalizeString(rawPayload.reporterEmail);
    const emailResult = reporterEmail
      ? await sendReportProgressEmail({
          to: reporterEmail,
          reporterName: normalizeString(rawPayload.reporterName) || "Pelapor",
          reportId,
          reportTitle,
          statusLabel: OM_STATUS_LABELS[nextStatus] || nextStatus,
          note,
        })
      : { sent: false as const, reason: "email_not_provided" as const };

    return NextResponse.json({ ok: true, status: nextStatus, emailNotification: emailResult });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal mengubah status laporan O&M." },
      { status: 500 }
    );
  }
}
