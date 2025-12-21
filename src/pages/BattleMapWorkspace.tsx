import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { CSSProperties, MouseEvent as ReactMouseEvent, WheelEvent as ReactWheelEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBattleMap } from '../hooks/useBattleMap';
import { DEFAULT_BATTLE_MAP_CONFIG } from '../services/battleMapStorage';
import type { BattleMapConfig, BattleMapWidget, SquareCell } from '../types/battlemap';
import type { SquareTileDefinition } from '../data/tiles/types';
import { SQUARE_TILE_SETS, TILE_PREVIEW_SCALE } from '../data/tiles/tileSets';
import { downloadDataUrl, fetchImageAsDataUrl, loadImageFromUrl } from '../lib/exportUtils';
import { generateClientId } from '../lib/utils';
import './BattleMapWorkspace.css';

const TILE_PREVIEW_COLUMNS = 3;

type DragPayload =
  | { type: 'palette'; tile: SquareTileDefinition }
  | { type: 'widget'; widget: BattleMapWidget };

const packTilesForPreview = (tiles: SquareTileDefinition[]) => {
  return tiles.map((tile, index) => ({ tile, index }));
};

function BattleMapWorkspace() {
  const { projectId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    project,
    config,
    isLoading,
    isSaving,
    error,
    saveConfig,
  } = useBattleMap(projectId, user?.id);

  const squareConfig: BattleMapConfig =
    config.gridType === 'square' ? config : DEFAULT_BATTLE_MAP_CONFIG;
  const gridColumns = squareConfig.gridColumns || DEFAULT_BATTLE_MAP_CONFIG.gridColumns;
  const gridRows = squareConfig.gridRows || DEFAULT_BATTLE_MAP_CONFIG.gridRows;
  const cellSize = squareConfig.cellSize || DEFAULT_BATTLE_MAP_CONFIG.cellSize;

  const [widgets, setWidgets] = useState<BattleMapWidget[]>(squareConfig.widgets ?? []);
  const [hoverCell, setHoverCell] = useState<SquareCell | null>(null);
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
  const [dragPayload, setDragPayload] = useState<DragPayload | null>(null);
  const [draggingOrigin, setDraggingOrigin] = useState<SquareCell | null>(null);
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isSpaceHeld, setIsSpaceHeld] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [accordionOpen, setAccordionOpen] = useState<Record<string, boolean>>(
    () => Object.fromEntries(SQUARE_TILE_SETS.map((set) => [set.title, false])),
  );
  const [hoverVisible, setHoverVisible] = useState(false);
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [isDeleteDrag, setIsDeleteDrag] = useState(false);
  const [isDeleteZoneActive, setIsDeleteZoneActive] = useState(false);
  const [isExpandMode, setIsExpandMode] = useState(false);
  const [expandClickStart, setExpandClickStart] = useState<{ x: number; y: number } | null>(null);
  const [isDrawMode, setIsDrawMode] = useState(false);
  const [selectedDrawTileId, setSelectedDrawTileId] = useState<string | null>(null);
  const [isDrawPainting, setIsDrawPainting] = useState(false);
  const lastPaintedCellRef = useRef<string | null>(null);

  const tileMap = useMemo(() => {
    const map = new Map<string, SquareTileDefinition>();
    SQUARE_TILE_SETS.forEach((set) => {
      set.tiles.forEach((tile) => {
        map.set(tile.id, tile);
      });
    });
    return map;
  }, []);

  const buildDefaultSquareCells = useCallback(() => {
    const cells: SquareCell[] = [];
    for (let y = 0; y < gridRows; y += 1) {
      for (let x = 0; x < gridColumns; x += 1) {
        cells.push({ x, y });
      }
    }
    return cells;
  }, [gridColumns, gridRows]);

  const [allowedCells, setAllowedCells] = useState<SquareCell[]>(() => {
    if (squareConfig.allowedSquareCells && squareConfig.allowedSquareCells.length > 0) {
      return squareConfig.allowedSquareCells;
    }
    return buildDefaultSquareCells();
  });

  const gridBounds = useMemo(() => {
    if (!allowedCells.length) return null;
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    allowedCells.forEach((cell) => {
      const x = cell.x * cellSize;
      const y = cell.y * cellSize;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + cellSize);
      maxY = Math.max(maxY, y + cellSize);
    });

    return {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }, [allowedCells, cellSize]);

  const gridBoundarySegments = useMemo(() => {
    if (!allowedCells.length) return [];

    const cellSet = new Set(allowedCells.map((cell) => `${cell.x},${cell.y}`));
    const segments: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];

    allowedCells.forEach((cell) => {
      const x = cell.x * cellSize;
      const y = cell.y * cellSize;

      // Check each edge and add segment if no neighbor exists
      // Top edge
      if (!cellSet.has(`${cell.x},${cell.y - 1}`)) {
        segments.push({ x1: x, y1: y, x2: x + cellSize, y2: y });
      }
      // Right edge
      if (!cellSet.has(`${cell.x + 1},${cell.y}`)) {
        segments.push({ x1: x + cellSize, y1: y, x2: x + cellSize, y2: y + cellSize });
      }
      // Bottom edge
      if (!cellSet.has(`${cell.x},${cell.y + 1}`)) {
        segments.push({ x1: x + cellSize, y1: y + cellSize, x2: x, y2: y + cellSize });
      }
      // Left edge
      if (!cellSet.has(`${cell.x - 1},${cell.y}`)) {
        segments.push({ x1: x, y1: y + cellSize, x2: x, y2: y });
      }
    });

    return segments;
  }, [allowedCells, cellSize]);

  const viewportRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<SVGGElement>(null);
  const deleteZoneRef = useRef<HTMLDivElement>(null);
  const deleteZoneActiveRef = useRef(false);
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const isPanningRef = useRef(false);
  const panRef = useRef({ x: 0, y: 0 });
  const scaleRef = useRef(scale);
  const transformRafRef = useRef<number | null>(null);
  const pendingTransformRef = useRef<{ pan: { x: number; y: number }; scale: number } | null>(null);
  const hasCenteredRef = useRef(false);
  const lastBoundsRef = useRef(gridBounds);
  const exportImageCacheRef = useRef<Map<string, string>>(new Map());
  const saveBufferRef = useRef<BattleMapConfig | null>(null);
  const saveThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveInFlightRef = useRef(false);
  const hasUnsavedChangesRef = useRef(false);
  const hasHydratedConfigRef = useRef(false);
  const lastHydratedVersionRef = useRef<number | null>(null);
  const lastHydratedProjectRef = useRef<string | undefined>(project?.id);

  const flushPendingSave = useCallback(async () => {
    if (saveInFlightRef.current || !saveBufferRef.current) return;
    const payload = saveBufferRef.current;
    saveBufferRef.current = null;
    saveInFlightRef.current = true;
    let failed = false;

    try {
      await saveConfig(payload);
    } catch (err) {
      console.error('Failed to save battle map', err);
      failed = true;
    } finally {
      saveInFlightRef.current = false;
      if (saveBufferRef.current) {
        void flushPendingSave();
      } else if (!failed) {
        hasUnsavedChangesRef.current = false;
      }
    }
  }, [saveConfig]);

  const queueSave = useCallback(
    (updatedWidgets: BattleMapWidget[], currentAllowedCells: SquareCell[]) => {
      hasUnsavedChangesRef.current = true;
      saveBufferRef.current = {
        gridType: 'square',
        gridColumns,
        gridRows,
        cellSize,
        widgets: updatedWidgets,
        allowedSquareCells: currentAllowedCells,
        version: config.version,
        updated_at: config.updated_at,
      };

      if (saveThrottleRef.current) {
        clearTimeout(saveThrottleRef.current);
      }

      saveThrottleRef.current = setTimeout(() => {
        saveThrottleRef.current = null;
        flushPendingSave();
      }, 80);
    },
    [cellSize, config.updated_at, config.version, flushPendingSave, gridColumns, gridRows],
  );

  useEffect(() => {
    const projectChanged = project?.id && project?.id !== lastHydratedProjectRef.current;
    if (config.gridType !== 'square') return;
    const incomingVersion = config.version ?? 0;
    const shouldHydrate =
      projectChanged ||
      !hasHydratedConfigRef.current ||
      (!hasUnsavedChangesRef.current && incomingVersion >= (lastHydratedVersionRef.current ?? -1));

    if (!shouldHydrate) return;

    setWidgets(config.widgets ?? []);
    if (config.allowedSquareCells && config.allowedSquareCells.length > 0) {
      setAllowedCells(config.allowedSquareCells);
    } else if (projectChanged || !hasHydratedConfigRef.current) {
      setAllowedCells(buildDefaultSquareCells());
    }

    hasHydratedConfigRef.current = true;
    lastHydratedVersionRef.current = incomingVersion;
    lastHydratedProjectRef.current = project?.id;
  }, [buildDefaultSquareCells, config, project?.id]);

  useEffect(
    () => () => {
      if (saveThrottleRef.current) {
        clearTimeout(saveThrottleRef.current);
      }
    },
    [],
  );

  const scheduleTransform = useCallback(
    (nextPan: { x: number; y: number }, nextScale = scaleRef.current) => {
      panRef.current = nextPan;
      pendingTransformRef.current = { pan: nextPan, scale: nextScale };

      if (surfaceRef.current) {
        surfaceRef.current.setAttribute(
          'transform',
          `translate(${nextPan.x} ${nextPan.y}) scale(${nextScale})`,
        );
      }

      if (transformRafRef.current !== null) return;

      transformRafRef.current = requestAnimationFrame(() => {
        transformRafRef.current = null;
        const pending = pendingTransformRef.current;
        if (!pending || !surfaceRef.current) return;
        surfaceRef.current.setAttribute(
          'transform',
          `translate(${pending.pan.x} ${pending.pan.y}) scale(${pending.scale})`,
        );
      });
    },
    [],
  );

  const commitPan = useCallback(
    (nextPan: { x: number; y: number }, nextScale?: number) => {
      scheduleTransform(nextPan, nextScale ?? scaleRef.current);
      setPan(nextPan);
    },
    [scheduleTransform],
  );

  useEffect(
    () => () => {
      if (transformRafRef.current !== null) {
        cancelAnimationFrame(transformRafRef.current);
      }
    },
    [],
  );

  useLayoutEffect(() => {
    scaleRef.current = scale;
    scheduleTransform(panRef.current, scale);
  }, [scale, scheduleTransform]);

  useLayoutEffect(() => {
    panRef.current = pan;
    scheduleTransform(pan, scaleRef.current);
  }, [pan, scheduleTransform]);

  const toWorldPoint = useCallback((clientX: number, clientY: number) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const currentPan = panRef.current;
    const currentScale = scaleRef.current;
    return {
      x: (clientX - rect.left - currentPan.x) / currentScale,
      y: (clientY - rect.top - currentPan.y) / currentScale,
    };
  }, []);

  const pointToCell = useCallback(
    (worldX: number, worldY: number): SquareCell => {
      return {
        x: Math.floor(worldX / cellSize),
        y: Math.floor(worldY / cellSize),
      };
    },
    [cellSize],
  );

  const buildFootprint = useCallback(
    (origin: SquareCell, cols: number, rows: number): SquareCell[] => {
      const footprint: SquareCell[] = [];
      for (let dx = 0; dx < Math.max(1, cols); dx += 1) {
        for (let dy = 0; dy < Math.max(1, rows); dy += 1) {
          footprint.push({ x: origin.x + dx, y: origin.y + dy });
        }
      }
      return footprint;
    },
    [],
  );

  const isFootprintAllowed = useCallback(
    (origin: SquareCell, cols: number, rows: number) => {
      const footprint = buildFootprint(origin, cols, rows);
      return footprint.every((cell) =>
        allowedCells.some((allowed) => allowed.x === cell.x && allowed.y === cell.y),
      );
    },
    [allowedCells, buildFootprint],
  );

  const findCollision = useCallback(
    (origin: SquareCell, cols: number, rows: number, ignoreId?: string) => {
      const width = Math.max(1, cols);
      const height = Math.max(1, rows);
      return widgets.find((widget) => {
        if (ignoreId && widget.id === ignoreId) return false;
        const otherWidth = Math.max(1, widget.w ?? 1);
        const otherHeight = Math.max(1, widget.h ?? 1);
        const overlapX = origin.x < widget.x + otherWidth && origin.x + width > widget.x;
        const overlapY = origin.y < widget.y + otherHeight && origin.y + height > widget.y;
        return overlapX && overlapY;
      });
    },
    [widgets],
  );

  const placeDrawTileAtCell = useCallback(
    (cell: SquareCell) => {
      if (!isDrawMode || !selectedDrawTileId) return;
      const tile = tileMap.get(selectedDrawTileId);
      if (!tile) return;

      const cols = Math.max(1, tile.cols ?? 1);
      const rows = Math.max(1, tile.rows ?? 1);

      if (!isFootprintAllowed(cell, cols, rows)) return;

      const key = `${cell.x}-${cell.y}`;
      if (lastPaintedCellRef.current === key) return;

      const overlapsFootprint = (
        widget: BattleMapWidget,
        origin: SquareCell,
        width: number,
        height: number,
      ) => {
        const otherWidth = Math.max(1, widget.w ?? 1);
        const otherHeight = Math.max(1, widget.h ?? 1);
        const overlapX = origin.x < widget.x + otherWidth && origin.x + width > widget.x;
        const overlapY = origin.y < widget.y + otherHeight && origin.y + height > widget.y;
        return overlapX && overlapY;
      };

      let placed = false;
      setWidgets((current) => {
        const collision = current.find((widget) => overlapsFootprint(widget, cell, cols, rows));
        if (collision) {
          const otherCollision = current.find(
            (widget) => widget.id !== collision.id && overlapsFootprint(widget, cell, cols, rows),
          );
          if (otherCollision) return current;

          const next = current.map((widget) =>
            widget.id === collision.id
              ? {
                  ...widget,
                  x: cell.x,
                  y: cell.y,
                  w: cols,
                  h: rows,
                  tileId: tile.id,
                  appearance: {
                    backgroundImageUrl: tile.image,
                  },
                }
              : widget,
          );
          queueSave(next, allowedCells);
          placed = true;
          return next;
        }

        const newWidget: BattleMapWidget = {
          id: generateClientId(),
          x: cell.x,
          y: cell.y,
          w: cols,
          h: rows,
          content: '',
          tileId: tile.id,
          appearance: {
            backgroundImageUrl: tile.image,
          },
        };

        const next = [...current, newWidget];
        queueSave(next, allowedCells);
        placed = true;
        return next;
      });

      lastPaintedCellRef.current = key;
      if (placed) {
        setStatusMessage('Painted tile.');
      }
    },
    [allowedCells, isDrawMode, isFootprintAllowed, queueSave, selectedDrawTileId, tileMap],
  );

  const getPayloadSize = useCallback((payload: DragPayload): { cols: number; rows: number } => {
    if (payload.type === 'palette') {
      return { cols: payload.tile.cols ?? 1, rows: payload.tile.rows ?? 1 };
    }
    return { cols: payload.widget.w ?? 1, rows: payload.widget.h ?? 1 };
  }, []);

  const recenterGrid = useCallback((scaleOverride?: number) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect || !gridBounds) return;
    const effectiveScale = scaleOverride ?? scale;
    const centerX = gridBounds.minX + gridBounds.width / 2;
    const centerY = gridBounds.minY + gridBounds.height / 2;
    commitPan({
      x: rect.width / 2 - centerX * effectiveScale,
      y: rect.height / 2 - centerY * effectiveScale,
    });
  }, [commitPan, gridBounds, scale]);

  const handleDelete = useCallback(
    (widgetId: string) => {
      const nextWidgets = widgets.filter((widget) => widget.id !== widgetId);
      setWidgets(nextWidgets);
      queueSave(nextWidgets, allowedCells);
      setSelectedWidgetId(null);
      setStatusMessage('Tile deleted.');
    },
    [allowedCells, queueSave, widgets],
  );

  const deleteCellAtPoint = useCallback(
    (clientX?: number, clientY?: number) => {
      if (clientX === undefined || clientY === undefined) return;
      const point = toWorldPoint(clientX, clientY);
      if (!point) return;
      const targetCell = pointToCell(point.x, point.y);
      const occupant = widgets.find(
        (widget) => widget.x === targetCell.x && widget.y === targetCell.y,
      );
      if (occupant) {
        handleDelete(occupant.id);
      }
    },
    [handleDelete, pointToCell, toWorldPoint, widgets],
  );

  const addCellAtPoint = useCallback(
    async (clientX?: number, clientY?: number) => {
      if (clientX === undefined || clientY === undefined) return;
      const point = toWorldPoint(clientX, clientY);
      if (!point) return;
      const targetCell = pointToCell(point.x, point.y);

      const alreadyExists = allowedCells.some(
        (cell) => cell.x === targetCell.x && cell.y === targetCell.y,
      );

      if (alreadyExists) {
        setStatusMessage('Grid cell already exists at this location.');
        return;
      }

      const newCells = [...allowedCells, targetCell];
      setAllowedCells(newCells);
      setStatusMessage('Saving expanded grid...');

      try {
        queueSave(widgets, newCells);
        setStatusMessage('Grid cell added (saving...).');
      } catch (error) {
        console.error('Failed to save expanded grid:', error);
        setStatusMessage('Failed to save grid expansion!');
      }
    },
    [allowedCells, pointToCell, queueSave, toWorldPoint, widgets],
  );

  const isPointInsideDeleteZone = useCallback(
    (clientX?: number, clientY?: number) => {
      const zone = deleteZoneRef.current;
      if (!zone || clientX === undefined || clientY === undefined) return false;
      const rect = zone.getBoundingClientRect();
      return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
    },
    [],
  );

  const updateDeleteZoneHighlight = useCallback(
    (clientX?: number, clientY?: number) => {
      const active = isPointInsideDeleteZone(clientX, clientY);
      deleteZoneActiveRef.current = active;
      setIsDeleteZoneActive(active);
      return active;
    },
    [isPointInsideDeleteZone],
  );

  useEffect(() => {
    const handleResize = () => {
      const rect = viewportRef.current?.getBoundingClientRect();
      if (rect && gridBounds) {
        if (!hasCenteredRef.current || lastBoundsRef.current !== gridBounds) {
          recenterGrid();
          hasCenteredRef.current = true;
          lastBoundsRef.current = gridBounds;
        }
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [gridBounds, recenterGrid]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        setIsSpaceHeld(true);
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedWidgetId) {
        event.preventDefault();
        handleDelete(selectedWidgetId);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        setIsSpaceHeld(false);
        setIsPanning(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleDelete, selectedWidgetId]);

  useEffect(() => {
    if (!isDrawMode) {
      setIsDrawPainting(false);
      setSelectedDrawTileId(null);
      lastPaintedCellRef.current = null;
    }
  }, [isDrawMode]);

  useEffect(() => {
    if (!dragPayload) return undefined;

    const handleMove = (event: MouseEvent) => {
      setDragPosition({ x: event.clientX, y: event.clientY });
      const point = toWorldPoint(event.clientX, event.clientY);
      if (!point) {
        setHoverCell(null);
        setHoverVisible(false);
        updateDeleteZoneHighlight(event.clientX, event.clientY);
        return;
      }
      const cellAtPoint = pointToCell(point.x, point.y);
      const size = getPayloadSize(dragPayload);
      const isValidCell = isFootprintAllowed(cellAtPoint, size.cols, size.rows);
      const collides = findCollision(cellAtPoint, size.cols, size.rows, dragPayload?.type === 'widget' ? dragPayload.widget.id : undefined);
      setHoverCell(cellAtPoint);
      setHoverVisible(isValidCell && !collides);
      updateDeleteZoneHighlight(event.clientX, event.clientY);
    };

    const handleUp = (event: MouseEvent) => {
      setDragPosition({ x: event.clientX, y: event.clientY });
      const activeDelete = updateDeleteZoneHighlight(event.clientX, event.clientY);
      const point = toWorldPoint(event.clientX, event.clientY);
      const targetCell = point ? pointToCell(point.x, point.y) : hoverCell;
      const payloadSize = dragPayload ? getPayloadSize(dragPayload) : { cols: 1, rows: 1 };
      const fitsInGrid = targetCell ? isFootprintAllowed(targetCell, payloadSize.cols, payloadSize.rows) : false;
      const collision = targetCell
        ? findCollision(targetCell, payloadSize.cols, payloadSize.rows, dragPayload?.type === 'widget' ? dragPayload.widget.id : undefined)
        : undefined;

      if (activeDelete && dragPayload?.type === 'widget') {
        handleDelete(dragPayload.widget.id);
      } else if (targetCell && fitsInGrid) {
        if (dragPayload.type === 'palette') {
          if (collision) {
            setStatusMessage('That placement overlaps another tile.');
          } else {
            const newWidget: BattleMapWidget = {
              id: generateClientId(),
              x: targetCell.x,
              y: targetCell.y,
              w: payloadSize.cols,
              h: payloadSize.rows,
              content: '',
              tileId: dragPayload.tile.id,
              appearance: {
                backgroundImageUrl: dragPayload.tile.image,
              },
            };
            const nextWidgets = [...widgets, newWidget];
            setWidgets(nextWidgets);
            queueSave(nextWidgets, allowedCells);
            setStatusMessage('Placed tile on grid.');
          }
        } else {
          const origin = draggingOrigin ?? dragPayload.widget;
          const isSameSpot = origin.x === targetCell.x && origin.y === targetCell.y;
          if (collision) {
            setStatusMessage('That spot is already occupied.');
          } else if (!isSameSpot) {
            const nextWidgets = widgets.map((widget) =>
              widget.id === dragPayload.widget.id
                ? { ...widget, x: targetCell.x, y: targetCell.y }
                : widget,
            );
            setWidgets(nextWidgets);
            queueSave(nextWidgets, allowedCells);
            setStatusMessage('Moved tile.');
          }
        }
      } else if (targetCell && !fitsInGrid) {
        setStatusMessage('Tile does not fit in the grid here.');
      } else if (dragPayload.type === 'widget') {
        setStatusMessage('Outside the grid. Returning tile to its spot.');
      } else if (dragPayload.type === 'palette') {
        setStatusMessage('Drop tiles inside the grid.');
      }

      setDragPayload(null);
      setDraggingOrigin(null);
      setHoverCell(null);
      setHoverVisible(false);
      setDragPosition(null);
      setIsDeleteZoneActive(false);
      deleteZoneActiveRef.current = false;
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      setIsDeleteDrag(false);
    };
  }, [
    allowedCells,
    dragPayload,
    draggingOrigin,
    hoverCell,
    handleDelete,
    isFootprintAllowed,
    queueSave,
    pointToCell,
    findCollision,
    getPayloadSize,
    setIsDeleteDrag,
    toWorldPoint,
    updateDeleteZoneHighlight,
    widgets,
  ]);

  const handlePanStart = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (!isSpaceHeld) return;
      event.preventDefault();
      setIsPanning(true);
      isPanningRef.current = true;
      panStartRef.current = {
        x: event.clientX,
        y: event.clientY,
        panX: panRef.current.x,
        panY: panRef.current.y,
      };
    },
    [isSpaceHeld],
  );

  const handlePanMove = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (!isPanningRef.current || !panStartRef.current) return;
      const dx = event.clientX - panStartRef.current.x;
      const dy = event.clientY - panStartRef.current.y;
      scheduleTransform(
        { x: panStartRef.current.panX + dx, y: panStartRef.current.panY + dy },
        scaleRef.current,
      );
    },
    [scheduleTransform],
  );

  const stopPan = useCallback(() => {
    setIsPanning(false);
    isPanningRef.current = false;
    panStartRef.current = null;
    setPan(panRef.current);
  }, []);

  useEffect(() => {
    if (!isPanning) return;

    const handleWindowMove = (event: MouseEvent) => {
      if (!isPanningRef.current || !panStartRef.current) return;
      const dx = event.clientX - panStartRef.current.x;
      const dy = event.clientY - panStartRef.current.y;
      scheduleTransform(
        { x: panStartRef.current.panX + dx, y: panStartRef.current.panY + dy },
        scaleRef.current,
      );
    };

    const handleWindowUp = () => {
      stopPan();
    };

    window.addEventListener('mousemove', handleWindowMove);
    window.addEventListener('mouseup', handleWindowUp);
    return () => {
      window.removeEventListener('mousemove', handleWindowMove);
      window.removeEventListener('mouseup', handleWindowUp);
    };
  }, [isPanning, scheduleTransform, stopPan]);

  const handleDeleteDragStart = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (!isDeleteMode) return;
      event.preventDefault();
      setIsDeleteDrag(true);
      deleteCellAtPoint(event.clientX, event.clientY);
    },
    [deleteCellAtPoint, isDeleteMode],
  );

  const handleDeleteDragMove = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (!isDeleteMode || !isDeleteDrag) return;
      event.preventDefault();
      deleteCellAtPoint(event.clientX, event.clientY);
    },
    [deleteCellAtPoint, isDeleteDrag, isDeleteMode],
  );

  const handleDeleteDragEnd = useCallback(() => {
    if (!isDeleteMode) return;
    setIsDeleteDrag(false);
  }, [isDeleteMode]);

  const handleExpandClickStart = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (!isExpandMode) return;
      event.preventDefault();
      setExpandClickStart({ x: event.clientX, y: event.clientY });
    },
    [isExpandMode],
  );

  const handleExpandClickEnd = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (!isExpandMode || !expandClickStart) return;
      event.preventDefault();

      const dx = Math.abs(event.clientX - expandClickStart.x);
      const dy = Math.abs(event.clientY - expandClickStart.y);
      const threshold = 5;

      if (dx < threshold && dy < threshold) {
        addCellAtPoint(event.clientX, event.clientY);
      }

      setExpandClickStart(null);
    },
    [addCellAtPoint, expandClickStart, isExpandMode],
  );

  const handleWheelZoom = useCallback(
    (event: ReactWheelEvent<HTMLDivElement>) => {
      event.preventDefault();
      const zoomIntensity = 0.0015;
      const nextScale = Math.min(
        10,
        Math.max(0.1, scaleRef.current * Math.exp(-event.deltaY * zoomIntensity)),
      );
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) {
        setScale(nextScale);
        scaleRef.current = nextScale;
        scheduleTransform(panRef.current, nextScale);
        return;
      }

      const worldBefore = toWorldPoint(event.clientX, event.clientY);
      setScale(nextScale);
      scaleRef.current = nextScale;

      if (worldBefore) {
        const screenX = event.clientX - rect.left;
        const screenY = event.clientY - rect.top;
        commitPan({
          x: screenX - worldBefore.x * nextScale,
          y: screenY - worldBefore.y * nextScale,
        }, nextScale);
      }
    },
    [commitPan, scheduleTransform, toWorldPoint],
  );

  const handleTilePointerDown = useCallback(
    (tile: SquareTileDefinition, event: ReactMouseEvent<HTMLElement>) => {
      event.preventDefault();
      if (isDrawMode) {
        setSelectedDrawTileId(tile.id);
        setStatusMessage(`Draw mode: ${tile.label} selected.`);
        return;
      }
      setDragPayload({ type: 'palette', tile });
      setStatusMessage(null);
    },
    [isDrawMode],
  );

  const handleWidgetPointerDown = useCallback(
    (widget: BattleMapWidget, event: ReactMouseEvent<SVGGElement>) => {
      if (isSpaceHeld || isDrawMode) {
        return;
      }
      event.preventDefault();
      if (isDeleteMode) {
        handleDelete(widget.id);
        return;
      }
      setSelectedWidgetId(widget.id);
      setDragPayload({ type: 'widget', widget });
      setDraggingOrigin({ x: widget.x, y: widget.y });
      setDragPosition({ x: event.clientX, y: event.clientY });
      setStatusMessage(null);
    },
    [handleDelete, isDeleteMode, isDrawMode, isSpaceHeld],
  );

  const startDrawPainting = useCallback(
    (clientX?: number, clientY?: number) => {
      if (!isDrawMode || isSpaceHeld) return;
      if (!selectedDrawTileId) {
        setStatusMessage('Select a tile to draw.');
        return;
      }
      if (clientX === undefined || clientY === undefined) return;
      const point = toWorldPoint(clientX, clientY);
      if (!point) return;
      lastPaintedCellRef.current = null;
      const cell = pointToCell(point.x, point.y);
      placeDrawTileAtCell(cell);
      setIsDrawPainting(true);
    },
    [isDrawMode, isSpaceHeld, placeDrawTileAtCell, pointToCell, selectedDrawTileId, toWorldPoint],
  );

  const continueDrawPainting = useCallback(
    (clientX?: number, clientY?: number) => {
      if (!isDrawMode || !isDrawPainting) return;
      if (clientX === undefined || clientY === undefined) return;
      const point = toWorldPoint(clientX, clientY);
      if (!point) return;
      const cell = pointToCell(point.x, point.y);
      placeDrawTileAtCell(cell);
    },
    [isDrawMode, isDrawPainting, placeDrawTileAtCell, pointToCell, toWorldPoint],
  );

  const stopDrawPainting = useCallback(() => {
    if (!isDrawPainting) return;
    setIsDrawPainting(false);
    lastPaintedCellRef.current = null;
  }, [isDrawPainting]);

  const dragPreviewImage = useMemo(() => {
    if (!dragPayload) return null;
    if (dragPayload.type === 'palette') return dragPayload.tile.image;
    return tileMap.get(dragPayload.widget.tileId ?? '')?.image ?? dragPayload.widget.appearance?.backgroundImageUrl ?? null;
  }, [dragPayload, tileMap]);

  const getSquareStyleValues = useCallback(() => {
    const workspaceEl = viewportRef.current?.closest('.square-workspace') as HTMLElement | null;
    const styles = workspaceEl ? getComputedStyle(workspaceEl) : getComputedStyle(document.documentElement);
    return {
      background: styles.getPropertyValue('--bg').trim() || '#0f172a',
      gridLine: styles.getPropertyValue('--grid-line-color').trim() || 'rgba(255,255,255,0.12)',
      gridBorder: styles.getPropertyValue('--grid-border-color').trim() || 'rgba(255,255,255,0.35)',
    };
  }, []);

  const handleExportBattleMap = useCallback(
    async (format: 'png' | 'jpeg') => {
      if (!gridBounds) {
        setStatusMessage('Grid not ready to export.');
        return;
      }

      try {
        const padding = Math.max(12, cellSize * 0.25);
        const viewMinX = gridBounds.minX - padding;
        const viewMinY = gridBounds.minY - padding;
        const viewWidth = gridBounds.width + padding * 2;
        const viewHeight = gridBounds.height + padding * 2;
        const { background, gridBorder, gridLine } = getSquareStyleValues();

        const inlineImages = new Map<string, string>();
        await Promise.all(
          widgets.map(async (widget) => {
            const src =
              tileMap.get(widget.tileId ?? '')?.image ??
              widget.appearance?.backgroundImageUrl ??
              undefined;
            if (!src || inlineImages.has(src)) return;
            const dataUrl = await fetchImageAsDataUrl(src, exportImageCacheRef.current);
            inlineImages.set(src, dataUrl);
          }),
        );

        const svgParts: string[] = [];
        svgParts.push(
          `<svg xmlns="http://www.w3.org/2000/svg" width="${viewWidth}" height="${viewHeight}" viewBox="${viewMinX} ${viewMinY} ${viewWidth} ${viewHeight}" fill="none">`,
        );

        // Grid lines
        allowedCells.forEach((cell) => {
          const x = cell.x * cellSize;
          const y = cell.y * cellSize;
          svgParts.push(
            `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="none" stroke="${gridLine}" stroke-width="1" />`,
          );
        });

        // Grid boundary
        gridBoundarySegments.forEach((seg) => {
          svgParts.push(
            `<line x1="${seg.x1}" y1="${seg.y1}" x2="${seg.x2}" y2="${seg.y2}" stroke="${gridBorder}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />`,
          );
        });

        // Widgets
        widgets.forEach((widget) => {
          const x = widget.x * cellSize;
          const y = widget.y * cellSize;
          const w = (widget.w ?? 1) * cellSize;
          const h = (widget.h ?? 1) * cellSize;
          const tileSrc =
            tileMap.get(widget.tileId ?? '')?.image ?? widget.appearance?.backgroundImageUrl ?? '';
          const href = tileSrc ? inlineImages.get(tileSrc) ?? tileSrc : '';

          if (href) {
            svgParts.push(
              `<image href="${href}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice" />`,
            );
          } else {
            svgParts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#d0d0d0" />`);
          }
        });

        svgParts.push('</svg>');

        const svgString = svgParts.join('');
        const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const svgUrl = URL.createObjectURL(svgBlob);
        const img = await loadImageFromUrl(svgUrl);

        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewWidth);
        canvas.height = Math.ceil(viewHeight);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(svgUrl);
          setStatusMessage('Unable to export: canvas not available.');
          return;
        }

        // Use the same background color as the page/workspace
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        URL.revokeObjectURL(svgUrl);

        const mime = format === 'png' ? 'image/png' : 'image/jpeg';
        const quality = format === 'jpeg' ? 0.92 : undefined;
        const dataUrl = canvas.toDataURL(mime, quality);
        downloadDataUrl(dataUrl, `battle-map.${format === 'png' ? 'png' : 'jpg'}`);
        setStatusMessage(`Saved battle map as ${format.toUpperCase()}.`);
      } catch (err) {
        console.error('Export failed', err);
        setStatusMessage('Failed to export battle map.');
      }
    },
    [allowedCells, cellSize, gridBounds, gridBoundarySegments, tileMap, widgets],
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
    <div className={`battlemap-workspace square-workspace${isDeleteMode ? ' is-delete-mode' : ''}`}>
        <div className="battlemap-workspace__sidebar square-workspace__sidebar">
          <div className="battlemap-workspace__sidebar-header">
            <button
              className="button button--ghost battlemap-workspace__back-button"
              onClick={() => navigate('/app')}
          >
            Back to Projects
          </button>
          <h2 className="battlemap-workspace__project-name">{project.name}</h2>
        </div>

        <div className="battlemap-workspace__tiles-panel">
          <div className="battlemap-workspace__mode-toggle">
            <button
              type="button"
              className={`button ${isDrawMode ? 'button--primary' : 'button--ghost'}`}
              onClick={() => {
                setIsDrawMode((prev) => {
                  const next = !prev;
                  if (next) {
                    setIsDeleteMode(false);
                    setIsExpandMode(false);
                    setStatusMessage('Draw mode enabled. Pick a tile, then click or drag on the grid.');
                  } else {
                    setStatusMessage('Draw mode disabled.');
                  }
                  return next;
                });
                setDragPayload(null);
                setHoverVisible(false);
                lastPaintedCellRef.current = null;
              }}
              onKeyDown={(event) => {
                if (event.code === 'Space') {
                  event.preventDefault();
                }
              }}
            >
              {isDrawMode ? 'Draw Mode: ON' : 'Draw Mode'}
            </button>
          </div>
          <div className="battlemap-workspace__tiles-header">
            <h3 className="battlemap-workspace__control-title">Tiles</h3>
          </div>
          <div className="battlemap-workspace__tiles-scroll">
            {SQUARE_TILE_SETS.map((set) => (
              <div
                key={set.title}
                className={`battlemap-workspace__tile-group${accordionOpen[set.title] ? ' is-open' : ''}`}
              >
                <button
                  type="button"
                  className="battlemap-workspace__tile-group-toggle"
                  onClick={() => setAccordionOpen((prev) => ({ ...prev, [set.title]: !prev[set.title] }))}
                  aria-expanded={accordionOpen[set.title] ?? false}
                  aria-controls={`tile-group-${set.title}`}
                >
                  <span className="battlemap-workspace__tile-group-title">{set.title}</span>
                  <span
                    className={`battlemap-workspace__tile-group-chevron${accordionOpen[set.title] ? ' is-open' : ''}`}
                    aria-hidden
                  />
                </button>
                <div
                  id={`tile-group-${set.title}`}
                className={`battlemap-workspace__widget-tray${accordionOpen[set.title] ? ' is-open' : ''}`}
                role="region"
                aria-label={`${set.title} tiles`}
                  style={
                    {
                      '--tile-preview-columns': TILE_PREVIEW_COLUMNS,
                      '--tile-preview-scale': TILE_PREVIEW_SCALE,
                      '--widget-preview-scale': TILE_PREVIEW_SCALE,
                    } as CSSProperties
                  }
                >
                  {packTilesForPreview(set.tiles).map(({ tile, index }) => (
                    <div
                      key={`${tile.id}-${index}`}
                      className="battlemap-workspace__widget-template-wrapper"
                      style={{
                        gridColumnEnd: `span ${tile.cols}`,
                        gridRowEnd: `span ${tile.rows}`,
                        '--tile-cols': tile.cols,
                        '--tile-rows': tile.rows,
                        justifySelf:
                          tile.cols >= TILE_PREVIEW_COLUMNS ? 'stretch' : 'center',
                      }}
                    >
                      <div
                        className={`battlemap-workspace__widget-template${isDrawMode ? ' is-draw-mode' : ''}${selectedDrawTileId === tile.id ? ' is-selected' : ''}`}
                        onMouseDown={(event) => handleTilePointerDown(tile, event)}
                        aria-label={`${tile.label} tile`}
                        style={
                          {
                            '--widget-bg-image': `url("${tile.image}")`,
                            '--tile-cols': tile.cols,
                            '--tile-rows': tile.rows,
                          } as CSSProperties
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="battlemap-workspace__hint battlemap-workspace__autosave">
            Auto-save: {isSaving ? 'Saving...' : 'Synced'}
          </p>
          {statusMessage ? <p className="square-workspace__status">{statusMessage}</p> : null}
        </div>
      </div>

      <div className="battlemap-workspace__main square-workspace__main">
        <div
          ref={viewportRef}
          className={`battlemap-workspace__viewport square-workspace__viewport${isSpaceHeld ? ' is-space-held' : ''}${isPanning ? ' is-panning' : ''}${isExpandMode ? ' is-expand-mode' : ''}`}
          onMouseDown={(event) => {
            if (isSpaceHeld) {
              handlePanStart(event);
            } else if (isDrawMode) {
              startDrawPainting(event.clientX, event.clientY);
            } else if (isExpandMode) {
              handleExpandClickStart(event);
            } else if (isDeleteMode) {
              handleDeleteDragStart(event);
            } else {
              handlePanStart(event);
            }
          }}
          onMouseMove={(event) => {
            if (isPanning) {
              handlePanMove(event);
            } else if (isDrawMode && isDrawPainting) {
              continueDrawPainting(event.clientX, event.clientY);
            } else if (isExpandMode) {
              // No drag behavior in expand mode
            } else if (isDeleteMode) {
              handleDeleteDragMove(event);
            } else {
              handlePanMove(event);
            }
          }}
          onMouseUp={(event) => {
            if (isPanning) {
              stopPan();
            } else if (isDrawMode && isDrawPainting) {
              stopDrawPainting();
            } else if (isExpandMode) {
              handleExpandClickEnd(event);
            } else if (isDeleteMode) {
              handleDeleteDragEnd();
            } else {
              stopPan();
            }
          }}
          onMouseLeave={() => {
            if (isPanning) {
              stopPan();
            } else if (isDrawMode && isDrawPainting) {
              stopDrawPainting();
            } else if (isExpandMode) {
              setExpandClickStart(null);
            } else if (isDeleteMode) {
              handleDeleteDragEnd();
            } else {
              stopPan();
            }
          }}
          onWheel={handleWheelZoom}
        >
          <svg className="square-workspace__surface">
            <g
              ref={surfaceRef}
              transform={`translate(${pan.x} ${pan.y}) scale(${scale})`}
            >
              {hoverCell && hoverVisible && dragPayload ? (
                <rect
                  className="square-workspace__hover"
                  x={hoverCell.x * cellSize}
                  y={hoverCell.y * cellSize}
                  width={cellSize * getPayloadSize(dragPayload).cols}
                  height={cellSize * getPayloadSize(dragPayload).rows}
                />
              ) : null}

              {allowedCells.map((cell) => {
                const x = cell.x * cellSize;
                const y = cell.y * cellSize;
                return (
                  <rect
                    key={`${cell.x}-${cell.y}`}
                    className="square-workspace__cell"
                    x={x}
                    y={y}
                    width={cellSize}
                    height={cellSize}
                  />
                );
              })}

              {gridBoundarySegments.map((seg, index) => (
                <line
                  key={`boundary-${index}`}
                  className="square-workspace__grid-boundary"
                  x1={seg.x1}
                  y1={seg.y1}
                  x2={seg.x2}
                  y2={seg.y2}
                />
              ))}

              {widgets.map((widget) => {
                const x = widget.x * cellSize;
                const y = widget.y * cellSize;
                const tile = tileMap.get(widget.tileId ?? '');
                const width = cellSize * (widget.w ?? 1);
                const height = cellSize * (widget.h ?? 1);
                const isDragOrigin =
                  dragPayload?.type === 'widget' && dragPayload.widget.id === widget.id;

                return (
                  <g
                    key={widget.id}
                    className={`square-workspace__tile${isDragOrigin ? ' is-drag-origin' : ''}`}
                    onMouseDown={(event) => handleWidgetPointerDown(widget, event)}
                  >
                    {tile || widget.appearance?.backgroundImageUrl ? (
                      <image
                        href={tile?.image ?? widget.appearance?.backgroundImageUrl}
                        x={x}
                        y={y}
                        width={width}
                        height={height}
                        preserveAspectRatio="xMidYMid slice"
                      />
                    ) : (
                      <rect x={x} y={y} width={width} height={height} fill="#d0d0d0" />
                    )}
                    <rect className="square-workspace__tile-border" x={x} y={y} width={width} height={height} />
                  </g>
                );
              })}
            </g>
          </svg>

          <div
            id="trash-dropzone"
            ref={deleteZoneRef}
            className={`battlemap-delete-panel${isDeleteZoneActive ? ' is-active' : ''}${isDeleteMode ? ' is-toggle-active' : ''}`}
            aria-label="Drop tiles here to delete them"
            role="presentation"
          onClick={() => {
            setIsDeleteMode((prev) => {
              const next = !prev;
              if (next) {
                setIsExpandMode(false);
                setIsDrawMode(false);
                setStatusMessage('Delete mode enabled.');
              } else {
                setStatusMessage('Delete mode disabled.');
              }
                setIsDeleteDrag(false);
                return next;
              });
            }}
          >
            <span className="battlemap-delete-panel__icon" aria-hidden />
          </div>

          {dragPayload && dragPosition && dragPreviewImage ? (
            <div
              className="square-workspace__drag-preview"
              style={{
                left: `${dragPosition.x}px`,
                top: `${dragPosition.y}px`,
                transform: 'translate(-50%, -50%)',
                width: `${cellSize * (dragPayload.type === 'palette' ? dragPayload.tile.cols : dragPayload.widget.w ?? 1) * scale}px`,
                height: `${cellSize * (dragPayload.type === 'palette' ? dragPayload.tile.rows : dragPayload.widget.h ?? 1) * scale}px`,
              }}
            >
              <img
                src={dragPreviewImage}
                alt="Drag preview"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  pointerEvents: 'none',
                }}
              />
            </div>
          ) : null}
        </div>
      </div>

      <div className="battlemap-workspace__right-sidebar">
        <div className="battlemap-workspace__control-section battlemap-workspace__control-section--compact">
          <h3 className="battlemap-workspace__control-title">Grid</h3>
          <div className="battlemap-workspace__grid-meta">
            <div className="battlemap-workspace__grid-meta-row">
              <span>Cell Size</span>
              <span>{cellSize}px</span>
            </div>
            <div className="battlemap-workspace__grid-meta-row">
              <span>Tiles Placed</span>
              <span>{widgets.length}</span>
            </div>
          </div>
          <button
            type="button"
            className="button button--ghost battlemap-workspace__reset-button"
            onClick={() => {
              setScale(1);
              hasCenteredRef.current = false;
              recenterGrid(1);
              hasCenteredRef.current = true;
            }}
          >
            Reset View
          </button>
          <button
            type="button"
            className={`button ${isExpandMode ? 'button--primary' : 'button--ghost'} battlemap-workspace__reset-button`}
            onClick={() => {
              setIsExpandMode((prev) => {
                const next = !prev;
                if (next) {
                  setIsDeleteMode(false);
                  setIsDrawMode(false);
                  setStatusMessage('Expand Grid Mode enabled. Click to add cells.');
                } else {
                  setStatusMessage('Expand Grid Mode disabled.');
                }
                return next;
              });
            }}
            onKeyDown={(event) => {
              if (event.code === 'Space') {
                event.preventDefault();
              }
            }}
          >
            {isExpandMode ? 'Expand Mode: ON' : 'Expand Grid'}
          </button>
          <div className="battlemap-workspace__export-actions">
            <button
              type="button"
              className="button battlemap-workspace__export-button"
              onClick={() => handleExportBattleMap('png')}
            >
              Save Battle Map (PNG)
            </button>
            <button
              type="button"
              className="button button--ghost battlemap-workspace__export-button"
              onClick={() => handleExportBattleMap('jpeg')}
            >
              Save Battle Map (JPEG)
            </button>
          </div>
          <p className="battlemap-workspace__hint">
            Hold space + drag to pan. Scroll to zoom. Drop tiles to snap to the grid. Occupied cells are swapped.
          </p>
        </div>
      </div>
    </div>
  );
}

export default BattleMapWorkspace;
