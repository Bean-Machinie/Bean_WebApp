import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import type { Project } from '../types/project';
import './BattleMapWorkspace.css';

function BattleMapWorkspace() {
  const { projectId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [isLoadingProject, setIsLoadingProject] = useState(true);

  useEffect(() => {
    const loadProject = async () => {
      if (!projectId || !user) {
        return;
      }

      setIsLoadingProject(true);
      const { data, error: fetchError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .eq('user_id', user.id)
        .single();

      if (fetchError) {
        console.error('Failed to load project:', fetchError);
        setIsLoadingProject(false);
        return;
      }

      setProject(data as Project);
      setIsLoadingProject(false);
    };

    loadProject();
  }, [projectId, user]);

  if (isLoadingProject) {
    return (
      <div className="battlemap-workspace__loading">
        <p className="battlemap-workspace__loading-text">Loading battle map...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="battlemap-workspace__error">
        <p className="battlemap-workspace__error-text">Battle map not found.</p>
        <button
          className="button button--ghost battlemap-workspace__error-button"
          onClick={() => navigate('/app')}
        >
          Back to Projects
        </button>
      </div>
    );
  }

  return (
    <div className="battlemap-workspace">
      {/* Left Sidebar */}
      <div className="battlemap-workspace__sidebar">
        <div className="battlemap-workspace__sidebar-header">
          <button
            className="button button--ghost battlemap-workspace__back-button"
            onClick={() => navigate('/app')}
          >
            Back to Projects
          </button>
          <h2 className="battlemap-workspace__project-name">{project.name}</h2>
        </div>
      </div>

      {/* Main Workspace Area */}
      <div className="battlemap-workspace__main">
        <div className="battlemap-workspace__content">
          {/* Battle map content will go here */}
        </div>
      </div>
    </div>
  );
}

export default BattleMapWorkspace;
