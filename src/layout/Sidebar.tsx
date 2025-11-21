import { Workspace } from './AppLayout';

type SidebarProps = {
  workspaces: Workspace[];
  isCollapsed: boolean;
  activeWorkspaceId?: string;
  onSelectWorkspace: (workspaceId: string) => void;
  onToggleCollapse: () => void;
};

function Sidebar({
  workspaces,
  isCollapsed,
  activeWorkspaceId,
  onSelectWorkspace,
  onToggleCollapse,
}: SidebarProps) {
  return (
    <aside className={`sidebar ${isCollapsed ? 'sidebar--collapsed' : ''}`}>
      <button className="sidebar__toggle" onClick={onToggleCollapse}>
        {isCollapsed ? '➜' : '⬅'}
        {!isCollapsed && <span className="sidebar__toggle-label">Collapse</span>}
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
              {!isCollapsed && <span className="workspace-item__title">{workspace.title}</span>}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

export default Sidebar;
