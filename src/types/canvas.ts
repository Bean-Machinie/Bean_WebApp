// Canvas stroke types - simplified for JSON document storage

export type ShapeType = 'line' | 'polyline' | 'rectangle' | 'ellipse' | 'triangle';

export type Stroke = {
  clientId: string;       // Temporary ID for React keys
  tool: 'pen' | 'eraser' | 'shape'; // Tool type
  points: number[];       // [x1, y1, x2, y2, ...] in canvas coordinates
  color: string;          // Hex color (stroke color for shapes, fill for pen)
  strokeWidth: number;    // Brush size
  saveState?: 'saved';    // Optional - only set after load from DB
  // Shape-specific properties
  shapeType?: ShapeType;  // Type of shape (only for tool: 'shape')
  fillColor?: string;     // Fill color for shapes
  closed?: boolean;       // Whether shape is closed (for polyline)
};

// Editable shape type - native Konva shapes with geometric properties
export type EditableShape = {
  id: string;              // UUID for selection
  shapeType: 'rectangle' | 'ellipse' | 'triangle'; // Exclude 'line' and 'polyline'
  x: number;               // Position
  y: number;
  width: number;           // Dimensions
  height: number;
  rotation: number;        // Transform state
  scaleX: number;
  scaleY: number;
  strokeColor: string;     // Stroke properties
  strokeWidth: number;
  fillColor?: string;      // Fill properties
  fillEnabled: boolean;
};

// Layer type for multi-layer canvas system
export type Layer = {
  id: string;             // UUID
  name: string;           // "Layer 1", "Background", etc.
  visible: boolean;       // Eye icon toggle
  order: number;          // Stacking order (higher = on top)
  strokes: Stroke[];      // Strokes belonging to this layer (immutable)
  shapes?: EditableShape[]; // NEW: Editable shapes (V3+, optional for backward compatibility)
};

// Version 3: Multi-layer canvas with editable shapes
export type CanvasDataV3 = {
  layers: Layer[];        // Layers now include shapes array
  activeLayerId: string;
  version: 3;
};

// Version 2: Multi-layer canvas data
export type CanvasDataV2 = {
  layers: Layer[];
  activeLayerId: string;
  version: 2;
};

// Version 1: Legacy flat stroke array (for migration)
export type CanvasDataV1 = {
  lines: Array<{
    tool: 'pen' | 'eraser';
    points: number[];
    color: string;
    strokeWidth: number;
  }>;
  version: 1;
};

// Union type for backwards compatibility
export type CanvasData = CanvasDataV1 | CanvasDataV2 | CanvasDataV3;
