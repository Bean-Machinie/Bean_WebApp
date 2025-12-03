import React, { useRef, useState, useEffect } from 'react';
import { hsvaToHex, hexToHsva } from '@uiw/color-convert';
import type { HsvaColor } from '@uiw/color-convert';
import './PenToolConfig.css';

const WHEEL_SIZE = 176;
const WHEEL_THICKNESS = 18;
const OUTER_RADIUS = WHEEL_SIZE / 2;
const INNER_RADIUS = OUTER_RADIUS - WHEEL_THICKNESS;
const HUE_THUMB_RADIUS = INNER_RADIUS + WHEEL_THICKNESS / 2;

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
  const [lastHue, setLastHue] = useState<number>(() => {
    const hsva = hexToHsva(brushColor);
    return Number.isFinite(hsva.h) ? hsva.h : 0;
  });
  const wheelRef = useRef<HTMLDivElement>(null);
  const lastCommittedColorRef = useRef<string>(brushColor);

  // Sync hue when brushColor changes externally with a valid hue
  useEffect(() => {
    // Only update if the color changed from an external source (not from our own commitColor)
    if (brushColor !== lastCommittedColorRef.current) {
      const hsva = hexToHsva(brushColor);
      // Only update hue if the new color has a finite, valid hue (saturation > 0)
      // This preserves the hue when external grey/white/black colors are set
      if (Number.isFinite(hsva.h) && hsva.s > 0) {
        setLastHue(hsva.h);
      }
    }
  }, [brushColor]);

  const hsvaRaw: HsvaColor = hexToHsva(brushColor);
  const effectiveHue = Number.isFinite(lastHue) ? lastHue : 0;
  const hsva: HsvaColor = {
    ...hsvaRaw,
    h: effectiveHue,
  };

  const hueColor = `hsl(${hsva.h}, 100%, 50%)`;

  const commitColor = (hue: number) => {
    if (Number.isFinite(hue)) {
      setLastHue(hue);
    }

    // Use the hue with full saturation and mid-brightness for vibrant colors
    const safeHsva: HsvaColor = {
      h: hue,
      s: 100,
      v: 50,
      a: 100
    };
    const newColor = hsvaToHex(safeHsva);
    lastCommittedColorRef.current = newColor;
    onBrushColorChange(newColor);
  };

  const handleHuePointer = (clientX: number, clientY: number) => {
    if (!wheelRef.current) return;
    const rect = wheelRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    const normalizedHue = (angle + 450) % 360; // aligns 0deg to top of the wheel
    commitColor(normalizedHue);
  };

  const startPointerTracking = (
    event: React.PointerEvent,
    onMove: (clientX: number, clientY: number) => void,
  ) => {
    event.preventDefault();
    const move = (e: PointerEvent) => onMove(e.clientX, e.clientY);
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    onMove(event.clientX, event.clientY);
  };

  const handleWheelPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!wheelRef.current) return;
    const rect = wheelRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const r = Math.sqrt(dx * dx + dy * dy);
    const isOnRing = r >= INNER_RADIUS && r <= OUTER_RADIUS;
    if (!isOnRing) return;
    startPointerTracking(e, handleHuePointer);
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
          <div
            className="pen-tool-config__wheel"
            style={{
              width: `${WHEEL_SIZE}px`,
              height: `${WHEEL_SIZE}px`,
              ['--wheel-thickness' as string]: `${WHEEL_THICKNESS}px`,
              ['--wheel-inner' as string]: `${INNER_RADIUS * 2}px`,
            }}
            ref={wheelRef}
            onPointerDown={handleWheelPointerDown}
          >
            <div className="pen-tool-config__wheel-track" />
            <div className="pen-tool-config__wheel-ring" />
            <div
              className="pen-tool-config__wheel-hole"
              style={{
                width: `${INNER_RADIUS * 2}px`,
                height: `${INNER_RADIUS * 2}px`,
              }}
            />
            <div
              className="pen-tool-config__hue-thumb"
              style={{
                transform: `translate(-50%, -50%) rotate(${hsva.h - 90}deg) translate(${HUE_THUMB_RADIUS}px) rotate(${-hsva.h + 90}deg)`,
                background: hueColor,
              }}
            />
          </div>

          <div className="pen-tool-config__color-meta">
            <div className="pen-tool-config__color-preview" style={{ background: brushColor }} />
            <div className="pen-tool-config__color-input-wrap">
              <label className="pen-tool-config__swatch-label">HEX</label>
              <input
                type="text"
                value={brushColor.toUpperCase()}
                onChange={(e) => {
                  const value = e.target.value;
                  if (/^#[0-9A-Fa-f]{0,6}$/.test(value)) {
                    // Update lastCommittedColorRef to track this change
                    lastCommittedColorRef.current = value;
                    // Try to update hue if the new color has a valid hue
                    const hsva = hexToHsva(value);
                    if (Number.isFinite(hsva.h) && hsva.s > 0) {
                      setLastHue(hsva.h);
                    }
                    onBrushColorChange(value);
                  }
                }}
                className="pen-tool-config__color-input"
                placeholder="#000000"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PenToolConfig;
