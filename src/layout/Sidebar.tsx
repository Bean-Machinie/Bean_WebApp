import { useEffect, useMemo, useState } from 'react';
import ProfileMenu from '../components/ProfileMenu/ProfileMenu';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { Workspace } from './AppLayout';

type SidebarProps = {
  workspaces: Workspace[];
  profileMenuItems: Workspace[];
  isCollapsed: boolean;
  activeWorkspaceId?: string;
  onSelectWorkspace: (workspaceId: string) => void;
  onToggleCollapse: () => void;
};

function Sidebar({
  workspaces,
  profileMenuItems,
  isCollapsed,
  activeWorkspaceId,
  onSelectWorkspace,
  onToggleCollapse,
}: SidebarProps) {
  const { user } = useAuth();
  const [profile, setProfile] = useState({
    displayName: '',
    avatarUrl: '',
    emailFallback: '',
  });

  useEffect(() => {
    if (!user?.id) return;

    const loadProfile = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('display_name, avatar_url, bio, website, social_accounts, timezone_enabled, timezone_value')
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
      .channel('sidebar-profile-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
        (payload) => {
          const next = payload.new as { display_name?: string; avatar_url?: string };
          setProfile((current) => ({
            ...current,
            displayName: next.display_name ?? current.displayName,
            avatarUrl: next.avatar_url ?? current.avatarUrl,
            emailFallback: user.email ?? current.emailFallback,
          }));
        },
      );

    return () => {
      channel.unsubscribe();
    };
  }, [user]);

  const mergedProfile = useMemo(
    () => ({
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      emailFallback: profile.emailFallback,
    }),
    [profile],
  );

  return (
    <aside className={`sidebar ${isCollapsed ? 'sidebar--collapsed' : ''}`}>
      <button className="sidebar__toggle" onClick={onToggleCollapse}>
        {isCollapsed ? '➜' : '⬅'}
        <span
          className={`sidebar__toggle-label ${
            isCollapsed ? 'sidebar__toggle-label--hidden' : ''
          }`}
        >
          Collapse
        </span>
      </button>

      <nav className="workspace-list" aria-label="Workspaces">
        {workspaces.map((workspace) => {
          const isActive = workspace.id === activeWorkspaceId;
          return (
            <button
              key={workspace.id}
              className={`workspace-item ${isActive ? 'workspace-item--active' : ''}`}
              onClick={() => onSelectWorkspace(workspace.id)}
              aria-pressed={isActive}
            >
              <span className="workspace-item__icon" aria-hidden>
                {workspace.icon}
              </span>
              <span
                className={`workspace-item__title ${
                  isCollapsed ? 'workspace-item__title--hidden' : ''
                }`}
              >
                {workspace.title}
              </span>
            </button>
          );
        })}
      </nav>

      <div className="sidebar__spacer" aria-hidden />

      <ProfileMenu isCollapsed={isCollapsed} items={profileMenuItems} profile={mergedProfile} />
    </aside>
  );
}

export default Sidebar;
