import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import type { MouseEvent as ReactMouseEvent, WheelEvent as ReactWheelEvent } from 'react';
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
  const widgetTemplateSelector = '.battlemap-workspace__widget-template';

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
  const gridRowsRef = useRef<number>(DEFAULT_BATTLE_MAP_CONFIG.gridRows);
  const cellSizeRef = useRef<number>(DEFAULT_BATTLE_MAP_CONFIG.cellSize);
  const scaleRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  const gridRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const gridStackRef = useRef<GridStack | null>(null);
  const [gridColumns, setGridColumns] = useState(DEFAULT_BATTLE_MAP_CONFIG.gridColumns);
  const [gridRows, setGridRows] = useState(DEFAULT_BATTLE_MAP_CONFIG.gridRows);
  const [cellSize, setCellSize] = useState(DEFAULT_BATTLE_MAP_CONFIG.cellSize);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isSpaceHeld, setIsSpaceHeld] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [widgetCounter, setWidgetCounter] = useState(1);
  const [hasRenderedConfig, setHasRenderedConfig] = useState(false);
  const [logEntries, setLogEntries] = useState<string[]>([]);
  const [showLog, setShowLog] = useState(true);
  const hasInitializedGridRef = useRef(false);
  const initialStaticRef = useRef(false);
  const hasCenteredRef = useRef(false);
  const widgetCounterRef = useRef(widgetCounter);

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
    const nextRows = config.gridRows ?? DEFAULT_BATTLE_MAP_CONFIG.gridRows;
    const nextCellSize = config.cellSize ?? DEFAULT_BATTLE_MAP_CONFIG.cellSize;
    setGridColumns(nextColumns);
    setGridRows(nextRows);
    setCellSize(nextCellSize);
    gridColumnsRef.current = nextColumns;
    gridRowsRef.current = nextRows;
    cellSizeRef.current = nextCellSize;
    setWidgetCounter((config.widgets?.length ?? 0) + 1);
  }, [config]);

  useEffect(() => {
    gridColumnsRef.current = gridColumns;
  }, [gridColumns]);

  useEffect(() => {
    gridRowsRef.current = gridRows;
  }, [gridRows]);

  useEffect(() => {
    cellSizeRef.current = cellSize;
  }, [cellSize]);

  useEffect(() => {
    setHasRenderedConfig(false);
    hasCenteredRef.current = false;
  }, [projectId]);

  useEffect(() => {
    const originPan = { x: 0, y: 0 };
    setPan(originPan);
    panRef.current = originPan;
    setScale(1);
    scaleRef.current = 1;
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

  useEffect(() => {
    widgetCounterRef.current = widgetCounter;
  }, [widgetCounter]);

  const syncGridGuides = useCallback(() => {
    if (!gridStackRef.current || !gridRef.current) return;

    const cellWidth = gridStackRef.current.cellWidth() || cellSizeRef.current;

    if (cellWidth && cellWidth > 0) {
      gridStackRef.current.cellHeight(cellWidth, false);

      gridRef.current.style.setProperty('--grid-cell-width', `${cellWidth}px`);
      gridRef.current.style.setProperty('--grid-cell-height', `${cellWidth}px`);

      const workspaceEl = gridRef.current.closest('.battlemap-workspace');
      if (workspaceEl) {
        workspaceEl.setAttribute('data-grid-cell-width', `${cellWidth}`);
        workspaceEl.style.setProperty('--grid-cell-width', `${cellWidth}px`);
        workspaceEl.style.setProperty('--grid-cell-height', `${cellWidth}px`);
      }

      gridRef.current.style.backgroundPosition = '0 0, 0 0';
    }
  }, []);

  const ensureRowLimits = useCallback(
    (rows: number) => {
      if (!gridStackRef.current) return;
      gridStackRef.current.updateOptions({ minRow: rows, maxRow: rows });
      gridStackRef.current.opts.minRow = rows;
      gridStackRef.current.opts.maxRow = rows;
      if (gridStackRef.current.engine) {
        // @ts-ignore sync engine bounds for dynamic row growth
        gridStackRef.current.engine.minRow = rows;
        // @ts-ignore sync engine bounds for dynamic row growth
        gridStackRef.current.engine.maxRow = rows;
        // @ts-ignore keep container height in sync with new bounds
        gridStackRef.current._updateContainerHeight?.();
      }
    },
    [],
  );

  const applyTemplateToNodes = useCallback(
    (nodes: GridStackNode[]) => {
      if (!nodes.length) return;

      let nextCounter = widgetCounterRef.current;

      nodes.forEach((node) => {
        const widgetId = generateClientId();
        const label = `Widget ${nextCounter}`;
        const content = `<div class="battlemap-widget-content">${label}</div>`;
        nextCounter += 1;

        node.id = widgetId;
        node.w = 2;
        node.h = 2;
        node.minW = 2;
        node.maxW = 2;
        node.minH = 2;
        node.maxH = 2;
        // keep draggable but disallow resize
        // @ts-ignore GridStack node option
        node.noResize = true;

        const el = node.el as HTMLElement | undefined;
        if (el) {
          el.dataset.widgetId = widgetId;
          el.dataset.content = content;
          el.setAttribute('gs-id', widgetId);
          el.setAttribute('data-is-fixed', 'true');
          el.setAttribute('gs-no-resize', 'true');
          el.setAttribute('gs-min-w', '2');
          el.setAttribute('gs-max-w', '2');
          el.setAttribute('gs-min-h', '2');
          el.setAttribute('gs-max-h', '2');
          el.classList.add('is-fixed-widget');
          const contentContainer = el.querySelector('.grid-stack-item-content');
          if (contentContainer) {
            contentContainer.innerHTML = content;
          } else {
            el.innerHTML = `<div class="grid-stack-item-content">${content}</div>`;
          }
        }

        (node as unknown as { noResize?: boolean }).noResize = true;
      });

      widgetCounterRef.current = nextCounter;
      setWidgetCounter(nextCounter);
    },
    [setWidgetCounter],
  );

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

      const isFixed =
        node.minW === 2 &&
        node.maxW === 2 &&
        node.minH === 2 &&
        node.maxH === 2 &&
        // @ts-ignore
        (node.noResize === true || node.el?.classList.contains('is-fixed-widget') || node.el?.dataset.isFixed === 'true');

      return {
        id: nodeId,
        x: node.x ?? 0,
        y: node.y ?? 0,
        w: node.w ?? 1,
        h: node.h ?? 1,
        isFixed,
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
        gridStackRef.current.removeAll(true);

        const columns = nextConfig.gridColumns || DEFAULT_BATTLE_MAP_CONFIG.gridColumns;
        const rows = nextConfig.gridRows || DEFAULT_BATTLE_MAP_CONFIG.gridRows;
        const size = nextConfig.cellSize || DEFAULT_BATTLE_MAP_CONFIG.cellSize;
        setGridColumns(columns);
        setGridRows(rows);
        setCellSize(size);
        gridColumnsRef.current = columns;
        gridRowsRef.current = rows;
        cellSizeRef.current = size;
        gridStackRef.current.column(columns);
        ensureRowLimits(rows);
        log('Apply config to grid', { columns, rows, widgets: nextConfig.widgets.length });

        nextConfig.widgets.forEach((widget) => {
          const isFixed = widget.isFixed === true;
          const widgetOptions = {
            id: widget.id,
            x: widget.x,
            y: widget.y,
            w: isFixed ? 2 : widget.w,
            h: isFixed ? 2 : widget.h,
            content: widget.content,
            minW: isFixed ? 2 : 1,
            maxW: isFixed ? 2 : undefined,
            minH: isFixed ? 2 : 1,
            maxH: isFixed ? 2 : undefined,
            // @ts-ignore
            noResize: isFixed ? true : undefined,
          };

          const el = gridStackRef.current?.addWidget(widgetOptions);

          if (el) {
            el.dataset.widgetId = widget.id;
            el.dataset.content = widget.content;
            if (isFixed) {
              el.dataset.isFixed = 'true';
              el.setAttribute('gs-no-resize', 'true');
              el.setAttribute('gs-min-w', '2');
              el.setAttribute('gs-max-w', '2');
              el.setAttribute('gs-min-h', '2');
              el.setAttribute('gs-max-h', '2');
              el.classList.add('is-fixed-widget');
            }
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
        minRow: gridRowsRef.current,
        maxRow: gridRowsRef.current,
        acceptWidgets: true,
        dragIn: widgetTemplateSelector,
        dragInOptions: {
          helper: 'clone',
          appendTo: 'body',
          revert: 'invalid',
          scroll: false,
        },
        dragInDefault: { w: 2, h: 2, minW: 2, maxW: 2, minH: 2, maxH: 2, noResize: true },
        resizable: {
          handles: 'e,se,s,sw,w',
        },
      },
      gridRef.current,
    );

    hasInitializedGridRef.current = true;
    initialStaticRef.current = gridStackRef.current.opts.staticGrid ?? false;
    log('GridStack initialized', { columns: gridColumnsRef.current });

    GridStack.setupDragIn(widgetTemplateSelector, {
      helper: 'clone',
      appendTo: 'body',
      revert: 'invalid',
      scroll: false,
    });
    log('GridStack drag-in configured', { selector: widgetTemplateSelector });

    setTimeout(() => {
      syncGridGuides();
    }, 0);
    ensureRowLimits(gridRowsRef.current);

    const handleGridChange = () => {
      if (applyingConfigRef.current) return;

      const widgets = readWidgetsFromGrid();
      const nextConfig: BattleMapConfig = {
        ...configRef.current,
        gridColumns: gridColumnsRef.current,
        gridRows: gridRowsRef.current,
        cellSize: cellSizeRef.current,
        widgets,
      };

      setConfig(nextConfig);
      queueSave(nextConfig);
      log('Grid change persisted', { widgets: widgets.length });
    };

    const handleDropped = (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      _event: any,
      _previousWidget: GridStackNode | undefined,
      newWidget?: GridStackNode | GridStackNode[],
    ) => {
      if (!newWidget) return;
      const nodes = Array.isArray(newWidget) ? newWidget : [newWidget];
      applyTemplateToNodes(nodes);
      handleGridChange();
    };

    gridStackRef.current.on('change', handleGridChange);
    gridStackRef.current.on('removed', handleGridChange);
    gridStackRef.current.on('dropped', handleDropped);

    return () => {
      gridStackRef.current?.off('change', handleGridChange);
      gridStackRef.current?.off('removed', handleGridChange);
      gridStackRef.current?.off('dropped', handleDropped);
      gridStackRef.current?.destroy(false);
      gridStackRef.current = null;
      hasInitializedGridRef.current = false;
      log('GridStack destroyed');
    };
  }, [
    applyTemplateToNodes,
    gridColumnsRef,
    gridRef,
    log,
    project,
    queueSave,
    readWidgetsFromGrid,
    setConfig,
    syncGridGuides,
  ]);

  useLayoutEffect(() => {
    const cleanup = initGridStack();
    return cleanup;
  }, [initGridStack, project]);

  useEffect(() => {
    const handleResize = () => syncGridGuides();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [syncGridGuides]);

  useEffect(() => {
    if (!gridStackRef.current) return;
    ensureRowLimits(gridRows);
    syncGridGuides();
  }, [gridRows, syncGridGuides, ensureRowLimits]);

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
      isFixed: false,
      content: `<div class="battlemap-widget-content">Widget ${widgetCounter}</div>`,
    };

    log('Adding widget', widget);

    const el = gridStackRef.current.addWidget({ ...widget, autoPosition: true });
    if (!el) {
      const nextConfig: BattleMapConfig = {
        ...configRef.current,
        gridColumns: gridColumnsRef.current,
        gridRows: gridRowsRef.current,
        cellSize: cellSizeRef.current,
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
      gridRows: gridRowsRef.current,
      cellSize: cellSizeRef.current,
      widgets: widgets.length ? widgets : [...configRef.current.widgets, widget],
    };

    setWidgetCounter((prev) => prev + 1);
    setConfig(nextConfig);
    queueSave(nextConfig);
  };

  const clampZoom = useCallback((value: number) => Math.min(3, Math.max(0.5, value)), []);

  const centerView = useCallback(
    (resetScale = false) => {
      const viewport = viewportRef.current;
      if (!viewport) return;

      const targetScale = resetScale ? 1 : scaleRef.current;
      const gridW = gridColumnsRef.current * cellSizeRef.current * targetScale;
      const gridH = gridRowsRef.current * cellSizeRef.current * targetScale;
      const nextPan = {
        x: (viewport.clientWidth - gridW) / 2,
        y: (viewport.clientHeight - gridH) / 2,
      };

      if (resetScale) {
        scaleRef.current = 1;
        setScale(1);
      }

      panRef.current = nextPan;
      setPan(nextPan);
    },
    [],
  );

  useEffect(() => {
    if (!gridStackRef.current || hasRenderedConfig) return;

    applyConfigToGrid(config);
    setHasRenderedConfig(true);
  }, [applyConfigToGrid, config, hasRenderedConfig]);

  useEffect(() => {
    if (!hasRenderedConfig || hasCenteredRef.current) return;
    centerView(true);
    hasCenteredRef.current = true;
  }, [centerView, hasRenderedConfig]);

  const applyZoom = useCallback(
    (nextScale: number, pivotClientX?: number, pivotClientY?: number) => {
      const viewport = viewportRef.current;
      if (!viewport) {
        setScale(nextScale);
        scaleRef.current = nextScale;
        return;
      }

      const rect = viewport.getBoundingClientRect();
      const originX = pivotClientX !== undefined ? pivotClientX - rect.left : rect.width / 2;
      const originY = pivotClientY !== undefined ? pivotClientY - rect.top : rect.height / 2;
      const scaleRatio = nextScale / scaleRef.current;
      const nextPan = {
        x: panRef.current.x * scaleRatio + originX * (1 - scaleRatio),
        y: panRef.current.y * scaleRatio + originY * (1 - scaleRatio),
      };

      panRef.current = nextPan;
      setPan(nextPan);
      scaleRef.current = nextScale;
      setScale(nextScale);
    },
    [],
  );

  const handleWheelZoom = useCallback(
    (event: WheelEvent | ReactWheelEvent<HTMLDivElement>) => {
      if ('cancelable' in event && event.cancelable) {
        event.preventDefault();
      }
      const deltaY = 'deltaY' in event ? event.deltaY : 0;
      const clientX = 'clientX' in event ? event.clientX : undefined;
      const clientY = 'clientY' in event ? event.clientY : undefined;
      const direction = deltaY > 0 ? -0.1 : 0.1;
      const proposedScale = clampZoom(scaleRef.current + direction);
      if (proposedScale === scaleRef.current) return;

      applyZoom(proposedScale, clientX, clientY);
    },
    [applyZoom, clampZoom],
  );

  const stopPan = useCallback(() => {
    panStartRef.current = null;
    if (isPanning) {
      setIsPanning(false);
    }
  }, [isPanning]);

  const handlePanStart = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (!isSpaceHeld || event.button !== 0) return;
      event.preventDefault();
      panStartRef.current = {
        x: event.clientX,
        y: event.clientY,
        panX: panRef.current.x,
        panY: panRef.current.y,
      };
      setIsPanning(true);
    },
    [isSpaceHeld],
  );

  const handlePanMove = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    if (!panStartRef.current) return;
    event.preventDefault();

    const deltaX = event.clientX - panStartRef.current.x;
    const deltaY = event.clientY - panStartRef.current.y;
    const nextPan = {
      x: panStartRef.current.panX + deltaX,
      y: panStartRef.current.panY + deltaY,
    };

    panRef.current = nextPan;
    setPan(nextPan);
  }, []);

  const handleKeyState = useCallback(
    (event: KeyboardEvent, pressed: boolean) => {
      if (event.code !== 'Space') return;
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      event.preventDefault();
      setIsSpaceHeld(pressed);
      if (!pressed) {
        stopPan();
      }
    },
    [stopPan],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => handleKeyState(event, true);
    const onKeyUp = (event: KeyboardEvent) => handleKeyState(event, false);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [handleKeyState]);

  useEffect(() => {
    if (!gridStackRef.current) return;
    const shouldBeStatic = initialStaticRef.current || isSpaceHeld || isPanning;
    gridStackRef.current.setStatic(shouldBeStatic);
  }, [isPanning, isSpaceHeld]);

  useEffect(() => {
    if (!isPanning) return undefined;
    const handleMouseUp = () => stopPan();
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [isPanning, stopPan]);

  const handleExpand = useCallback(
    (direction: 'top' | 'bottom' | 'left' | 'right') => {
      if (!gridStackRef.current) {
        initGridStack();
      }

      const isVertical = direction === 'top' || direction === 'bottom';
      const isHorizontal = direction === 'left' || direction === 'right';

      const nextColumns = gridColumnsRef.current + (isHorizontal ? 1 : 0);
      const nextRows = gridRowsRef.current + (isVertical ? 1 : 0);
      const shiftX = direction === 'left' ? 1 : 0;
      const shiftY = direction === 'top' ? 1 : 0;

      const shiftedWidgets =
        shiftX || shiftY
          ? configRef.current.widgets.map((widget) => ({
              ...widget,
              x: widget.x + shiftX,
              y: widget.y + shiftY,
            }))
          : configRef.current.widgets;

      const nextConfig: BattleMapConfig = {
        ...configRef.current,
        gridColumns: nextColumns,
        gridRows: nextRows,
        cellSize: cellSizeRef.current,
        widgets: shiftedWidgets,
      };

      configRef.current = nextConfig;
      setGridColumns(nextColumns);
      setGridRows(nextRows);
      setConfig(nextConfig);
      gridColumnsRef.current = nextColumns;
      gridRowsRef.current = nextRows;

      if (shiftX || shiftY) {
        const nextPan = {
          x: panRef.current.x - shiftX * cellSizeRef.current * scaleRef.current,
          y: panRef.current.y - shiftY * cellSizeRef.current * scaleRef.current,
        };
        panRef.current = nextPan;
        setPan(nextPan);
      }

      if (gridStackRef.current) {
        ensureRowLimits(nextRows);
        applyConfigToGrid(nextConfig);
      }

      requestAnimationFrame(() => {
        syncGridGuides();
      });

      queueSave(nextConfig);
      log('Grid expanded', { direction, columns: nextColumns, rows: nextRows });
    },
    [applyConfigToGrid, initGridStack, log, queueSave, syncGridGuides],
  );

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

            <div className="battlemap-workspace__grid-meta">
              <div className="battlemap-workspace__grid-meta-row">
                <span>Columns</span>
                <span>{gridColumns}</span>
              </div>
              <div className="battlemap-workspace__grid-meta-row">
                <span>Rows</span>
                <span>{gridRows}</span>
              </div>
              <div className="battlemap-workspace__grid-meta-row">
                <span>Cell Size</span>
                <span>{cellSize}px</span>
              </div>
              <p className="battlemap-workspace__hint">
                Hold Space to pan, scroll to zoom. Widgets stay locked while panning.
              </p>
            </div>
            <button
              type="button"
              className="button button--ghost"
              onClick={() => {
                centerView(true);
              }}
            >
              Reset View
            </button>
          </div>

          <div className="battlemap-workspace__control-section">
            <h3 className="battlemap-workspace__control-title">Widgets</h3>
            <button
              className="button button--primary battlemap-workspace__add-widget-btn"
              onClick={handleAddWidget}
            >
              Add Widget
            </button>
            <div className="battlemap-workspace__widget-tray">
              <p className="battlemap-workspace__label">Fixed 2x2 Widget</p>
              <div
                className="battlemap-workspace__widget-template grid-stack-item"
                data-gs-width="2"
                data-gs-height="2"
                data-is-fixed="true"
                data-gs-auto-position="true"
              >
                <div className="battlemap-workspace__widget-template-inner grid-stack-item-content">
                  <span className="battlemap-workspace__widget-template-title">2 x 2</span>
                  <span className="battlemap-workspace__widget-template-subtitle">Drag to grid</span>
                </div>
              </div>
              <p className="battlemap-workspace__hint">
                Drag and drop for an endless supply of fixed 2x2 widgets.
              </p>
            </div>
            <p className="battlemap-workspace__hint">
              Auto-save: {isSaving ? 'Saving...' : 'Synced'} ({storageMode} storage)
            </p>
          </div>
        </div>
      </div>

      <div className="battlemap-workspace__main">
        <div
          ref={viewportRef}
          className={`battlemap-workspace__viewport${isSpaceHeld ? ' is-space-held' : ''}${
            isPanning ? ' is-panning' : ''
          }`}
          onMouseDown={handlePanStart}
          onMouseMove={handlePanMove}
          onMouseUp={stopPan}
          onMouseLeave={stopPan}
          onWheel={handleWheelZoom}
        >
          <div
            ref={surfaceRef}
            className="battlemap-workspace__surface"
            style={{
              width: `${gridColumns * cellSize}px`,
              height: `${gridRows * cellSize}px`,
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
              transformOrigin: '0 0',
            }}
          >
            <div
              className="battlemap-workspace__grid-wrapper"
              style={{ width: '100%', height: '100%' }}
            >
              <button
                type="button"
                className="battlemap-workspace__expander battlemap-workspace__expander--top"
                aria-label="Expand rows upward"
                onClick={() => handleExpand('top')}
              />
              <button
                type="button"
                className="battlemap-workspace__expander battlemap-workspace__expander--bottom"
                aria-label="Expand rows downward"
                onClick={() => handleExpand('bottom')}
              />
              <button
                type="button"
                className="battlemap-workspace__expander battlemap-workspace__expander--left"
                aria-label="Expand columns left"
                onClick={() => handleExpand('left')}
              />
              <button
                type="button"
                className="battlemap-workspace__expander battlemap-workspace__expander--right"
                aria-label="Expand columns right"
                onClick={() => handleExpand('right')}
              />
              <div
                ref={gridRef}
                className="grid-stack battlemap-workspace__grid"
                style={{
                  width: '100%',
                  minHeight: `${gridRows * cellSize}px`,
                }}
              />
            </div>
          </div>
        </div>
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
