/**
 * Utility functions for SV Triangle (Saturation/Value picker)
 * Handles barycentric coordinate conversion and S/V calculations
 */

export interface Point {
  x: number;
  y: number;
}

export interface TriangleVertices {
  hue: Point;    // Top vertex: pure hue (100% sat, 50% value)
  white: Point;  // Bottom-right: white (0% sat, 100% value)
  black: Point;  // Bottom-left: black (0% sat, 0% value)
}

export interface BarycentricCoords {
  hue: number;
  white: number;
  black: number;
}

/**
 * Calculate the vertices of an equilateral triangle that fits inside a circle
 * The triangle is oriented with one vertex pointing up (towards the current hue)
 *
 * @param centerX - Center X coordinate of the wheel
 * @param centerY - Center Y coordinate of the wheel
 * @param radius - Radius to fit the triangle (typically the inner radius of the wheel)
 * @param rotation - Rotation angle in degrees (typically the hue angle)
 * @returns The three vertices of the triangle
 */
export function calculateTriangleVertices(
  centerX: number,
  centerY: number,
  radius: number,
  rotation: number
): TriangleVertices {
  // Scale the triangle to fit nicely inside the circle
  // Use ~86% of radius to give some padding
  const triangleRadius = radius * 0.86;

  // Convert rotation to radians and adjust so 0° is at top
  const rotRad = ((rotation - 90) * Math.PI) / 180;

  // Equilateral triangle vertices at 0°, 120°, 240° relative to rotation
  const hue: Point = {
    x: centerX + triangleRadius * Math.cos(rotRad),
    y: centerY + triangleRadius * Math.sin(rotRad)
  };

  const white: Point = {
    x: centerX + triangleRadius * Math.cos(rotRad + (2 * Math.PI / 3)),
    y: centerY + triangleRadius * Math.sin(rotRad + (2 * Math.PI / 3))
  };

  const black: Point = {
    x: centerX + triangleRadius * Math.cos(rotRad + (4 * Math.PI / 3)),
    y: centerY + triangleRadius * Math.sin(rotRad + (4 * Math.PI / 3))
  };

  return { hue, white, black };
}

/**
 * Convert a point (x, y) to barycentric coordinates within a triangle
 * Barycentric coordinates express a point as weighted combination of triangle vertices
 *
 * @param point - The point to convert
 * @param vertices - The triangle vertices
 * @returns Barycentric coordinates (weights for hue, white, black vertices)
 */
export function pointToBarycentric(
  point: Point,
  vertices: TriangleVertices
): BarycentricCoords {
  const { hue, white, black } = vertices;

  // Calculate the area of the main triangle using cross product
  const denominator =
    (white.y - black.y) * (hue.x - black.x) +
    (black.x - white.x) * (hue.y - black.y);

  // Calculate barycentric coordinate for hue vertex
  const hueWeight =
    ((white.y - black.y) * (point.x - black.x) +
     (black.x - white.x) * (point.y - black.y)) / denominator;

  // Calculate barycentric coordinate for white vertex
  const whiteWeight =
    ((black.y - hue.y) * (point.x - black.x) +
     (hue.x - black.x) * (point.y - black.y)) / denominator;

  // Calculate barycentric coordinate for black vertex (remainder)
  const blackWeight = 1 - hueWeight - whiteWeight;

  return {
    hue: hueWeight,
    white: whiteWeight,
    black: blackWeight
  };
}

/**
 * Convert barycentric coordinates back to a point (x, y)
 *
 * @param bary - Barycentric coordinates
 * @param vertices - The triangle vertices
 * @returns The point in Cartesian coordinates
 */
export function barycentricToPoint(
  bary: BarycentricCoords,
  vertices: TriangleVertices
): Point {
  return {
    x: bary.hue * vertices.hue.x + bary.white * vertices.white.x + bary.black * vertices.black.x,
    y: bary.hue * vertices.hue.y + bary.white * vertices.white.y + bary.black * vertices.black.y
  };
}

/**
 * Check if a point is inside the triangle
 * A point is inside if all barycentric coordinates are >= 0
 *
 * @param bary - Barycentric coordinates
 * @returns true if point is inside triangle
 */
export function isInsideTriangle(bary: BarycentricCoords): boolean {
  return bary.hue >= 0 && bary.white >= 0 && bary.black >= 0;
}

/**
 * Clamp barycentric coordinates to the triangle bounds
 * This ensures the point stays within the triangle
 *
 * @param bary - Barycentric coordinates
 * @returns Clamped barycentric coordinates
 */
export function clampToTriangle(bary: BarycentricCoords): BarycentricCoords {
  // If all weights are positive, point is already inside
  if (isInsideTriangle(bary)) {
    return bary;
  }

  // Clamp to nearest edge or vertex
  const hue = Math.max(0, bary.hue);
  const white = Math.max(0, bary.white);
  const black = Math.max(0, bary.black);

  // Normalize to sum to 1
  const sum = hue + white + black;

  return {
    hue: hue / sum,
    white: white / sum,
    black: black / sum
  };
}

/**
 * Convert barycentric coordinates to saturation and value percentages
 *
 * Formula:
 * - value = (hue_weight + white_weight) * 100
 * - saturation = (hue_weight / (hue_weight + white_weight)) * 100
 *
 * Special case: when hue_weight + white_weight = 0 (pure black), saturation = 0
 *
 * @param bary - Barycentric coordinates
 * @returns Saturation (0-100) and Value (0-100)
 */
export function barycentricToSV(bary: BarycentricCoords): { s: number; v: number } {
  const { hue, white } = bary;
  const colorAmount = hue + white;

  // Value is the amount of "color" (everything except black)
  const v = colorAmount * 100;

  // Saturation is the proportion of hue vs white in the color
  // When value is 0 (pure black), saturation is undefined, so we use 0
  const s = colorAmount > 0 ? (hue / colorAmount) * 100 : 0;

  return { s, v };
}

/**
 * Convert saturation and value percentages to barycentric coordinates
 *
 * @param s - Saturation (0-100)
 * @param v - Value (0-100)
 * @returns Barycentric coordinates
 */
export function svToBarycentric(s: number, v: number): BarycentricCoords {
  // Normalize to 0-1 range
  const saturation = s / 100;
  const value = v / 100;

  // Calculate how much "color" we have (everything except black)
  const colorAmount = value;

  // Split the color between hue and white based on saturation
  const hue = colorAmount * saturation;
  const white = colorAmount * (1 - saturation);

  // Black is the remainder (1 - value)
  const black = 1 - value;

  return { hue, white, black };
}

/**
 * Convert saturation/value to a point within the triangle
 *
 * @param s - Saturation (0-100)
 * @param v - Value (0-100)
 * @param vertices - The triangle vertices
 * @returns The point in Cartesian coordinates
 */
export function svToPoint(
  s: number,
  v: number,
  vertices: TriangleVertices
): Point {
  const bary = svToBarycentric(s, v);
  return barycentricToPoint(bary, vertices);
}

/**
 * Convert a point to saturation and value, clamping to triangle bounds
 *
 * @param point - The point to convert
 * @param vertices - The triangle vertices
 * @returns Saturation (0-100) and Value (0-100)
 */
export function pointToSV(
  point: Point,
  vertices: TriangleVertices
): { s: number; v: number } {
  const bary = pointToBarycentric(point, vertices);
  const clampedBary = clampToTriangle(bary);
  return barycentricToSV(clampedBary);
}

/**
 * Calculate gradient coordinates that align with the triangle's geometry
 *
 * The gradients should follow the triangle edges to create proper 3-point interpolation:
 * - Hue-to-white gradient: From hue-black edge to the white vertex (saturation control)
 * - Black overlay gradient: From hue-white edge to the black vertex (value/brightness control)
 *
 * @param vertices - The triangle vertices
 * @returns Gradient start and end points for both gradients
 */
export function calculateGradientCoordinates(vertices: TriangleVertices): {
  hueToWhite: { start: Point; end: Point };
  blackOverlay: { start: Point; end: Point };
} {
  // Hue-to-white gradient: From the midpoint of hue-black edge to the white vertex
  // This creates the saturation gradient (left edge = hue, right corner = white)
  const hueBlackMidpoint: Point = {
    x: (vertices.hue.x + vertices.black.x) / 2,
    y: (vertices.hue.y + vertices.black.y) / 2
  };

  // Black overlay gradient: From the midpoint of hue-white edge to the black vertex
  // This creates the value gradient (top edge = bright, bottom corner = black)
  const hueWhiteMidpoint: Point = {
    x: (vertices.hue.x + vertices.white.x) / 2,
    y: (vertices.hue.y + vertices.white.y) / 2
  };

  return {
    hueToWhite: {
      start: hueBlackMidpoint,
      end: vertices.white
    },
    blackOverlay: {
      start: hueWhiteMidpoint,
      end: vertices.black
    }
  };
}
