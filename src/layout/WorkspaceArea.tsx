import { useMemo, useState } from 'react';
import { Workspace } from './AppLayout';

type WorkspaceAreaProps = {
  activeWorkspace?: Workspace;
};

type ProjectCard = {
  id: string;
  title: string;
};

// Replace the placeholder content below with routed pages, editors, or other workspace UIs.
function WorkspaceArea({ activeWorkspace }: WorkspaceAreaProps) {
  const [projects, setProjects] = useState<ProjectCard[]>([
    { id: 'project-1', title: 'Brand refresh' },
    { id: 'project-2', title: 'Mobile concept' },
  ]);

  const handleAddProject = () => {
    setProjects((prev) => [
      ...prev,
      { id: `project-${Date.now()}`, title: `Untitled project ${prev.length + 1}` },
    ]);
  };

  const workspaceContent = useMemo(() => {
    if (!activeWorkspace) {
      return <p>Choose a workspace from the sidebar to get started.</p>;
    }

    if (activeWorkspace.id === 'my-projects') {
      return <MyProjectsBoard projects={projects} onAddProject={handleAddProject} />;
    }

    return (
      <p>Page content goes here. Swap this section out for your real feature area.</p>
    );
  }, [activeWorkspace, handleAddProject, projects]);

  return (
    <main className="workspace-area">
      <div className="workspace-area__header">
        <p className="workspace-area__eyebrow">Workspace</p>
        <h1>{activeWorkspace ? activeWorkspace.title : 'Select a workspace'}</h1>
      </div>

      <div className="workspace-area__body">{workspaceContent}</div>
    </main>
  );
}

type MyProjectsBoardProps = {
  projects: ProjectCard[];
  onAddProject: () => void;
};

function MyProjectsBoard({ projects, onAddProject }: MyProjectsBoardProps) {
  return (
    <section className="project-board" aria-label="My projects">
      <div className="project-board__header">
        <div>
          <p className="project-board__eyebrow">Projects</p>
          <h2 className="project-board__title">Workspace overview</h2>
          <p className="project-board__subtitle">Add a new project card to get started.</p>
        </div>

        <button type="button" className="project-board__add" onClick={onAddProject}>
          + New project
        </button>
      </div>

      <div className="project-board__grid">
        {projects.map((project) => (
          <article key={project.id} className="project-card">
            <div className="project-card__title">{project.title}</div>
            <p className="project-card__empty">Blank card — add details later.</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export default WorkspaceArea;
