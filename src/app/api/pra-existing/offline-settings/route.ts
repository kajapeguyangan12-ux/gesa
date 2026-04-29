import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import {
  DEFAULT_PRA_EXISTING_OFFLINE_SETTINGS,
  PRA_EXISTING_OFFLINE_SETTINGS_KEY,
  type PraExistingOfflineSettings,
} from "@/utils/praExistingOfflineSettings";

interface AppSettingRow {
  key: string | null;
  value: Record<string, unknown> | null;
}

interface AppSettingUpsertRow {
  key: string;
  value: PraExistingOfflineSettings;
  updated_at: string;
}

async function upsertAppSetting(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  row: AppSettingUpsertRow
) {
  const appSettingsTable = supabase.from("app_settings") as unknown as {
    upsert: (
      values: AppSettingUpsertRow | AppSettingUpsertRow[],
      options?: { onConflict?: string }
    ) => Promise<{ error: { message: string } | null }>;
  };

  return appSettingsTable.upsert(row, { onConflict: "key" });
}

function normalizePraExistingOfflineSettings(
  value: Record<string, unknown> | null | undefined
): PraExistingOfflineSettings {
  return {
    globalEnabled:
      typeof value?.globalEnabled === "boolean"
        ? value.globalEnabled
        : DEFAULT_PRA_EXISTING_OFFLINE_SETTINGS.globalEnabled,
  };
}

export async function GET() {
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("app_settings")
      .select("key, value")
      .eq("key", PRA_EXISTING_OFFLINE_SETTINGS_KEY)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    const row = data as AppSettingRow | null;
    return NextResponse.json({
      source: "supabase",
      settings: normalizePraExistingOfflineSettings(row?.value),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Gagal memuat pengaturan offline pra-existing dari Supabase.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = (await request.json()) as { globalEnabled?: unknown };
    const settings = normalizePraExistingOfflineSettings(payload as Record<string, unknown>);
    const supabase = getSupabaseAdminClient();
    const now = new Date().toISOString();

    const { error } = await upsertAppSetting(supabase, {
      key: PRA_EXISTING_OFFLINE_SETTINGS_KEY,
      value: settings,
      updated_at: now,
    });

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      ok: true,
      source: "supabase",
      settings,
      updatedAt: now,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Gagal menyimpan pengaturan offline pra-existing ke Supabase.",
      },
      { status: 500 }
    );
  }
}
