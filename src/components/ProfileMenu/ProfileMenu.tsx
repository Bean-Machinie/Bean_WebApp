import { ReactNode, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '../../context/ProfileContext';

type ProfileMenuItem = {
  id: string;
  title: string;
  icon: ReactNode;
};

type ProfileMenuProps = {
  isCollapsed: boolean;
  items: ProfileMenuItem[];
};

function ProfileMenu({ isCollapsed, items }: ProfileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const { profile, loading, resolvedAvatarUrl, avatarLoading } = useProfile();

  const resolvedName = useMemo(() => {
    return profile?.displayName || profile?.emailFallback || 'Profile';
  }, [profile?.displayName, profile?.emailFallback]);

  const initials = useMemo(() => {
    const source = resolvedName || 'User';
    return source
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  }, [resolvedName]);

  const isProfileHydrating = loading && (!profile || (!profile.displayName && !profile.avatarUrl));
  const showAvatarSkeleton = isProfileHydrating || (avatarLoading && !!profile?.avatarUrl);
  const showNameSkeleton = isProfileHydrating;

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
          {showAvatarSkeleton ? (
            <span className="skeleton skeleton--circle skeleton--avatar-sm" />
          ) : resolvedAvatarUrl ? (
            <img src={resolvedAvatarUrl} alt="Profile avatar" />
          ) : (
            <span className="profile-menu__avatar-initials">{initials}</span>
          )}
        </div>
        <span
          className={`profile-menu__name ${isCollapsed ? 'profile-menu__name--hidden' : ''}`}
          title={resolvedName}
        >
          {showNameSkeleton ? <span className="skeleton skeleton--text skeleton--name" /> : resolvedName}
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
