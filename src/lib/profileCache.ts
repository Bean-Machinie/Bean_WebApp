const STORAGE_KEY = 'bean.profile.cache';

type ProfileCacheEntry = {
  displayName?: string;
  displayNameUpdatedAt?: number;
  avatarPreviewUrl?: string;
  avatarUpdatedAt?: number;
};

type CacheShape = Record<string, ProfileCacheEntry>;

const safeNow = () => Date.now();

function readCache(): CacheShape {
  if (typeof localStorage === 'undefined') return {};
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return {};
    return JSON.parse(stored) as CacheShape;
  } catch {
    return {};
  }
}

function writeCache(cache: CacheShape) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
}

export function getCachedProfile(userId: string | undefined | null): ProfileCacheEntry | null {
  if (!userId) return null;
  const cache = readCache();
  return cache[userId] ?? null;
}

export function updateCachedProfile(
  userId: string | undefined | null,
  updates: Partial<ProfileCacheEntry>,
  timestamp: number = safeNow(),
): ProfileCacheEntry | null {
  if (!userId) return null;
  const cache = readCache();
  const current = cache[userId] ?? {};

  const next: ProfileCacheEntry = { ...current };

  if (typeof updates.displayName === 'string') {
    next.displayName = updates.displayName;
    next.displayNameUpdatedAt = timestamp;
  }

  if (typeof updates.avatarPreviewUrl === 'string') {
    next.avatarPreviewUrl = updates.avatarPreviewUrl;
    next.avatarUpdatedAt = timestamp;
  }

  cache[userId] = next;
  writeCache(cache);
  return next;
}

export function clearProfileCache(userId?: string) {
  if (typeof localStorage === 'undefined') return;

  if (userId) {
    const cache = readCache();
    if (cache[userId]) {
      delete cache[userId];
      writeCache(cache);
    }
    return;
  }

  localStorage.removeItem(STORAGE_KEY);
}

export type { ProfileCacheEntry };
