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
import { ContextMenu } from '@base-ui-components/react/context-menu';
import { Copy, Trash2, Edit3, Layers } from 'lucide-react';
import type { Layer } from '@/types/canvas';
import './LayerPanel.css';
import './LayerContextMenu.css';

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
  onDuplicate: () => void;
  onMerge: () => void;
  canMerge: boolean;
};

// Simple thumbnail renderer for layer preview
function LayerThumbnail({ layer }: { layer: Layer }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, 40, 40);

    if (layer.strokes.length === 0) {
      // Empty layer - show subtle background
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, 0, 40, 40);
      return;
    }

    // Calculate bounding box of all strokes
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    layer.strokes.forEach(stroke => {
      for (let i = 0; i < stroke.points.length; i += 2) {
        minX = Math.min(minX, stroke.points[i]);
        maxX = Math.max(maxX, stroke.points[i]);
        minY = Math.min(minY, stroke.points[i + 1]);
        maxY = Math.max(maxY, stroke.points[i + 1]);
      }
    });

    const width = maxX - minX;
    const height = maxY - minY;
    const scale = Math.min(36 / width, 36 / height, 1); // Fit with 2px padding

    // Center the preview
    const offsetX = (40 - width * scale) / 2 - minX * scale;
    const offsetY = (40 - height * scale) / 2 - minY * scale;

    // Draw strokes
    layer.strokes.forEach(stroke => {
      if (stroke.tool === 'eraser') return; // Skip eraser strokes in preview

      ctx.save();
      ctx.translate(offsetX, offsetY);
      ctx.scale(scale, scale);

      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (stroke.tool === 'shape' && stroke.shapeType) {
        // Draw shapes
        ctx.beginPath();

        if (stroke.shapeType === 'rectangle' && stroke.points.length >= 4) {
          const [x1, y1, x2, y2] = stroke.points;
          ctx.rect(x1, y1, x2 - x1, y2 - y1);
        } else if (stroke.shapeType === 'ellipse' && stroke.points.length >= 4) {
          const [x1, y1, x2, y2] = stroke.points;
          const cx = (x1 + x2) / 2;
          const cy = (y1 + y2) / 2;
          const rx = Math.abs(x2 - x1) / 2;
          const ry = Math.abs(y2 - y1) / 2;
          ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
        } else if (stroke.points.length >= 2) {
          // Polyline, line, triangle
          ctx.moveTo(stroke.points[0], stroke.points[1]);
          for (let i = 2; i < stroke.points.length; i += 2) {
            ctx.lineTo(stroke.points[i], stroke.points[i + 1]);
          }
          if (stroke.closed || stroke.shapeType === 'triangle') {
            ctx.closePath();
          }
        }

        if (stroke.fillColor) {
          ctx.fillStyle = stroke.fillColor;
          ctx.fill();
        }
        ctx.stroke();
      } else if (stroke.points.length >= 4) {
        // Draw pen strokes
        ctx.beginPath();
        ctx.moveTo(stroke.points[0], stroke.points[1]);
        for (let i = 2; i < stroke.points.length; i += 2) {
          ctx.lineTo(stroke.points[i], stroke.points[i + 1]);
        }
        ctx.stroke();
      }

      ctx.restore();
    });
  }, [layer.strokes]);

  return (
    <canvas
      ref={canvasRef}
      width={40}
      height={40}
      className="layer-item__thumbnail"
    />
  );
}

function SortableLayerItem({
  layer,
  isActive,
  isBackground,
  onSelect,
  onToggleVisibility,
  onRename,
  onDelete,
  onDuplicate,
  onMerge,
  canMerge,
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
    opacity: isDragging ? 0.4 : 1,
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
    <ContextMenu.Root>
      <ContextMenu.Trigger className="layer-context-menu__trigger">
        <div
          ref={setNodeRef}
          style={style}
          className={`layer-item ${isActive ? 'layer-item--active' : ''} ${isBackground ? 'layer-item--background' : ''} ${isDragging ? 'layer-item--dragging' : ''}`}
          onClick={onSelect}
          {...(isBackground ? {} : { ...attributes, ...listeners })}
        >
          {/* Eye Toggle */}
          <div className="layer-item__section layer-item__section--visibility">
            <button
              className="layer-item__visibility"
              onClick={(e) => {
                e.stopPropagation();
                onToggleVisibility();
              }}
              title={layer.visible ? 'Hide layer' : 'Show layer'}
            >
              {layer.visible && <span className="layer-item__eye-icon">👁</span>}
            </button>
          </div>

          <div className="layer-item__divider" />

          {/* Thumbnail */}
          <div className="layer-item__section layer-item__section--thumbnail">
            <LayerThumbnail layer={layer} />
          </div>

          <div className="layer-item__divider" />

          {/* Layer Name */}
          <div className="layer-item__section layer-item__section--name">
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
          </div>
        </div>
      </ContextMenu.Trigger>

      <ContextMenu.Portal>
        <ContextMenu.Positioner className="layer-context-menu__positioner">
          <ContextMenu.Popup className="layer-context-menu__popup">
            {/* Duplicate Layer */}
            <ContextMenu.Item
              className="layer-context-menu__item"
              onClick={onDuplicate}
            >
              <Copy className="layer-context-menu__item-icon" size={16} />
              Duplicate Layer
            </ContextMenu.Item>

            {/* Rename Layer */}
            {!isBackground && (
              <ContextMenu.Item
                className="layer-context-menu__item"
                onClick={() => setIsRenaming(true)}
              >
                <Edit3 className="layer-context-menu__item-icon" size={16} />
                Rename Layer
              </ContextMenu.Item>
            )}

            {/* Merge Selected Layers */}
            <ContextMenu.Item
              className="layer-context-menu__item"
              onClick={onMerge}
              disabled={!canMerge}
            >
              <Layers className="layer-context-menu__item-icon" size={16} />
              Merge Selected Layers
            </ContextMenu.Item>

            <ContextMenu.Separator className="layer-context-menu__separator" />

            {/* Delete Layer */}
            {!isBackground && (
              <ContextMenu.Item
                className="layer-context-menu__item layer-context-menu__item--danger"
                onClick={onDelete}
              >
                <Trash2 className="layer-context-menu__item-icon" size={16} />
                Delete Layer
              </ContextMenu.Item>
            )}
          </ContextMenu.Popup>
        </ContextMenu.Positioner>
      </ContextMenu.Portal>
    </ContextMenu.Root>
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

    const layer = layers.find(l => l.id === layerId);
    if (!layer) return;

    // Confirm if layer has content
    if (layer.strokes.length > 0) {
      if (!window.confirm(
        `Delete "${layer.name}"? This will remove ${layer.strokes.length} strokes.`
      )) {
        return;
      }
    }

    const remainingLayers = layers.filter((l) => l.id !== layerId);
    onLayersChange(remainingLayers);

    // If we deleted the active layer, switch to first remaining layer
    if (layerId === activeLayerId && remainingLayers.length > 0) {
      onActiveLayerChange(remainingLayers[0].id);
    }
  };

  const handleDuplicate = (layerId: string) => {
    const layer = layers.find(l => l.id === layerId);
    if (!layer) return;

    const maxOrder = Math.max(...layers.map((l) => l.order), -1);

    // Create a deep copy of strokes
    const duplicatedStrokes = layer.strokes.map(stroke => ({
      ...stroke,
      clientId: crypto.randomUUID(), // New client ID for each stroke
    }));

    const duplicatedLayer: Layer = {
      id: crypto.randomUUID(),
      name: `${layer.name} Copy`,
      visible: layer.visible,
      order: maxOrder + 1,
      strokes: duplicatedStrokes,
    };

    onLayersChange([...layers, duplicatedLayer]);
    onActiveLayerChange(duplicatedLayer.id);
  };

  const handleMerge = (layerId: string) => {
    // For now, merge is disabled (canMerge is always false)
    // This would require multi-selection implementation
    alert('Multi-layer selection and merging will be available in a future update.');
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
                onDuplicate={() => handleDuplicate(layer.id)}
                onMerge={() => handleMerge(layer.id)}
                canMerge={false} // TODO: Implement multi-selection
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
