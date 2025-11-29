// Canvas stroke types - simplified for JSON document storage

export type Stroke = {
  clientId: string;       // Temporary ID for React keys
  tool: 'pen' | 'eraser'; // Tool type
  points: number[];       // [x1, y1, x2, y2, ...] in canvas coordinates
  color: string;          // Hex color
  strokeWidth: number;    // Brush size
  saveState?: 'saved';    // Optional - only set after load from DB
};

// Layer type for multi-layer canvas system
export type Layer = {
  id: string;             // UUID
  name: string;           // "Layer 1", "Background", etc.
  visible: boolean;       // Eye icon toggle
  order: number;          // Stacking order (higher = on top)
  strokes: Stroke[];      // Strokes belonging to this layer
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
export type CanvasData = CanvasDataV1 | CanvasDataV2;
