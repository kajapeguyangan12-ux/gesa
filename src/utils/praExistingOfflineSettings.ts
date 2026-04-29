export const PRA_EXISTING_OFFLINE_SETTINGS_KEY = "pra_existing_offline";

export interface PraExistingOfflineSettings {
  globalEnabled: boolean;
}

export interface PraExistingOfflineTaskLike {
  type?: string;
  offlineEnabled?: boolean | null;
}

export const DEFAULT_PRA_EXISTING_OFFLINE_SETTINGS: PraExistingOfflineSettings = {
  globalEnabled: true,
};

function normalizePraExistingOfflineSettings(data: { globalEnabled?: unknown } | null | undefined): PraExistingOfflineSettings {
  return {
    globalEnabled:
      typeof data?.globalEnabled === "boolean"
        ? data.globalEnabled
        : DEFAULT_PRA_EXISTING_OFFLINE_SETTINGS.globalEnabled,
  };
}

export async function getPraExistingOfflineSettings(): Promise<PraExistingOfflineSettings> {
  try {
    const response = await fetch("/api/pra-existing/offline-settings", {
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error("Gagal memuat pengaturan offline pra-existing dari Supabase.");
    }
    const payload = (await response.json()) as { settings?: { globalEnabled?: unknown } | null };
    return normalizePraExistingOfflineSettings(payload.settings);
  } catch (error) {
    console.error("Error loading pra-existing offline settings:", error);
    return DEFAULT_PRA_EXISTING_OFFLINE_SETTINGS;
  }
}

export async function updatePraExistingOfflineSettings(
  settings: PraExistingOfflineSettings
): Promise<PraExistingOfflineSettings> {
  const response = await fetch("/api/pra-existing/offline-settings", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(settings),
  });

  if (!response.ok) {
    throw new Error("Gagal menyimpan pengaturan offline pra-existing ke Supabase.");
  }

  const payload = (await response.json()) as { settings?: { globalEnabled?: unknown } | null };
  return normalizePraExistingOfflineSettings(payload.settings);
}

export function isPraExistingTaskOfflineEnabled(
  settings: PraExistingOfflineSettings,
  task: PraExistingOfflineTaskLike | null | undefined
): boolean {
  if (!settings.globalEnabled) {
    return false;
  }

  if (!task || task.type !== "pra-existing") {
    return false;
  }

  return task.offlineEnabled !== false;
}
