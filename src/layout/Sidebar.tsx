import { CSSProperties } from 'react';
import { Workspace } from './AppLayout';

type SidebarProps = {
  workspaces: Workspace[];
  isCollapsed: boolean;
  activeWorkspaceId?: string;
  onSelectWorkspace: (workspaceId: string) => void;
  onToggleCollapse: () => void;
};

// Sidebar widths are set here so they are easy to tweak later.
const SIDEBAR_WIDTHS = {
  expanded: 256,
  collapsed: 76,
};

function Sidebar({
  workspaces,
  isCollapsed,
  activeWorkspaceId,
  onSelectWorkspace,
  onToggleCollapse,
}: SidebarProps) {
  const sidebarStyle: CSSProperties = {
    // These CSS variables are consumed in App.css for the width transition.
    ['--sidebar-width-expanded' as const]: `${SIDEBAR_WIDTHS.expanded}px`,
    ['--sidebar-width-collapsed' as const]: `${SIDEBAR_WIDTHS.collapsed}px`,
  };

  return (
    <aside
      className={`sidebar ${isCollapsed ? 'sidebar--collapsed' : ''}`}
      style={sidebarStyle}
    >
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
    </aside>
  );
}

export default Sidebar;
