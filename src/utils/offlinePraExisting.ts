import type { ParsedTaskGeometries } from "@/utils/taskNavigation";

const DB_NAME = "gesa-pra-existing-offline";
const DB_VERSION = 1;
const TASK_PACKAGE_STORE = "task_packages";
const SURVEY_QUEUE_STORE = "survey_queue";

export interface OfflineTaskPackage {
  taskId: string;
  task: {
    id: string;
    title?: string;
    description?: string;
    type?: string;
    status?: string;
    surveyorId?: string;
    kmzFileUrl?: string;
    kmzFileUrl2?: string;
    offlineEnabled?: boolean;
  };
  geometries: ParsedTaskGeometries;
  savedAt: number;
  basemapReady: boolean;
  basemapPreparedAt?: number | null;
  offlineAllowed?: boolean;
  globalOfflineEnabled?: boolean;
}

export interface PendingPraExistingSurveyRecord {
  id: string;
  taskId: string;
  createdAtLocal: number;
  payload: Record<string, unknown>;
  photoBlob: Blob;
  photoName: string;
  photoType: string;
  syncStatus: "pending" | "syncing" | "failed";
  attempts: number;
  lastError?: string;
}

function openOfflineDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(TASK_PACKAGE_STORE)) {
        db.createObjectStore(TASK_PACKAGE_STORE, { keyPath: "taskId" });
      }

      if (!db.objectStoreNames.contains(SURVEY_QUEUE_STORE)) {
        const store = db.createObjectStore(SURVEY_QUEUE_STORE, { keyPath: "id" });
        store.createIndex("createdAtLocal", "createdAtLocal", { unique: false });
        store.createIndex("taskId", "taskId", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Gagal membuka IndexedDB."));
  });
}

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  executor: (store: IDBObjectStore) => Promise<T>
): Promise<T> {
  const db = await openOfflineDb();

  try {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const result = await executor(store);

    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Transaksi IndexedDB gagal."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Transaksi IndexedDB dibatalkan."));
    });

    return result;
  } finally {
    db.close();
  }
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Operasi IndexedDB gagal."));
  });
}

export async function getOfflineTaskPackage(taskId: string): Promise<OfflineTaskPackage | null> {
  return withStore(TASK_PACKAGE_STORE, "readonly", async (store) => {
    const result = await requestToPromise(store.get(taskId));
    return (result as OfflineTaskPackage | undefined) ?? null;
  });
}

export async function saveOfflineTaskPackage(input: OfflineTaskPackage): Promise<void> {
  await withStore(TASK_PACKAGE_STORE, "readwrite", async (store) => {
    await requestToPromise(store.put(input));
  });
}

export async function updateOfflineTaskBasemapStatus(taskId: string, basemapReady: boolean): Promise<void> {
  const existing = await getOfflineTaskPackage(taskId);
  if (!existing) return;

  await saveOfflineTaskPackage({
    ...existing,
    basemapReady,
    basemapPreparedAt: basemapReady ? Date.now() : existing.basemapPreparedAt ?? null,
  });
}

export async function addPendingPraExistingSurvey(record: PendingPraExistingSurveyRecord): Promise<void> {
  await withStore(SURVEY_QUEUE_STORE, "readwrite", async (store) => {
    await requestToPromise(store.put(record));
  });
}

export async function updatePendingPraExistingSurvey(
  id: string,
  updates: Partial<PendingPraExistingSurveyRecord>
): Promise<void> {
  await withStore(SURVEY_QUEUE_STORE, "readwrite", async (store) => {
    const current = (await requestToPromise(store.get(id))) as PendingPraExistingSurveyRecord | undefined;
    if (!current) return;
    await requestToPromise(store.put({ ...current, ...updates }));
  });
}

export async function removePendingPraExistingSurvey(id: string): Promise<void> {
  await withStore(SURVEY_QUEUE_STORE, "readwrite", async (store) => {
    await requestToPromise(store.delete(id));
  });
}

export async function getPendingPraExistingSurveys(taskId?: string): Promise<PendingPraExistingSurveyRecord[]> {
  return withStore(SURVEY_QUEUE_STORE, "readonly", async (store) => {
    if (taskId) {
      const index = store.index("taskId");
      const result = await requestToPromise(index.getAll(taskId));
      return (result as PendingPraExistingSurveyRecord[]).sort((a, b) => a.createdAtLocal - b.createdAtLocal);
    }

    const result = await requestToPromise(store.getAll());
    return (result as PendingPraExistingSurveyRecord[]).sort((a, b) => a.createdAtLocal - b.createdAtLocal);
  });
}

export async function countPendingPraExistingSurveys(taskId?: string): Promise<number> {
  const items = await getPendingPraExistingSurveys(taskId);
  return items.length;
}
