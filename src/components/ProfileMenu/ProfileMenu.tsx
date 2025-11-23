import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { Button, Menu } from 'antd';
import { ReactNode, useEffect, useMemo, useState } from 'react';
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
  const [collapsed, setCollapsed] = useState(isCollapsed);
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

  useEffect(() => {
    setCollapsed(isCollapsed);
  }, [isCollapsed]);

  const handleSelect = (itemId: string) => {
    const destinations: Record<string, string> = {
      profile: '/settings/profile',
      themes: '/settings/appearance',
      settings: '/settings',
    };

    navigate(destinations[itemId] ?? '/settings');
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const logoutIcon = useMemo(
    () => (
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
    ),
    [],
  );

  const menuItems: Required<MenuProps>['items'] = useMemo(() => {
    const actionItems: Required<MenuProps>['items'] = items.map((item) => ({
      key: item.id,
      icon: item.icon,
      label: item.title,
    }));

    actionItems.push({ type: 'divider' });
    actionItems.push({
      key: 'logout',
      icon: logoutIcon,
      label: 'Log out',
      danger: true,
    });

    return actionItems;
  }, [items, logoutIcon]);

  const handleMenuClick: MenuProps['onClick'] = async ({ key }) => {
    if (key === 'logout') {
      await handleLogout();
      return;
    }

    handleSelect(String(key));
  };

  return (
    <div className="profile-menu">
      <div className="profile-menu__controls">
        <div className="profile-menu__identity" aria-live="polite">
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
        </div>
        <Button
          type="primary"
          size="small"
          onClick={() => setCollapsed((prev) => !prev)}
          icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          aria-label={collapsed ? 'Expand action menu' : 'Collapse action menu'}
          className="profile-menu__collapse-btn"
        />
      </div>

      <Menu
        mode="inline"
        theme="dark"
        inlineCollapsed={collapsed}
        items={menuItems}
        selectable={false}
        onClick={handleMenuClick}
        className="profile-menu__menu"
      />
    </div>
  );
}

export default ProfileMenu;
