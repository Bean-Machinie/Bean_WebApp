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
import { DEFAULT_HEX_BATTLE_MAP_CONFIG } from '../services/battleMapStorage';
import type { BattleMapConfig, HexWidget } from '../types/battlemap';
import type { TileDefinition } from '../data/tiles/types';
import { TILE_SETS } from '../data/tiles/tileSets';
import { createHexGeometry } from '../hex/hexGeometry';
import { buildHexGrid, isOccupied } from '../hex/hexEngine';
import type { Cube } from '../hex/hexTypes';
import { generateClientId } from '../lib/utils';
import './HexBattleMapWorkspace.css';

const TILE_PREVIEW_COLUMNS = 3;

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

  const [hexWidgets, setHexWidgets] = useState<HexWidget[]>(hexConfig.hexWidgets ?? []);
  const [hoverHex, setHoverHex] = useState<Cube | null>(null);
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
  const [draggingTile, setDraggingTile] = useState<TileDefinition | null>(null);
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isSpaceHeld, setIsSpaceHeld] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });

  const viewportRef = useRef<HTMLDivElement>(null);
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const hasCenteredRef = useRef(false);

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
  const hexGrid = useMemo(() => buildHexGrid(hexWidgets), [hexWidgets]);

  const persistHexWidgets = useCallback(
    async (widgets: HexWidget[]) => {
      const nextConfig: BattleMapConfig = {
        gridType: 'hex',
        gridColumns: hexConfig.gridColumns,
        gridRows: hexConfig.gridRows,
        cellSize: hexConfig.cellSize,
        widgets: [],
        hexSettings,
        hexWidgets: widgets,
        version: hexConfig.version,
        updated_at: hexConfig.updated_at,
      };

      await saveConfig(nextConfig);
    },
    [hexConfig.cellSize, hexConfig.gridColumns, hexConfig.gridRows, hexConfig.updated_at, hexConfig.version, hexSettings, saveConfig],
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
        setViewportSize({ width: rect.width, height: rect.height });
        if (!hasCenteredRef.current) {
          setPan({ x: rect.width / 2, y: rect.height / 2 });
          hasCenteredRef.current = true;
        }
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
    if (!draggingTile) return undefined;

    const handleMove = (event: MouseEvent) => {
      setDragPosition({ x: event.clientX, y: event.clientY });
      const point = toWorldPoint(event.clientX, event.clientY);
      if (!point) {
        setHoverHex(null);
        return;
      }
      setHoverHex(geometry.pixelToHex(point));
    };

    const handleUp = (event: MouseEvent) => {
      setDragPosition({ x: event.clientX, y: event.clientY });
      const point = toWorldPoint(event.clientX, event.clientY);
      const targetHex = point ? geometry.pixelToHex(point) : hoverHex;

      if (targetHex) {
        if (isOccupied(hexGrid, targetHex)) {
          setStatusMessage('That hex is already occupied.');
        } else {
          const newWidget: HexWidget = {
            id: generateClientId(),
            gridType: 'hex',
            q: targetHex.q,
            r: targetHex.r,
            s: targetHex.s,
            tileId: draggingTile.id,
            appearance: {
              backgroundImageUrl: draggingTile.image,
            },
          };
          const nextWidgets = [...hexWidgets, newWidget];
          setHexWidgets(nextWidgets);
          persistHexWidgets(nextWidgets);
          setStatusMessage('Placed tile on hex grid.');
        }
      }

      setDraggingTile(null);
      setHoverHex(null);
      setDragPosition(null);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [draggingTile, geometry, hexGrid, hexWidgets, hoverHex, persistHexWidgets, toWorldPoint]);

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

  const handleTilePointerDown = useCallback((tile: TileDefinition, event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setDraggingTile(tile);
    setStatusMessage(null);
  }, []);

  const visibleHexes = useMemo(() => {
    const effectiveSize = Math.max(hexSettings.hexSize, 1);
    const radius = Math.max(
      4,
      Math.ceil(Math.max(viewportSize.width, viewportSize.height) / (effectiveSize * Math.max(scale, 0.0001))),
    );
    const cells: Cube[] = [];
    for (let q = -radius; q <= radius; q += 1) {
      for (let r = -radius; r <= radius; r += 1) {
        const s = -q - r;
        if (Math.max(Math.abs(q), Math.abs(r), Math.abs(s)) <= radius) {
          cells.push({ q, r, s });
        }
      }
    }
    return cells;
  }, [hexSettings.hexSize, scale, viewportSize.height, viewportSize.width]);

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
    <div className="hex-workspace">
      <div className="hex-workspace__sidebar">
        <div className="hex-workspace__sidebar-header">
          <button
            className="button button--ghost battlemap-workspace__back-button"
            onClick={() => navigate('/app')}
          >
            Back to Projects
          </button>
          <h2 className="battlemap-workspace__project-name">{project.name}</h2>
        </div>

        <div className="hex-workspace__tiles-panel">
          <div className="battlemap-workspace__tiles-header">
            <h3 className="battlemap-workspace__control-title">Tiles</h3>
          </div>
          <div className="hex-workspace__tiles-scroll">
            {TILE_SETS.map((set) => (
              <div key={set.title} className="hex-workspace__tile-group">
                <p className="hex-workspace__tile-group-title">{set.title}</p>
                <div
                  className="hex-workspace__tile-grid"
                  style={{ '--hex-tile-columns': TILE_PREVIEW_COLUMNS } as CSSProperties}
                >
                  {packTilesForPreview(set.tiles, TILE_PREVIEW_COLUMNS).map(({ tile, col, row }) => (
                    <button
                      key={`${tile.id}-${row}-${col}`}
                      type="button"
                      className="hex-workspace__tile-button"
                      onMouseDown={(event) => handleTilePointerDown(tile, event)}
                      onClick={(event) => handleTilePointerDown(tile, event)}
                      aria-label={`Drag ${tile.label}`}
                    >
                      <div
                        className="hex-workspace__tile-thumb"
                        style={{ backgroundImage: `url("${tile.image}")` }}
                      />
                      <span className="hex-workspace__tile-label">{tile.label}</span>
                    </button>
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

      <div className="hex-workspace__main">
        <div
          ref={viewportRef}
          className={`hex-workspace__viewport${isSpaceHeld ? ' is-space-held' : ''}${isPanning ? ' is-panning' : ''}`}
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
              {visibleHexes.map((hex) => {
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

              {hoverHex ? (
                <polygon
                  className="hex-workspace__hover"
                  points={geometry.hexToCorners({ q: hoverHex.q, r: hoverHex.r })
                    .map((corner) => `${corner.x},${corner.y}`)
                    .join(' ')}
                />
              ) : null}

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
                    className={`hex-workspace__tile${selectedWidgetId === widget.id ? ' is-selected' : ''}`}
                    onClick={() => setSelectedWidgetId(widget.id)}
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

          {draggingTile && dragPosition ? (
            <div
              className="hex-workspace__drag-preview"
              style={{
                left: `${dragPosition.x}px`,
                top: `${dragPosition.y}px`,
                backgroundImage: `url("${draggingTile.image}")`,
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
              const rect = viewportRef.current?.getBoundingClientRect();
              if (rect) {
                setPan({ x: rect.width / 2, y: rect.height / 2 });
                setScale(1);
              }
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
