import React from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import { ContextMenu } from '@base-ui-components/react/context-menu';
import { Menu } from '@base-ui-components/react/menu';
import { Edit3, Trash2, Plus } from 'lucide-react';
import './BattleMapLayerPanel.css';
import '../LayerPanel/LayerContextMenu.css';
import '../LayerPanel/LayerPanel.css';

export type BattleMapLayerKind = 'grid' | 'tiles' | 'layer' | 'image' | 'background';

export type BattleMapLayer = {
  id: string;
  name: string;
  kind: BattleMapLayerKind;
  visible: boolean;
};

type BattleMapLayerPanelProps = {
  layers: BattleMapLayer[];
  activeLayerId: string;
  onActiveLayerChange: (layerId: string) => void;
  onToggleVisibility: (layerId: string) => void;
  onAddLayer: (kind: BattleMapLayerKind) => void;
  onRenameLayer: (layerId: string, nextName: string) => void;
  onMoveLayerUp: (layerId: string) => void;
  onMoveLayerDown: (layerId: string) => void;
  onDeleteLayer: (layerId: string) => void;
  onReorderLayers: (nextLayers: BattleMapLayer[]) => void;
};

function BattleMapLayerPanel({
  layers,
  activeLayerId,
  onActiveLayerChange,
  onToggleVisibility,
  onAddLayer,
  onRenameLayer,
  onMoveLayerUp,
  onMoveLayerDown,
  onDeleteLayer,
  onReorderLayers,
}: BattleMapLayerPanelProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    }),
  );
  const layerIds = layers.map((layer) => layer.id);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = layers.findIndex((layer) => layer.id === active.id);
    const newIndex = layers.findIndex((layer) => layer.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(layers, oldIndex, newIndex);
    onReorderLayers(reordered);
  };

  return (
    <div className="layer-panel battlemap-layer-panel">
      <div className="layer-panel__header">
        <h3>Layers</h3>
        <Menu.Root>
          <Menu.Trigger
            type="button"
            className="layer-panel__new-button battlemap-layer-panel__new-button"
            title="Add layer"
          >
            <Plus size={16} aria-hidden />
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner className="layer-context-menu__positioner">
              <Menu.Popup className="layer-context-menu__popup">
                <Menu.Item
                  className="layer-context-menu__item"
                  onClick={() => onAddLayer('tiles')}
                >
                  Tile Layer
                </Menu.Item>
                <Menu.Item
                  className="layer-context-menu__item"
                  onClick={() => onAddLayer('image')}
                >
                  Image
                </Menu.Item>
                <Menu.Item
                  className="layer-context-menu__item"
                  onClick={() => onAddLayer('background')}
                >
                  Background
                </Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        modifiers={[restrictToVerticalAxis]}
      >
        <SortableContext items={layerIds} strategy={verticalListSortingStrategy}>
          <div className="layer-panel__list">
            {layers.map((layer) => (
              <SortableLayerRow
                key={layer.id}
                layer={layer}
                isActive={layer.id === activeLayerId}
                onSelect={() => onActiveLayerChange(layer.id)}
                onToggleVisibility={() => onToggleVisibility(layer.id)}
                onRename={(nextName) => onRenameLayer(layer.id, nextName)}
                onMoveUp={() => onMoveLayerUp(layer.id)}
                onMoveDown={() => onMoveLayerDown(layer.id)}
                onDelete={() => onDeleteLayer(layer.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

export default BattleMapLayerPanel;

type LayerRowProps = {
  layer: BattleMapLayer;
  isActive: boolean;
  onSelect: () => void;
  onToggleVisibility: () => void;
  onRename: (nextName: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  dragAttributes?: Record<string, unknown>;
  dragListeners?: Record<string, unknown>;
  dragRef?: (node: HTMLDivElement | null) => void;
  dragStyle?: React.CSSProperties;
  isDragging?: boolean;
};

function SortableLayerRow({
  layer,
  isActive,
  onSelect,
  onToggleVisibility,
  onRename,
  onMoveUp,
  onMoveDown,
  onDelete,
}: Omit<LayerRowProps, 'dragAttributes' | 'dragListeners' | 'dragRef' | 'dragStyle' | 'isDragging'>) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: layer.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <LayerRow
      layer={layer}
      isActive={isActive}
      onSelect={onSelect}
      onToggleVisibility={onToggleVisibility}
      onRename={onRename}
      onMoveUp={onMoveUp}
      onMoveDown={onMoveDown}
      onDelete={onDelete}
      dragAttributes={attributes}
      dragListeners={listeners}
      dragRef={setNodeRef}
      dragStyle={style}
      isDragging={isDragging}
    />
  );
}

function LayerRow({
  layer,
  isActive,
  onSelect,
  onToggleVisibility,
  onRename,
  onMoveUp,
  onMoveDown,
  onDelete,
  dragAttributes,
  dragListeners,
  dragRef,
  dragStyle,
  isDragging,
}: LayerRowProps) {
  const [isRenaming, setIsRenaming] = React.useState(false);
  const [editName, setEditName] = React.useState(layer.name);

  React.useEffect(() => {
    if (!isRenaming) {
      setEditName(layer.name);
    }
  }, [isRenaming, layer.name]);

  const handleRenameSubmit = () => {
    const trimmed = editName.trim();
    if (trimmed) {
      onRename(trimmed);
    } else {
      setEditName(layer.name);
    }
    setIsRenaming(false);
  };

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger className="layer-context-menu__trigger">
        <div
          ref={dragRef}
          style={dragStyle}
          className={`layer-item${isActive ? ' layer-item--active' : ''}${layer.kind === 'grid' ? ' battlemap-layer-panel__item--grid' : ''}${isDragging ? ' layer-item--dragging' : ''}`}
          onClick={onSelect}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onSelect();
            } else if (event.key === 'Escape' && isRenaming) {
              event.preventDefault();
              setEditName(layer.name);
              setIsRenaming(false);
            }
          }}
          {...dragAttributes}
          {...dragListeners}
        >
          <div className="layer-item__section layer-item__section--visibility">
            <button
              type="button"
              className="layer-item__visibility"
              onClick={(event) => {
                event.stopPropagation();
                onToggleVisibility();
              }}
              aria-label={layer.visible ? 'Hide layer' : 'Show layer'}
            >
              {layer.visible ? (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden
                >
                  <path
                    d="M3 14C3 9.02944 7.02944 5 12 5C16.9706 5 21 9.02944 21 14M17 14C17 16.7614 14.7614 19 12 19C9.23858 19 7 16.7614 7 14C7 11.2386 9.23858 9 12 9C14.7614 9 17 11.2386 17 14Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden
                >
                  <path
                    d="M9.60997 9.60714C8.05503 10.4549 7 12.1043 7 14C7 16.7614 9.23858 19 12 19C13.8966 19 15.5466 17.944 16.3941 16.3878M21 14C21 9.02944 16.9706 5 12 5C11.5582 5 11.1238 5.03184 10.699 5.09334M3 14C3 11.0069 4.46104 8.35513 6.70883 6.71886M3 3L21 21"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
          </div>

          <div className="layer-item__divider" />

          <div className="layer-item__section layer-item__section--thumbnail">
            <div className="layer-item__thumbnail battlemap-layer-panel__thumbnail">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden
              >
                <rect x="3" y="3" width="7" height="7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <rect x="3" y="14" width="7" height="7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <rect x="14" y="3" width="7" height="7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <rect x="14" y="14" width="7" height="7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          <div className="layer-item__divider" />

          <div className="layer-item__section layer-item__section--name">
            {isRenaming ? (
              <input
                className="layer-item__name-input"
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
                onBlur={handleRenameSubmit}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    handleRenameSubmit();
                  } else if (event.key === 'Escape') {
                    event.preventDefault();
                    setEditName(layer.name);
                    setIsRenaming(false);
                  }
                }}
                onClick={(event) => event.stopPropagation()}
                autoFocus
              />
            ) : (
              <div
                className="layer-item__name"
                onDoubleClick={(event) => {
                  event.stopPropagation();
                  setIsRenaming(true);
                }}
              >
                {layer.name}
              </div>
            )}
          </div>
        </div>
      </ContextMenu.Trigger>

      <ContextMenu.Portal>
        <ContextMenu.Positioner className="layer-context-menu__positioner">
          <ContextMenu.Popup className="layer-context-menu__popup">
            <ContextMenu.Item
              className="layer-context-menu__item"
              onClick={() => setIsRenaming(true)}
            >
              <Edit3 className="layer-context-menu__item-icon" size={16} />
              Rename
            </ContextMenu.Item>

            <ContextMenu.Item
              className="layer-context-menu__item"
              onClick={onMoveUp}
            >
              <span className="layer-context-menu__item-icon" aria-hidden>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 -4.5 20 20"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden
                >
                  <path
                    d="M223.707692,6534.63378 L223.707692,6534.63378 C224.097436,6534.22888 224.097436,6533.57338 223.707692,6533.16951 L215.444127,6524.60657 C214.66364,6523.79781 213.397472,6523.79781 212.616986,6524.60657 L204.29246,6533.23165 C203.906714,6533.6324 203.901717,6534.27962 204.282467,6534.68555 C204.671211,6535.10081 205.31179,6535.10495 205.70653,6534.69695 L213.323521,6526.80297 C213.714264,6526.39807 214.346848,6526.39807 214.737591,6526.80297 L222.294621,6534.63378 C222.684365,6535.03868 223.317949,6535.03868 223.707692,6534.63378"
                    transform="translate(-204 -6524)"
                    fill="currentColor"
                  />
                </svg>
              </span>
              Move Up
            </ContextMenu.Item>

            <ContextMenu.Item
              className="layer-context-menu__item"
              onClick={onMoveDown}
            >
              <span className="layer-context-menu__item-icon" aria-hidden>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 -4.5 20 20"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden
                >
                  <path
                    d="M164.292308,6524.36583 L164.292308,6524.36583 C163.902564,6524.77071 163.902564,6525.42619 164.292308,6525.83004 L172.555873,6534.39267 C173.33636,6535.20244 174.602528,6535.20244 175.383014,6534.39267 L183.70754,6525.76791 C184.093286,6525.36716 184.098283,6524.71997 183.717533,6524.31405 C183.328789,6523.89985 182.68821,6523.89467 182.29347,6524.30266 L174.676479,6532.19636 C174.285736,6532.60124 173.653152,6532.60124 173.262409,6532.19636 L165.705379,6524.36583 C165.315635,6523.96094 164.683051,6523.96094 164.292308,6524.36583"
                    transform="translate(-164 -6524)"
                    fill="currentColor"
                  />
                </svg>
              </span>
              Move Down
            </ContextMenu.Item>

            <ContextMenu.Separator className="layer-context-menu__separator" />

            <ContextMenu.Item
              className="layer-context-menu__item layer-context-menu__item--danger"
              onClick={onDelete}
              disabled={layer.kind === 'grid'}
            >
              <Trash2 className="layer-context-menu__item-icon" size={16} />
              Delete
            </ContextMenu.Item>
          </ContextMenu.Popup>
        </ContextMenu.Positioner>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
