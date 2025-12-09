import { useCallback, useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import type { Project } from '../types/project';
import { generateClientId } from '../lib/utils';
import { GridStack } from 'gridstack';
import 'gridstack/dist/gridstack.min.css';
import './BattleMapWorkspace.css';

type BattleMapWidget = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  content: string;
};

type BattleMapConfig = {
  gridColumns: number;
  widgets: BattleMapWidget[];
};

const DEFAULT_CONFIG: BattleMapConfig = {
  gridColumns: 12,
  widgets: [],
};

function BattleMapWorkspace() {
  const { projectId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [isLoadingProject, setIsLoadingProject] = useState(true);
  const [isConfigLoaded, setIsConfigLoaded] = useState(false);
  const applyingConfigRef = useRef(false);

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

  const getCurrentWidgets = useCallback((): BattleMapWidget[] => {
    if (!gridStackRef.current) return [];

    const nodes = gridStackRef.current.engine?.nodes ?? [];
    return nodes.map((node) => {
      const nodeId =
        (node.id as string | undefined) ||
        node.el?.getAttribute('gs-id') ||
        node.el?.dataset.widgetId ||
        generateClientId();

      if (node.el) {
        node.el.dataset.widgetId = nodeId;
      }

      return {
        id: nodeId,
        x: node.x ?? 0,
        y: node.y ?? 0,
        w: node.w ?? 1,
        h: node.h ?? 1,
        content:
          node.el?.dataset.content ||
          node.el?.querySelector('.battlemap-widget-content')?.innerHTML ||
          'Widget',
      };
    });
  }, []);

  const persistBattleMapConfig = useCallback(
    async (nextConfig?: Partial<BattleMapConfig>) => {
      if (!project || !user || !gridStackRef.current || applyingConfigRef.current) return;

      const configToSave: BattleMapConfig = {
        gridColumns: nextConfig?.gridColumns ?? gridColumns,
        widgets: nextConfig?.widgets ?? getCurrentWidgets(),
      };

      await supabase
        .from('projects')
        .update({ battle_map_config: configToSave })
        .eq('id', project.id)
        .eq('user_id', user.id);

      setProject((prev) =>
        prev ? { ...prev, battle_map_config: configToSave } : prev
      );
    },
    [getCurrentWidgets, gridColumns, project, user]
  );

  const applyConfigToGrid = useCallback(
    (config: BattleMapConfig) => {
      if (!gridStackRef.current) return;

      applyingConfigRef.current = true;

      try {
        gridStackRef.current.removeAll(false);

        setGridColumns(config.gridColumns || DEFAULT_CONFIG.gridColumns);
        gridStackRef.current.column(config.gridColumns || DEFAULT_CONFIG.gridColumns);

        config.widgets.forEach((widget) => {
          const el = gridStackRef.current?.addWidget({
            id: widget.id,
            x: widget.x,
            y: widget.y,
            w: widget.w,
            h: widget.h,
            content: widget.content,
          });

          if (el) {
            el.dataset.widgetId = widget.id;
            el.dataset.content = widget.content;
          }
        });

        setWidgetCounter((config.widgets?.length || 0) + 1);
        syncGridGuides();
      } finally {
        applyingConfigRef.current = false;
      }
    },
    [syncGridGuides]
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

    // Persist on drag/resize/move changes
    gridStackRef.current?.on('change', () => {
      persistBattleMapConfig();
    });
    gridStackRef.current?.on('removed', () => {
      persistBattleMapConfig();
    });

    return () => {
      if (gridStackRef.current) {
        gridStackRef.current.destroy(false);
      }
    };
  }, [project, gridColumns, syncGridGuides, persistBattleMapConfig]);

  // Load saved config into GridStack once grid is ready
  useEffect(() => {
    if (!gridStackRef.current || !project || isConfigLoaded) return;

    const savedConfig = (project as unknown as { battle_map_config?: BattleMapConfig })
      .battle_map_config;

    const configToApply: BattleMapConfig =
      savedConfig && savedConfig.widgets ? savedConfig : DEFAULT_CONFIG;

    applyConfigToGrid(configToApply);
    setIsConfigLoaded(true);
  }, [applyConfigToGrid, isConfigLoaded, project]);

  useEffect(() => {
    const handleResize = () => syncGridGuides();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [syncGridGuides]);

  const handleAddWidget = () => {
    if (!gridStackRef.current) return;

    const widgetId = generateClientId();
    const widget = {
      id: widgetId,
      w: 2,
      h: 2,
      content: `<div class="battlemap-widget-content">Widget ${widgetCounter}</div>`,
    };

    const el = gridStackRef.current.addWidget(widget);
    if (el) {
      el.dataset.widgetId = widgetId;
      el.dataset.content = widget.content;
    }

    setWidgetCounter(widgetCounter + 1);
    persistBattleMapConfig();
  };

  const handleGridScaleChange = (newColumns: number) => {
    setGridColumns(newColumns);
    if (gridStackRef.current) {
      gridStackRef.current.column(newColumns);
      // Sync to ensure cells remain square after column change
      setTimeout(() => {
        syncGridGuides();
      }, 0);

      persistBattleMapConfig({ gridColumns: newColumns });
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
