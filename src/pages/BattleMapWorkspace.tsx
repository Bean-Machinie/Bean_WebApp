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
  const [widgetCounter, setWidgetCounter] = useState(1);

  const syncGridGuides = useCallback(() => {
    if (!gridStackRef.current || !gridRef.current) return;

    const cellWidth = gridStackRef.current.cellWidth();

    // Make cells square: set height equal to width for 1:1 aspect ratio
    if (cellWidth && cellWidth > 0) {
      gridStackRef.current.cellHeight(cellWidth, false);

      gridRef.current.style.setProperty('--grid-cell-width', `${cellWidth}px`);
      gridRef.current.style.setProperty('--grid-cell-height', `${cellWidth}px`);

      console.log('Grid sync:', {
        gridUnitWidth: cellWidth,
        gridUnitHeight: cellWidth,
        width: cellWidth - 8,
        heightValue: cellWidth - 8,
        marginValue: 8,
      });
    }
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
        cellHeight: 'auto', // Will be set by syncGridGuides to match width
        margin: 8,
        animate: true,
        float: true,
        resizable: {
          handles: 'e,se,s,sw,w',
        },
      },
      gridRef.current
    );

    // Ensure grid is mounted before syncing
    setTimeout(() => {
      syncGridGuides();
    }, 0);

    return () => {
      if (gridStackRef.current) {
        gridStackRef.current.destroy(false);
      }
    };
  }, [project, gridColumns, syncGridGuides]);

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

  const handleGridScaleChange = (newColumns: number) => {
    setGridColumns(newColumns);
    if (gridStackRef.current) {
      gridStackRef.current.column(newColumns);
      // Sync to ensure cells remain square after column change
      setTimeout(() => {
        syncGridGuides();
      }, 0);
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
                Grid Scale: {gridColumns} columns
              </label>
              <input
                type="range"
                className="battlemap-workspace__slider"
                min="4"
                max="24"
                value={gridColumns}
                onChange={(e) => handleGridScaleChange(Number(e.target.value))}
              />
              <p className="battlemap-workspace__hint">
                Adjust grid density (cells are always square)
              </p>
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
