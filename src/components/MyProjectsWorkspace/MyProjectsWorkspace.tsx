import { useState, useRef, useEffect } from 'react';
import type { Project } from '../../types/project';
import Folder from '../Folder/Folder';
import './MyProjectsWorkspace.css';

type MyProjectsWorkspaceProps = {
  projects: Project[];
  isLoading: boolean;
  onSelectProject: (project: Project) => void;
  onUpdateProject?: (projectId: string, newName: string) => Promise<void>;
  onRefresh?: () => void;
};

function MyProjectsWorkspace({ projects, isLoading, onSelectProject, onUpdateProject, onRefresh }: MyProjectsWorkspaceProps) {
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const getProjectColor = (projectType: string): string => {
    const colorMap: Record<string, string> = {
      'canvas': '#df4b26',
      'battle-maps': '#FF6B35',
      'character-sheets': '#4ECDC4',
      'item-cards': '#FFD93D',
      'game-boards': '#95E1D3',
      'campaign-journal': '#F38181',
    };
    return colorMap[projectType] || '#FF6B35';
  };

  useEffect(() => {
    if (editingProjectId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingProjectId]);

  const handleStartEdit = (project: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingProjectId(project.id);
    setEditingName(project.name);
  };

  const handleSaveEdit = async (projectId: string) => {
    if (!onUpdateProject || !editingName.trim() || editingName === projects.find(p => p.id === projectId)?.name) {
      setEditingProjectId(null);
      return;
    }

    setIsUpdating(true);
    try {
      await onUpdateProject(projectId, editingName.trim());
      setEditingProjectId(null);
    } catch (error) {
      console.error('Failed to update project name:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingProjectId(null);
    setEditingName('');
  };

  const handleKeyDown = (e: React.KeyboardEvent, projectId: string) => {
    if (e.key === 'Enter') {
      handleSaveEdit(projectId);
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
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
                {editingProjectId === project.id ? (
                  <input
                    ref={inputRef}
                    type="text"
                    className="my-projects__title my-projects__title--editing"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={() => handleSaveEdit(project.id)}
                    onKeyDown={(e) => handleKeyDown(e, project.id)}
                    disabled={isUpdating}
                    maxLength={100}
                  />
                ) : (
                  <h3
                    className="my-projects__title"
                    onClick={(e) => handleStartEdit(project, e)}
                    title={project.name}
                  >
                    {project.name}
                  </h3>
                )}
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
