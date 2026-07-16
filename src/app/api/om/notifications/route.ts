import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

type NotificationRow = {
  fb_doc_id: string | null;
  title: string | null;
  message: string | null;
  category: string | null;
  source: string | null;
  report_id: string | null;
  target_roles: unknown;
  raw_payload: Record<string, unknown> | null;
  created_at: string | null;
};

function normalizeOmRole(role: string) {
  if (role === "petugas-om") return "petugas-om-preventif";
  return role;
}

function extractTargetRoles(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  return [];
}

export async function GET(request: NextRequest) {
  try {
    const role = normalizeOmRole(request.nextUrl.searchParams.get("role")?.trim() || "");
    const uid = request.nextUrl.searchParams.get("uid")?.trim() || "";
    const limit = Math.min(Math.max(Number.parseInt(request.nextUrl.searchParams.get("limit") || "40", 10) || 40, 1), 100);

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("app_notifications")
      .select("fb_doc_id, title, message, category, source, report_id, target_roles, raw_payload, created_at")
      .order("created_at", { ascending: false })
      .limit(limit * 3);

    if (error) {
      throw new Error(error.message);
    }

    const rows = ((data || []) as NotificationRow[]).filter((row) => {
      const targetRoles = extractTargetRoles(row.target_roles).map(normalizeOmRole);
      const rawPayload = row.raw_payload || {};
      const targetUserUid = typeof rawPayload.targetUserUid === "string" ? rawPayload.targetUserUid : "";
      if (uid && targetUserUid && targetUserUid === uid) return true;
      if (!role) return true;
      return targetRoles.includes(role);
    });

    return NextResponse.json({
      notifications: rows.slice(0, limit).map((row) => {
        const rawPayload = row.raw_payload || {};
        return {
          id: row.fb_doc_id || "",
          title: row.title || "Notifikasi",
          message: row.message || "",
          category: row.category || "",
          source: row.source || "",
          reportId: row.report_id || "",
          createdAt: row.created_at,
          targetRoles: extractTargetRoles(row.target_roles).map(normalizeOmRole),
          targetUserUid: typeof rawPayload.targetUserUid === "string" ? rawPayload.targetUserUid : "",
        };
      }),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memuat notifikasi O&M." },
      { status: 500 }
    );
  }
}
