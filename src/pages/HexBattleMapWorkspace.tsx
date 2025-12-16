import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { CSSProperties, MouseEvent as ReactMouseEvent, WheelEvent as ReactWheelEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBattleMap } from '../hooks/useBattleMap';
import { DEFAULT_BATTLE_MAP_CONFIG, DEFAULT_HEX_BATTLE_MAP_CONFIG } from '../services/battleMapStorage';
import type { BattleMapConfig, HexWidget } from '../types/battlemap';
import type { HexTileDefinition } from '../data/tiles/types';
import { HEX_TILE_SETS } from '../data/tiles/tileSets';
import { createHexGeometry } from '../hex/hexGeometry';
import type { Cube } from '../hex/hexTypes';
import { downloadDataUrl, fetchImageAsDataUrl, loadImageFromUrl } from '../lib/exportUtils';
import { generateClientId } from '../lib/utils';
import './HexBattleMapWorkspace.css';

type DragPayload =
  | { type: 'palette'; tile: HexTileDefinition }
  | { type: 'widget'; widget: HexWidget };

function HexBattleMapWorkspace() {
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

  const hexConfig: BattleMapConfig =
    config.gridType === 'hex' ? config : DEFAULT_HEX_BATTLE_MAP_CONFIG;
  const hexSettings =
    hexConfig.hexSettings ?? DEFAULT_HEX_BATTLE_MAP_CONFIG.hexSettings ?? { hexSize: 80, orientation: 'pointy' as const };
  const widestHexSpan = Math.max(
    hexConfig.gridColumns || DEFAULT_HEX_BATTLE_MAP_CONFIG.gridColumns,
    hexConfig.gridRows || DEFAULT_HEX_BATTLE_MAP_CONFIG.gridRows,
  );
  const gridRadius = Math.max(1, Math.ceil(widestHexSpan / 2));

  const [hexWidgets, setHexWidgets] = useState<HexWidget[]>(hexConfig.hexWidgets ?? []);
  const [hoverHex, setHoverHex] = useState<Cube | null>(null);
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
  const [dragPayload, setDragPayload] = useState<DragPayload | null>(null);
  const [draggingOrigin, setDraggingOrigin] = useState<Cube | null>(null);
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isSpaceHeld, setIsSpaceHeld] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [accordionOpen, setAccordionOpen] = useState<Record<string, boolean>>(
    () => Object.fromEntries(HEX_TILE_SETS.map((set) => [set.title, false])),
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
  const lastPaintedHexRef = useRef<string | null>(null);

  const tileMap = useMemo(() => {
    const map = new Map<string, HexTileDefinition>();
    HEX_TILE_SETS.forEach((set) => {
      set.tiles.forEach((tile) => {
        map.set(tile.id, tile);
      });
    });
    return map;
  }, []);

  const geometry = useMemo(
    () => createHexGeometry(hexSettings),
    [hexSettings.hexSize, hexSettings.orientation],
  );

  const buildFilledHexagon = useCallback((radius: number) => {
    const cells: Cube[] = [];
    for (let q = -radius + 1; q <= radius - 1; q += 1) {
      for (let r = -radius + 1; r <= radius - 1; r += 1) {
        const s = -q - r;
        if (Math.max(Math.abs(q), Math.abs(r), Math.abs(s)) < radius) {
          cells.push({ q, r, s });
        }
      }
    }
    return cells;
  }, []);

  const [allowedCells, setAllowedCells] = useState<Cube[]>(() => {
    if (hexConfig.allowedHexCells && hexConfig.allowedHexCells.length > 0) {
      return hexConfig.allowedHexCells;
    }
    return buildFilledHexagon(gridRadius);
  });

  const gridBounds = useMemo(() => {
    if (!allowedCells.length) return null;
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    allowedCells.forEach((cell) => {
      const corners = geometry.hexToCorners({ q: cell.q, r: cell.r });
      corners.forEach((corner) => {
        minX = Math.min(minX, corner.x);
        minY = Math.min(minY, corner.y);
        maxX = Math.max(maxX, corner.x);
        maxY = Math.max(maxY, corner.y);
      });
    });

    return {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }, [allowedCells, geometry]);

  const boundaryEdges = useMemo(() => {
    if (!allowedCells.length) return [];
    const edgeMap = new Map<
      string,
      { start: { x: number; y: number }; end: { x: number; y: number }; count: number }
    >();
    const formatPoint = (point: { x: number; y: number }) => `${point.x.toFixed(4)},${point.y.toFixed(4)}`;

    allowedCells.forEach((cell) => {
      const corners = geometry.hexToCorners({ q: cell.q, r: cell.r });
      for (let i = 0; i < corners.length; i += 1) {
        const start = corners[i];
        const end = corners[(i + 1) % corners.length];
        const a = formatPoint(start);
        const b = formatPoint(end);
        const key = a < b ? `${a}|${b}` : `${b}|${a}`;
        const existing = edgeMap.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          edgeMap.set(key, { start, end, count: 1 });
        }
      }
    });

    return Array.from(edgeMap.values()).filter((edge) => edge.count === 1);
  }, [allowedCells, geometry]);

  const viewportRef = useRef<HTMLDivElement>(null);
  const deleteZoneRef = useRef<HTMLDivElement>(null);
  const deleteZoneActiveRef = useRef(false);
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const hasCenteredRef = useRef(false);
  const lastBoundsRef = useRef(gridBounds);
  const exportImageCacheRef = useRef<Map<string, string>>(new Map());

  const persistHexWidgets = useCallback(
    async (widgets: HexWidget[]) => {
      const nextConfig: BattleMapConfig = {
        gridType: 'hex',
        gridColumns: gridRadius * 2 - 1,
        gridRows: gridRadius * 2 - 1,
        cellSize: hexConfig.cellSize || hexSettings.hexSize,
        widgets: [],
        hexSettings: hexSettings,
        hexWidgets: widgets,
        allowedHexCells: allowedCells,
        version: hexConfig.version,
        updated_at: hexConfig.updated_at,
      };

      await saveConfig(nextConfig);
    },
    [allowedCells, gridRadius, hexConfig.cellSize, hexConfig.updated_at, hexConfig.version, hexSettings, saveConfig],
  );

  useEffect(() => {
    if (config.gridType !== 'hex') return;
    setHexWidgets(config.hexWidgets ?? []);

    if (config.allowedHexCells && config.allowedHexCells.length > 0) {
      setAllowedCells(config.allowedHexCells);
      return;
    }

    // Rebuild allowed cells from the saved grid radius when none were persisted.
    setAllowedCells(buildFilledHexagon(gridRadius));
  }, [buildFilledHexagon, config, gridRadius]);

  const placeDrawHexAtCell = useCallback(
    (hex: Cube) => {
      if (!isDrawMode || !selectedDrawTileId) return;
      const within = allowedCells.some((cell) => cell.q === hex.q && cell.r === hex.r);
      if (!within) return;

      const key = `${hex.q},${hex.r}`;
      if (lastPaintedHexRef.current === key) return;

      const tile = tileMap.get(selectedDrawTileId);
      if (!tile) return;

      let placed = false;
      setHexWidgets((current) => {
        const occupied = current.some((widget) => widget.q === hex.q && widget.r === hex.r);
        if (occupied) return current;

        const newWidget: HexWidget = {
          id: generateClientId(),
          gridType: 'hex',
          q: hex.q,
          r: hex.r,
          s: hex.s ?? -(hex.q + hex.r),
          tileId: tile.id,
          appearance: {
            backgroundImageUrl: tile.image,
          },
        };

        const next = [...current, newWidget];
        persistHexWidgets(next);
        placed = true;
        return next;
      });

      lastPaintedHexRef.current = key;
      if (placed) {
        setStatusMessage('Painted tile.');
      }
    },
    [allowedCells, isDrawMode, persistHexWidgets, selectedDrawTileId, tileMap],
  );

  const toWorldPoint = useCallback(
    (clientX: number, clientY: number) => {
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) return null;
      return {
        x: (clientX - rect.left - pan.x) / scale,
        y: (clientY - rect.top - pan.y) / scale,
      };
    },
    [pan.x, pan.y, scale],
  );

  const recenterGrid = useCallback((scaleOverride?: number) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect || !gridBounds) return;
    const effectiveScale = scaleOverride ?? scale;
    const centerX = gridBounds.minX + gridBounds.width / 2;
    const centerY = gridBounds.minY + gridBounds.height / 2;
    setPan({
      x: rect.width / 2 - centerX * effectiveScale,
      y: rect.height / 2 - centerY * effectiveScale,
    });
  }, [gridBounds, scale]);

  const handleDelete = useCallback(
    (widgetId: string) => {
      const nextWidgets = hexWidgets.filter((widget) => widget.id !== widgetId);
      setHexWidgets(nextWidgets);
      persistHexWidgets(nextWidgets);
      setSelectedWidgetId(null);
      setStatusMessage('Tile deleted.');
    },
    [hexWidgets, persistHexWidgets],
  );

  const deleteHexAtPoint = useCallback(
    (clientX?: number, clientY?: number) => {
      if (clientX === undefined || clientY === undefined) return;
      const point = toWorldPoint(clientX, clientY);
      if (!point) return;
      const targetHex = geometry.pixelToHex(point);
      const occupant = hexWidgets.find(
        (widget) => widget.q === targetHex.q && widget.r === targetHex.r,
      );
      if (occupant) {
        handleDelete(occupant.id);
      }
    },
    [geometry, handleDelete, hexWidgets, toWorldPoint],
  );

  const persistAllowedCells = useCallback(
    async (cells: Cube[]) => {
      const nextConfig: BattleMapConfig = {
        gridType: 'hex',
        gridColumns: gridRadius * 2 - 1,
        gridRows: gridRadius * 2 - 1,
        cellSize: hexConfig.cellSize || hexSettings.hexSize,
        widgets: [],
        hexSettings: hexSettings,
        hexWidgets: hexWidgets,
        allowedHexCells: cells,
        version: hexConfig.version,
        updated_at: hexConfig.updated_at,
      };

      await saveConfig(nextConfig);
    },
    [gridRadius, hexConfig.cellSize, hexConfig.updated_at, hexConfig.version, hexSettings, hexWidgets, saveConfig],
  );

  const addHexAtPoint = useCallback(
    (clientX?: number, clientY?: number) => {
      if (clientX === undefined || clientY === undefined) return;
      const point = toWorldPoint(clientX, clientY);
      if (!point) return;
      const targetHex = geometry.pixelToHex(point);

      const alreadyExists = allowedCells.some(
        (cell) => cell.q === targetHex.q && cell.r === targetHex.r,
      );

      if (alreadyExists) {
        setStatusMessage('Hex tile already exists at this location.');
        return;
      }

      const newCells = [...allowedCells, targetHex];
      setAllowedCells(newCells);
      persistAllowedCells(newCells);
      setStatusMessage('Added hex tile to grid.');
    },
    [allowedCells, geometry, persistAllowedCells, toWorldPoint],
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
      if (rect) {
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
      lastPaintedHexRef.current = null;
    }
  }, [isDrawMode]);

  useEffect(() => {
    if (!dragPayload) return undefined;

    const handleMove = (event: MouseEvent) => {
      setDragPosition({ x: event.clientX, y: event.clientY });
      const point = toWorldPoint(event.clientX, event.clientY);
      if (!point) {
        setHoverHex(null);
        setHoverVisible(false);
        updateDeleteZoneHighlight(event.clientX, event.clientY);
        return;
      }
      const hexAtPoint = geometry.pixelToHex(point);
      const isValidCell = allowedCells.some(
        (cell) => cell.q === hexAtPoint.q && cell.r === hexAtPoint.r,
      );
      setHoverHex(hexAtPoint);
      setHoverVisible(isValidCell);
      updateDeleteZoneHighlight(event.clientX, event.clientY);
    };

    const handleUp = (event: MouseEvent) => {
      setDragPosition({ x: event.clientX, y: event.clientY });
       const activeDelete = updateDeleteZoneHighlight(event.clientX, event.clientY);
      const point = toWorldPoint(event.clientX, event.clientY);
      const targetHex = point ? geometry.pixelToHex(point) : hoverHex;
      const isWithinBounds = targetHex
        ? allowedCells.some((cell) => cell.q === targetHex.q && cell.r === targetHex.r)
        : false;

      if (activeDelete && dragPayload?.type === 'widget') {
        handleDelete(dragPayload.widget.id);
      } else if (targetHex && isWithinBounds) {
        const occupant = hexWidgets.find(
          (widget) => widget.q === targetHex.q && widget.r === targetHex.r,
        );

        if (dragPayload.type === 'palette') {
          if (occupant) {
            setStatusMessage('That hex is already occupied.');
          } else {
            const newWidget: HexWidget = {
              id: generateClientId(),
              gridType: 'hex',
              q: targetHex.q,
              r: targetHex.r,
              s: targetHex.s,
              tileId: dragPayload.tile.id,
              appearance: {
                backgroundImageUrl: dragPayload.tile.image,
              },
            };
            const nextWidgets = [...hexWidgets, newWidget];
            setHexWidgets(nextWidgets);
            persistHexWidgets(nextWidgets);
            setStatusMessage('Placed tile on hex grid.');
          }
        } else {
          const origin = draggingOrigin ?? dragPayload.widget;
          const isSameSpot = origin.q === targetHex.q && origin.r === targetHex.r;
          if (occupant && occupant.id !== dragPayload.widget.id) {
            const nextWidgets = hexWidgets.map((widget) => {
              if (widget.id === dragPayload.widget.id) {
                return { ...widget, q: targetHex.q, r: targetHex.r, s: targetHex.s };
              }
              if (widget.id === occupant.id) {
                return { ...widget, q: origin.q, r: origin.r, s: origin.s };
              }
              return widget;
            });
            setHexWidgets(nextWidgets);
            persistHexWidgets(nextWidgets);
            setStatusMessage('Swapped tiles.');
          } else if (!isSameSpot) {
            const nextWidgets = hexWidgets.map((widget) =>
              widget.id === dragPayload.widget.id
                ? { ...widget, q: targetHex.q, r: targetHex.r, s: targetHex.s }
                : widget,
            );
            setHexWidgets(nextWidgets);
            persistHexWidgets(nextWidgets);
            setStatusMessage('Moved tile.');
          }
        }
      } else if (dragPayload.type === 'widget') {
        setStatusMessage('Outside the grid. Returning tile to its spot.');
      } else if (dragPayload.type === 'palette') {
        setStatusMessage('Drop tiles inside the grid.');
      }

      setDragPayload(null);
      setDraggingOrigin(null);
      setHoverHex(null);
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
    geometry,
    handleDelete,
    hexWidgets,
    hoverHex,
    persistHexWidgets,
    setIsDeleteDrag,
    toWorldPoint,
    updateDeleteZoneHighlight,
  ]);

  const handlePanStart = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (!isSpaceHeld) return;
      event.preventDefault();
      setIsPanning(true);
      panStartRef.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
    },
    [isSpaceHeld, pan.x, pan.y],
  );

  const handlePanMove = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (!isPanning || !panStartRef.current) return;
      const dx = event.clientX - panStartRef.current.x;
      const dy = event.clientY - panStartRef.current.y;
      setPan({ x: panStartRef.current.panX + dx, y: panStartRef.current.panY + dy });
    },
    [isPanning],
  );

  const stopPan = useCallback(() => {
    setIsPanning(false);
    panStartRef.current = null;
  }, []);

  const handleDeleteDragStart = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (!isDeleteMode) return;
      event.preventDefault();
      setIsDeleteDrag(true);
      deleteHexAtPoint(event.clientX, event.clientY);
    },
    [deleteHexAtPoint, isDeleteMode],
  );

  const handleDeleteDragMove = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (!isDeleteMode || !isDeleteDrag) return;
      event.preventDefault();
      deleteHexAtPoint(event.clientX, event.clientY);
    },
    [deleteHexAtPoint, isDeleteDrag, isDeleteMode],
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
        addHexAtPoint(event.clientX, event.clientY);
      }

      setExpandClickStart(null);
    },
    [addHexAtPoint, expandClickStart, isExpandMode],
  );

  const handleWheelZoom = useCallback(
    (event: ReactWheelEvent<HTMLDivElement>) => {
      const zoomFactor = event.deltaY < 0 ? 1.1 : 0.9;
      const nextScale = Math.min(2.5, Math.max(0.4, scale * zoomFactor));
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) {
        setScale(nextScale);
        return;
      }

      const worldBefore = toWorldPoint(event.clientX, event.clientY);
      setScale(nextScale);

      if (worldBefore) {
        const screenX = event.clientX - rect.left;
        const screenY = event.clientY - rect.top;
        setPan({
          x: screenX - worldBefore.x * nextScale,
          y: screenY - worldBefore.y * nextScale,
        });
      }
    },
    [scale, toWorldPoint],
  );

  const handleTilePointerDown = useCallback(
    (tile: HexTileDefinition, event: ReactMouseEvent<HTMLElement>) => {
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
    (widget: HexWidget, event: ReactMouseEvent<SVGGElement>) => {
      event.preventDefault();
      if (isDeleteMode) {
        handleDelete(widget.id);
        return;
      }
      setSelectedWidgetId(widget.id);
      setDragPayload({ type: 'widget', widget });
      setDraggingOrigin({ q: widget.q, r: widget.r, s: widget.s });
      setDragPosition({ x: event.clientX, y: event.clientY });
      setStatusMessage(null);
    },
    [handleDelete, isDeleteMode],
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
      lastPaintedHexRef.current = null;
      const targetHex = geometry.pixelToHex(point);
      placeDrawHexAtCell(targetHex);
      setIsDrawPainting(true);
    },
    [geometry, isDrawMode, isSpaceHeld, placeDrawHexAtCell, selectedDrawTileId, toWorldPoint],
  );

  const continueDrawPainting = useCallback(
    (clientX?: number, clientY?: number) => {
      if (!isDrawMode || !isDrawPainting) return;
      if (clientX === undefined || clientY === undefined) return;
      const point = toWorldPoint(clientX, clientY);
      if (!point) return;
      const targetHex = geometry.pixelToHex(point);
      placeDrawHexAtCell(targetHex);
    },
    [geometry, isDrawMode, isDrawPainting, placeDrawHexAtCell, toWorldPoint],
  );

  const stopDrawPainting = useCallback(() => {
    if (!isDrawPainting) return;
    setIsDrawPainting(false);
    lastPaintedHexRef.current = null;
  }, [isDrawPainting]);

  const dragPreviewImage = useMemo(() => {
    if (!dragPayload) return null;
    if (dragPayload.type === 'palette') return dragPayload.tile.image;
    return tileMap.get(dragPayload.widget.tileId)?.image ?? dragPayload.widget.appearance?.backgroundImageUrl ?? null;
  }, [dragPayload, tileMap]);

  const dragPreviewHexShape = useMemo(() => {
    const corners = geometry.hexToCorners({ q: 0, r: 0 });
    const minX = Math.min(...corners.map((c) => c.x));
    const maxX = Math.max(...corners.map((c) => c.x));
    const minY = Math.min(...corners.map((c) => c.y));
    const maxY = Math.max(...corners.map((c) => c.y));
    const width = maxX - minX;
    const height = maxY - minY;
    const points = corners.map((corner) => `${corner.x - minX},${corner.y - minY}`).join(' ');
    return { width, height, points };
  }, [geometry]);

  const getHexStyleValues = useCallback(() => {
    const workspaceEl = viewportRef.current?.closest('.hex-workspace') as HTMLElement | null;
    const styles = workspaceEl ? getComputedStyle(workspaceEl) : getComputedStyle(document.documentElement);
    return {
      background: styles.getPropertyValue('--bg').trim() || '#0f172a',
      gridLine: styles.getPropertyValue('--grid-line-color').trim() || 'rgba(255,255,255,0.12)',
      gridBorder: styles.getPropertyValue('--grid-border-color').trim() || 'rgba(255,255,255,0.35)',
      tileBorder:
        styles.getPropertyValue('--grid-border-color').trim() ||
        styles.getPropertyValue('--text').trim() ||
        '#6b7280',
    };
  }, []);

  const handleExportHexBattleMap = useCallback(
    async (format: 'png' | 'jpeg') => {
      if (!gridBounds) {
        setStatusMessage('Grid not ready to export.');
        return;
      }

      try {
        const padding = Math.max(12, hexSettings.hexSize * 0.25);
        const viewMinX = gridBounds.minX - padding;
        const viewMinY = gridBounds.minY - padding;
        const viewWidth = gridBounds.width + padding * 2;
        const viewHeight = gridBounds.height + padding * 2;
        const { background, gridBorder, gridLine, tileBorder } = getHexStyleValues();

        const inlineImages = new Map<string, string>();
        await Promise.all(
          hexWidgets.map(async (widget) => {
            const src =
              tileMap.get(widget.tileId)?.image ??
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

        if (hexWidgets.length) {
          svgParts.push('<defs>');
          hexWidgets.forEach((widget) => {
            const corners = geometry.hexToCorners({ q: widget.q, r: widget.r });
            const points = corners.map((corner) => `${corner.x},${corner.y}`).join(' ');
            const clipId = `hex-export-${widget.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
            svgParts.push(`<clipPath id="${clipId}"><polygon points="${points}" /></clipPath>`);
          });
          svgParts.push('</defs>');
        }

        boundaryEdges.forEach((edge) => {
          svgParts.push(
            `<line x1="${edge.start.x}" y1="${edge.start.y}" x2="${edge.end.x}" y2="${edge.end.y}" stroke="${gridBorder}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />`,
          );
        });

        allowedCells.forEach((hex) => {
          const points = geometry
            .hexToCorners({ q: hex.q, r: hex.r })
            .map((corner) => `${corner.x},${corner.y}`)
            .join(' ');
          svgParts.push(
            `<polygon points="${points}" fill="none" stroke="${gridLine}" stroke-width="1" />`,
          );
        });

        hexWidgets.forEach((widget) => {
          const corners = geometry.hexToCorners({ q: widget.q, r: widget.r });
          const points = corners.map((corner) => `${corner.x},${corner.y}`).join(' ');
          const minX = Math.min(...corners.map((corner) => corner.x));
          const maxX = Math.max(...corners.map((corner) => corner.x));
          const minY = Math.min(...corners.map((corner) => corner.y));
          const maxY = Math.max(...corners.map((corner) => corner.y));
          const clipId = `hex-export-${widget.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
          const tileSrc =
            tileMap.get(widget.tileId)?.image ?? widget.appearance?.backgroundImageUrl ?? '';
          const href = tileSrc ? inlineImages.get(tileSrc) ?? tileSrc : '';

          if (href) {
            svgParts.push(
              `<image href="${href}" x="${minX}" y="${minY}" width="${maxX - minX}" height="${
                maxY - minY
              }" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})" />`,
            );
          } else {
            svgParts.push(`<polygon points="${points}" fill="#d0d0d0" />`);
          }

          svgParts.push(
            `<polygon points="${points}" fill="none" stroke="${tileBorder}" stroke-width="1.5" />`,
          );
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

        ctx.fillStyle = background || 'transparent';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        URL.revokeObjectURL(svgUrl);

        const mime = format === 'png' ? 'image/png' : 'image/jpeg';
        const quality = format === 'jpeg' ? 0.92 : undefined;
        const dataUrl = canvas.toDataURL(mime, quality);
        downloadDataUrl(dataUrl, `hex-battle-map.${format === 'png' ? 'png' : 'jpg'}`);
        setStatusMessage(`Saved hex battle map as ${format.toUpperCase()}.`);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Hex export failed', err);
        setStatusMessage('Failed to export hex battle map.');
      }
    },
    [
      allowedCells,
      boundaryEdges,
      geometry,
      getHexStyleValues,
      gridBounds,
      hexSettings.hexSize,
      hexWidgets,
      tileMap,
    ],
  );

  if (isLoading) {
    return (
      <div className="battlemap-workspace__loading">
        <p className="battlemap-workspace__loading-text">Loading hex battle map...</p>
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
    <div className={`battlemap-workspace hex-workspace${isDeleteMode ? ' is-delete-mode' : ''}`}>
      <div className="battlemap-workspace__sidebar hex-workspace__sidebar">
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
                lastPaintedHexRef.current = null;
              }}
            >
              {isDrawMode ? 'Draw Mode: ON' : 'Draw Mode'}
            </button>
          </div>
          <div className="battlemap-workspace__tiles-header">
            <h3 className="battlemap-workspace__control-title">Tiles</h3>
          </div>
          <div className="battlemap-workspace__tiles-scroll">
            {HEX_TILE_SETS.map((set) => (
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
                >
                  {set.tiles.map((tile) => (
                    <div
                      key={tile.id}
                      className="battlemap-workspace__widget-template-wrapper"
                    >
                      <div
                        className={`battlemap-workspace__widget-template battlemap-workspace__widget-template--hex${isDrawMode ? ' is-draw-mode' : ''}${selectedDrawTileId === tile.id ? ' is-selected' : ''}`}
                        onMouseDown={(event) => handleTilePointerDown(tile, event)}
                        aria-label={`${tile.label} tile`}
                        style={
                          {
                            '--widget-bg-image': `url("${tile.image}")`,
                          } as CSSProperties
                        }
                      >
                        <div className="battlemap-workspace__widget-template-inner battlemap-workspace__widget-template-inner--hex" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="battlemap-workspace__hint battlemap-workspace__autosave">
            Auto-save: {isSaving ? 'Saving...' : 'Synced'}
          </p>
          {statusMessage ? <p className="hex-workspace__status">{statusMessage}</p> : null}
        </div>
      </div>

      <div className="battlemap-workspace__main hex-workspace__main">
        <div
          ref={viewportRef}
          className={`battlemap-workspace__viewport hex-workspace__viewport${isSpaceHeld ? ' is-space-held' : ''}${isPanning ? ' is-panning' : ''}${isExpandMode ? ' is-expand-mode' : ''}`}
          onMouseDown={(event) => {
            if (isDrawMode && !isSpaceHeld) {
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
            if (isDrawMode && isDrawPainting) {
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
            if (isDrawMode && isDrawPainting) {
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
            if (isDrawMode && isDrawPainting) {
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
          <svg className="hex-workspace__surface">
            <defs>
              {hexWidgets.map((widget) => {
                const corners = geometry.hexToCorners({ q: widget.q, r: widget.r });
                const points = corners.map((corner) => `${corner.x},${corner.y}`).join(' ');
                return (
                  <clipPath id={`hex-clip-${widget.id}`} key={`clip-${widget.id}`} clipPathUnits="userSpaceOnUse">
                    <polygon points={points} />
                  </clipPath>
                );
              })}
            </defs>
            <g transform={`translate(${pan.x} ${pan.y}) scale(${scale})`}>
              {boundaryEdges.map((edge, index) => (
                <line
                  key={`boundary-${index}`}
                  className="hex-workspace__grid-boundary"
                  x1={edge.start.x}
                  y1={edge.start.y}
                  x2={edge.end.x}
                  y2={edge.end.y}
                />
              ))}

              {hoverHex && hoverVisible && dragPayload ? (
                <polygon
                  className="hex-workspace__hover"
                  points={geometry
                    .hexToCorners({ q: hoverHex.q, r: hoverHex.r })
                    .map((corner) => `${corner.x},${corner.y}`)
                    .join(' ')}
                />
              ) : null}

              {allowedCells.map((hex) => {
                const corners = geometry.hexToCorners({ q: hex.q, r: hex.r });
                const points = corners.map((corner) => `${corner.x},${corner.y}`).join(' ');
                return (
                  <polygon
                    key={`${hex.q}-${hex.r}`}
                    className="hex-workspace__cell"
                    points={points}
                  />
                );
              })}

              {hexWidgets.map((widget) => {
                const corners = geometry.hexToCorners({ q: widget.q, r: widget.r });
                const points = corners.map((corner) => `${corner.x},${corner.y}`).join(' ');
                const minX = Math.min(...corners.map((corner) => corner.x));
                const maxX = Math.max(...corners.map((corner) => corner.x));
                const minY = Math.min(...corners.map((corner) => corner.y));
                const maxY = Math.max(...corners.map((corner) => corner.y));
                const tile = tileMap.get(widget.tileId);

                return (
                  <g
                    key={widget.id}
                    className="hex-workspace__tile"
                    onMouseDown={(event) => handleWidgetPointerDown(widget, event)}
                  >
                    {tile ? (
                      <image
                        href={tile.image}
                        x={minX}
                        y={minY}
                        width={maxX - minX}
                        height={maxY - minY}
                        preserveAspectRatio="xMidYMid slice"
                        clipPath={`url(#hex-clip-${widget.id})`}
                      />
                    ) : (
                      <polygon points={points} fill="#d0d0d0" />
                    )}
                    <polygon className="hex-workspace__tile-border" points={points} />
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
              className="hex-workspace__drag-preview"
              style={{
                left: `${dragPosition.x}px`,
                top: `${dragPosition.y}px`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <svg
                width={dragPreviewHexShape.width}
                height={dragPreviewHexShape.height}
                viewBox={`0 0 ${dragPreviewHexShape.width} ${dragPreviewHexShape.height}`}
                style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }}
              >
                <defs>
                  <clipPath id="drag-preview-clip">
                    <polygon points={dragPreviewHexShape.points} />
                  </clipPath>
                </defs>
                <image
                  href={dragPreviewImage}
                  x={0}
                  y={0}
                  width={dragPreviewHexShape.width}
                  height={dragPreviewHexShape.height}
                  preserveAspectRatio="xMidYMid slice"
                  clipPath="url(#drag-preview-clip)"
                />
                <polygon className="hex-workspace__tile-border" points={dragPreviewHexShape.points} />
              </svg>
            </div>
          ) : null}
        </div>
      </div>

      <div className="battlemap-workspace__right-sidebar">
        <div className="battlemap-workspace__control-section battlemap-workspace__control-section--compact">
          <h3 className="battlemap-workspace__control-title">Hex Grid</h3>
          <div className="battlemap-workspace__grid-meta">
            <div className="battlemap-workspace__grid-meta-row">
              <span>Orientation</span>
              <span>{hexSettings.orientation === 'flat' ? 'Flat top' : 'Pointy top'}</span>
            </div>
            <div className="battlemap-workspace__grid-meta-row">
              <span>Hex Size</span>
              <span>{hexSettings.hexSize}px</span>
            </div>
            <div className="battlemap-workspace__grid-meta-row">
              <span>Tiles Placed</span>
              <span>{hexWidgets.length}</span>
            </div>
          </div>
          <button
            type="button"
            className="button button--ghost battlemap-workspace__reset-button"
            onClick={() => {
              setScale(1);
              recenterGrid(1);
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
                  setStatusMessage('Expand Hex Grid Mode enabled. Click to add tiles.');
                } else {
                  setStatusMessage('Expand Hex Grid Mode disabled.');
                }
                return next;
              });
            }}
          >
            {isExpandMode ? 'Expand Mode: ON' : 'Expand Hex Grid'}
          </button>
          <div className="battlemap-workspace__export-actions">
            <button
              type="button"
              className="button battlemap-workspace__export-button"
              onClick={() => handleExportHexBattleMap('png')}
            >
              Save Battle Map (PNG)
            </button>
            <button
              type="button"
              className="button button--ghost battlemap-workspace__export-button"
              onClick={() => handleExportHexBattleMap('jpeg')}
            >
              Save Battle Map (JPEG)
            </button>
          </div>
          <p className="battlemap-workspace__hint">
            Hold space + drag to pan. Scroll to zoom. Drop tiles to snap to the nearest open hex. Occupied hexes are rejected (no swaps).
          </p>
        </div>
      </div>
    </div>
  );
}

export default HexBattleMapWorkspace;
