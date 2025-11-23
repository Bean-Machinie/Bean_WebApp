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
import { supabase } from '../lib/supabaseClient';
import { useAuth } from './AuthContext';

type Profile = {
  displayName: string;
  bio: string;
  website: string;
  socialAccounts: string[];
  avatarUrl: string;
  timezoneEnabled: boolean;
  timezoneValue: string;
  emailFallback: string;
};

type ProfileContextValue = {
  profile: Profile | null;
  avatarUrl: string;
  isLoading: boolean;
  refreshProfile: () => Promise<void>;
};

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined);

function normalizeSocialAccounts(rawSocialAccounts?: string | null): string[] {
  const parsed = (rawSocialAccounts || '')
    .split('\n')
    .map((entry) => entry.trim())
    .filter(Boolean);

  return [...parsed, '', '', ''].slice(0, 3);
}

function useProfileSubscription(userId: string | null, onUpdate: (updates: Partial<Profile>) => void) {
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('profile-context-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
        (payload) => {
          const next = payload.new as {
            display_name?: string;
            bio?: string;
            website?: string;
            social_accounts?: string;
            avatar_url?: string;
            timezone_enabled?: boolean;
            timezone_value?: string;
          };

          onUpdate({
            displayName: next.display_name,
            bio: next.bio,
            website: next.website,
            socialAccounts: next.social_accounts ? normalizeSocialAccounts(next.social_accounts) : undefined,
            avatarUrl: next.avatar_url,
            timezoneEnabled:
              typeof next.timezone_enabled === 'boolean' ? next.timezone_enabled : undefined,
            timezoneValue: next.timezone_value,
          });
        },
      );

    return () => {
      channel.unsubscribe();
    };
  }, [onUpdate, userId]);
}

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const profileRef = useRef<Profile | null>(null);

  const refreshProfile = useCallback(async () => {
    if (!user?.id) {
      setProfile(null);
      setAvatarUrl('');
      setIsLoading(false);
      profileRef.current = null;
      return;
    }

    const shouldShowLoading = profileRef.current === null;
    if (shouldShowLoading) {
      setIsLoading(true);
    }

    try {
      const { data } = await supabase
        .from('profiles')
        .select('display_name, bio, website, social_accounts, avatar_url, timezone_enabled, timezone_value')
        .eq('id', user.id)
        .single();

      const nextProfile: Profile = {
        displayName: data?.display_name ?? '',
        bio: data?.bio ?? '',
        website: data?.website ?? '',
        socialAccounts: normalizeSocialAccounts(data?.social_accounts),
        avatarUrl: data?.avatar_url ?? '',
        timezoneEnabled: data?.timezone_enabled ?? false,
        timezoneValue: data?.timezone_value ?? '',
        emailFallback: user.email ?? '',
      };

      profileRef.current = nextProfile;
      setProfile(nextProfile);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  useEffect(() => {
    if (!profile?.avatarUrl) {
      setAvatarUrl('');
      return;
    }

    let isActive = true;

    const resolveAvatarUrl = async () => {
      const { data: signedData, error: signedError } = await supabase.storage
        .from('avatars')
        .createSignedUrl(profile.avatarUrl, 60 * 60 * 24 * 7);

      if (isActive && signedData?.signedUrl && !signedError) {
        setAvatarUrl(signedData.signedUrl);
        return;
      }

      const { data: publicData } = supabase.storage.from('avatars').getPublicUrl(profile.avatarUrl);
      if (isActive) {
        setAvatarUrl(publicData.publicUrl ?? '');
      }
    };

    resolveAvatarUrl();

    return () => {
      isActive = false;
    };
  }, [profile?.avatarUrl]);

  const handleRealtimeUpdate = useCallback(
    (updates: Partial<Profile>) => {
      setProfile((current) => {
        const nextProfile = {
          displayName: updates.displayName ?? current?.displayName ?? '',
          bio: updates.bio ?? current?.bio ?? '',
          website: updates.website ?? current?.website ?? '',
          socialAccounts: updates.socialAccounts ?? current?.socialAccounts ?? ['', '', ''],
          avatarUrl: updates.avatarUrl ?? current?.avatarUrl ?? '',
          timezoneEnabled: updates.timezoneEnabled ?? current?.timezoneEnabled ?? false,
          timezoneValue: updates.timezoneValue ?? current?.timezoneValue ?? '',
          emailFallback: current?.emailFallback ?? user?.email ?? '',
        } satisfies Profile;

        profileRef.current = nextProfile;
        return nextProfile;
      });
    },
    [user?.email],
  );

  useProfileSubscription(user?.id ?? null, handleRealtimeUpdate);

  const value = useMemo(
    () => ({ profile, avatarUrl, isLoading, refreshProfile }),
    [avatarUrl, isLoading, profile, refreshProfile],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
}
