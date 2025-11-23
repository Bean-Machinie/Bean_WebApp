import ProfileMenu from '../components/ProfileMenu/ProfileMenu';
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

      <ProfileMenu isCollapsed={isCollapsed} items={profileMenuItems} />
    </aside>
  );
}

export default Sidebar;
