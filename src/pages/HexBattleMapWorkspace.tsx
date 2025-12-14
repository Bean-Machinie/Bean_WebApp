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
import type { TileDefinition } from '../data/tiles/types';
import { TILE_SETS } from '../data/tiles/tileSets';
import { createHexGeometry } from '../hex/hexGeometry';
import type { Cube } from '../hex/hexTypes';
import { generateClientId } from '../lib/utils';
import './HexBattleMapWorkspace.css';

const TILE_PREVIEW_COLUMNS = 3;

type DragPayload =
  | { type: 'palette'; tile: TileDefinition }
  | { type: 'widget'; widget: HexWidget };

const packTilesForPreview = (tiles: TileDefinition[], columns: number) => {
  const placements: Array<{ tile: TileDefinition; col: number; row: number }> = [];
  let col = 0;
  let row = 0;

  tiles.forEach((tile, index) => {
    placements.push({ tile, col, row });
    col += 1;
    if (col >= columns) {
      col = 0;
      row += 1;
    }
    // keep a deterministic but compact layout
    if (index === tiles.length - 1 && col !== 0) {
      row += 1;
      col = 0;
    }
  });

  return placements;
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
  const gridRadius =
    hexConfig.hexSettings?.hexRadius ||
    Math.max(
      1,
      Math.round(
        Math.max(
          hexConfig.gridColumns || DEFAULT_HEX_BATTLE_MAP_CONFIG.gridColumns,
          hexConfig.gridRows || DEFAULT_HEX_BATTLE_MAP_CONFIG.gridRows,
          DEFAULT_BATTLE_MAP_CONFIG.gridColumns,
        ) / 2,
      ),
    );

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
    () => Object.fromEntries(TILE_SETS.map((set) => [set.title, false])),
  );
  const [hoverVisible, setHoverVisible] = useState(false);

  const tileMap = useMemo(() => {
    const map = new Map<string, TileDefinition>();
    TILE_SETS.forEach((set) => {
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
  const allowedCells = useMemo(() => {
    const cells: Cube[] = [];
    for (let q = -gridRadius + 1; q <= gridRadius - 1; q += 1) {
      for (let r = -gridRadius + 1; r <= gridRadius - 1; r += 1) {
        const s = -q - r;
        if (Math.max(Math.abs(q), Math.abs(r), Math.abs(s)) < gridRadius) {
          cells.push({ q, r, s });
        }
      }
    }
    return cells;
  }, [gridRadius]);

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
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const hasCenteredRef = useRef(false);
  const lastBoundsRef = useRef(gridBounds);

  const persistHexWidgets = useCallback(
    async (widgets: HexWidget[]) => {
      const nextConfig: BattleMapConfig = {
        gridType: 'hex',
        gridColumns: gridRadius * 2 - 1,
        gridRows: gridRadius * 2 - 1,
        cellSize: hexConfig.cellSize || hexSettings.hexSize,
        widgets: [],
        hexSettings: { ...hexSettings, hexRadius: gridRadius },
        hexWidgets: widgets,
        version: hexConfig.version,
        updated_at: hexConfig.updated_at,
      };

      await saveConfig(nextConfig);
    },
    [gridRadius, hexConfig.cellSize, hexConfig.updated_at, hexConfig.version, hexSettings, saveConfig],
  );

  useEffect(() => {
    if (config.gridType === 'hex') {
      setHexWidgets(config.hexWidgets ?? []);
    }
  }, [config]);

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
    },
    [hexWidgets, persistHexWidgets],
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
    if (!dragPayload) return undefined;

    const handleMove = (event: MouseEvent) => {
      setDragPosition({ x: event.clientX, y: event.clientY });
      const point = toWorldPoint(event.clientX, event.clientY);
      if (!point) {
        setHoverHex(null);
        setHoverVisible(false);
        return;
      }
      setHoverHex(geometry.pixelToHex(point));
      setHoverVisible(true);
    };

    const handleUp = (event: MouseEvent) => {
      setDragPosition({ x: event.clientX, y: event.clientY });
      const point = toWorldPoint(event.clientX, event.clientY);
      const targetHex = point ? geometry.pixelToHex(point) : hoverHex;
      const isWithinBounds = targetHex
        ? Math.max(Math.abs(targetHex.q), Math.abs(targetHex.r), Math.abs(targetHex.s)) < gridRadius
        : false;

      if (targetHex && isWithinBounds) {
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
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [dragPayload, draggingOrigin, geometry, gridRadius, hexWidgets, hoverHex, persistHexWidgets, toWorldPoint]);

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

  const handleWheelZoom = useCallback(
    (event: ReactWheelEvent<HTMLDivElement>) => {
      event.preventDefault();
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

  const handleTilePointerDown = useCallback((tile: TileDefinition, event: ReactMouseEvent<HTMLElement>) => {
    event.preventDefault();
    setDragPayload({ type: 'palette', tile });
    setStatusMessage(null);
  }, []);

  const handleWidgetPointerDown = useCallback(
    (widget: HexWidget, event: ReactMouseEvent<SVGGElement>) => {
      event.preventDefault();
      setSelectedWidgetId(widget.id);
      setDragPayload({ type: 'widget', widget });
      setDraggingOrigin({ q: widget.q, r: widget.r, s: widget.s });
      setDragPosition({ x: event.clientX, y: event.clientY });
      setStatusMessage(null);
    },
    [],
  );

  const dragPreviewImage = useMemo(() => {
    if (!dragPayload) return null;
    if (dragPayload.type === 'palette') return dragPayload.tile.image;
    return tileMap.get(dragPayload.widget.tileId)?.image ?? dragPayload.widget.appearance?.backgroundImageUrl ?? null;
  }, [dragPayload, tileMap]);

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
    <div className="battlemap-workspace hex-workspace">
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
          <div className="battlemap-workspace__tiles-header">
            <h3 className="battlemap-workspace__control-title">Tiles</h3>
          </div>
          <div className="battlemap-workspace__tiles-scroll">
            {TILE_SETS.map((set) => (
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
                  style={{ '--tile-preview-columns': TILE_PREVIEW_COLUMNS } as CSSProperties}
                >
                  {packTilesForPreview(set.tiles, TILE_PREVIEW_COLUMNS).map(({ tile, col, row }) => (
                    <div
                      key={`${tile.id}-${row}-${col}`}
                      className="battlemap-workspace__widget-template-wrapper"
                      style={{
                        gridColumnStart: col + 1,
                        gridColumnEnd: `span 1`,
                        gridRowStart: row + 1,
                        gridRowEnd: `span 1`,
                      }}
                    >
                      <div
                        className="battlemap-workspace__widget-template battlemap-workspace__widget-template--hex"
                        onMouseDown={(event) => handleTilePointerDown(tile, event)}
                        aria-label={`${tile.label} tile`}
                        style={
                          {
                            '--tile-preview-scale': 0.45,
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
          className={`battlemap-workspace__viewport hex-workspace__viewport${isSpaceHeld ? ' is-space-held' : ''}${isPanning ? ' is-panning' : ''}`}
          onMouseDown={handlePanStart}
          onMouseMove={handlePanMove}
          onMouseUp={stopPan}
          onMouseLeave={stopPan}
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

          {dragPayload && dragPosition && dragPreviewImage ? (
            <div
              className="hex-workspace__drag-preview"
              style={{
                left: `${dragPosition.x}px`,
                top: `${dragPosition.y}px`,
                backgroundImage: `url("${dragPreviewImage}")`,
                width: `${geometry.hexWidth * scale}px`,
                height: `${geometry.hexHeight * scale}px`,
              }}
            />
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
          <p className="battlemap-workspace__hint">
            Hold space + drag to pan. Scroll to zoom. Drop tiles to snap to the nearest open hex. Occupied hexes are rejected (no swaps).
          </p>
        </div>
      </div>
    </div>
  );
}

export default HexBattleMapWorkspace;
