import type { Project } from '../../types/project';
import Folder from '../Folder/Folder';
import './MyProjectsWorkspace.css';

type MyProjectsWorkspaceProps = {
  projects: Project[];
  isLoading: boolean;
  onSelectProject: (project: Project) => void;
  onRefresh?: () => void;
};

function MyProjectsWorkspace({ projects, isLoading, onSelectProject, onRefresh }: MyProjectsWorkspaceProps) {
  const getProjectColor = (projectType: string): string => {
    const colorMap: Record<string, string> = {
      'canvas': '#5227FF',
      'battle-maps': '#FF6B35',
      'character-sheets': '#4ECDC4',
      'item-cards': '#FFD93D',
      'game-boards': '#95E1D3',
      'campaign-journal': '#F38181',
    };
    return colorMap[projectType] || '#5227FF';
  };

  return (
    <div className="my-projects">
      <div className="my-projects__toolbar">
        <div>
          <p className="my-projects__eyebrow">Projects</p>
          <h2>My Projects</h2>
        </div>

        {onRefresh ? (
          <button className="button button--ghost" onClick={onRefresh} disabled={isLoading}>
            Refresh
          </button>
        ) : null}
      </div>

      {isLoading ? (
        <p className="muted">Loading your projects…</p>
      ) : projects.length === 0 ? (
        <div className="my-projects__empty">
          <p className="muted">No projects yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="my-projects__grid">
          {projects.map((project) => (
            <div key={project.id} className="my-projects__folder-wrapper">
              <Folder
                color={getProjectColor(project.project_type)}
                size={1.2}
                onClick={() => onSelectProject(project)}
              />
              <div className="my-projects__folder-info">
                <h3 className="my-projects__title">{project.name}</h3>
                <div className="my-projects__meta">
                  <span className="my-projects__type">{project.project_type}</span>
                  <span className="my-projects__date">
                    {project.created_at ? new Date(project.created_at).toLocaleDateString() : ''}
                  </span>
                </div>
                {project.description ? <p className="my-projects__description">{project.description}</p> : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default MyProjectsWorkspace;
