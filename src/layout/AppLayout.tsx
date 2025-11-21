import { ReactNode, useMemo, useState } from 'react';
import Sidebar from './Sidebar';
import WorkspaceArea from './WorkspaceArea';

export type Workspace = {
  id: string;
  title: string;
  icon: ReactNode;
};

// AppLayout owns the overall UI shell: sidebar state + active workspace.
// Extend the `workspaces` array to surface more destinations.
const workspaces: Workspace[] = [
  { id: 'home', title: 'Home', icon: '🏠' },
  { id: 'items', title: 'My Items', icon: '🗂️' },
  { id: 'settings', title: 'Settings', icon: '⚙️' },
];

function AppLayout() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(workspaces[0]?.id);

  const activeWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === activeWorkspaceId),
    [activeWorkspaceId],
  );

  return (
    <div className="app-layout">
      <Sidebar
        workspaces={workspaces}
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
