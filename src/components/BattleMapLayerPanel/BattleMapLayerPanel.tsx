import React from 'react';
import './BattleMapLayerPanel.css';
import '../LayerPanel/LayerPanel.css';

export type BattleMapLayer = {
  id: string;
  name: string;
  kind: 'grid' | 'layer';
  visible: boolean;
};

type BattleMapLayerPanelProps = {
  layers: BattleMapLayer[];
  activeLayerId: string;
  onActiveLayerChange: (layerId: string) => void;
  onToggleVisibility: (layerId: string) => void;
  onAddLayer: () => void;
  onRenameLayer: (layerId: string, nextName: string) => void;
};

function BattleMapLayerPanel({
  layers,
  activeLayerId,
  onActiveLayerChange,
  onToggleVisibility,
  onAddLayer,
  onRenameLayer,
}: BattleMapLayerPanelProps) {
  return (
    <div className="layer-panel battlemap-layer-panel">
      <div className="layer-panel__header">
        <h3>Layers</h3>
        <button type="button" className="layer-panel__new-button" onClick={onAddLayer}>
          + New
        </button>
      </div>
      <div className="layer-panel__list">
        {layers.map((layer) => (
          <LayerRow
            key={layer.id}
            layer={layer}
            isActive={layer.id === activeLayerId}
            onSelect={() => onActiveLayerChange(layer.id)}
            onToggleVisibility={() => onToggleVisibility(layer.id)}
            onRename={(nextName) => onRenameLayer(layer.id, nextName)}
          />
        ))}
      </div>
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
};

function LayerRow({
  layer,
  isActive,
  onSelect,
  onToggleVisibility,
  onRename,
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
    <div
      className={`layer-item${isActive ? ' layer-item--active' : ''}${layer.kind === 'grid' ? ' battlemap-layer-panel__item--grid' : ''}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
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
  );
}
