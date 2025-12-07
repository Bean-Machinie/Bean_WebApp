import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import type { Project } from '../types/project';
import type { Tile } from '../types/battlemap';
import { useBattleMap } from '../hooks/useBattleMap';
import { useTiles } from '../hooks/useTiles';
import TileGrid from '../components/battlemap/TileGrid';
import TileSidebar from '../components/battlemap/TileSidebar';

function BattleMapWorkspace() {
  const { projectId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [isLoadingProject, setIsLoadingProject] = useState(true);

  const { battleMap, placedTiles, isLoading, error, addPlacedTile, removePlacedTile } =
    useBattleMap(projectId || '');
  const { tiles, isLoading: isLoadingTiles, refreshTiles } = useTiles();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) return;

    // Extract tile data from the dragged item
    const tileData = active.data.current?.tile as Tile | undefined;
    if (!tileData) return;

    // Extract cell coordinates from the drop target
    const cellData = over.data.current as { x: number; y: number } | undefined;
    if (!cellData) return;

    // Add the tile to the grid
    addPlacedTile(tileData.id, cellData.x, cellData.y);
  };

  if (isLoadingProject || isLoading) {
    return (
      <div style={{ padding: '2rem' }}>
        <p className="muted">Loading battle map...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem' }}>
        <p className="strong">Error loading battle map</p>
        <p className="muted">{error}</p>
        <button className="button button--ghost" onClick={() => navigate('/app')}>
          Back to Projects
        </button>
      </div>
    );
  }

  if (!battleMap) {
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
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
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
          <div style={{ padding: '1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <button
              className="button button--ghost"
              onClick={() => navigate('/app')}
              style={{ marginBottom: '0.5rem', width: '100%' }}
            >
              Back to Projects
            </button>
            <h2 style={{ margin: '0.5rem 0' }}>{project?.name}</h2>
            <p className="muted" style={{ fontSize: '0.875rem' }}>
              {battleMap.width} × {battleMap.height} grid
            </p>
          </div>
          <TileSidebar tiles={tiles} isLoading={isLoadingTiles} onTileAdded={refreshTiles} />
        </div>

        {/* Main Grid Area */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '1rem',
          }}
        >
          <TileGrid
            battleMap={battleMap}
            placedTiles={placedTiles}
            onRemoveTile={removePlacedTile}
          />
        </div>
      </div>
    </DndContext>
  );
}

export default BattleMapWorkspace;
