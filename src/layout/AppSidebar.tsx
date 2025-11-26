import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar, SidebarBody, SidebarLink } from '@/components/ui/sidebar';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useProfile } from '../context/ProfileContext';
import { Workspace } from './AppLayout';

type AppSidebarProps = {
  workspaces: Workspace[];
  profileMenuItems: Workspace[];
  activeWorkspaceId?: string;
  onSelectWorkspace: (workspaceId: string) => void;
};

function AppSidebar({
  workspaces,
  profileMenuItems,
  activeWorkspaceId,
  onSelectWorkspace,
}: AppSidebarProps) {
  const [open, setOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
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

  const handleProfileMenuItemClick = (itemId: string) => {
    const destinations: Record<string, string> = {
      profile: '/settings/profile',
      themes: '/settings/appearance',
      settings: '/settings',
    };

    navigate(destinations[itemId] ?? '/settings');
    setProfileMenuOpen(false);
  };

  const handleLogout = async () => {
    setProfileMenuOpen(false);
    await signOut();
    navigate('/login');
  };

  const logoutIcon = (
    <svg
      width="20px"
      height="20px"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0"
    >
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

  // Convert workspaces to SidebarLink format
  const workspaceLinks = workspaces.map((workspace) => ({
    label: workspace.title,
    href: `#${workspace.id}`,
    icon: <span className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0">{workspace.icon}</span>,
  }));

  return (
    <Sidebar open={open} setOpen={setOpen}>
      <SidebarBody className="justify-between gap-10">
        <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
          {/* Logo */}
          {open ? <Logo /> : <LogoIcon />}

          {/* Workspace Links */}
          <div className="mt-8 flex flex-col gap-2">
            {workspaceLinks.map((link, idx) => (
              <div
                key={idx}
                onClick={(e) => {
                  e.preventDefault();
                  const workspaceId = workspaces[idx].id;
                  onSelectWorkspace(workspaceId);
                }}
                className={`cursor-pointer px-2 ${
                  workspaces[idx].id === activeWorkspaceId
                    ? 'bg-neutral-200 dark:bg-neutral-700 rounded-md'
                    : ''
                }`}
              >
                <SidebarLink link={link} />
              </div>
            ))}
          </div>
        </div>

        {/* Profile Menu Section */}
        <div className="relative">
          <div
            onClick={() => setProfileMenuOpen(!profileMenuOpen)}
            className="flex items-center justify-start gap-2 group/sidebar py-2 cursor-pointer hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-md px-2"
          >
            <div className="h-7 w-7 flex-shrink-0 rounded-full overflow-hidden bg-neutral-300 dark:bg-neutral-600 flex items-center justify-center">
              {isLoading ? (
                <div className="w-full h-full bg-neutral-400 dark:bg-neutral-500 animate-pulse" />
              ) : avatarUrl ? (
                <img src={avatarUrl} alt="Profile avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs font-medium text-neutral-700 dark:text-neutral-200">{initials}</span>
              )}
            </div>
            <motion.span
              animate={{
                display: open ? 'inline-block' : 'none',
                opacity: open ? 1 : 0,
              }}
              className="text-neutral-700 dark:text-neutral-200 text-sm whitespace-pre inline-block !p-0 !m-0"
            >
              {isLoading ? 'Loading...' : resolvedName}
            </motion.span>
          </div>

          {/* Profile Dropdown Menu */}
          {profileMenuOpen && open && (
            <div className="absolute bottom-full left-0 mb-2 w-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md shadow-lg overflow-hidden z-50">
              {profileMenuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleProfileMenuItemClick(item.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                >
                  <span className="h-5 w-5 flex-shrink-0">{item.icon}</span>
                  <span>{item.title}</span>
                </button>
              ))}
              <div className="border-t border-neutral-200 dark:border-neutral-700" />
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
              >
                {logoutIcon}
                <span>Log out</span>
              </button>
            </div>
          )}
        </div>
      </SidebarBody>
    </Sidebar>
  );
}

const Logo = () => {
  return (
    <div className="font-normal flex space-x-2 items-center text-sm text-black dark:text-white py-1 relative z-20">
      <div className="h-5 w-6 bg-black dark:bg-white rounded-br-lg rounded-tr-sm rounded-tl-lg rounded-bl-sm flex-shrink-0" />
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="font-medium text-black dark:text-white whitespace-pre"
      >
        Bean App
      </motion.span>
    </div>
  );
};

const LogoIcon = () => {
  return (
    <div className="font-normal flex space-x-2 items-center text-sm text-black dark:text-white py-1 relative z-20">
      <div className="h-5 w-6 bg-black dark:bg-white rounded-br-lg rounded-tr-sm rounded-tl-lg rounded-bl-sm flex-shrink-0" />
    </div>
  );
};

export default AppSidebar;
