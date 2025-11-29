// Canvas stroke types for persistent storage

export type Stroke = {
  // Identifiers
  clientId: string;         // Client-generated UUID (ALWAYS present)
  id?: string;              // DB UUID (undefined until saved)

  // Stroke data
  points: number[];         // [x1, y1, x2, y2, ...] in canvas coordinates
  color: string;            // Hex color
  strokeWidth: number;      // Brush size
  tool: 'pen' | 'eraser';   // Tool type

  // Save state tracking
  saveState: 'pending' | 'saving' | 'saved' | 'error';
  saveError?: string;       // Error message if save failed
  lastSaveAttempt?: number; // Timestamp of last save attempt
  retryCount?: number;      // Number of retry attempts
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
