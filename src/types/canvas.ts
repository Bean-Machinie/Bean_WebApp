// Canvas stroke types for persistent storage

export type Stroke = {
  // Local state (always present)
  id?: string;              // UUID from DB (undefined until saved)
  points: number[];         // [x1, y1, x2, y2, ...] in canvas coordinates
  color: string;            // Hex color
  strokeWidth: number;      // Brush size
  tool: 'pen' | 'eraser';   // Tool type

  // Save tracking (client-side only)
  isSaving?: boolean;       // Currently being saved
  saveError?: string;       // Error message if save failed
};

export type StrokeDTO = {
  id: string;
  project_id: string;
  user_id: string;
  points: number[];
  color: string;
  stroke_width: number;
  tool: string;
  created_at: string;
};
