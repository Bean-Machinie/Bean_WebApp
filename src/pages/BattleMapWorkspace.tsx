import { useCallback, useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import type { Project } from '../types/project';
import { GridStack } from 'gridstack';
import 'gridstack/dist/gridstack.min.css';
import './BattleMapWorkspace.css';

function BattleMapWorkspace() {
  const { projectId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [isLoadingProject, setIsLoadingProject] = useState(true);

  // GridStack state
  const gridRef = useRef<HTMLDivElement>(null);
  const gridStackRef = useRef<GridStack | null>(null);
  const [gridColumns, setGridColumns] = useState(12);
  const [cellHeight, setCellHeight] = useState(50);
  const [widgetCounter, setWidgetCounter] = useState(1);

  const syncGridGuides = useCallback(() => {
    if (!gridStackRef.current || !gridRef.current) return;

    const width = gridStackRef.current.cellWidth();
    const height = gridStackRef.current.cellHeight();
    const normalizedHeight = typeof height === 'number' ? `${height}px` : height;

    gridRef.current.style.setProperty('--grid-cell-width', `${width}px`);
    gridRef.current.style.setProperty('--grid-cell-height', normalizedHeight);
  }, []);

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

  // Initialize GridStack
  useEffect(() => {
    if (!gridRef.current || !project) return;

    gridStackRef.current = GridStack.init(
      {
        column: gridColumns,
        cellHeight: cellHeight,
        margin: 8,
        animate: true,
        float: true,
        resizable: {
          handles: 'e,se,s,sw,w',
        },
      },
      gridRef.current
    );

    syncGridGuides();

    return () => {
      if (gridStackRef.current) {
        gridStackRef.current.destroy(false);
      }
    };
  }, [project, gridColumns, cellHeight, syncGridGuides]);

  useEffect(() => {
    const handleResize = () => syncGridGuides();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [syncGridGuides]);

  const handleAddWidget = () => {
    if (!gridStackRef.current) return;

    const widget = {
      w: 2,
      h: 2,
      content: `<div class="battlemap-widget-content">Widget ${widgetCounter}</div>`,
    };

    gridStackRef.current.addWidget(widget);
    setWidgetCounter(widgetCounter + 1);
  };

  const handleGridColumnsChange = (newColumns: number) => {
    setGridColumns(newColumns);
    if (gridStackRef.current) {
      gridStackRef.current.column(newColumns);
      syncGridGuides();
    }
  };

  const handleCellHeightChange = (newHeight: number) => {
    setCellHeight(newHeight);
    if (gridStackRef.current) {
      gridStackRef.current.cellHeight(newHeight);
      syncGridGuides();
    }
  };

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

        {/* Grid Configuration */}
        <div className="battlemap-workspace__controls">
          <div className="battlemap-workspace__control-section">
            <h3 className="battlemap-workspace__control-title">Grid Settings</h3>

            <div className="battlemap-workspace__control-group">
              <label className="battlemap-workspace__label">
                Grid Columns: {gridColumns}
              </label>
              <input
                type="range"
                className="battlemap-workspace__slider"
                min="1"
                max="24"
                value={gridColumns}
                onChange={(e) => handleGridColumnsChange(Number(e.target.value))}
              />
            </div>

            <div className="battlemap-workspace__control-group">
              <label className="battlemap-workspace__label">
                Cell Height: {cellHeight}px
              </label>
              <input
                type="range"
                className="battlemap-workspace__slider"
                min="20"
                max="200"
                value={cellHeight}
                onChange={(e) => handleCellHeightChange(Number(e.target.value))}
              />
            </div>
          </div>

          {/* Widget Controls */}
          <div className="battlemap-workspace__control-section">
            <h3 className="battlemap-workspace__control-title">Widgets</h3>
            <button
              className="button button--primary battlemap-workspace__add-widget-btn"
              onClick={handleAddWidget}
            >
              Add Widget
            </button>
          </div>
        </div>
      </div>

      {/* Main Workspace Area */}
      <div className="battlemap-workspace__main">
        <div ref={gridRef} className="grid-stack battlemap-workspace__grid">
          {/* GridStack items will be added here dynamically */}
        </div>
      </div>
    </div>
  );
}

export default BattleMapWorkspace;
