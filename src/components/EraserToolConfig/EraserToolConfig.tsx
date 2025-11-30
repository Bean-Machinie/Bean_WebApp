import React, { useState } from 'react';
import './EraserToolConfig.css';

type EraserToolConfigProps = {
  brushSize: number;
  onBrushSizeChange: (size: number) => void;
};

function EraserToolConfig({ brushSize, onBrushSizeChange }: EraserToolConfigProps) {
  const [opacity, setOpacity] = useState(100);

  return (
    <div className="eraser-tool-config">
      {/* Tool Properties Section */}
      <div className="eraser-tool-config__section">
        <h4 className="eraser-tool-config__section-title">Tool Properties</h4>

        {/* Brush Size Slider */}
        <div className="eraser-tool-config__property">
          <label className="eraser-tool-config__property-label">
            <span>Brush Size</span>
            <span className="eraser-tool-config__property-value">{brushSize}px</span>
          </label>
          <div className="eraser-tool-config__slider-container">
            <input
              type="range"
              min="1"
              max="50"
              value={brushSize}
              onChange={(e) => onBrushSizeChange(Number(e.target.value))}
              className="eraser-tool-config__slider"
            />
            <div
              className="eraser-tool-config__slider-fill"
              style={{ width: `${(brushSize / 50) * 100}%` }}
            />
          </div>
        </div>

        {/* Opacity Slider */}
        <div className="eraser-tool-config__property">
          <label className="eraser-tool-config__property-label">
            <span>Opacity</span>
            <span className="eraser-tool-config__property-value">{opacity}%</span>
          </label>
          <div className="eraser-tool-config__slider-container">
            <input
              type="range"
              min="0"
              max="100"
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
              className="eraser-tool-config__slider"
            />
            <div
              className="eraser-tool-config__slider-fill"
              style={{ width: `${opacity}%` }}
            />
          </div>
        </div>
      </div>

      <div className="eraser-tool-config__divider" />

      {/* Info Section */}
      <div className="eraser-tool-config__section">
        <div className="eraser-tool-config__info">
          <div className="eraser-tool-config__info-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 16V12M12 8H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <p className="eraser-tool-config__info-text">
            Eraser removes strokes from the active layer
          </p>
        </div>
      </div>
    </div>
  );
}

export default EraserToolConfig;
