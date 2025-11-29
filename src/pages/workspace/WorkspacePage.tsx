import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import type { Project } from '../../types/project';

function WorkspacePage() {
  const { projectId, projectType } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadProject = async () => {
      if (!projectId || !user) {
        return;
      }

      setIsLoading(true);
      const { data, error: fetchError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .eq('user_id', user.id)
        .single();

      if (fetchError) {
        setError(fetchError.message);
        setIsLoading(false);
        return;
      }

      setProject(data as Project);
      setIsLoading(false);
    };

    loadProject();
  }, [projectId, user]);


  return (
    <div className="page">
      <header className="page__header">
        <div>
          <p className="muted">Workspace</p>
          <h1>{project?.name ?? 'Loading project…'}</h1>
          <p className="muted">Project type: {project?.project_type ?? projectType}</p>
        </div>

        <button className="button button--ghost" onClick={() => navigate('/app')}>
          Back to My Projects
        </button>
      </header>

      {isLoading ? (
        <p className="muted">Loading project…</p>
      ) : error ? (
        <div className="card">
          <div className="card__body">
            <p className="strong">Unable to load project</p>
            <p className="muted">{error}</p>
          </div>
        </div>
      ) : project ? (
        <div className="card">
          <div className="card__body">
            <p className="muted">Workspace content will appear here.</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default WorkspacePage;
