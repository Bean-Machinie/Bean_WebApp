import React, { useState } from 'react';
import Wheel from '@uiw/react-color-wheel';
import { hsvaToHex, hexToHsva } from '@uiw/color-convert';
import type { HsvaColor } from '@uiw/color-convert';
import './PenToolConfig.css';

type BrushType = 'normal';

type PenToolConfigProps = {
  brushSize: number;
  brushColor: string;
  onBrushSizeChange: (size: number) => void;
  onBrushColorChange: (color: string) => void;
};

function PenToolConfig({
  brushSize,
  brushColor,
  onBrushSizeChange,
  onBrushColorChange,
}: PenToolConfigProps) {
  const [selectedBrushType, setSelectedBrushType] = useState<BrushType>('normal');
  const [opacity, setOpacity] = useState(100);

  // Convert hex color to HSVA for the color wheel
  const hsva: HsvaColor = hexToHsva(brushColor);

  const handleColorChange = (color: { hsva: HsvaColor }) => {
    const hexColor = hsvaToHex(color.hsva);
    onBrushColorChange(hexColor);
  };

  return (
    <div className="pen-tool-config">
      {/* Pen Type Section */}
      <div className="pen-tool-config__section">
        <h4 className="pen-tool-config__section-title">Pen Type</h4>
        <div className="pen-tool-config__brush-types">
          <button
            className={`pen-tool-config__brush-type ${selectedBrushType === 'normal' ? 'pen-tool-config__brush-type--active' : ''}`}
            onClick={() => setSelectedBrushType('normal')}
          >
            <div className="pen-tool-config__brush-preview">
              <div className="pen-tool-config__brush-circle" />
            </div>
            <span className="pen-tool-config__brush-label">Normal</span>
          </button>
          {/* Placeholder for future brush types */}
          <div className="pen-tool-config__brush-type pen-tool-config__brush-type--placeholder">
            <div className="pen-tool-config__brush-preview">
              <div className="pen-tool-config__brush-circle pen-tool-config__brush-circle--disabled" />
            </div>
            <span className="pen-tool-config__brush-label pen-tool-config__brush-label--disabled">More Soon</span>
          </div>
        </div>
      </div>

      <div className="pen-tool-config__divider" />

      {/* Tool Properties Section */}
      <div className="pen-tool-config__section">
        <h4 className="pen-tool-config__section-title">Tool Properties</h4>

        {/* Brush Size Slider */}
        <div className="pen-tool-config__property">
          <label className="pen-tool-config__property-label">
            <span>Brush Size</span>
            <span className="pen-tool-config__property-value">{brushSize}px</span>
          </label>
          <div className="pen-tool-config__slider-container">
            <input
              type="range"
              min="1"
              max="50"
              value={brushSize}
              onChange={(e) => onBrushSizeChange(Number(e.target.value))}
              className="pen-tool-config__slider"
            />
            <div
              className="pen-tool-config__slider-fill"
              style={{ width: `${(brushSize / 50) * 100}%` }}
            />
          </div>
        </div>

        {/* Opacity Slider */}
        <div className="pen-tool-config__property">
          <label className="pen-tool-config__property-label">
            <span>Opacity</span>
            <span className="pen-tool-config__property-value">{opacity}%</span>
          </label>
          <div className="pen-tool-config__slider-container">
            <input
              type="range"
              min="0"
              max="100"
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
              className="pen-tool-config__slider"
            />
            <div
              className="pen-tool-config__slider-fill"
              style={{ width: `${opacity}%` }}
            />
          </div>
        </div>
      </div>

      <div className="pen-tool-config__divider" />

      {/* Color Wheel Section */}
      <div className="pen-tool-config__section">
        <h4 className="pen-tool-config__section-title">Color</h4>
        <div className="pen-tool-config__color-wheel-container">
          <Wheel
            color={hsva}
            onChange={handleColorChange}
            width={160}
            height={160}
          />
          <div className="pen-tool-config__color-preview" style={{ background: brushColor }} />
          <input
            type="text"
            value={brushColor.toUpperCase()}
            onChange={(e) => {
              const value = e.target.value;
              if (/^#[0-9A-Fa-f]{0,6}$/.test(value)) {
                onBrushColorChange(value);
              }
            }}
            className="pen-tool-config__color-input"
            placeholder="#000000"
          />
        </div>
      </div>
    </div>
  );
}

export default PenToolConfig;
