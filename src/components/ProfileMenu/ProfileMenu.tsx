import { ReactNode, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';

const AVATAR_URL_CACHE_KEY = 'cachedAvatarPublicUrl';
let avatarUrlMemoryCache = '';

const getCachedAvatarUrl = () => {
  if (avatarUrlMemoryCache) return avatarUrlMemoryCache;
  if (typeof window === 'undefined') return '';
  avatarUrlMemoryCache = window.localStorage.getItem(AVATAR_URL_CACHE_KEY) ?? '';
  return avatarUrlMemoryCache;
};

const setCachedAvatarUrl = (url: string) => {
  avatarUrlMemoryCache = url;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(AVATAR_URL_CACHE_KEY, url);
  }
};

const clearCachedAvatarUrl = () => {
  avatarUrlMemoryCache = '';
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(AVATAR_URL_CACHE_KEY);
  }
};

type ProfileMenuItem = {
  id: string;
  title: string;
  icon: ReactNode;
};

type ProfileMenuProps = {
  isCollapsed: boolean;
  items: ProfileMenuItem[];
  profile?: { displayName: string; avatarUrl: string; emailFallback: string };
};

function ProfileMenu({ isCollapsed, items, profile: profileFromProps }: ProfileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [profile, setProfile] = useState({
    displayName: '',
    avatarUrl: '',
    emailFallback: '',
  });
  const [isProfileLoading, setIsProfileLoading] = useState(!profileFromProps);
  const [resolvedAvatarUrl, setResolvedAvatarUrl] = useState(() => getCachedAvatarUrl());
  const [isAvatarLoaded, setIsAvatarLoaded] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (profileFromProps) {
      setProfile(profileFromProps);
      setIsProfileLoading(false);
    }
  }, [profileFromProps]);

  useEffect(() => {
    if (profileFromProps) return;
    if (!user?.id) {
      setIsProfileLoading(false);
      return;
    }

    const loadProfile = async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('display_name, avatar_url')
          .eq('id', user.id)
          .single();

        setProfile({
          displayName: data?.display_name ?? '',
          avatarUrl: data?.avatar_url ?? '',
          emailFallback: user.email ?? '',
        });
      } finally {
        setIsProfileLoading(false);
      }
    };

    loadProfile();

    const channel = supabase
      .channel('profile-menu-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
        (payload) => {
          const newRecord = payload.new as { display_name?: string; avatar_url?: string };
          setProfile((current) => ({
            ...current,
            displayName: newRecord.display_name ?? current.displayName,
            avatarUrl: newRecord.avatar_url ?? current.avatarUrl,
            emailFallback: user.email ?? current.emailFallback,
          }));
        },
      );

    return () => {
      channel.unsubscribe();
    };
  }, [profileFromProps, user]);

  const resolvedName = useMemo(() => {
    return profile.displayName || profile.emailFallback || 'Profile';
  }, [profile.displayName, profile.emailFallback]);

  useEffect(() => {
    let isActive = true;

    const resolveAvatarUrl = async () => {
      if (!profile.avatarUrl) {
        clearCachedAvatarUrl();
        setResolvedAvatarUrl('');
        return;
      }

      const cached = getCachedAvatarUrl();
      if (cached) {
        setResolvedAvatarUrl((current) => current || cached);
      }

      const { data: signedData, error: signedError } = await supabase.storage
        .from('avatars')
        .createSignedUrl(profile.avatarUrl, 60 * 60 * 24 * 7);

      if (isActive && signedData?.signedUrl && !signedError) {
        setCachedAvatarUrl(signedData.signedUrl);
        setResolvedAvatarUrl(signedData.signedUrl);
        return;
      }

      const { data: publicData } = supabase.storage.from('avatars').getPublicUrl(profile.avatarUrl);
      if (isActive) {
        const nextUrl = publicData.publicUrl ?? '';
        setCachedAvatarUrl(nextUrl);
        setResolvedAvatarUrl(nextUrl);
      }
    };

    resolveAvatarUrl();

    return () => {
      isActive = false;
    };
  }, [profile.avatarUrl]);

  useEffect(() => {
    setIsAvatarLoaded(false);
  }, [resolvedAvatarUrl]);

  const initials = useMemo(() => {
    const source = profile.displayName || profile.emailFallback || 'User';
    return source
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  }, [profile.displayName, profile.emailFallback]);

  const handleToggle = () => setIsOpen((prev) => !prev);
  const handleSelect = (itemId: string) => {
    const destinations: Record<string, string> = {
      profile: '/settings/profile',
      themes: '/settings/appearance',
      settings: '/settings',
    };

    navigate(destinations[itemId] ?? '/settings');
    setIsOpen(false);
  };

  return (
    <div className="profile-menu">
      <button
        className="profile-menu__trigger"
        onClick={handleToggle}
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <div
          className={`profile-menu__avatar ${
            isProfileLoading || (resolvedAvatarUrl && !isAvatarLoaded) ? 'profile-menu__avatar--loading' : ''
          }`}
          aria-hidden
        >
          {resolvedAvatarUrl && (
            <img
              src={resolvedAvatarUrl}
              alt="Profile avatar"
              onLoad={() => setIsAvatarLoaded(true)}
              onError={() => setIsAvatarLoaded(false)}
              style={{ opacity: isAvatarLoaded ? 1 : 0 }}
            />
          )}
          {isProfileLoading || (resolvedAvatarUrl && !isAvatarLoaded) ? (
            <div className="profile-menu__avatar-skeleton" />
          ) : resolvedAvatarUrl ? null : (
            <span className="profile-menu__avatar-initials">{initials}</span>
          )}
        </div>
        <span
          className={`profile-menu__name ${isCollapsed ? 'profile-menu__name--hidden' : ''}`}
          title={resolvedName}
        >
          {isProfileLoading ? <span className="profile-menu__name-skeleton" /> : resolvedName}
        </span>
      </button>

      <ul className={`profile-menu__dropdown ${isOpen ? 'profile-menu__dropdown--open' : ''}`} role="menu">
        {items.map((item) => {
          return (
            <li key={item.id} role="menuitem">
              <button className="profile-menu__item" onClick={() => handleSelect(item.id)}>
                <span className="profile-menu__item-icon" aria-hidden>
                  {item.icon}
                </span>
                <span className="profile-menu__item-label">{item.title}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default ProfileMenu;
