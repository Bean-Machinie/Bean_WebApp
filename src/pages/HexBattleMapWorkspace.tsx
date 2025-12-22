import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { CSSProperties, MouseEvent as ReactMouseEvent } from 'react';
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
import BattleMapLayerPanel, { type BattleMapLayer } from '../components/BattleMapLayerPanel/BattleMapLayerPanel';
import './HexBattleMapWorkspace.css';

type DragPayload =
  | { type: 'palette'; tile: HexTileDefinition }
  | { type: 'widget'; widget: HexWidget };

const GRID_LAYER_ID = 'grid-layer';
const GRID_BORDER_MIN = 1;
const GRID_BORDER_MAX = 30;
const GRID_BORDER_STEP = 0.5;
const GRID_BORDER_TICKS = 11;
const GRID_LINE_MIN = 0.5;
const GRID_LINE_MAX = 20;
const GRID_LINE_STEP = 0.5;
const GRID_LINE_TICKS = 11;

const clampNumber = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const getSliderPercent = (value: number, min: number, max: number) => {
  const clamped = clampNumber(value, min, max);
  return ((clamped - min) / (max - min)) * 100;
};

const parseColorToHex = (value: string, fallback: string) => {
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  if (trimmed.startsWith('#')) return trimmed;
  const match = trimmed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!match) return fallback;
  const toHex = (channel: string) => {
    const hex = Number(channel).toString(16).padStart(2, '0');
    return hex;
  };
  return `#${toHex(match[1])}${toHex(match[2])}${toHex(match[3])}`;
};

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
  const [mapLayers, setMapLayers] = useState<BattleMapLayer[]>(() => (
    hexConfig.layers && hexConfig.layers.length > 0
      ? hexConfig.layers
      : [{ id: GRID_LAYER_ID, name: 'Grid Map Layer', kind: 'grid', visible: true }]
  ));
  const [activeLayerId, setActiveLayerId] = useState(
    hexConfig.activeLayerId ?? GRID_LAYER_ID,
  );
  const mapLayersRef = useRef(mapLayers);
  const activeLayerIdRef = useRef(activeLayerId);
  const [gridLineWidth, setGridLineWidth] = useState(
    Number.isFinite(hexConfig.gridLineWidth)
      ? Number(hexConfig.gridLineWidth)
      : (DEFAULT_HEX_BATTLE_MAP_CONFIG.gridLineWidth ?? 1),
  );
  const [gridBorderWidth, setGridBorderWidth] = useState(
    Number.isFinite(hexConfig.gridBorderWidth)
      ? Number(hexConfig.gridBorderWidth)
      : (DEFAULT_HEX_BATTLE_MAP_CONFIG.gridBorderWidth ?? 2),
  );
  const [gridLineColor, setGridLineColor] = useState(hexConfig.gridLineColor ?? '');
  const [gridBorderColor, setGridBorderColor] = useState(hexConfig.gridBorderColor ?? '');
  const gridLineWidthRef = useRef(gridLineWidth);
  const gridBorderWidthRef = useRef(gridBorderWidth);
  const gridLineColorRef = useRef(gridLineColor);
  const gridBorderColorRef = useRef(gridBorderColor);
  const [isExpandMode, setIsExpandMode] = useState(false);
  const [isExpandPainting, setIsExpandPainting] = useState(false);
  const [isShrinkMode, setIsShrinkMode] = useState(false);
  const [isShrinkPainting, setIsShrinkPainting] = useState(false);
  const [isDrawMode, setIsDrawMode] = useState(false);
  const [selectedDrawTileId, setSelectedDrawTileId] = useState<string | null>(null);
  const [isDrawPainting, setIsDrawPainting] = useState(false);
  const [gridHoverHex, setGridHoverHex] = useState<Cube | null>(null);
  const [gridHoverMode, setGridHoverMode] = useState<'expand' | 'shrink' | null>(null);
  const lastPaintedHexRef = useRef<string | null>(null);
  const lastGridPaintedRef = useRef<string | null>(null);

  const activeLayer = useMemo(
    () => mapLayers.find((layer) => layer.id === activeLayerId),
    [mapLayers, activeLayerId],
  );
  const isGridLayerActive = activeLayer?.kind === 'grid';
  const isGridLayerVisible =
    mapLayers.find((layer) => layer.kind === 'grid')?.visible ?? true;

  useEffect(() => {
    if (!isGridLayerActive) {
      setIsExpandMode(false);
      setIsShrinkMode(false);
      setIsDrawMode(false);
    }
  }, [isGridLayerActive]);

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
  const allowedCellSet = useMemo(
    () => new Set(allowedCells.map((cell) => `${cell.q},${cell.r}`)),
    [allowedCells],
  );

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
  const exportImageCacheRef = useRef<Map<string, string>>(new Map());
  const saveBufferRef = useRef<BattleMapConfig | null>(null);
  const saveThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gridVisualSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveInFlightRef = useRef(false);
  const hasUnsavedChangesRef = useRef(false);
  const hasHydratedConfigRef = useRef(false);
  const lastHydratedVersionRef = useRef<number | null>(null);
  const lastHydratedProjectRef = useRef<string | undefined>(project?.id);

  useEffect(() => {
    mapLayersRef.current = mapLayers;
  }, [mapLayers]);

  useEffect(() => {
    activeLayerIdRef.current = activeLayerId;
  }, [activeLayerId]);

  useEffect(() => {
    gridLineWidthRef.current = gridLineWidth;
  }, [gridLineWidth]);

  useEffect(() => {
    gridBorderWidthRef.current = gridBorderWidth;
  }, [gridBorderWidth]);

  useEffect(() => {
    gridLineColorRef.current = gridLineColor;
  }, [gridLineColor]);

  useEffect(() => {
    gridBorderColorRef.current = gridBorderColor;
  }, [gridBorderColor]);

  const flushPendingSave = useCallback(async () => {
    if (saveInFlightRef.current || !saveBufferRef.current) return;
    const payload = saveBufferRef.current;
    saveBufferRef.current = null;
    saveInFlightRef.current = true;
    let failed = false;

    try {
      await saveConfig(payload);
    } catch (err) {
      console.error('Failed to save hex battle map', err);
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
    (
      widgets: HexWidget[],
      layerOverrides?: { layers?: BattleMapLayer[]; activeLayerId?: string },
      allowedCellsOverride?: Cube[],
    ) => {
      hasUnsavedChangesRef.current = true;
      saveBufferRef.current = {
        gridType: 'hex',
        gridColumns: gridRadius * 2 - 1,
        gridRows: gridRadius * 2 - 1,
        cellSize: hexConfig.cellSize || hexSettings.hexSize,
        gridLineColor: gridLineColorRef.current || undefined,
        gridBorderColor: gridBorderColorRef.current || undefined,
        gridLineWidth: gridLineWidthRef.current,
        gridBorderWidth: gridBorderWidthRef.current,
        widgets: [],
        hexSettings,
        hexWidgets: widgets,
        allowedHexCells: allowedCellsOverride ?? allowedCells,
        layers: layerOverrides?.layers ?? mapLayersRef.current,
        activeLayerId: layerOverrides?.activeLayerId ?? activeLayerIdRef.current,
        version: hexConfig.version,
        updated_at: hexConfig.updated_at,
      };

      if (saveThrottleRef.current) {
        clearTimeout(saveThrottleRef.current);
      }

      saveThrottleRef.current = setTimeout(() => {
        saveThrottleRef.current = null;
        flushPendingSave();
      }, 80);
    },
    [
      allowedCells,
      flushPendingSave,
      gridRadius,
      hexConfig.cellSize,
      hexConfig.updated_at,
      hexConfig.version,
      hexSettings,
    ],
  );

  const commitLayerState = useCallback(
    (nextLayers: BattleMapLayer[], nextActiveLayerId = activeLayerId) => {
      setMapLayers(nextLayers);
      setActiveLayerId(nextActiveLayerId);
      queueSave(hexWidgets, { layers: nextLayers, activeLayerId: nextActiveLayerId });
    },
    [activeLayerId, hexWidgets, queueSave],
  );

  const commitGridVisuals = useCallback(() => {
    queueSave(hexWidgets);
  }, [hexWidgets, queueSave]);

  const scheduleGridVisualSave = useCallback(() => {
    if (gridVisualSaveTimeoutRef.current) {
      clearTimeout(gridVisualSaveTimeoutRef.current);
    }
    gridVisualSaveTimeoutRef.current = setTimeout(() => {
      gridVisualSaveTimeoutRef.current = null;
      commitGridVisuals();
    }, 250);
  }, [commitGridVisuals]);

  useEffect(() => {
    const projectChanged = project?.id && project?.id !== lastHydratedProjectRef.current;
    if (config.gridType !== 'hex') return;
    const incomingVersion = config.version ?? 0;
    const shouldHydrate =
      projectChanged ||
      !hasHydratedConfigRef.current ||
      (!hasUnsavedChangesRef.current && incomingVersion >= (lastHydratedVersionRef.current ?? -1));

    if (!shouldHydrate) return;

    setHexWidgets(config.hexWidgets ?? []);
    setMapLayers(
      config.layers && config.layers.length > 0
        ? config.layers
        : [{ id: GRID_LAYER_ID, name: 'Grid Map Layer', kind: 'grid', visible: true }],
    );
    setActiveLayerId(config.activeLayerId ?? GRID_LAYER_ID);

    if (config.allowedHexCells && config.allowedHexCells.length > 0) {
      setAllowedCells(config.allowedHexCells);
    } else if (projectChanged || !hasHydratedConfigRef.current) {
      setAllowedCells(buildFilledHexagon(gridRadius));
    }
    setGridLineWidth(
      Number.isFinite(config.gridLineWidth)
        ? Number(config.gridLineWidth)
        : (DEFAULT_HEX_BATTLE_MAP_CONFIG.gridLineWidth ?? 1),
    );
    setGridBorderWidth(
      Number.isFinite(config.gridBorderWidth)
        ? Number(config.gridBorderWidth)
        : (DEFAULT_HEX_BATTLE_MAP_CONFIG.gridBorderWidth ?? 2),
    );
    setGridLineColor(config.gridLineColor ?? '');
    setGridBorderColor(config.gridBorderColor ?? '');

    hasHydratedConfigRef.current = true;
    lastHydratedVersionRef.current = incomingVersion;
    lastHydratedProjectRef.current = project?.id;
  }, [buildFilledHexagon, config, gridRadius, project?.id]);

  useEffect(
    () => () => {
      if (saveThrottleRef.current) {
        clearTimeout(saveThrottleRef.current);
      }
      if (gridVisualSaveTimeoutRef.current) {
        clearTimeout(gridVisualSaveTimeoutRef.current);
      }
    },
    [],
  );

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
        const existing = current.find((widget) => widget.q === hex.q && widget.r === hex.r);
        if (existing) {
          const next = current.map((widget) =>
            widget.id === existing.id
              ? {
                  ...widget,
                  tileId: tile.id,
                  appearance: {
                    backgroundImageUrl: tile.image,
                  },
                }
              : widget,
          );
          queueSave(next);
          placed = true;
          return next;
        }

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
        queueSave(next);
        placed = true;
        return next;
      });

      lastPaintedHexRef.current = key;
      if (placed) {
        setStatusMessage('Painted tile.');
      }
    },
    [allowedCells, isDrawMode, queueSave, selectedDrawTileId, tileMap],
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
      const nextWidgets = hexWidgets.filter((widget) => widget.id !== widgetId);
      setHexWidgets(nextWidgets);
      queueSave(nextWidgets);
      setSelectedWidgetId(null);
      setStatusMessage('Tile deleted.');
    },
    [hexWidgets, queueSave],
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

  const doesWidgetMatchHex = useCallback(
    (widget: HexWidget, hex: Cube) => widget.q === hex.q && widget.r === hex.r,
    [],
  );

  const addHexAtPoint = useCallback(
    (clientX?: number, clientY?: number) => {
      if (clientX === undefined || clientY === undefined) return;
      const point = toWorldPoint(clientX, clientY);
      if (!point) return;
      const targetHex = geometry.pixelToHex(point);
      const key = `${targetHex.q},${targetHex.r}`;

      if (lastGridPaintedRef.current === key) return;
      lastGridPaintedRef.current = key;

      setAllowedCells((current) => {
        const alreadyExists = current.some(
          (cell) => cell.q === targetHex.q && cell.r === targetHex.r,
        );
        if (alreadyExists) {
          return current;
        }

        const newCells = [...current, targetHex];
        queueSave(hexWidgets, undefined, newCells);
        setStatusMessage('Added hex tile to grid.');
        return newCells;
      });
    },
    [geometry, hexWidgets, queueSave, toWorldPoint],
  );

  const removeHexAtPoint = useCallback(
    (clientX?: number, clientY?: number) => {
      if (clientX === undefined || clientY === undefined) return;
      const point = toWorldPoint(clientX, clientY);
      if (!point) return;
      const targetHex = geometry.pixelToHex(point);
      const key = `${targetHex.q},${targetHex.r}`;

      if (lastGridPaintedRef.current === key) return;
      lastGridPaintedRef.current = key;

      setAllowedCells((current) => {
        const exists = current.some(
          (cell) => cell.q === targetHex.q && cell.r === targetHex.r,
        );
        if (!exists) {
          return current;
        }

        const nextCells = current.filter(
          (cell) => cell.q !== targetHex.q || cell.r !== targetHex.r,
        );

        setHexWidgets((currentWidgets) => {
          const nextWidgets = currentWidgets.filter(
            (widget) => !doesWidgetMatchHex(widget, targetHex),
          );
          if (selectedWidgetId && currentWidgets.some((widget) => widget.id === selectedWidgetId)) {
            const selectedStillExists = nextWidgets.some((widget) => widget.id === selectedWidgetId);
            if (!selectedStillExists) {
              setSelectedWidgetId(null);
            }
          }
          queueSave(nextWidgets, undefined, nextCells);
          setStatusMessage('Removed hex tile from grid.');
          return nextWidgets;
        });

        return nextCells;
      });
    },
    [doesWidgetMatchHex, geometry, queueSave, selectedWidgetId, toWorldPoint],
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
        if (!hasCenteredRef.current) {
          recenterGrid();
          hasCenteredRef.current = true;
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
    if (!isExpandMode) {
      setIsExpandPainting(false);
    }
    if (!isShrinkMode) {
      setIsShrinkPainting(false);
    }
    if (!isExpandMode && !isShrinkMode) {
      setGridHoverHex(null);
      setGridHoverMode(null);
      lastGridPaintedRef.current = null;
    }
  }, [isExpandMode, isShrinkMode]);

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
            queueSave(nextWidgets);
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
            queueSave(nextWidgets);
            setStatusMessage('Swapped tiles.');
          } else if (!isSameSpot) {
            const nextWidgets = hexWidgets.map((widget) =>
              widget.id === dragPayload.widget.id
                ? { ...widget, q: targetHex.q, r: targetHex.r, s: targetHex.s }
                : widget,
            );
            setHexWidgets(nextWidgets);
            queueSave(nextWidgets);
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
    queueSave,
    setIsDeleteDrag,
    toWorldPoint,
    updateDeleteZoneHighlight,
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

  const updateGridHover = useCallback(
    (clientX?: number, clientY?: number) => {
      if (clientX === undefined || clientY === undefined) return;
      if (!isExpandMode && !isShrinkMode) return;
      const point = toWorldPoint(clientX, clientY);
      if (!point) {
        setGridHoverHex(null);
        setGridHoverMode(null);
        return;
      }
      const hexAtPoint = geometry.pixelToHex(point);
      const key = `${hexAtPoint.q},${hexAtPoint.r}`;

      if (isExpandMode && !allowedCellSet.has(key)) {
        setGridHoverHex(hexAtPoint);
        setGridHoverMode('expand');
        return;
      }

      if (isShrinkMode && allowedCellSet.has(key)) {
        setGridHoverHex(hexAtPoint);
        setGridHoverMode('shrink');
        return;
      }

      setGridHoverHex(null);
      setGridHoverMode(null);
    },
    [allowedCellSet, geometry, isExpandMode, isShrinkMode, toWorldPoint],
  );

  const startExpandPainting = useCallback(
    (clientX?: number, clientY?: number) => {
      if (!isExpandMode) return;
      lastGridPaintedRef.current = null;
      setIsExpandPainting(true);
      addHexAtPoint(clientX, clientY);
    },
    [addHexAtPoint, isExpandMode],
  );

  const continueExpandPainting = useCallback(
    (clientX?: number, clientY?: number) => {
      if (!isExpandMode || !isExpandPainting) return;
      addHexAtPoint(clientX, clientY);
    },
    [addHexAtPoint, isExpandMode, isExpandPainting],
  );

  const stopExpandPainting = useCallback(() => {
    if (!isExpandPainting) return;
    setIsExpandPainting(false);
    lastGridPaintedRef.current = null;
  }, [isExpandPainting]);

  const startShrinkPainting = useCallback(
    (clientX?: number, clientY?: number) => {
      if (!isShrinkMode) return;
      lastGridPaintedRef.current = null;
      setIsShrinkPainting(true);
      removeHexAtPoint(clientX, clientY);
    },
    [isShrinkMode, removeHexAtPoint],
  );

  const continueShrinkPainting = useCallback(
    (clientX?: number, clientY?: number) => {
      if (!isShrinkMode || !isShrinkPainting) return;
      removeHexAtPoint(clientX, clientY);
    },
    [isShrinkMode, isShrinkPainting, removeHexAtPoint],
  );

  const stopShrinkPainting = useCallback(() => {
    if (!isShrinkPainting) return;
    setIsShrinkPainting(false);
    lastGridPaintedRef.current = null;
  }, [isShrinkPainting]);

  const handleWheelZoom = useCallback(
    (event: WheelEvent) => {
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

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;

    const handleWheel = (event: WheelEvent) => {
      handleWheelZoom(event);
    };

    viewport.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      viewport.removeEventListener('wheel', handleWheel);
    };
  }, [handleWheelZoom, isLoading]);

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
      setDraggingOrigin({ q: widget.q, r: widget.r, s: widget.s });
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

  const gridStyleVars = useMemo(
    () =>
      ({
        '--grid-line-color': gridLineColor || undefined,
        '--grid-border-color': gridBorderColor || undefined,
        '--grid-line-width': `${gridLineWidth}px`,
        '--grid-border-width': `${gridBorderWidth}px`,
      }) as CSSProperties,
    [gridBorderColor, gridBorderWidth, gridLineColor, gridLineWidth],
  );

  const getHexStyleValues = useCallback(() => {
    const workspaceEl = viewportRef.current?.closest('.hex-workspace') as HTMLElement | null;
    const styles = workspaceEl ? getComputedStyle(workspaceEl) : getComputedStyle(document.documentElement);
    const gridLineWidthValue = parseFloat(styles.getPropertyValue('--grid-line-width'));
    const gridBorderWidthValue = parseFloat(styles.getPropertyValue('--grid-border-width'));
    return {
      background: styles.getPropertyValue('--bg').trim() || '#0f172a',
      gridLine: styles.getPropertyValue('--grid-line-color').trim() || '#e2e8f0',
      gridBorder: styles.getPropertyValue('--grid-border-color').trim() || '#f8fafc',
      gridLineWidth: Number.isFinite(gridLineWidthValue) ? gridLineWidthValue : 1,
      gridBorderWidth: Number.isFinite(gridBorderWidthValue) ? gridBorderWidthValue : 2,
      tileBorder:
        styles.getPropertyValue('--grid-border-color').trim() ||
        styles.getPropertyValue('--text').trim() ||
        '#6b7280',
    };
  }, []);

  const resolvedGridLineColor = useMemo(() => {
    if (gridLineColor) return gridLineColor;
    return parseColorToHex(getHexStyleValues().gridLine, '#94a3b8');
  }, [getHexStyleValues, gridLineColor]);

  const resolvedGridBorderColor = useMemo(() => {
    if (gridBorderColor) return gridBorderColor;
    return parseColorToHex(getHexStyleValues().gridBorder, '#94a3b8');
  }, [getHexStyleValues, gridBorderColor]);
  const gridBorderPercent = getSliderPercent(gridBorderWidth, GRID_BORDER_MIN, GRID_BORDER_MAX);
  const gridLinePercent = getSliderPercent(gridLineWidth, GRID_LINE_MIN, GRID_LINE_MAX);

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
        const { background, gridBorder, gridLine, gridBorderWidth, gridLineWidth, tileBorder } = getHexStyleValues();

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

        // Tiles
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

        // Grid lines
        allowedCells.forEach((hex) => {
          const points = geometry
            .hexToCorners({ q: hex.q, r: hex.r })
            .map((corner) => `${corner.x},${corner.y}`)
            .join(' ');
          svgParts.push(
            `<polygon points="${points}" fill="none" stroke="${gridLine}" stroke-width="${gridLineWidth}" />`,
          );
        });

        // Grid boundary
        boundaryEdges.forEach((edge) => {
          svgParts.push(
            `<line x1="${edge.start.x}" y1="${edge.start.y}" x2="${edge.end.x}" y2="${edge.end.y}" stroke="${gridBorder}" stroke-width="${gridBorderWidth}" stroke-linecap="round" stroke-linejoin="round" />`,
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
    <div
      className={`battlemap-workspace hex-workspace${isDeleteMode ? ' is-delete-mode' : ''}`}
      style={gridStyleVars}
    >
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
              disabled={!isGridLayerActive}
              onClick={() => {
                setIsDrawMode((prev) => {
                  const next = !prev;
                  if (next) {
                    setIsDeleteMode(false);
                    setIsExpandMode(false);
                    setIsShrinkMode(false);
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
          <div className="battlemap-workspace__sidebar-actions">
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
          className={`battlemap-workspace__viewport hex-workspace__viewport${isSpaceHeld ? ' is-space-held' : ''}${isPanning ? ' is-panning' : ''}${isExpandMode ? ' is-expand-mode' : ''}${isShrinkMode ? ' is-shrink-mode' : ''}`}
          onMouseDown={(event) => {
            if (isSpaceHeld) {
              handlePanStart(event);
            } else if (isDrawMode) {
              startDrawPainting(event.clientX, event.clientY);
            } else if (isExpandMode) {
              startExpandPainting(event.clientX, event.clientY);
            } else if (isShrinkMode) {
              startShrinkPainting(event.clientX, event.clientY);
            } else if (isDeleteMode) {
              handleDeleteDragStart(event);
            } else {
              handlePanStart(event);
            }
          }}
          onMouseMove={(event) => {
            if (isExpandMode || isShrinkMode) {
              updateGridHover(event.clientX, event.clientY);
            }
            if (isPanning) {
              handlePanMove(event);
            } else if (isDrawMode && isDrawPainting) {
              continueDrawPainting(event.clientX, event.clientY);
            } else if (isExpandMode) {
              continueExpandPainting(event.clientX, event.clientY);
            } else if (isShrinkMode) {
              continueShrinkPainting(event.clientX, event.clientY);
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
              stopExpandPainting();
            } else if (isShrinkMode) {
              stopShrinkPainting();
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
              stopExpandPainting();
              setGridHoverHex(null);
              setGridHoverMode(null);
            } else if (isShrinkMode) {
              stopShrinkPainting();
              setGridHoverHex(null);
              setGridHoverMode(null);
            } else if (isDeleteMode) {
              handleDeleteDragEnd();
            } else {
              stopPan();
            }
          }}
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
            <g
              ref={surfaceRef}
              transform={`translate(${pan.x} ${pan.y}) scale(${scale})`}
            >
              {isGridLayerVisible ? (
                <>
                  {hexWidgets.map((widget) => {
                    const corners = geometry.hexToCorners({ q: widget.q, r: widget.r });
                    const points = corners.map((corner) => `${corner.x},${corner.y}`).join(' ');
                    const minX = Math.min(...corners.map((corner) => corner.x));
                    const maxX = Math.max(...corners.map((corner) => corner.x));
                    const minY = Math.min(...corners.map((corner) => corner.y));
                    const maxY = Math.max(...corners.map((corner) => corner.y));
                    const tile = tileMap.get(widget.tileId);
                    const isDragOrigin =
                      dragPayload?.type === 'widget' && dragPayload.widget.id === widget.id;

                    return (
                      <g
                        key={widget.id}
                        className={`hex-workspace__tile${isDragOrigin ? ' is-drag-origin' : ''}`}
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

                  {gridHoverHex && gridHoverMode === 'expand' ? (
                    <polygon
                      className="hex-workspace__expand-preview"
                      points={geometry
                        .hexToCorners({ q: gridHoverHex.q, r: gridHoverHex.r })
                        .map((corner) => `${corner.x},${corner.y}`)
                        .join(' ')}
                    />
                  ) : null}

                  {gridHoverHex && gridHoverMode === 'shrink' ? (
                    <polygon
                      className="hex-workspace__shrink-preview"
                      points={geometry
                        .hexToCorners({ q: gridHoverHex.q, r: gridHoverHex.r })
                        .map((corner) => `${corner.x},${corner.y}`)
                        .join(' ')}
                    />
                  ) : null}
                </>
              ) : null}
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
                setIsShrinkMode(false);
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
        <BattleMapLayerPanel
          layers={mapLayers}
          activeLayerId={activeLayerId}
          onActiveLayerChange={(layerId) => {
            commitLayerState(mapLayers, layerId);
          }}
          onToggleVisibility={(layerId) => {
            const nextLayers = mapLayers.map((layer) =>
              layer.id === layerId ? { ...layer, visible: !layer.visible } : layer,
            );
            commitLayerState(nextLayers);
          }}
          onAddLayer={(kind) => {
            const baseName = (() => {
              if (kind === 'grid') return 'Grid Layer';
              if (kind === 'image') return 'Image Layer';
              if (kind === 'background') return 'Background Layer';
              return 'Layer';
            })();
            const nextLayer = {
              id: crypto.randomUUID(),
              name: `${baseName} ${mapLayers.length}`,
              kind,
              visible: true,
            };
            const nextLayers = [...mapLayers, nextLayer];
            commitLayerState(nextLayers, nextLayer.id);
          }}
          onRenameLayer={(layerId, nextName) => {
            const nextLayers = mapLayers.map((layer) =>
              layer.id === layerId ? { ...layer, name: nextName } : layer,
            );
            commitLayerState(nextLayers);
          }}
          onMoveLayerUp={(layerId) => {
            const index = mapLayers.findIndex((layer) => layer.id === layerId);
            if (index <= 0) return;
            const nextLayers = [...mapLayers];
            [nextLayers[index - 1], nextLayers[index]] = [nextLayers[index], nextLayers[index - 1]];
            commitLayerState(nextLayers);
          }}
          onMoveLayerDown={(layerId) => {
            const index = mapLayers.findIndex((layer) => layer.id === layerId);
            if (index < 0 || index >= mapLayers.length - 1) return;
            const nextLayers = [...mapLayers];
            [nextLayers[index + 1], nextLayers[index]] = [nextLayers[index], nextLayers[index + 1]];
            commitLayerState(nextLayers);
          }}
          onDeleteLayer={(layerId) => {
            const layer = mapLayers.find((entry) => entry.id === layerId);
            if (!layer || layer.kind === 'grid') return;
            if (mapLayers.length <= 1) return;
            const nextLayers = mapLayers.filter((entry) => entry.id !== layerId);
            const deletedIndex = mapLayers.findIndex((entry) => entry.id === layerId);
            const nextActiveLayerId =
              activeLayerId === layerId
                ? nextLayers[Math.max(0, deletedIndex - 1)]?.id ?? nextLayers[0]?.id
                : activeLayerId;
            commitLayerState(nextLayers, nextActiveLayerId);
          }}
          onReorderLayers={(nextLayers) => {
            commitLayerState(nextLayers);
          }}
        />
        <div className="battlemap-workspace__control-section battlemap-workspace__control-section--compact">
          <h3 className="battlemap-workspace__control-title">Grid Properties</h3>
          {isGridLayerActive ? (
            <>
              <div className="battlemap-grid-toggle-row">
                <button
                  type="button"
                  className={`button button--ghost battlemap-grid-toggle${isExpandMode ? ' is-active' : ''}`}
                  onClick={() => {
                    setIsExpandMode((prev) => {
                      const next = !prev;
                      if (next) {
                        setIsDeleteMode(false);
                        setIsDrawMode(false);
                        setIsShrinkMode(false);
                        setStatusMessage('Expand Hex Grid Mode enabled. Click or drag to add tiles.');
                      } else {
                        setStatusMessage('Expand Hex Grid Mode disabled.');
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
                  Expand
                </button>
                <button
                  type="button"
                  className={`button button--ghost battlemap-grid-toggle${isShrinkMode ? ' is-active' : ''}`}
                  onClick={() => {
                    setIsShrinkMode((prev) => {
                      const next = !prev;
                      if (next) {
                        setIsDeleteMode(false);
                        setIsDrawMode(false);
                        setIsExpandMode(false);
                        setStatusMessage('Decrease Hex Grid Mode enabled. Click or drag to remove tiles.');
                      } else {
                        setStatusMessage('Decrease Hex Grid Mode disabled.');
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
                  Decrease
                </button>
              </div>

              <h3 className="battlemap-workspace__control-title battlemap-grid-visuals-title">Grid Visuals</h3>
              <div className="battlemap-grid-visual">
                <div className="battlemap-grid-visual__label-row">
                  <span>Outer Border Thickness</span>
                  <span className="battlemap-grid-visual__value">{gridBorderWidth.toFixed(1)}px</span>
                </div>
                <div
                  className="battlemap-grid-slider-wrap"
                  style={{ '--tick-count': GRID_BORDER_TICKS } as CSSProperties}
                >
                  <input
                    type="range"
                    min={GRID_BORDER_MIN}
                    max={GRID_BORDER_MAX}
                    step={GRID_BORDER_STEP}
                    value={gridBorderWidth}
                    onChange={(event) => {
                      const next = clampNumber(
                        Number(event.target.value),
                        GRID_BORDER_MIN,
                        GRID_BORDER_MAX,
                      );
                      setGridBorderWidth(next);
                      gridBorderWidthRef.current = next;
                    }}
                    onPointerUp={commitGridVisuals}
                    onKeyUp={commitGridVisuals}
                    className="battlemap-grid-slider"
                    aria-label="Outer border thickness"
                  />
                  <output
                    className="battlemap-grid-slider__value"
                    style={{ left: `${gridBorderPercent}%` }}
                  >
                    {gridBorderWidth.toFixed(1)}px
                  </output>
                  <div className="battlemap-grid-slider__ticks" aria-hidden>
                    {Array.from({ length: GRID_BORDER_TICKS }).map((_, index) => (
                      <span key={`grid-border-tick-${index}`} />
                    ))}
                  </div>
                </div>
                <input
                  type="color"
                  value={resolvedGridBorderColor}
                  onChange={(event) => {
                    const next = event.currentTarget.value;
                    setGridBorderColor(next);
                    gridBorderColorRef.current = next;
                    scheduleGridVisualSave();
                  }}
                  className="battlemap-grid-color"
                  aria-label="Outer border color"
                />
              </div>
              <div className="battlemap-grid-visual">
                <div className="battlemap-grid-visual__label-row">
                  <span>Inner Grid Thickness</span>
                  <span className="battlemap-grid-visual__value">{gridLineWidth.toFixed(1)}px</span>
                </div>
                <div
                  className="battlemap-grid-slider-wrap"
                  style={{ '--tick-count': GRID_LINE_TICKS } as CSSProperties}
                >
                  <input
                    type="range"
                    min={GRID_LINE_MIN}
                    max={GRID_LINE_MAX}
                    step={GRID_LINE_STEP}
                    value={gridLineWidth}
                    onChange={(event) => {
                      const next = clampNumber(
                        Number(event.target.value),
                        GRID_LINE_MIN,
                        GRID_LINE_MAX,
                      );
                      setGridLineWidth(next);
                      gridLineWidthRef.current = next;
                    }}
                    onPointerUp={commitGridVisuals}
                    onKeyUp={commitGridVisuals}
                    className="battlemap-grid-slider"
                    aria-label="Inner grid thickness"
                  />
                  <output
                    className="battlemap-grid-slider__value"
                    style={{ left: `${gridLinePercent}%` }}
                  >
                    {gridLineWidth.toFixed(1)}px
                  </output>
                  <div className="battlemap-grid-slider__ticks" aria-hidden>
                    {Array.from({ length: GRID_LINE_TICKS }).map((_, index) => (
                      <span key={`grid-line-tick-${index}`} />
                    ))}
                  </div>
                </div>
                <input
                  type="color"
                  value={resolvedGridLineColor}
                  onChange={(event) => {
                    const next = event.currentTarget.value;
                    setGridLineColor(next);
                    gridLineColorRef.current = next;
                    scheduleGridVisualSave();
                  }}
                  className="battlemap-grid-color"
                  aria-label="Inner grid color"
                />
              </div>
            </>
          ) : (
            <p className="battlemap-workspace__hint">
              Grid tools appear when the Grid Map Layer is active.
            </p>
          )}
          <p className="battlemap-workspace__hint">
            Hold space + drag to pan. Scroll to zoom. Drop tiles to snap to the grid.
          </p>
        </div>
      </div>
    </div>
  );
}

export default HexBattleMapWorkspace;
