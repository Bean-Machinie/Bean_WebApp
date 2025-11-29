// Canvas stroke types - simplified for JSON document storage

export type Stroke = {
  clientId: string;       // Temporary ID for React keys
  tool: 'pen' | 'eraser'; // Tool type
  points: number[];       // [x1, y1, x2, y2, ...] in canvas coordinates
  color: string;          // Hex color
  strokeWidth: number;    // Brush size
  saveState?: 'saved';    // Optional - only set after load from DB
};
