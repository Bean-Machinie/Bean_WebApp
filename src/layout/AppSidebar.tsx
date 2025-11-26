import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar, SidebarBody, SidebarLink } from '@/components/ui/sidebar';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useProfile } from '../context/ProfileContext';
import { Workspace } from './AppLayout';
import { cn } from '@/lib/utils';

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
  const [open, setOpen] = useState(() => {
    const saved = localStorage.getItem('sidebar-expanded');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { profile, avatarUrl, isLoading } = useProfile();

  useEffect(() => {
    localStorage.setItem('sidebar-expanded', JSON.stringify(open));
  }, [open]);

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
          {/* Header with Logo and Collapse Button */}
          <div className={cn("mb-2 flex items-center justify-end relative", open ? "px-2" : "px-0")} style={{ height: '42px' }}>
            {/* Logo - only show when expanded */}
            <AnimatePresence mode="wait">
              {open && <Logo />}
            </AnimatePresence>

            {/* Collapse/Expand Button */}
            <button
              onClick={() => setOpen(!open)}
              className="w-[40px] h-[40px] flex items-center justify-center bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 rounded-xl hover:bg-neutral-200 dark:hover:bg-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600"
              aria-label={open ? 'Collapse sidebar' : 'Expand sidebar'}
              title={open ? 'Collapse sidebar' : 'Expand sidebar'}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="flex-shrink-0"
              >
                <path
                  d="M10 4H6C4.89543 4 4 4.89543 4 6V18C4 19.1046 4.89543 20 6 20H10M10 4H18C19.1046 4 20 4.89543 20 6V18C20 19.1046 19.1046 20 18 20H10M10 4V20"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>

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
            className="flex items-center justify-start gap-2 group/sidebar px-1.5 py-2.5 cursor-pointer hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-md px-2"
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
              transition={{
                duration: 0.2,
                ease: "easeInOut",
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
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      className="font-normal flex space-x-2 items-center text-sm text-black dark:text-white absolute left-2"
    >
      <svg
        fill="currentColor"
        width="30px"
        height="30px"
        viewBox="0 0 64 64"
        version="1.1"
        xmlns="http://www.w3.org/2000/svg"
        xmlnsXlink="http://www.w3.org/1999/xlink"
        xmlSpace="preserve"
        className="flex-shrink-0"
        style={{ fillRule: "evenodd", clipRule: "evenodd", strokeLinejoin: "round", strokeMiterlimit: 2 }}
      >
        <g transform="matrix(1,0,0,1,-1152,-256)">
          <g id="coffee-bean-filled" transform="matrix(0.866025,0.5,-0.5,0.866025,717.879,-387.292)">
            <g transform="matrix(1,0,0,1,0,-0.699553)">
              <path d="M737.673,328.231C738.494,328.056 739.334,328.427 739.757,329.152C739.955,329.463 740.106,329.722 740.106,329.722C740.106,329.722 745.206,338.581 739.429,352.782C737.079,358.559 736.492,366.083 738.435,371.679C738.697,372.426 738.482,373.258 737.89,373.784C737.298,374.31 736.447,374.426 735.735,374.077C730.192,371.375 722.028,365.058 722.021,352C722.015,340.226 728.812,330.279 737.673,328.231Z"/>
            </g>
            <g transform="matrix(-1,0,0,-1,1483.03,703.293)">
              <path d="M737.609,328.246C738.465,328.06 739.344,328.446 739.785,329.203C739.97,329.49 740.106,329.722 740.106,329.722C740.106,329.722 745.206,338.581 739.429,352.782C737.1,358.507 736.503,365.948 738.383,371.527C738.646,372.304 738.415,373.164 737.796,373.703C737.177,374.243 736.294,374.356 735.56,373.989C730.02,371.241 722.028,364.92 722.021,352C722.016,340.255 728.779,330.328 737.609,328.246Z"/>
            </g>
          </g>
        </g>
      </svg>
      <span className="font-medium text-black dark:text-white whitespace-pre">
        Bean App
      </span>
    </motion.div>
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
