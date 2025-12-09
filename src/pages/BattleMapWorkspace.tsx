import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import type { Project } from '../types/project';

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
      <div style={{ padding: '2rem' }}>
        <p className="muted">Loading battle map...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div style={{ padding: '2rem' }}>
        <p className="muted">Battle map not found.</p>
        <button className="button button--ghost" onClick={() => navigate('/app')}>
          Back to Projects
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        overflow: 'hidden',
        backgroundColor: '#0a0a0a',
      }}
    >
      {/* Sidebar */}
      <div
        style={{
          width: '300px',
          borderRight: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '1rem' }}>
          <button
            className="button button--ghost"
            onClick={() => navigate('/app')}
            style={{ marginBottom: '0.5rem', width: '100%' }}
          >
            Back to Projects
          </button>
          <h2 style={{ margin: '0.5rem 0' }}>{project?.name}</h2>
        </div>
      </div>

      {/* Main Area */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '1rem',
        }}
      >
        {/* Content will go here */}
      </div>
    </div>
  );
}

export default BattleMapWorkspace;
