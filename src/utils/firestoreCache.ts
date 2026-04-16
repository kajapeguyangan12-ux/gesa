const CACHE_PREFIX = "gesa_cache:";
const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 menit

interface CacheEntry<T> {
  expiresAt: number;
  value: T;
}

const inMemoryCache = new Map<string, CacheEntry<any>>();
const inflightFetches = new Map<string, Promise<any>>();

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

  const inflight = inflightFetches.get(key);
  if (inflight) {
    return inflight as Promise<T>;
  }

  const fetchPromise = (async () => {
    try {
      const value = await fetcher();
      setCachedData(key, value, ttlMs);
      return value;
    } finally {
      inflightFetches.delete(key);
    }
  })();

  inflightFetches.set(key, fetchPromise);
  return fetchPromise;
}

// Polling tracker to prevent multiple simultaneous polls
const pollingInProgress = new Map<string, Promise<any>>();

/**
 * Poll data with caching instead of using onSnapshot listeners.
 * Reduces read operations significantly by only polling when cache expires.
 * @param key Cache key
 * @param fetcher Function to fetch fresh data
 * @param ttlMs Cache TTL in milliseconds
 * @param pollIntervalMs How often to check if cache expired (default 30s)
 */
export async function pollWithCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS,
  pollIntervalMs: number = 30_000
): Promise<T> {
  // Return cached value if still valid
  const cached = getCachedData<T>(key);
  if (cached !== null) return cached;

  // If a poll is already in progress for this key, wait for it
  if (pollingInProgress.has(key)) {
    return pollingInProgress.get(key)!;
  }

  // Start new fetch
  const fetchPromise = (async () => {
    try {
      const value = await fetcher();
      setCachedData(key, value, ttlMs);
      return value;
    } finally {
      pollingInProgress.delete(key);
    }
  })();

  pollingInProgress.set(key, fetchPromise);
  return fetchPromise;
}

// Polling state manager for React hooks
const pollingTimers = new Map<string, NodeJS.Timeout>();

/**
 * Setup polling for a key with callback (for React useEffect).
 * Automatically cleans up on component unmount.
 */
export function setupPolling<T>(
  key: string,
  fetcher: () => Promise<T>,
  onData: (data: T) => void,
  ttlMs: number = DEFAULT_TTL_MS,
  pollIntervalMs: number = 30_000
): (() => void) {
  // Initial fetch with cache
  pollWithCache(key, fetcher, ttlMs, pollIntervalMs)
    .then(onData)
    .catch((err) => console.error(`Polling error for ${key}:`, err));

  // Setup periodic check
  const intervalId = setInterval(async () => {
    const cached = getCachedData<T>(key);
    if (cached === null) {
      // Cache expired, fetch fresh data
      try {
        const data = await pollWithCache(key, fetcher, ttlMs, pollIntervalMs);
        onData(data);
      } catch (err) {
        console.error(`Polling error for ${key}:`, err);
      }
    }
  }, pollIntervalMs);

  // Cleanup function that will be called on unmount
  const cleanup = () => {
    clearInterval(intervalId);
    pollingTimers.delete(key);
  };

  pollingTimers.set(key, intervalId);
  return cleanup;
}
