import React, { useRef, useState, useEffect } from 'react';
import { hsvaToHex, hexToHsva } from '@uiw/color-convert';
import type { HsvaColor } from '@uiw/color-convert';
import { SVTriangle } from '../PenToolConfig/SVTriangle';
import type { ShapeType } from '@/types/canvas';
import './ShapeToolConfig.css';

const WHEEL_SIZE = 176;
const WHEEL_THICKNESS = 18;
const OUTER_RADIUS = WHEEL_SIZE / 2;
const INNER_RADIUS = OUTER_RADIUS - WHEEL_THICKNESS;
const HUE_THUMB_RADIUS = INNER_RADIUS + WHEEL_THICKNESS / 2;

type ShapeToolConfigProps = {
  brushSize: number;
  brushColor: string;
  selectedShape: ShapeType;
  fillEnabled: boolean;
  fillColor: string;
  onBrushSizeChange: (size: number) => void;
  onBrushColorChange: (color: string) => void;
  onShapeChange: (shape: ShapeType) => void;
  onFillEnabledChange: (enabled: boolean) => void;
  onFillColorChange: (color: string) => void;
};

function ShapeToolConfig({
  brushSize,
  brushColor,
  selectedShape,
  fillEnabled,
  fillColor,
  onBrushSizeChange,
  onBrushColorChange,
  onShapeChange,
  onFillEnabledChange,
  onFillColorChange,
}: ShapeToolConfigProps) {
  const [editingFill, setEditingFill] = useState(false);
  const [lastHue, setLastHue] = useState<number>(() => {
    const hsva = hexToHsva(editingFill ? fillColor : brushColor);
    return Number.isFinite(hsva.h) ? hsva.h : 0;
  });
  const wheelRef = useRef<HTMLDivElement>(null);
  const lastCommittedColorRef = useRef<string>(editingFill ? fillColor : brushColor);

  const currentColor = editingFill ? fillColor : brushColor;
  const onCurrentColorChange = editingFill ? onFillColorChange : onBrushColorChange;

  // Sync hue when color changes externally
  useEffect(() => {
    if (currentColor !== lastCommittedColorRef.current) {
      const hsva = hexToHsva(currentColor);
      if (Number.isFinite(hsva.h) && hsva.s > 0) {
        setLastHue(hsva.h);
      }
    }
  }, [currentColor]);

  const hsvaRaw: HsvaColor = hexToHsva(currentColor);
  const effectiveHue = Number.isFinite(lastHue) ? lastHue : 0;
  const hsva: HsvaColor = {
    ...hsvaRaw,
    h: effectiveHue,
  };

  const hueColor = `hsl(${hsva.h}, 100%, 50%)`;

  const commitColor = (hue?: number, saturation?: number, value?: number) => {
    const h = hue !== undefined ? hue : effectiveHue;
    const s = saturation !== undefined ? saturation : hsva.s;
    const v = value !== undefined ? value : hsva.v;

    if (hue !== undefined && Number.isFinite(hue)) {
      setLastHue(hue);
    }

    const safeHsva: HsvaColor = {
      h,
      s,
      v,
      a: 100
    };
    const newColor = hsvaToHex(safeHsva);
    lastCommittedColorRef.current = newColor;
    onCurrentColorChange(newColor);
  };

  const handleHuePointer = (clientX: number, clientY: number) => {
    if (!wheelRef.current) return;
    const rect = wheelRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    const normalizedHue = (angle + 450) % 360;
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

  const handleSVChange = (s: number, v: number) => {
    commitColor(undefined, s, v);
  };

  const shapes: { type: ShapeType; label: string; icon: JSX.Element }[] = [
    {
      type: 'line',
      label: 'Line',
      icon: <svg width="20" height="20" viewBox="0 0 20 20"><line x1="2" y1="18" x2="18" y2="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
    },
    {
      type: 'rectangle',
      label: 'Rectangle',
      icon: <svg width="20" height="20" viewBox="0 0 20 20"><rect x="3" y="3" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none"/></svg>
    },
    {
      type: 'ellipse',
      label: 'Ellipse',
      icon: <svg width="20" height="20" viewBox="0 0 20 20"><ellipse cx="10" cy="10" rx="7" ry="7" stroke="currentColor" strokeWidth="2" fill="none"/></svg>
    },
    {
      type: 'triangle',
      label: 'Triangle',
      icon: <svg width="20" height="20" viewBox="0 0 20 20"><path d="M10 3 L17 17 L3 17 Z" stroke="currentColor" strokeWidth="2" fill="none"/></svg>
    },
  ];

  return (
    <div className="shape-tool-config">
      {/* Shape Type Section */}
      <div className="shape-tool-config__section">
        <h4 className="shape-tool-config__section-title">Shape Type</h4>
        <div className="shape-tool-config__shape-grid">
          {shapes.map((shape) => (
            <button
              key={shape.type}
              className={`shape-tool-config__shape-button ${selectedShape === shape.type ? 'shape-tool-config__shape-button--active' : ''}`}
              onClick={() => onShapeChange(shape.type)}
              title={shape.label}
            >
              {shape.icon}
              <span className="shape-tool-config__shape-label">{shape.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="shape-tool-config__divider" />

      {/* Tool Properties Section */}
      <div className="shape-tool-config__section">
        <h4 className="shape-tool-config__section-title">Properties</h4>

        {/* Stroke Width Slider */}
        <div className="shape-tool-config__property">
          <label className="shape-tool-config__property-label">
            <span>Stroke Width</span>
            <span className="shape-tool-config__property-value">{brushSize}px</span>
          </label>
          <div className="shape-tool-config__slider-container">
            <input
              type="range"
              min="1"
              max="50"
              value={brushSize}
              onChange={(e) => onBrushSizeChange(Number(e.target.value))}
              className="shape-tool-config__slider"
            />
            <div
              className="shape-tool-config__slider-fill"
              style={{ width: `${(brushSize / 50) * 100}%` }}
            />
          </div>
        </div>

        {/* Fill Toggle */}
        <div className="shape-tool-config__property">
          <label className="shape-tool-config__property-label">
            <span>Fill</span>
            <input
              type="checkbox"
              checked={fillEnabled}
              onChange={(e) => onFillEnabledChange(e.target.checked)}
              className="shape-tool-config__checkbox"
            />
          </label>
        </div>
      </div>

      <div className="shape-tool-config__divider" />

      {/* Color Section */}
      <div className="shape-tool-config__section">
        <h4 className="shape-tool-config__section-title">Color</h4>

        {/* Color Type Toggle */}
        <div className="shape-tool-config__color-type-toggle">
          <button
            className={`shape-tool-config__color-type-button ${!editingFill ? 'shape-tool-config__color-type-button--active' : ''}`}
            onClick={() => setEditingFill(false)}
          >
            Stroke
          </button>
          {fillEnabled && (
            <button
              className={`shape-tool-config__color-type-button ${editingFill ? 'shape-tool-config__color-type-button--active' : ''}`}
              onClick={() => setEditingFill(true)}
            >
              Fill
            </button>
          )}
        </div>

        {/* Color Wheel */}
        <div className="shape-tool-config__color-wheel-container">
          <div
            className="shape-tool-config__wheel"
            style={{
              width: `${WHEEL_SIZE}px`,
              height: `${WHEEL_SIZE}px`,
              ['--wheel-thickness' as string]: `${WHEEL_THICKNESS}px`,
              ['--wheel-inner' as string]: `${INNER_RADIUS * 2}px`,
            }}
            ref={wheelRef}
            onPointerDown={handleWheelPointerDown}
          >
            <div className="shape-tool-config__wheel-track" />
            <div className="shape-tool-config__wheel-ring" />
            <div
              className="shape-tool-config__wheel-hole"
              style={{
                width: `${INNER_RADIUS * 2}px`,
                height: `${INNER_RADIUS * 2}px`,
              }}
            />
            <div
              className="shape-tool-config__hue-thumb"
              style={{
                transform: `translate(-50%, -50%) rotate(${hsva.h - 90}deg) translate(${HUE_THUMB_RADIUS}px) rotate(${-hsva.h + 90}deg)`,
                background: hueColor,
              }}
            />
            <SVTriangle
              hue={hsva.h}
              saturation={hsva.s}
              value={hsva.v}
              onChange={handleSVChange}
              radius={INNER_RADIUS}
              size={WHEEL_SIZE}
            />
          </div>

          <div className="shape-tool-config__color-meta">
            <div className="shape-tool-config__color-preview" style={{ background: currentColor }} />
            <div className="shape-tool-config__color-input-wrap">
              <label className="shape-tool-config__swatch-label">HEX</label>
              <input
                type="text"
                value={currentColor.toUpperCase()}
                onChange={(e) => {
                  const value = e.target.value;
                  if (/^#[0-9A-Fa-f]{0,6}$/.test(value)) {
                    lastCommittedColorRef.current = value;
                    const hsva = hexToHsva(value);
                    if (Number.isFinite(hsva.h) && hsva.s > 0) {
                      setLastHue(hsva.h);
                    }
                    onCurrentColorChange(value);
                  }
                }}
                className="shape-tool-config__color-input"
                placeholder="#000000"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ShapeToolConfig;
