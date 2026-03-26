import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export const PRA_EXISTING_OFFLINE_SETTINGS_COLLECTION = "app_settings";
export const PRA_EXISTING_OFFLINE_SETTINGS_DOC = "pra_existing_offline";

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

export async function getPraExistingOfflineSettings(): Promise<PraExistingOfflineSettings> {
  const settingsRef = doc(
    db,
    PRA_EXISTING_OFFLINE_SETTINGS_COLLECTION,
    PRA_EXISTING_OFFLINE_SETTINGS_DOC
  );
  const snapshot = await getDoc(settingsRef);

  if (!snapshot.exists()) {
    return DEFAULT_PRA_EXISTING_OFFLINE_SETTINGS;
  }

  const data = snapshot.data() as { globalEnabled?: unknown };
  return {
    globalEnabled:
      typeof data.globalEnabled === "boolean"
        ? data.globalEnabled
        : DEFAULT_PRA_EXISTING_OFFLINE_SETTINGS.globalEnabled,
  };
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
