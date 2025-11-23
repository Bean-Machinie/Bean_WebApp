import { useCallback, useEffect, useMemo, useState } from 'react';
import ProfileMenu from '../components/ProfileMenu/ProfileMenu';
import { useAuth } from '../context/AuthContext';
import { getCachedProfile, updateCachedProfile } from '../lib/profileCache';
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
  const [, setDisplayNameTimestamp] = useState(0);
  const [, setAvatarTimestamp] = useState(0);
  const [avatarSourceTimestamp, setAvatarSourceTimestamp] = useState(0);

  const applyDisplayNameCandidate = useCallback(
    (value: string, candidateTimestamp: number) => {
      let applied = false;
      setDisplayNameTimestamp((current) => {
        if (candidateTimestamp >= current) {
          applied = true;
          setProfile((currentProfile) => ({ ...currentProfile, displayName: value }));
          return candidateTimestamp;
        }
        return current;
      });

      if (applied) {
        updateCachedProfile(user?.id, { displayName: value }, candidateTimestamp);
      }
    },
    [user?.id],
  );

  const applyAvatarCandidate = useCallback(
    (value: string, candidateTimestamp: number) => {
      let applied = false;
      setAvatarTimestamp((current) => {
        if (candidateTimestamp >= current) {
          applied = true;
          setProfile((currentProfile) => ({ ...currentProfile, avatarUrl: value }));
          return candidateTimestamp;
        }
        return current;
      });

      if (applied) {
        updateCachedProfile(user?.id, { avatarPreviewUrl: value }, candidateTimestamp);
      }
    },
    [user?.id],
  );

  useEffect(() => {
    setProfile({ displayName: '', avatarUrl: '', emailFallback: user?.email ?? '' });
    setDisplayNameTimestamp(0);
    setAvatarTimestamp(0);
    setAvatarSourceTimestamp(0);

    if (!user?.id) return;

    const cached = getCachedProfile(user.id);
    if (cached?.displayName) {
      applyDisplayNameCandidate(cached.displayName, cached.displayNameUpdatedAt ?? 0);
    }
    if (cached?.avatarPreviewUrl) {
      applyAvatarCandidate(cached.avatarPreviewUrl, cached.avatarUpdatedAt ?? 0);
    }

    const loadProfile = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('display_name, avatar_url, updated_at, bio, website, social_accounts, timezone_enabled, timezone_value')
        .eq('id', user.id)
        .single();

      const serverUpdatedAt = data?.updated_at ? new Date(data.updated_at).getTime() : 0;

      applyDisplayNameCandidate(data?.display_name ?? '', serverUpdatedAt);
      setAvatarSourceTimestamp(serverUpdatedAt);
      setProfile((current) => ({
        ...current,
        avatarUrl: data?.avatar_url ?? '',
        emailFallback: user.email ?? current.emailFallback,
      }));
    };

    loadProfile();

    const channel = supabase
      .channel('sidebar-profile-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
        (payload) => {
          const next = payload.new as { display_name?: string; avatar_url?: string; updated_at?: string };
          const eventTimestamp = next?.updated_at ? new Date(next.updated_at).getTime() : Date.now();
          applyDisplayNameCandidate(next.display_name ?? '', eventTimestamp);
          setAvatarSourceTimestamp(eventTimestamp);
          setProfile((current) => ({
            ...current,
            avatarUrl: next.avatar_url ?? current.avatarUrl,
            emailFallback: user.email ?? current.emailFallback,
          }));
        },
      );

    return () => {
      channel.unsubscribe();
    };
  }, [applyAvatarCandidate, applyDisplayNameCandidate, user]);

  useEffect(() => {
    if (!profile.avatarUrl) return;

    let isActive = true;

    const resolveAvatarUrl = async () => {
      if (
        profile.avatarUrl.startsWith('http') ||
        profile.avatarUrl.startsWith('data:') ||
        profile.avatarUrl.startsWith('blob:')
      ) {
        applyAvatarCandidate(profile.avatarUrl, avatarSourceTimestamp);
        return;
      }

      const { data: signedData, error: signedError } = await supabase.storage
        .from('avatars')
        .createSignedUrl(profile.avatarUrl, 60 * 60 * 24 * 7);

      if (isActive && signedData?.signedUrl && !signedError) {
        applyAvatarCandidate(signedData.signedUrl, avatarSourceTimestamp);
        return;
      }

      const { data: publicData } = supabase.storage.from('avatars').getPublicUrl(profile.avatarUrl);
      if (isActive) {
        applyAvatarCandidate(publicData.publicUrl ?? '', avatarSourceTimestamp);
      }
    };

    resolveAvatarUrl();

    return () => {
      isActive = false;
    };
  }, [applyAvatarCandidate, avatarSourceTimestamp, profile.avatarUrl]);

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
