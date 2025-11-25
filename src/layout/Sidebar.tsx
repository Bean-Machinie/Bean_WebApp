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
    <svg width="20px" height="20px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M13 19L6.70711 12.7071C6.31658 12.3166 6.31658 11.6834 6.70711 11.2929L13 5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M18 19L18 5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
  );



  const collapsedIcon = (
    <svg width="20px" height="20px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M11 5L17.2929 11.2929C17.6834 11.6834 17.6834 12.3166 17.2929 12.7071L11 19" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M6 5L6 19" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
  );

  return (
    <aside className={`sidebar ${isCollapsed ? 'sidebar--collapsed' : ''}`}>
      <div className="sidebar__header">
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
