import React from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DraggableAttributes,
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

function LayerKindIcon({ kind }: { kind: BattleMapLayerKind }) {
  if (kind === 'tiles') {
    return (
      <svg
        width="24"
        height="24"
        viewBox="0 0 42.704 42.704"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <path
          d="M42.629,14.199c-0.006-0.021-0.019-0.04-0.024-0.061c-0.031-0.096-0.07-0.189-0.121-0.278c0-0.004-0.002-0.007-0.004-0.01
          c-0.019-0.031-0.041-0.057-0.062-0.088c-0.045-0.07-0.09-0.142-0.143-0.206c-0.04-0.046-0.086-0.085-0.129-0.127
          c-0.043-0.042-0.084-0.087-0.133-0.126c-0.062-0.051-0.135-0.092-0.201-0.133c-0.033-0.02-0.062-0.045-0.096-0.063l-14.777-7.73
          c-0.531-0.277-1.16-0.282-1.695-0.016l-3.266,1.635l-9.062-4.479c-0.536-0.267-1.171-0.257-1.7,0.025L0.986,7.999
          C0.373,8.325-0.008,8.967,0,9.662c0.008,0.695,0.402,1.327,1.023,1.641l15.518,7.83L2,26.986c-0.034,0.02-0.061,0.043-0.094,0.062
          c-0.07,0.043-0.141,0.085-0.204,0.14c-0.05,0.041-0.091,0.088-0.136,0.133c-0.041,0.044-0.084,0.08-0.121,0.125
          c-0.056,0.068-0.102,0.145-0.146,0.22c-0.018,0.026-0.039,0.052-0.055,0.081c-0.002,0.003-0.002,0.005-0.004,0.007
          c-0.053,0.102-0.094,0.207-0.129,0.313c-0.02,0.064-0.031,0.133-0.045,0.197c-0.011,0.062-0.027,0.119-0.034,0.182
          c-0.007,0.066-0.001,0.135-0.001,0.199c0.001,0.057-0.004,0.107,0.001,0.164c0.009,0.084,0.029,0.164,0.049,0.248
          c0.009,0.033,0.011,0.069,0.021,0.104c0.036,0.113,0.084,0.229,0.142,0.34c0.001,0.002,0.002,0.004,0.002,0.006
          c0.005,0.009,0.012,0.013,0.015,0.021c0.069,0.125,0.157,0.24,0.255,0.349c0.029,0.032,0.059,0.062,0.09,0.092
          c0.083,0.079,0.175,0.149,0.273,0.215c0.031,0.021,0.061,0.043,0.094,0.062c0.012,0.006,0.021,0.018,0.033,0.021l18.472,9.893
          c0.08,0.043,0.165,0.064,0.247,0.097c0.053,0.02,0.103,0.045,0.157,0.061c0.156,0.041,0.315,0.064,0.472,0.064
          c0.002,0,0.004,0,0.004,0c0.15,0,0.307-0.021,0.459-0.062c0.051-0.012,0.098-0.035,0.146-0.055
          c0.078-0.024,0.158-0.048,0.234-0.085l18.357-9.321c0.916-0.467,1.282-1.586,0.814-2.502c-0.021-0.043-0.052-0.078-0.076-0.119
          c-0.113-0.526-0.449-1.006-0.972-1.27l-9.215-4.648l10.619-5.917c0.004-0.002,0.008-0.004,0.012-0.006l0.019-0.009
          c0.021-0.015,0.043-0.033,0.065-0.048c0.077-0.049,0.152-0.098,0.229-0.158c0.041-0.034,0.073-0.077,0.112-0.116
          c0.049-0.047,0.099-0.091,0.14-0.143c0.049-0.064,0.09-0.131,0.131-0.199c0.02-0.034,0.045-0.062,0.062-0.099
          c0.002-0.003,0.003-0.007,0.004-0.01c0.044-0.081,0.072-0.166,0.104-0.253c0.074-0.219,0.104-0.443,0.098-0.666
          c0-0.049,0.006-0.096,0-0.142C42.689,14.433,42.665,14.315,42.629,14.199z M5.905,9.595l6.222-3.318l5.892,2.912l-6.07,3.456
          L5.905,9.595z M36.043,28.972l-14.662,7.444L6.817,28.617l13.776-7.442L36.043,28.972z M27.1,20.289l-5.674-2.861l-5.489-2.77
          l6.926-3.942l3.191-1.599l10.881,5.691L27.1,20.289z"
          fill="currentColor"
        />
      </svg>
    );
  }

  if (kind === 'background') {
    return (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <path
          d="M14.2639 15.9375L12.5958 14.2834C11.7909 13.4851 11.3884 13.086 10.9266 12.9401C10.5204 12.8118 10.0838 12.8165 9.68048 12.9536C9.22188 13.1095 8.82814 13.5172 8.04068 14.3326L4.04409 18.2801M14.2639 15.9375L14.6053 15.599C15.4112 14.7998 15.8141 14.4002 16.2765 14.2543C16.6831 14.126 17.12 14.1311 17.5236 14.2687C17.9824 14.4251 18.3761 14.8339 19.1634 15.6514L20 16.4934M14.2639 15.9375L18.275 19.9565M18.275 19.9565C17.9176 20 17.4543 20 16.8 20H7.2C6.07989 20 5.51984 20 5.09202 19.782C4.71569 19.5903 4.40973 19.2843 4.21799 18.908C4.12796 18.7313 4.07512 18.5321 4.04409 18.2801M18.275 19.9565C18.5293 19.9256 18.7301 19.8727 18.908 19.782C19.2843 19.5903 19.5903 19.2843 19.782 18.908C20 18.4802 20 17.9201 20 16.8V16.4934M4.04409 18.2801C4 17.9221 4 17.4575 4 16.8V7.2C4 6.0799 4 5.51984 4.21799 5.09202C4.40973 4.71569 4.71569 4.40973 5.09202 4.21799C5.51984 4 6.07989 4 7.2 4H16.8C17.9201 4 18.4802 4 18.908 4.21799C19.2843 4.40973 19.5903 4.71569 19.782 5.09202C20 5.51984 20 6.0799 20 7.2V16.4934M17 8.99989C17 10.1045 16.1046 10.9999 15 10.9999C13.8954 10.9999 13 10.1045 13 8.99989C13 7.89532 13.8954 6.99989 15 6.99989C16.1046 6.99989 17 7.89532 17 8.99989Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
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
  );
}

type LayerRowProps = {
  layer: BattleMapLayer;
  isActive: boolean;
  onSelect: () => void;
  onToggleVisibility: () => void;
  onRename: (nextName: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  dragAttributes?: DraggableAttributes;
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
              <LayerKindIcon kind={layer.kind} />
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
