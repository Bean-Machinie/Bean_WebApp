import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabaseClient';

type ProfileData = {
  displayName: string;
  bio: string;
  website: string;
  socialAccounts: string[];
  avatarUrl: string;
  emailFallback: string;
};

type ProfileContextValue = {
  profile: ProfileData | null;
  loading: boolean;
  avatarLoading: boolean;
  resolvedAvatarUrl: string;
  refreshProfile: () => Promise<void>;
  updateProfileLocally: (updates: Partial<ProfileData>) => void;
};

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined);

const AVATAR_TTL_SECONDS = 60 * 60 * 24 * 7;

function parseSocialAccounts(raw?: string | null) {
  if (!raw) return ['', '', ''];
  const entries = raw
    .split('\n')
    .map((entry) => entry.trim())
    .filter(Boolean);
  return [entries[0] ?? '', entries[1] ?? '', entries[2] ?? ''];
}

function createDefaultProfile(email?: string | null): ProfileData {
  return {
    displayName: '',
    bio: '',
    website: '',
    socialAccounts: ['', '', ''],
    avatarUrl: '',
    emailFallback: email ?? '',
  };
}

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [resolvedAvatarUrl, setResolvedAvatarUrl] = useState('');
  const mountedRef = useRef(true);

  const cacheKey = useMemo(() => {
    if (!user?.id) return null;
    return `profile-cache-${user.id}`;
  }, [user?.id]);

  const persistProfile = useCallback(
    (next: ProfileData) => {
      if (!cacheKey) return;
      try {
        localStorage.setItem(cacheKey, JSON.stringify(next));
      } catch (error) {
        console.warn('Unable to persist profile cache', error);
      }
    },
    [cacheKey],
  );

  const loadCachedProfile = useCallback(() => {
    if (!cacheKey) return null;
    try {
      const raw = localStorage.getItem(cacheKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as ProfileData;
      return parsed;
    } catch (error) {
      console.warn('Unable to read profile cache', error);
      return null;
    }
  }, [cacheKey]);

  const resolveAvatarUrl = useCallback(async (avatarPath: string) => {
    if (!avatarPath) return '';

    const { data: signedData, error: signedError } = await supabase.storage
      .from('avatars')
      .createSignedUrl(avatarPath, AVATAR_TTL_SECONDS);

    if (signedData?.signedUrl && !signedError) return signedData.signedUrl;

    const { data: publicData } = supabase.storage.from('avatars').getPublicUrl(avatarPath);
    return publicData.publicUrl ?? '';
  }, []);

  const preloadAvatar = useCallback(
    async (avatarPath: string) => {
      setAvatarLoading(!!avatarPath);

      if (!avatarPath) {
        setResolvedAvatarUrl('');
        setAvatarLoading(false);
        return;
      }

      const candidateUrl = await resolveAvatarUrl(avatarPath);
      if (!candidateUrl) {
        setResolvedAvatarUrl('');
        setAvatarLoading(false);
        return;
      }

      if (typeof Image === 'undefined') {
        setResolvedAvatarUrl(candidateUrl);
        setAvatarLoading(false);
        return;
      }

      await new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = candidateUrl;
      });

      if (mountedRef.current) {
        setResolvedAvatarUrl(candidateUrl);
        setAvatarLoading(false);
      }
    },
    [resolveAvatarUrl],
  );

  const refreshProfile = useCallback(async () => {
    if (!user?.id) {
      setProfile(null);
      setResolvedAvatarUrl('');
      setAvatarLoading(false);
      setLoading(false);
      return;
    }

    const shouldShowLoader = !profile;
    if (shouldShowLoader) setLoading(true);

    const { data, error } = await supabase
      .from('profiles')
      .select('display_name, bio, website, social_accounts, avatar_url')
      .eq('id', user.id)
      .single();

    if (error) {
      console.warn('Unable to load profile', error);
      setLoading(false);
      return;
    }

    const nextProfile: ProfileData = {
      displayName: data?.display_name ?? '',
      bio: data?.bio ?? '',
      website: data?.website ?? '',
      socialAccounts: parseSocialAccounts(data?.social_accounts),
      avatarUrl: data?.avatar_url ?? '',
      emailFallback: user.email ?? '',
    };

    setProfile(nextProfile);
    persistProfile(nextProfile);
    preloadAvatar(nextProfile.avatarUrl);
    setLoading(false);
  }, [persistProfile, preloadAvatar, profile, user]);

  const updateProfileLocally = useCallback(
    (updates: Partial<ProfileData>) => {
      setProfile((current) => {
        const base = current ?? createDefaultProfile(user?.email);
        const nextProfile = { ...base, ...updates };
        persistProfile(nextProfile);
        preloadAvatar(nextProfile.avatarUrl);
        return nextProfile;
      });
    },
    [persistProfile, preloadAvatar, user?.email],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setProfile(null);
      setResolvedAvatarUrl('');
      setAvatarLoading(false);
      setLoading(false);
      return;
    }

    const cached = loadCachedProfile();
    if (cached) {
      setProfile(cached);
      setLoading(false);
      preloadAvatar(cached.avatarUrl);
    } else {
      setProfile(createDefaultProfile(user.email));
    }

    refreshProfile();
  }, [loadCachedProfile, preloadAvatar, refreshProfile, user]);

  const value = useMemo(
    () => ({ profile, loading, avatarLoading, resolvedAvatarUrl, refreshProfile, updateProfileLocally }),
    [avatarLoading, loading, profile, refreshProfile, resolvedAvatarUrl, updateProfileLocally],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
}
