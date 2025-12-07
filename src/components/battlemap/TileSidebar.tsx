import { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import type { Tile } from '../../types/battlemap';
import './battlemap.css';

type TileSidebarProps = {
  tiles: Tile[];
  isLoading: boolean;
  onTileAdded: () => void;
};

type DraggableTileProps = {
  tile: Tile;
};

function DraggableTile({ tile }: DraggableTileProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `tile-${tile.id}`,
    data: { tile },
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.5 : 1,
        cursor: 'grab',
      }
    : { cursor: 'grab' };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="tile-sidebar__item"
      title={tile.name}
    >
      <img
        src={tile.image_url}
        alt={tile.name}
        className="tile-sidebar__image"
        draggable={false}
      />
      <span className="tile-sidebar__name">{tile.name}</span>
    </div>
  );
}

export default function TileSidebar({ tiles, isLoading, onTileAdded }: TileSidebarProps) {
  const { user } = useAuth();
  const [isAddingTiles, setIsAddingTiles] = useState(false);

  const handleAddDefaultTiles = async () => {
    if (!user) return;

    setIsAddingTiles(true);

    const defaultTiles = [
      { name: 'Stone Floor', image_url: '/tiles/stone-floor.svg', type: 'custom' },
      { name: 'Grass Tile', image_url: 'https://via.placeholder.com/50/228B22/FFFFFF?text=Grass', type: 'custom' },
      { name: 'Water Tile', image_url: 'https://via.placeholder.com/50/4169E1/FFFFFF?text=Water', type: 'custom' },
      { name: 'Wood Floor', image_url: 'https://via.placeholder.com/50/8B4513/FFFFFF?text=Wood', type: 'custom' },
      { name: 'Lava Tile', image_url: 'https://via.placeholder.com/50/FF4500/FFFFFF?text=Lava', type: 'custom' },
    ];

    try {
      const tilesToInsert = defaultTiles.map(tile => ({
        owner: user.id,
        name: tile.name,
        image_url: tile.image_url,
        type: tile.type,
      }));

      const { error } = await supabase
        .from('tiles')
        .insert(tilesToInsert);

      if (error) {
        console.error('Failed to add tiles:', error);
        alert('Failed to add tiles: ' + error.message);
      } else {
        onTileAdded();
      }
    } catch (err) {
      console.error('Error adding tiles:', err);
      alert('An error occurred while adding tiles');
    } finally {
      setIsAddingTiles(false);
    }
  };

  if (isLoading) {
    return (
      <div className="tile-sidebar">
        <div className="tile-sidebar__header">
          <h3>Tiles</h3>
        </div>
        <p className="muted" style={{ padding: '1rem' }}>
          Loading tiles...
        </p>
      </div>
    );
  }

  return (
    <div className="tile-sidebar">
      <div className="tile-sidebar__header">
        <h3>Tiles</h3>
        {tiles.length === 0 && (
          <button
            onClick={handleAddDefaultTiles}
            disabled={isAddingTiles}
            className="button button--primary"
            style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
          >
            {isAddingTiles ? 'Adding...' : '+ Add Tiles'}
          </button>
        )}
      </div>
      <div className="tile-sidebar__list">
        {tiles.length === 0 ? (
          <div style={{ padding: '1rem', textAlign: 'center' }}>
            <p className="muted" style={{ marginBottom: '0.5rem' }}>
              No tiles available.
            </p>
            <p className="muted" style={{ fontSize: '0.875rem' }}>
              Click "Add Tiles" above to get started with default tiles.
            </p>
          </div>
        ) : (
          tiles.map((tile) => <DraggableTile key={tile.id} tile={tile} />)
        )}
      </div>
    </div>
  );
}
