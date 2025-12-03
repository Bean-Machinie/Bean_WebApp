import React, { useRef, useEffect, useState } from 'react';
import {
  calculateTriangleVertices,
  pointToSV,
  svToPoint,
  type Point,
  type TriangleVertices
} from './svTriangleUtils';
import './SVTriangle.css';

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
 * - Top vertex: Pure hue (100% saturation, 50% value)
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

  // Calculate the thumb position based on current S/V
  const thumbPosition = svToPoint(saturation, value, vertices);

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
          {/* Gradient from hue (top) to white (bottom-right) to black (bottom-left) */}
          <linearGradient id={`sv-gradient-h-${hue}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={hueColor} />
            <stop offset="100%" stopColor="white" />
          </linearGradient>
          <linearGradient id="sv-gradient-black" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="100%" stopColor="black" />
          </linearGradient>
        </defs>

        {/* Triangle with hue-to-white gradient */}
        <polygon
          points={`${vertices.hue.x},${vertices.hue.y} ${vertices.white.x},${vertices.white.y} ${vertices.black.x},${vertices.black.y}`}
          fill={`url(#sv-gradient-h-${hue})`}
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
          background: `hsl(${hue}, ${saturation}%, ${value}%)`
        }}
      />
    </div>
  );
}
