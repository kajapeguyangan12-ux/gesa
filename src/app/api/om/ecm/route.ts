import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

type Raw = Record<string, unknown>;

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function numberOrNull(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Number.parseFloat(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function rawOf(row: Raw) {
  return row.raw_payload && typeof row.raw_payload === "object" ? row.raw_payload as Raw : {};
}

function normalizeArea(value: unknown) {
  const area = text(value).toLowerCase();
  if (area.includes("denpasar")) return "denpasar";
  if (area.includes("tabanan")) return "tabanan";
  return area;
}

function isCommissioning(row: Raw) {
  const raw = rawOf(row);
  const stage = text(row.stage || raw.stage || raw.tahap || raw.type).toLowerCase();
  return stage.includes("commission") || stage.includes("comission");
}

function normalizePoint(row: Raw) {
  const raw = rawOf(row);
  const idTitik = text(row.id_titik || raw.idTitik || raw.id_titik);
  const group = text(row.zona || raw.group || raw.grup || raw.zona || row.source_task_id) || "Tanpa Grup";
  return {
    id: text(row.fb_doc_id) || idTitik,
    idTitik,
    group,
    namaTitik: text(row.nama_titik || raw.namaTitik) || idTitik,
    namaJalan: text(raw.namaJalan || raw.nama_jalan) || "-",
    kabupaten: text(raw.kabupaten || raw.area) || "-",
    dayaLampu: text(raw.dayaLampu || raw.daya_lampu) || "-",
    noSeriLampu1: text(raw.noSeriLampu1 || raw.no_seri_lampu_1) || "-",
    noSeriLampu2: text(raw.noSeriLampu2 || raw.no_seri_lampu_2) || "-",
    status: text(row.status || raw.status) || "valid",
    updatedAt: text(row.updated_at || raw.updatedAt || row.validated_at),
  };
}

function missingTable(error: { message?: string } | null | undefined) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("schema cache") || message.includes("does not exist") || message.includes("could not find the table");
}

function readingOf(row: Raw) {
  return {
    id: text(row.fb_doc_id),
    panelId: text(row.panel_id),
    groupId: text(row.group_id),
    sampledAt: text(row.sampled_at),
    intervalStart: text(row.interval_start),
    voltage: numberOrNull(row.voltage),
    current: numberOrNull(row.current_ampere),
    powerKw: numberOrNull(row.power_kw),
    energyKwh: numberOrNull(row.energy_kwh),
    powerFactor: numberOrNull(row.power_factor),
    frequencyHz: numberOrNull(row.frequency_hz),
    status: text(row.status) || "normal",
  };
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdminClient() as any;
    const groupId = text(request.nextUrl.searchParams.get("groupId"));
    const kabupaten = normalizeArea(request.nextUrl.searchParams.get("kabupaten"));
    const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get("limit")) || 84, 1), 500);

    const { data: constructionRows, error: constructionError } = await supabase
      .from("kontruksi_valid")
      .select("fb_doc_id, source_task_id, nama_titik, id_titik, zona, stage, status, raw_payload, updated_at, validated_at")
      .order("validated_at", { ascending: false })
      .limit(5000);
    if (constructionError) throw new Error(constructionError.message);

    const pointMap = new Map<string, ReturnType<typeof normalizePoint>>();
    ((constructionRows || []) as Raw[]).filter(isCommissioning).map(normalizePoint).forEach((point) => {
      if (!point.idTitik || pointMap.has(point.idTitik)) return;
      if (kabupaten && normalizeArea(point.kabupaten) !== kabupaten) return;
      pointMap.set(point.idTitik, point);
    });
    const points = Array.from(pointMap.values());

    const [
      { data: panelRows, error: panelError },
      { data: readingRows, error: readingError },
      { data: historyRows, error: historyError },
      { data: reportRows, error: reportError },
    ] = await Promise.all([
      supabase.from("om_ecm_panels").select("*").order("updated_at", { ascending: false }),
      supabase.from("om_ecm_readings").select("*").order("sampled_at", { ascending: false }).limit(groupId ? limit : 2000),
      supabase.from("om_asset_history").select("*").order("occurred_at", { ascending: false }).limit(groupId ? limit : 500),
      supabase.from("om_reports").select("fb_doc_id, title, description, report_type, status, reporter_name, raw_payload, created_at, updated_at").order("created_at", { ascending: false }).limit(2000),
    ]);
    for (const error of [panelError, readingError, historyError, reportError]) {
      if (error && !missingTable(error)) throw new Error(error.message);
    }
    const setupRequired = [panelError, readingError, historyError].some(Boolean);
    const panels = panelError ? [] : (panelRows || []) as Raw[];
    const readings = readingError ? [] : (readingRows || []) as Raw[];
    const histories = historyError ? [] : (historyRows || []) as Raw[];

    const groupMap = new Map<string, { id: string; name: string; points: typeof points; panel: Raw | null; latestReading: ReturnType<typeof readingOf> | null }>();
    points.forEach((point) => {
      const current = groupMap.get(point.group) || { id: point.group, name: point.group, points: [], panel: null, latestReading: null };
      current.points.push(point);
      groupMap.set(point.group, current);
    });
    panels.forEach((panel) => {
      const id = text(panel.group_id || panel.group_name) || "Tanpa Grup";
      const current = groupMap.get(id) || { id, name: text(panel.group_name) || id, points: [], panel: null, latestReading: null };
      current.panel = panel;
      current.name = text(panel.group_name) || current.name;
      groupMap.set(id, current);
    });
    readings.forEach((row) => {
      const id = text(row.group_id);
      const current = groupMap.get(id);
      if (current && !current.latestReading) current.latestReading = readingOf(row);
    });

    const groups = Array.from(groupMap.values()).map((group) => ({
      id: group.id,
      name: group.name,
      lampCount: group.points.length,
      panel: group.panel ? {
        id: text(group.panel.fb_doc_id),
        name: text(group.panel.panel_name) || `Panel ${group.name}`,
        meterSerial: text(group.panel.smart_meter_serial) || "-",
        mqttTopic: text(group.panel.mqtt_topic) || "-",
        status: text(group.panel.status) || "belum-terhubung",
      } : null,
      latestReading: group.latestReading,
    }));

    if (!groupId) {
      return NextResponse.json({
        setupRequired,
        intervalHours: 2,
        summary: {
          groups: groups.length,
          panels: groups.filter((group) => group.panel).length,
          online: groups.filter((group) => group.latestReading?.status === "normal").length,
          lamps: points.length,
        },
        groups,
      });
    }

    const group = groupMap.get(groupId);
    if (!group) return NextResponse.json({ error: "Grup APJ tidak ditemukan." }, { status: 404 });
    const panelId = text(group.panel?.fb_doc_id);
    const groupReadings = readings.filter((row) => text(row.group_id) === groupId || (panelId && text(row.panel_id) === panelId)).map(readingOf).slice(0, limit);
    const groupHistory = histories.filter((row) => text(row.group_id) === groupId).map((row) => ({
      id: text(row.fb_doc_id),
      assetType: text(row.asset_type),
      assetId: text(row.asset_id),
      eventType: text(row.event_type),
      description: text(row.description),
      occurredAt: text(row.occurred_at),
      source: text(row.source),
    }));
    const pointIds = new Set(group.points.map((point) => point.idTitik));
    const reportHistory = ((reportRows || []) as Raw[]).flatMap((row) => {
      const raw = rawOf(row);
      const pointId = text(raw.idTitik || raw.id_titik);
      const reportGroup = text(raw.groupName || raw.groupId || raw.group || raw.grup);
      if ((!pointId || !pointIds.has(pointId)) && reportGroup !== groupId) return [];
      const reportType = text(row.report_type || raw.reportType).toLowerCase();
      const workType = reportType === "korektif" ? "Korektif" : reportType === "preventif" ? "Preventif" : "Aktivitas O&M";
      return [{
        id: text(row.fb_doc_id),
        assetType: "lampu",
        assetId: pointId || groupId,
        eventType: `${workType} · ${text(row.title) || "Pekerjaan titik APJ"}`,
        description: `${text(row.description) || "Laporan pekerjaan"} · Petugas: ${text(row.reporter_name || raw.reporterName) || "-"} · Status: ${text(row.status) || "baru"}`,
        occurredAt: text(row.updated_at || row.created_at),
        source: workType,
      }];
    });

    return NextResponse.json({
      setupRequired,
      intervalHours: 2,
      group: groups.find((item) => item.id === groupId),
      points: group.points,
      readings: groupReadings,
      history: [...groupHistory, ...reportHistory],
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal memuat ECM O&M." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const configuredKey = text(process.env.ECM_MQTT_INGEST_KEY);
    if (configuredKey && request.headers.get("x-ecm-ingest-key") !== configuredKey) {
      return NextResponse.json({ error: "Kunci ingest smart meter tidak valid." }, { status: 401 });
    }
    const payload = await request.json() as Raw;
    const groupId = text(payload.groupId || payload.group_id);
    const panelId = text(payload.panelId || payload.panel_id) || `panel_${groupId.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
    const meterSerial = text(payload.smartMeterSerial || payload.meterSerial || payload.meter_serial);
    if (!groupId) return NextResponse.json({ error: "groupId wajib diisi." }, { status: 400 });

    const supabase = getSupabaseAdminClient() as any;
    if (text(payload.action) === "register-panel" && text(payload.actorRole) === "admin") {
      const actorKabupaten = normalizeArea(payload.actorKabupaten);
      const { data: groupRows, error: groupError } = await supabase
        .from("kontruksi_valid")
        .select("raw_payload")
        .eq("zona", groupId)
        .limit(20);
      if (groupError) throw new Error(groupError.message);
      const groupAreas = new Set((Array.isArray(groupRows) ? groupRows as Raw[] : []).map((row) => normalizeArea(rawOf(row).kabupaten || rawOf(row).area)).filter(Boolean));
      if (!actorKabupaten || groupAreas.size === 0 || Array.from(groupAreas).some((item) => item !== actorKabupaten)) {
        return NextResponse.json({ error: "Admin hanya dapat mengelola panel dari wilayah akunnya." }, { status: 403 });
      }
    }
    const now = new Date().toISOString();
    const { error: panelError } = await supabase.from("om_ecm_panels").upsert({
      fb_doc_id: panelId,
      group_id: groupId,
      group_name: text(payload.groupName) || groupId,
      panel_name: text(payload.panelName) || `Panel ${groupId}`,
      smart_meter_serial: meterSerial || null,
      mqtt_topic: text(payload.mqttTopic) || null,
      status: text(payload.status) || "online",
      raw_payload: payload,
      updated_at: now,
    }, { onConflict: "group_id" });
    if (panelError) throw new Error(panelError.message);

    if (text(payload.action) === "register-panel") {
      const historyId = `panel_history_${panelId}_${Date.now()}`;
      const { error: historyError } = await supabase.from("om_asset_history").insert({
        fb_doc_id: historyId,
        group_id: groupId,
        asset_type: "panel",
        asset_id: panelId,
        event_type: "Konfigurasi panel diperbarui",
        description: `${text(payload.panelName) || `Panel ${groupId}`} · Smart meter ${meterSerial || "belum diisi"}`,
        source: "Admin O&M",
        raw_payload: payload,
        occurred_at: now,
      });
      if (historyError) throw new Error(historyError.message);
      return NextResponse.json({ message: "Panel dan smart meter grup berhasil disimpan.", panelId });
    }

    const sampledDate = new Date(text(payload.sampledAt || payload.timestamp) || now);
    if (Number.isNaN(sampledDate.getTime())) return NextResponse.json({ error: "Waktu pembacaan tidak valid." }, { status: 400 });
    const twoHours = 2 * 60 * 60 * 1000;
    const intervalStart = new Date(Math.floor(sampledDate.getTime() / twoHours) * twoHours).toISOString();
    const readingId = `ecm_${panelId}_${intervalStart.replace(/[^0-9]/g, "")}`;
    const { error: readingError } = await supabase.from("om_ecm_readings").upsert({
      fb_doc_id: readingId,
      panel_id: panelId,
      group_id: groupId,
      sampled_at: sampledDate.toISOString(),
      interval_start: intervalStart,
      voltage: numberOrNull(payload.voltage),
      current_ampere: numberOrNull(payload.current || payload.currentAmpere),
      power_kw: numberOrNull(payload.powerKw || payload.power_kw),
      energy_kwh: numberOrNull(payload.energyKwh || payload.energy_kwh),
      power_factor: numberOrNull(payload.powerFactor || payload.power_factor),
      frequency_hz: numberOrNull(payload.frequencyHz || payload.frequency_hz),
      status: text(payload.readingStatus || payload.status) || "normal",
      raw_payload: payload,
      updated_at: now,
    }, { onConflict: "panel_id,interval_start" });
    if (readingError) throw new Error(readingError.message);
    return NextResponse.json({ message: "Pembacaan smart meter tersimpan.", panelId, intervalStart, readingId });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal menyimpan pembacaan smart meter." }, { status: 500 });
  }
}
