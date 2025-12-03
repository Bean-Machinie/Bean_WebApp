import React, { useRef, useState, useEffect } from 'react';
import { hsvaToHex, hexToHsva } from '@uiw/color-convert';
import type { HsvaColor } from '@uiw/color-convert';
import './PenToolConfig.css';

type Point = { x: number; y: number };
type Barycentric = { hue: number; white: number; black: number };

const WHEEL_SIZE = 176; // tighter fit and slimmer ring
const WHEEL_THICKNESS = 18;
const OUTER_RADIUS = WHEEL_SIZE / 2;
const INNER_RADIUS = OUTER_RADIUS - WHEEL_THICKNESS;
const TRIANGLE_RADIUS = INNER_RADIUS * 0.72;
const TRIANGLE_SIDE = TRIANGLE_RADIUS * Math.sqrt(3);
const TRIANGLE_HEIGHT = (Math.sqrt(3) / 2) * TRIANGLE_SIDE;
const HUE_THUMB_RADIUS = INNER_RADIUS + WHEEL_THICKNESS / 2;

type TriangleVertices = {
  hue: Point;
  white: Point;
  black: Point;
};

const TRIANGLE_VERTICES: TriangleVertices = {
  hue: { x: 0, y: -TRIANGLE_RADIUS },
  white: {
    x: TRIANGLE_RADIUS * Math.cos(Math.PI / 6),
    y: TRIANGLE_RADIUS * Math.sin(Math.PI / 6),
  },
  black: {
    x: TRIANGLE_RADIUS * Math.cos((5 * Math.PI) / 6),
    y: TRIANGLE_RADIUS * Math.sin((5 * Math.PI) / 6),
  },
};

const clampBarycentric = ({ hue, white, black }: Barycentric): Barycentric => {
  const cHue = Math.max(0, hue);
  const cWhite = Math.max(0, white);
  const cBlack = Math.max(0, black);
  const sum = cHue + cWhite + cBlack || 1;

  return {
    hue: cHue / sum,
    white: cWhite / sum,
    black: cBlack / sum,
  };
};

const pointToBarycentric = (p: Point, t: TriangleVertices): Barycentric => {
  const v0 = { x: t.white.x - t.hue.x, y: t.white.y - t.hue.y };
  const v1 = { x: t.black.x - t.hue.x, y: t.black.y - t.hue.y };
  const v2 = { x: p.x - t.hue.x, y: p.y - t.hue.y };

  const d00 = v0.x * v0.x + v0.y * v0.y;
  const d01 = v0.x * v1.x + v0.y * v1.y;
  const d11 = v1.x * v1.x + v1.y * v1.y;
  const d20 = v2.x * v0.x + v2.y * v0.y;
  const d21 = v2.x * v1.x + v2.y * v1.y;
  const denom = d00 * d11 - d01 * d01 || 1;

  const white = (d11 * d20 - d01 * d21) / denom;
  const black = (d00 * d21 - d01 * d20) / denom;
  const hue = 1 - white - black;

  return clampBarycentric({ hue, white, black });
};

const barycentricToPoint = (b: Barycentric, t: TriangleVertices): Point => ({
  x: b.hue * t.hue.x + b.white * t.white.x + b.black * t.black.x,
  y: b.hue * t.hue.y + b.white * t.white.y + b.black * t.black.y,
});

const barycentricToSV = (b: Barycentric) => {
  const value = (b.hue + b.white) * 100;
  const saturation = value === 0 ? 0 : (b.hue / (b.hue + b.white)) * 100;
  return { saturation, value };
};

const svToBarycentric = (s: number, v: number): Barycentric => {
  const value = Math.max(0, Math.min(100, v)) / 100;
  const saturation = value === 0 ? 0 : Math.max(0, Math.min(100, s)) / 100;
  const hue = saturation * value;
  const white = value - hue;
  const black = 1 - value;

  return { hue, white, black };
};

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
  const triangleRef = useRef<HTMLDivElement>(null);
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
  const triangleWeights = svToBarycentric(hsva.s, hsva.v);
  const trianglePoint = barycentricToPoint(triangleWeights, TRIANGLE_VERTICES);

  // The triangle element is centered, but its coordinate origin is offset
  // from the element's geometric center by this amount vertically
  const triangleOffsetY = TRIANGLE_RADIUS - TRIANGLE_HEIGHT / 2;

  const commitColor = (nextHsva: HsvaColor, opts?: { lockHue?: boolean }) => {
    // Determine which hue to use (update if not locked and valid, otherwise keep current)
    const hueToUse = (!opts?.lockHue && Number.isFinite(nextHsva.h)) ? nextHsva.h : lastHue;

    // Update state if hue changed (triggers re-render for triangle update)
    if (hueToUse !== lastHue) {
      setLastHue(hueToUse);
    }

    const safeHsva = { ...nextHsva, h: hueToUse };
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
    commitColor({ ...hsva, h: normalizedHue });
  };

  const handleTrianglePointer = (clientX: number, clientY: number) => {
    if (!triangleRef.current) return;
    const rect = triangleRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    // Use TRIANGLE_RADIUS instead of rect.height / 2 to match the coordinate system
    const cy = rect.top + TRIANGLE_RADIUS;
    const point = { x: clientX - cx, y: clientY - cy };
    const bary = pointToBarycentric(point, TRIANGLE_VERTICES);
    const { saturation, value } = barycentricToSV(bary);
    commitColor({
      ...hsva,
      s: saturation,
      v: value,
    }, { lockHue: true });
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

            <div
              className="pen-tool-config__triangle"
              style={{
                width: `${TRIANGLE_SIDE}px`,
                height: `${TRIANGLE_HEIGHT}px`,
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                ['--triangle-hue' as string]: `${hsva.h}`,
              }}
              ref={triangleRef}
              onPointerDown={(e) => {
                e.stopPropagation();
                startPointerTracking(e, handleTrianglePointer);
              }}
            />

            <div
              className="pen-tool-config__triangle-thumb"
              style={{
                left: '50%',
                top: '50%',
                transform: `translate(-50%, -50%) translate(${trianglePoint.x}px, ${trianglePoint.y + triangleOffsetY}px)`,
                background: brushColor,
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
