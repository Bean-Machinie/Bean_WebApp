import { ReactNode, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';

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
  const [resolvedAvatarUrl, setResolvedAvatarUrl] = useState('');
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (profileFromProps) {
      setProfile(profileFromProps);
    }
  }, [profileFromProps]);

  useEffect(() => {
    if (profileFromProps) return;
    if (!user?.id) return;

    const loadProfile = async () => {
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
        setResolvedAvatarUrl('');
        return;
      }

      const { data: signedData, error: signedError } = await supabase.storage
        .from('avatars')
        .createSignedUrl(profile.avatarUrl, 60 * 60 * 24 * 7);

      if (isActive && signedData?.signedUrl && !signedError) {
        setResolvedAvatarUrl(signedData.signedUrl);
        return;
      }

      const { data: publicData } = supabase.storage.from('avatars').getPublicUrl(profile.avatarUrl);
      if (isActive) {
        setResolvedAvatarUrl(publicData.publicUrl ?? '');
      }
    };

    resolveAvatarUrl();

    return () => {
      isActive = false;
    };
  }, [profile.avatarUrl]);

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
        <div className="profile-menu__avatar" aria-hidden>
          {resolvedAvatarUrl ? (
            <img src={resolvedAvatarUrl} alt="Profile avatar" />
          ) : (
            <span className="profile-menu__avatar-initials">{initials}</span>
          )}
        </div>
        <span
          className={`profile-menu__name ${isCollapsed ? 'profile-menu__name--hidden' : ''}`}
          title={resolvedName}
        >
          {resolvedName}
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
