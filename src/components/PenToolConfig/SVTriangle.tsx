import React, { useRef, useState } from 'react';
import {
  calculateTriangleVertices,
  pointToSV,
  svToPoint,
  calculateGradientCoordinates,
  type Point
} from './svTriangleUtils';
import './SVTriangle.css';

/**
 * Convert HSV to RGB color
 * @param h - Hue (0-360)
 * @param s - Saturation (0-100)
 * @param v - Value (0-100)
 * @returns RGB color string
 */
function hsvToRgb(h: number, s: number, v: number): string {
  const saturation = s / 100;
  const value = v / 100;

  const c = value * saturation;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = value - c;

  let r = 0, g = 0, b = 0;

  if (h >= 0 && h < 60) {
    r = c; g = x; b = 0;
  } else if (h >= 60 && h < 120) {
    r = x; g = c; b = 0;
  } else if (h >= 120 && h < 180) {
    r = 0; g = c; b = x;
  } else if (h >= 180 && h < 240) {
    r = 0; g = x; b = c;
  } else if (h >= 240 && h < 300) {
    r = x; g = 0; b = c;
  } else {
    r = c; g = 0; b = x;
  }

  const red = Math.round((r + m) * 255);
  const green = Math.round((g + m) * 255);
  const blue = Math.round((b + m) * 255);

  return `rgb(${red}, ${green}, ${blue})`;
}

export interface SVTriangleProps {
  /** Current hue value (0-360) */
  hue: number;
  /** Current saturation value (0-100) */
  saturation: number;
  /** Current value/brightness (0-100) */
  value: number;
  /** Callback when saturation or value changes */
  onChange: (s: number, v: number) => void;
  /** Radius of the inner circle where the triangle fits */
  radius: number;
  /** Size of the container (width and height) */
  size: number;
}

/**
 * SVTriangle - Saturation/Value picker in the form of a rotating triangle
 *
 * The triangle represents the S/V plane for a given hue:
 * - Top vertex: Pure hue (100% saturation, 100% value)
 * - Bottom-right: White (0% saturation, 100% value)
 * - Bottom-left: Black (0% saturation, 0% value)
 *
 * The triangle rotates to keep the top vertex aligned with the current hue.
 */
export function SVTriangle({
  hue,
  saturation,
  value,
  onChange,
  radius,
  size
}: SVTriangleProps) {
  const triangleRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Calculate the center and vertices of the triangle
  const center = size / 2;
  const vertices = calculateTriangleVertices(center, center, radius, hue);

  // Calculate gradient coordinates that align with the triangle's geometry
  const gradientCoords = calculateGradientCoordinates(vertices);

  // Calculate the thumb position based on current S/V
  const thumbPosition = svToPoint(saturation, value, vertices);

  // Convert HSV to RGB for accurate color display in the thumb
  // HSV and HSL are different color spaces, so we need proper conversion
  const thumbColor = hsvToRgb(hue, saturation, value);

  /**
   * Handle pointer interaction - convert screen coordinates to S/V values
   */
  const handlePointerMove = (clientX: number, clientY: number) => {
    if (!triangleRef.current) return;

    const rect = triangleRef.current.getBoundingClientRect();
    const point: Point = {
      x: clientX - rect.left,
      y: clientY - rect.top
    };

    const { s, v } = pointToSV(point, vertices);
    onChange(s, v);
  };

  /**
   * Start pointer tracking
   */
  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);

    const move = (moveEvent: PointerEvent) => {
      handlePointerMove(moveEvent.clientX, moveEvent.clientY);
    };

    const up = () => {
      setIsDragging(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);

    // Handle the initial click
    handlePointerMove(e.clientX, e.clientY);
  };

  // Generate the pure hue color for the gradient
  const hueColor = `hsl(${hue}, 100%, 50%)`;

  return (
    <div
      className="sv-triangle"
      ref={triangleRef}
      style={{
        width: `${size}px`,
        height: `${size}px`
      }}
    >
      {/* SVG for precise triangle rendering */}
      <svg
        className="sv-triangle__svg"
        width={size}
        height={size}
        onPointerDown={handlePointerDown}
        style={{ cursor: isDragging ? 'grabbing' : 'crosshair' }}
      >
        <defs>
          {/* Gradient from hue (top) to white (bottom), aligned with triangle geometry */}
          <linearGradient
            id="sv-gradient-hue"
            x1={gradientCoords.hueToWhite.start.x}
            y1={gradientCoords.hueToWhite.start.y}
            x2={gradientCoords.hueToWhite.end.x}
            y2={gradientCoords.hueToWhite.end.y}
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor={hueColor} />
            <stop offset="100%" stopColor="white" />
          </linearGradient>
          {/* Black gradient from top to bottom, aligned with triangle geometry */}
          <linearGradient
            id="sv-gradient-black"
            x1={gradientCoords.blackOverlay.start.x}
            y1={gradientCoords.blackOverlay.start.y}
            x2={gradientCoords.blackOverlay.end.x}
            y2={gradientCoords.blackOverlay.end.y}
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="transparent" />
            <stop offset="100%" stopColor="black" />
          </linearGradient>
        </defs>

        {/* Triangle with hue-to-white gradient */}
        <polygon
          points={`${vertices.hue.x},${vertices.hue.y} ${vertices.white.x},${vertices.white.y} ${vertices.black.x},${vertices.black.y}`}
          fill="url(#sv-gradient-hue)"
          className="sv-triangle__base"
        />

        {/* Overlay triangle with black gradient for value control */}
        <polygon
          points={`${vertices.hue.x},${vertices.hue.y} ${vertices.white.x},${vertices.white.y} ${vertices.black.x},${vertices.black.y}`}
          fill="url(#sv-gradient-black)"
          className="sv-triangle__overlay"
        />
      </svg>

      {/* Draggable thumb indicator */}
      <div
        className={`sv-triangle__thumb ${isDragging ? 'sv-triangle__thumb--dragging' : ''}`}
        style={{
          left: `${thumbPosition.x}px`,
          top: `${thumbPosition.y}px`,
          background: thumbColor
        }}
      />
    </div>
  );
}
