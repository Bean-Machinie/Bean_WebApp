import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { GridStack, GridStackNode } from 'gridstack';
import 'gridstack/dist/gridstack.min.css';
import { useAuth } from '../context/AuthContext';
import { generateClientId } from '../lib/utils';
import { useBattleMap } from '../hooks/useBattleMap';
import { DEFAULT_BATTLE_MAP_CONFIG } from '../services/battleMapStorage';
import type { BattleMapConfig, BattleMapWidget } from '../types/battlemap';
import './BattleMapWorkspace.css';

function BattleMapWorkspace() {
  const { projectId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const {
    project,
    config,
    setConfig,
    isLoading,
    isSaving,
    error,
    storageMode,
    saveConfig,
  } = useBattleMap(projectId, user?.id);

  const applyingConfigRef = useRef(false);
  const configRef = useRef<BattleMapConfig>(DEFAULT_BATTLE_MAP_CONFIG);
  const gridColumnsRef = useRef<number>(DEFAULT_BATTLE_MAP_CONFIG.gridColumns);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const gridRef = useRef<HTMLDivElement>(null);
  const gridStackRef = useRef<GridStack | null>(null);
  const [gridColumns, setGridColumns] = useState(DEFAULT_BATTLE_MAP_CONFIG.gridColumns);
  const [widgetCounter, setWidgetCounter] = useState(1);
  const [hasRenderedConfig, setHasRenderedConfig] = useState(false);
  const [logEntries, setLogEntries] = useState<string[]>([]);
  const [showLog, setShowLog] = useState(true);
  const hasInitializedGridRef = useRef(false);

  const log = useCallback(
    (message: string, detail?: unknown) => {
      const timestamp = new Date().toISOString().split('T')[1]?.replace('Z', '') ?? '';
      const line = detail ? `${timestamp} ${message} | ${JSON.stringify(detail)}` : `${timestamp} ${message}`;
      setLogEntries((prev) => [line, ...prev].slice(0, 80));
      if (detail !== undefined) {
        // eslint-disable-next-line no-console
        console.log(message, detail);
      } else {
        // eslint-disable-next-line no-console
        console.log(message);
      }
    },
    [],
  );

  useEffect(() => {
    configRef.current = config;
    const nextColumns = config.gridColumns ?? DEFAULT_BATTLE_MAP_CONFIG.gridColumns;
    setGridColumns(nextColumns);
    gridColumnsRef.current = nextColumns;
    setWidgetCounter((config.widgets?.length ?? 0) + 1);
  }, [config]);

  useEffect(() => {
    gridColumnsRef.current = gridColumns;
  }, [gridColumns]);

  useEffect(() => {
    setHasRenderedConfig(false);
  }, [projectId]);

  useEffect(() => {
    if (projectId) {
      log('BattleMap mount', { projectId });
    }
  }, [log, projectId]);

  useEffect(() => {
    if (project) {
      log('Project loaded', { name: project.name, id: project.id });
    }
  }, [log, project]);

  useEffect(() => {
    if (error) {
      log('Error state', error);
    }
  }, [error, log]);

  const syncGridGuides = useCallback(() => {
    if (!gridStackRef.current || !gridRef.current) return;

    const cellWidth = gridStackRef.current.cellWidth();

    if (cellWidth && cellWidth > 0) {
      gridStackRef.current.cellHeight(cellWidth, false);

      gridRef.current.style.setProperty('--grid-cell-width', `${cellWidth}px`);
      gridRef.current.style.setProperty('--grid-cell-height', `${cellWidth}px`);
    }
  }, []);

  const readWidgetsFromGrid = useCallback((): BattleMapWidget[] => {
    if (!gridStackRef.current) return [];

    const nodes: GridStackNode[] = gridStackRef.current.engine?.nodes ?? [];
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

  const queueSave = useCallback(
    (nextConfig: BattleMapConfig) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(() => {
        saveConfig(nextConfig);
      }, 300);
    },
    [saveConfig],
  );

  useEffect(
    () => () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    },
    [],
  );

  const applyConfigToGrid = useCallback(
    (nextConfig: BattleMapConfig) => {
      if (!gridStackRef.current) return;

      applyingConfigRef.current = true;

      try {
        gridStackRef.current.removeAll(false);

        const columns = nextConfig.gridColumns || DEFAULT_BATTLE_MAP_CONFIG.gridColumns;
        setGridColumns(columns);
        gridColumnsRef.current = columns;
        gridStackRef.current.column(columns);
        log('Apply config to grid', { columns, widgets: nextConfig.widgets.length });

        nextConfig.widgets.forEach((widget) => {
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

        setWidgetCounter((nextConfig.widgets?.length ?? 0) + 1);
        syncGridGuides();
      } finally {
        applyingConfigRef.current = false;
      }
    },
    [log, syncGridGuides],
  );

  const initGridStack = useCallback(() => {
    if (hasInitializedGridRef.current) {
      return undefined;
    }

    if (!project) {
      log('GridStack init skipped: project missing');
      return undefined;
    }

    if (!gridRef.current) {
      log('GridStack init skipped: gridRef missing, retrying soon');
      requestAnimationFrame(() => initGridStack());
      return undefined;
    }

    gridStackRef.current = GridStack.init(
      {
        column: gridColumnsRef.current,
        cellHeight: 'auto',
        margin: 8,
        animate: true,
        float: true,
        resizable: {
          handles: 'e,se,s,sw,w',
        },
      },
      gridRef.current,
    );

    hasInitializedGridRef.current = true;
    log('GridStack initialized', { columns: gridColumnsRef.current });

    setTimeout(() => {
      syncGridGuides();
    }, 0);

    const handleGridChange = () => {
      if (applyingConfigRef.current) return;

      const widgets = readWidgetsFromGrid();
      const nextConfig: BattleMapConfig = {
        ...configRef.current,
        gridColumns: gridColumnsRef.current,
        widgets,
      };

      setConfig(nextConfig);
      queueSave(nextConfig);
      log('Grid change persisted', { widgets: widgets.length });
    };

    gridStackRef.current.on('change', handleGridChange);
    gridStackRef.current.on('removed', handleGridChange);

    return () => {
      gridStackRef.current?.off('change', handleGridChange);
      gridStackRef.current?.off('removed', handleGridChange);
      gridStackRef.current?.destroy(false);
      gridStackRef.current = null;
      hasInitializedGridRef.current = false;
      log('GridStack destroyed');
    };
  }, [gridColumnsRef, gridRef, log, project, queueSave, readWidgetsFromGrid, setConfig, syncGridGuides]);

  useLayoutEffect(() => {
    const cleanup = initGridStack();
    return cleanup;
  }, [initGridStack, project]);

  useEffect(() => {
    if (!gridStackRef.current || hasRenderedConfig) return;

    applyConfigToGrid(config);
    setHasRenderedConfig(true);
  }, [applyConfigToGrid, config, hasRenderedConfig]);

  useEffect(() => {
    const handleResize = () => syncGridGuides();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [syncGridGuides]);

  const handleAddWidget = () => {
    if (!gridStackRef.current) {
      log('Add widget blocked: grid not ready, retrying init');
      initGridStack();
      if (!gridStackRef.current) {
        return;
      }
    }

    const widgetId = generateClientId();
    const widget = {
      id: widgetId,
      x: 0,
      y: 0,
      w: 2,
      h: 2,
      content: `<div class="battlemap-widget-content">Widget ${widgetCounter}</div>`,
    };

    log('Adding widget', widget);

    const el = gridStackRef.current.addWidget({ ...widget, autoPosition: true });
    if (!el) {
      const nextConfig: BattleMapConfig = {
        ...configRef.current,
        gridColumns: gridColumnsRef.current,
        widgets: [...configRef.current.widgets, widget],
      };

      setConfig(nextConfig);
      queueSave(nextConfig);
      return;
    }

    el.dataset.widgetId = widgetId;
    el.dataset.content = widget.content;

    const widgets = readWidgetsFromGrid();
    const nextConfig: BattleMapConfig = {
      ...configRef.current,
      gridColumns: gridColumnsRef.current,
      widgets: widgets.length ? widgets : [...configRef.current.widgets, widget],
    };

    setWidgetCounter((prev) => prev + 1);
    setConfig(nextConfig);
    queueSave(nextConfig);
  };

  const handleGridScaleChange = (newColumns: number) => {
    log('Grid scale change', newColumns);
    setGridColumns(newColumns);
    gridColumnsRef.current = newColumns;

    if (gridStackRef.current) {
      gridStackRef.current.column(newColumns);
      syncGridGuides();
    }

    const nextConfig: BattleMapConfig = {
      ...configRef.current,
      gridColumns: newColumns,
    };

    setConfig(nextConfig);
    queueSave(nextConfig);
  };

  if (isLoading) {
    return (
      <div className="battlemap-workspace__loading">
        <p className="battlemap-workspace__loading-text">Loading battle map...</p>
      </div>
    );
  }

  if (!project || error) {
    return (
      <div className="battlemap-workspace__error">
        <p className="battlemap-workspace__error-text">
          {error ?? 'Battle map not found.'}
        </p>
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

          <div className="battlemap-workspace__control-section">
            <h3 className="battlemap-workspace__control-title">Widgets</h3>
            <button
              className="button button--primary battlemap-workspace__add-widget-btn"
              onClick={handleAddWidget}
            >
              Add Widget
            </button>
            <p className="battlemap-workspace__hint">
              Auto-save: {isSaving ? 'Saving...' : 'Synced'} ({storageMode} storage)
            </p>
          </div>
        </div>
      </div>

      <div className="battlemap-workspace__main">
        <div ref={gridRef} className="grid-stack battlemap-workspace__grid" />
        <div className="battlemap-log">
          <div className="battlemap-log__header">
            <span>Debug Log</span>
            <div className="battlemap-log__actions">
              <button
                className="battlemap-log__button"
                type="button"
                onClick={() => setShowLog((v) => !v)}
              >
                {showLog ? 'Hide' : 'Show'}
              </button>
              <button
                className="battlemap-log__button"
                type="button"
                onClick={() => setLogEntries([])}
              >
                Clear
              </button>
            </div>
          </div>
          {showLog ? (
            <div className="battlemap-log__body">
              {logEntries.map((entry, idx) => (
                // eslint-disable-next-line react/no-array-index-key
                <div className="battlemap-log__line" key={idx}>
                  {entry}
                </div>
              ))}
              {logEntries.length === 0 ? (
                <div className="battlemap-log__line">No entries yet.</div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default BattleMapWorkspace;
