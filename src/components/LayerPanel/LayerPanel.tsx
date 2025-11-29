import React from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import type { Layer } from '@/types/canvas';
import './LayerPanel.css';

type LayerPanelProps = {
  layers: Layer[];
  activeLayerId: string;
  onLayersChange: (layers: Layer[]) => void;
  onActiveLayerChange: (layerId: string) => void;
};

type SortableLayerItemProps = {
  layer: Layer;
  isActive: boolean;
  isBackground: boolean;
  onSelect: () => void;
  onToggleVisibility: () => void;
  onRename: (newName: string) => void;
  onDelete: () => void;
};

function SortableLayerItem({
  layer,
  isActive,
  isBackground,
  onSelect,
  onToggleVisibility,
  onRename,
  onDelete,
}: SortableLayerItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: layer.id });

  const [isRenaming, setIsRenaming] = React.useState(false);
  const [editName, setEditName] = React.useState(layer.name);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleRenameSubmit = () => {
    if (editName.trim() !== '') {
      onRename(editName.trim());
    } else {
      setEditName(layer.name);
    }
    setIsRenaming(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRenameSubmit();
    } else if (e.key === 'Escape') {
      setEditName(layer.name);
      setIsRenaming(false);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`layer-item ${isActive ? 'layer-item--active' : ''} ${isBackground ? 'layer-item--background' : ''}`}
      onClick={onSelect}
    >
      {!isBackground && (
        <div className="layer-item__drag-handle" {...attributes} {...listeners}>
          ⋮⋮
        </div>
      )}

      <button
        className="layer-item__visibility"
        onClick={(e) => {
          e.stopPropagation();
          onToggleVisibility();
        }}
        title={layer.visible ? 'Hide layer' : 'Show layer'}
      >
        {layer.visible ? '👁' : '👁‍🗨'}
      </button>

      {isRenaming && !isBackground ? (
        <input
          className="layer-item__name-input"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onBlur={handleRenameSubmit}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
          autoFocus
        />
      ) : (
        <div
          className="layer-item__name"
          onDoubleClick={(e) => {
            if (!isBackground) {
              e.stopPropagation();
              setIsRenaming(true);
            }
          }}
          style={isBackground ? { cursor: 'default' } : undefined}
        >
          {layer.name}
        </div>
      )}

      <span className="layer-item__count">{layer.strokes.length}</span>

      {!isBackground && (
        <button
          className="layer-item__delete"
          onClick={(e) => {
            e.stopPropagation();
            if (
              layer.strokes.length === 0 ||
              window.confirm(
                `Delete "${layer.name}"? This will remove ${layer.strokes.length} strokes.`
              )
            ) {
              onDelete();
            }
          }}
          title="Delete layer"
        >
          🗑
        </button>
      )}
    </div>
  );
}

export default function LayerPanel({
  layers,
  activeLayerId,
  onLayersChange,
  onActiveLayerChange,
}: LayerPanelProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: 250, // Prevent accidental drags
        tolerance: 5, // 5px movement threshold
      },
    })
  );

  // Sort layers by order (descending for UI - top layer first)
  const sortedLayers = [...layers].sort((a, b) => b.order - a.order);
  const layerIds = sortedLayers.map((l) => l.id);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sortedLayers.findIndex((l) => l.id === active.id);
    const newIndex = sortedLayers.findIndex((l) => l.id === over.id);

    // Reorder array
    const reordered = arrayMove(sortedLayers, oldIndex, newIndex);

    // Update order fields (reverse because we're displaying in reverse order)
    const updated = reordered.map((layer, index) => ({
      ...layer,
      order: reordered.length - 1 - index,
    }));

    onLayersChange(updated);
  };

  const handleNewLayer = () => {
    const maxOrder = Math.max(...layers.map((l) => l.order), -1);
    const newLayer: Layer = {
      id: crypto.randomUUID(),
      name: `Layer ${layers.length + 1}`,
      visible: true,
      order: maxOrder + 1,
      strokes: [],
    };

    onLayersChange([...layers, newLayer]);
    onActiveLayerChange(newLayer.id);
  };

  const handleToggleVisibility = (layerId: string) => {
    onLayersChange(
      layers.map((layer) =>
        layer.id === layerId ? { ...layer, visible: !layer.visible } : layer
      )
    );
  };

  const handleRename = (layerId: string, newName: string) => {
    onLayersChange(
      layers.map((layer) =>
        layer.id === layerId ? { ...layer, name: newName } : layer
      )
    );
  };

  const handleDelete = (layerId: string) => {
    // Don't allow deleting the last layer
    if (layers.length <= 1) {
      alert('Cannot delete the last layer');
      return;
    }

    const remainingLayers = layers.filter((l) => l.id !== layerId);
    onLayersChange(remainingLayers);

    // If we deleted the active layer, switch to first remaining layer
    if (layerId === activeLayerId && remainingLayers.length > 0) {
      onActiveLayerChange(remainingLayers[0].id);
    }
  };

  return (
    <div className="layer-panel">
      <div className="layer-panel__header">
        <h3>Layers</h3>
        <button className="layer-panel__new-button" onClick={handleNewLayer}>
          + New
        </button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        modifiers={[restrictToVerticalAxis]}
      >
        <SortableContext items={layerIds} strategy={verticalListSortingStrategy}>
          <div className="layer-panel__list">
            {sortedLayers.map((layer) => (
              <SortableLayerItem
                key={layer.id}
                layer={layer}
                isActive={layer.id === activeLayerId}
                isBackground={layer.name === 'Background' && layer.order === 0}
                onSelect={() => onActiveLayerChange(layer.id)}
                onToggleVisibility={() => handleToggleVisibility(layer.id)}
                onRename={(newName) => handleRename(layer.id, newName)}
                onDelete={() => handleDelete(layer.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="layer-panel__help">
        <p>• Click to select layer</p>
        <p>• Double-click name to rename</p>
        <p>• Drag to reorder</p>
      </div>
    </div>
  );
}
