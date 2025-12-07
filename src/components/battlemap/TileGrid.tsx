import { useDroppable, useDraggable } from '@dnd-kit/core';
import type { BattleMap, PlacedTile } from '../../types/battlemap';
import './battlemap.css';

const fallbackTileImages: Record<string, string> = {
  'Stone Floor': '/tiles/stone-floor.svg',
  'Grass Tile': '/tiles/grass-tile.svg',
};

type TileGridProps = {
  battleMap: BattleMap;
  placedTiles: PlacedTile[];
  onRemoveTile: (placedTileId: string) => void;
};

type GridCellProps = {
  x: number;
  y: number;
  cellSize: number;
  placedTile?: PlacedTile;
  onRemoveTile: (placedTileId: string) => void;
};

function GridCell({ x, y, cellSize, placedTile, onRemoveTile }: GridCellProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `cell-${x}-${y}`,
    data: { x, y },
  });

  return (
    <div
      ref={setNodeRef}
      className="tile-grid__cell"
      style={{
        width: `${cellSize}px`,
        height: `${cellSize}px`,
        position: 'absolute',
        left: `${x * cellSize}px`,
        top: `${y * cellSize}px`,
        border: '1px solid rgba(255, 255, 255, 0.1)',
        backgroundColor: isOver ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
      }}
    >
      {placedTile && placedTile.tile && (
        <DraggablePlacedTile
          placedTile={placedTile}
          onRemoveTile={onRemoveTile}
        />
      )}
    </div>
  );
}

function DraggablePlacedTile({
  placedTile,
  onRemoveTile,
}: {
  placedTile: PlacedTile;
  onRemoveTile: (placedTileId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `placed-${placedTile.id}`,
    data: { placedTileId: placedTile.id, tile: placedTile.tile },
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.7 : 1,
        cursor: 'grab',
      }
    : { cursor: 'grab' };

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className="tile-grid__placed-tile"
      data-placed-tile-id={placedTile.id}
      data-tile-id={placedTile.tile?.id}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        ...style,
      }}
      onDoubleClick={() => onRemoveTile(placedTile.id)}
      title={`${placedTile.tile?.name ?? 'Tile'} (Drag to move, double-click to remove)`}
    >
      <img
        src={
          fallbackTileImages[placedTile.tile?.name ?? ''] ||
          placedTile.tile?.image_url ||
          ''
        }
        alt={placedTile.tile?.name ?? 'Tile'}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          pointerEvents: 'none',
        }}
        draggable={false}
        onError={(e) => {
          const fallback = fallbackTileImages[placedTile.tile?.name ?? ''];
          if (fallback && e.currentTarget.src !== fallback) {
            e.currentTarget.src = fallback;
          }
        }}
      />
    </div>
  );
}

export default function TileGrid({ battleMap, placedTiles, onRemoveTile }: TileGridProps) {
  const gridWidth = battleMap.width * battleMap.tile_size;
  const gridHeight = battleMap.height * battleMap.tile_size;

  // Create a map of cell coordinates to placed tiles for quick lookup
  const tileMap = new Map<string, PlacedTile>();
  placedTiles.forEach((placedTile) => {
    const key = `${placedTile.x}-${placedTile.y}`;
    tileMap.set(key, placedTile);
  });

  // Generate grid cells
  const cells = [];
  for (let y = 0; y < battleMap.height; y++) {
    for (let x = 0; x < battleMap.width; x++) {
      const key = `${x}-${y}`;
      const placedTile = tileMap.get(key);
      cells.push(
        <GridCell
          key={key}
          x={x}
          y={y}
          cellSize={battleMap.tile_size}
          placedTile={placedTile}
          onRemoveTile={onRemoveTile}
        />
      );
    }
  }

  return (
    <div
      className="tile-grid"
      style={{
        width: `${gridWidth}px`,
        height: `${gridHeight}px`,
        position: 'relative',
        backgroundColor: '#1a1a1a',
        margin: '2rem auto',
      }}
    >
      {cells}
    </div>
  );
}
