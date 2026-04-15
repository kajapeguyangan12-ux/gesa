const CACHE_PREFIX = "gesa_cache:";
const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 menit

interface CacheEntry<T> {
  expiresAt: number;
  value: T;
}

const inMemoryCache = new Map<string, CacheEntry<any>>();

const isBrowser = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined";

export function getCachedData<T>(key: string): T | null {
  const now = Date.now();
  const entry = inMemoryCache.get(key) as CacheEntry<T> | undefined;
  if (entry) {
    if (entry.expiresAt > now) return entry.value;
    inMemoryCache.delete(key);
  }

  if (!isBrowser()) return null;

  try {
    const raw = window.localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as CacheEntry<T>;
    if (parsed.expiresAt <= now) {
      window.localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }

    inMemoryCache.set(key, parsed);
    return parsed.value;
  } catch (error) {
    console.error("Firestore cache read error:", error);
    return null;
  }
}

export function setCachedData<T>(key: string, value: T, ttlMs: number = DEFAULT_TTL_MS): void {
  const entry: CacheEntry<T> = {
    value,
    expiresAt: Date.now() + ttlMs,
  };

  inMemoryCache.set(key, entry);

  if (!isBrowser()) return;

  try {
    window.localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
  } catch (error) {
    console.error("Firestore cache write error:", error);
  }
}

export function clearCachedData(key: string): void {
  inMemoryCache.delete(key);
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(CACHE_PREFIX + key);
  } catch (error) {
    console.error("Firestore cache clear error:", error);
  }
}

export async function fetchWithCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<T> {
  const cached = getCachedData<T>(key);
  if (cached !== null) return cached;

  const value = await fetcher();
  setCachedData(key, value, ttlMs);
  return value;
}
