// TypeScript types for the normalized canvas database schema

export interface CanvasConfig {
  id: string;
  project_id: string;
  width: number;
  height: number;
  background_color: string;
  zoom: number;
  pan_x: number;
  pan_y: number;
  created_at: string;
  updated_at: string;
}

export interface CanvasLayer {
  id: string;
  canvas_config_id: string;
  name: string;
  order_index: number;
  visible: boolean;
  locked: boolean;
  opacity: number;
  blend_mode: string;
  created_at: string;
  updated_at: string;
}

export interface CanvasStroke {
  id: string;
  layer_id: string;
  stroke_data: StrokeData;
  stroke_order: number;
  created_at: string;
}

export interface StrokeData {
  // Define the structure of a single stroke
  points: Array<{ x: number; y: number; pressure?: number }>;
  color: string;
  width: number;
  tool: 'pen' | 'brush' | 'eraser' | 'highlighter';
  opacity?: number;
  smoothing?: number;
}

export interface CanvasVersion {
  id: string;
  project_id: string;
  version_number: number;
  snapshot_data: VersionSnapshot;
  created_at: string;
}

export interface VersionSnapshot {
  // Lightweight state snapshot for undo/redo
  layer_ids: string[];
  settings: {
    zoom: number;
    pan_x: number;
    pan_y: number;
  };
  timestamp: string;
}

// Request/Response types for API operations
export interface CreateCanvasConfigRequest {
  project_id: string;
  width?: number;
  height?: number;
  background_color?: string;
  zoom?: number;
  pan_x?: number;
  pan_y?: number;
}

export interface CreateLayerRequest {
  canvas_config_id: string;
  name: string;
  order_index: number;
  visible?: boolean;
  locked?: boolean;
  opacity?: number;
  blend_mode?: string;
}

export interface UpdateLayerRequest {
  name?: string;
  order_index?: number;
  visible?: boolean;
  locked?: boolean;
  opacity?: number;
  blend_mode?: string;
}

export interface CreateStrokeRequest {
  layer_id: string;
  stroke_data: StrokeData;
  stroke_order: number;
}

export interface CreateVersionRequest {
  project_id: string;
  version_number: number;
  snapshot_data: VersionSnapshot;
}

// Combined types for fetching related data
export interface CanvasConfigWithLayers extends CanvasConfig {
  canvas_layers: CanvasLayer[];
}

export interface CanvasLayerWithStrokes extends CanvasLayer {
  canvas_strokes: CanvasStroke[];
}

// Pagination types
export interface PaginatedStrokes {
  strokes: CanvasStroke[];
  total: number;
  hasMore: boolean;
}
