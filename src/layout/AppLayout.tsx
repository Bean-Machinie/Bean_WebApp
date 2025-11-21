import { ReactNode, useMemo, useState } from 'react';
import MyProjectsIcon from '../icons/MyProjectsIcon';
import NewProjectIcon from '../icons/NewProjectIcon';
import PlaygroundIcon from '../icons/PlaygroundIcon';
import Sidebar from './Sidebar';
import WorkspaceArea from './WorkspaceArea';

export type Workspace = {
  id: string;
  title: string;
  icon: ReactNode;
  source?: 'workspace' | 'profile';
};

// AppLayout owns the overall UI shell: sidebar state + active workspace/profile page.
// Extend the `workspaces` and `profileMenuItems` arrays to surface more destinations.
// Edit the workspaces array to surface new destinations in the middle of the sidebar.
const workspaces: Workspace[] = [
  { id: 'my-projects', title: 'My Projects', icon: <MyProjectsIcon />, source: 'workspace' },
  { id: 'new-project', title: 'New Project', icon: <NewProjectIcon />, source: 'workspace' },
  { id: 'playground', title: 'Playground', icon: <PlaygroundIcon />, source: 'workspace' },
];

const profileIcon = (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    stroke="currentColor"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <circle cx="12" cy="9" r="3.25" />
    <path d="M6.5 18.5c0-2.761 2.239-5 5-5h1c2.761 0 5 2.239 5 5" />
  </svg>
);

const themesIcon = (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    stroke="currentColor"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M12 3v18" />
    <path d="M8.5 7.5c0 2.485-1.567 4.5-3.5 4.5 0-2.485 1.567-4.5 3.5-4.5Z" />
    <path d="M15.5 12.5c0 2.485 1.567 4.5 3.5 4.5 0-2.485-1.567-4.5-3.5-4.5Z" />
    <path d="M8 15.5c0 2.485-1.567 4.5-3.5 4.5 0-2.485 1.567-4.5 3.5-4.5Z" />
    <path d="M16 4.5c0 2.485 1.567 4.5 3.5 4.5 0-2.485-1.567-4.5-3.5-4.5Z" />
  </svg>
);

const settingsIcon = (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    stroke="currentColor"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <circle cx="12" cy="12" r="3.25" />
    <path d="m19.4 15-.86.5a2 2 0 0 0-.92 1.74l.02.99a1 1 0 0 1-1.5.9l-.86-.5a2 2 0 0 0-2 0l-.86.5a1 1 0 0 1-1.5-.9l.02-.99A2 2 0 0 0 9.46 15L8.6 14.5a1 1 0 0 1 0-1.74l.86-.5a2 2 0 0 0 .92-1.74l-.02-.99a1 1 0 0 1 1.5-.9l.86.5a2 2 0 0 0 2 0l.86-.5a1 1 0 0 1 1.5.9l-.02.99a2 2 0 0 0 .92 1.74l.86.5a1 1 0 0 1 0 1.74Z" />
  </svg>
);

// Update these to change the drop-up menu items that live under the profile row.
const profileMenuItems: Workspace[] = [
  { id: 'profile', title: 'Profile', icon: profileIcon, source: 'profile' },
  { id: 'themes', title: 'Themes', icon: themesIcon, source: 'profile' },
  { id: 'settings', title: 'Settings', icon: settingsIcon, source: 'profile' },
];

function AppLayout() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(workspaces[0]?.id);

  const allDestinations = useMemo(() => [...workspaces, ...profileMenuItems], []);

  const activeWorkspace = useMemo(
    () => allDestinations.find((workspace) => workspace.id === activeWorkspaceId),
    [allDestinations, activeWorkspaceId],
  );

  return (
    <div className="app-layout">
      <Sidebar
        workspaces={workspaces}
        profileMenuItems={profileMenuItems}
        isCollapsed={isCollapsed}
        activeWorkspaceId={activeWorkspaceId}
        onSelectWorkspace={setActiveWorkspaceId}
        onToggleCollapse={() => setIsCollapsed((prev) => !prev)}
      />

      <WorkspaceArea activeWorkspace={activeWorkspace} />
    </div>
  );
}

export default AppLayout;
