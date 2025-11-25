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
  const expandedIcon = (
    <svg width="20px" height="20px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        d="M21 6H13M9 6V18M21 10H13M21 14H13M21 18H13M3 10L5 12L3 14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  const collapsedIcon = (
    <svg width="20px" height="20px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        d="M21 6H13M9 6V18M21 10H13M21 14H13M21 18H13M5 10L3 12L5 14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  return (
    <aside className={`sidebar ${isCollapsed ? 'sidebar--collapsed' : ''}`}>
      <div className="sidebar__header">
        <span className={`sidebar__title ${isCollapsed ? 'sidebar__title--hidden' : ''}`}>
          Action Menu
        </span>
        <button
          className={`sidebar__collapse-button ${isCollapsed ? 'sidebar__collapse-button--collapsed' : ''}`}
          onClick={onToggleCollapse}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <span className="sidebar__collapse-icon sidebar__collapse-icon--expanded">{expandedIcon}</span>
          <span className="sidebar__collapse-icon sidebar__collapse-icon--collapsed">{collapsedIcon}</span>
        </button>
      </div>

      <div className="sidebar__divider" aria-hidden />

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

      <div className="sidebar__divider" aria-hidden />

      <ProfileMenu isCollapsed={isCollapsed} items={profileMenuItems} />
    </aside>
  );
}

export default Sidebar;
