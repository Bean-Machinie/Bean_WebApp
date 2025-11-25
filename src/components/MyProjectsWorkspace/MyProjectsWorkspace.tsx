import type { Project } from '../../types/project';
import './MyProjectsWorkspace.css';

type MyProjectsWorkspaceProps = {
  projects: Project[];
  isLoading: boolean;
  onSelectProject: (project: Project) => void;
  onRefresh?: () => void;
};

function MyProjectsWorkspace({ projects, isLoading, onSelectProject, onRefresh }: MyProjectsWorkspaceProps) {
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
            <button
              key={project.id}
              className="my-projects__card"
              onClick={() => onSelectProject(project)}
            >
              <div className="my-projects__card-header">
                <span className="my-projects__type">{project.project_type}</span>
                <span className="my-projects__date">
                  {project.created_at ? new Date(project.created_at).toLocaleDateString() : ''}
                </span>
              </div>
              <h3 className="my-projects__title">{project.name}</h3>
              {project.description ? <p className="muted">{project.description}</p> : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default MyProjectsWorkspace;
