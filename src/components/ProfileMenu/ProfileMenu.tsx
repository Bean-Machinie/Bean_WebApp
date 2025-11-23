import { ReactNode, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
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
  const { signOut, user } = useAuth();
  const { profile, avatarUrl, isLoading } = useProfile();

  const resolvedName = useMemo(() => {
    return profile?.displayName || profile?.emailFallback || user?.email || 'Profile';
  }, [profile?.displayName, profile?.emailFallback, user?.email]);

  const initials = useMemo(() => {
    const source = profile?.displayName || profile?.emailFallback || user?.email || 'User';
    return source
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  }, [profile?.displayName, profile?.emailFallback, user?.email]);

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

  const handleLogout = async () => {
    setIsOpen(false);
    await signOut();
    navigate('/login');
  };

  const logoutIcon = (
    <svg width="20px" height="20px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M15 16.5V19C15 20.1046 14.1046 21 13 21H6C4.89543 21 4 20.1046 4 19V5C4 3.89543 4.89543 3 6 3H13C14.1046 3 15 3.89543 15 5V8.0625"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11 12H21M21 12L18.5 9.5M21 12L18.5 14.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  return (
    <div className="profile-menu">
      <button
        className="profile-menu__trigger"
        onClick={handleToggle}
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <div
          className={`profile-menu__avatar ${isLoading ? 'profile-menu__avatar--loading' : ''}`}
          aria-hidden
        >
          {isLoading ? (
            <div className="profile-menu__avatar-skeleton" />
          ) : avatarUrl ? (
            <img src={avatarUrl} alt="Profile avatar" />
          ) : (
            <span className="profile-menu__avatar-initials">{initials}</span>
          )}
        </div>
        <span
          className={`profile-menu__name ${isCollapsed ? 'profile-menu__name--hidden' : ''}`}
          title={resolvedName}
        >
          {isLoading ? <span className="profile-menu__name-skeleton" /> : resolvedName}
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

        <li className="profile-menu__separator" aria-hidden />

        <li role="menuitem">
          <button className="profile-menu__item profile-menu__item--danger" onClick={handleLogout}>
            <span className="profile-menu__item-icon" aria-hidden>
              {logoutIcon}
            </span>
            <span className="profile-menu__item-label">Log out</span>
          </button>
        </li>
      </ul>
    </div>
  );
}

export default ProfileMenu;
