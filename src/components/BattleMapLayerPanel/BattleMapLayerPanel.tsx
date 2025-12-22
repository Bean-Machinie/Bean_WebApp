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
          <span className="layer-item__eye-icon">{layer.visible ? 'V' : 'H'}</span>
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
