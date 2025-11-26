import { supabase } from '../lib/supabaseClient';
import {
  CanvasConfig,
  CanvasLayer,
  CanvasStroke,
  CanvasVersion,
  CanvasConfigWithLayers,
  CanvasLayerWithStrokes,
  PaginatedStrokes,
  CreateCanvasConfigRequest,
  CreateLayerRequest,
  UpdateLayerRequest,
  CreateStrokeRequest,
  CreateVersionRequest,
} from '../types/canvas';

// =============================================
// CANVAS CONFIG OPERATIONS
// =============================================

export async function getCanvasConfig(projectId: string): Promise<CanvasConfig | null> {
  const { data, error } = await supabase
    .from('canvas_configs')
    .select('*')
    .eq('project_id', projectId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw new Error(`Failed to fetch canvas config: ${error.message}`);
  }

  return data;
}

export async function getCanvasConfigWithLayers(projectId: string): Promise<CanvasConfigWithLayers | null> {
  const { data, error } = await supabase
    .from('canvas_configs')
    .select(`
      *,
      canvas_layers (
        *
      )
    `)
    .eq('project_id', projectId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw new Error(`Failed to fetch canvas config with layers: ${error.message}`);
  }

  // Sort layers by order_index
  if (data.canvas_layers) {
    data.canvas_layers.sort((a, b) => a.order_index - b.order_index);
  }

  return data as CanvasConfigWithLayers;
}

export async function createCanvasConfig(request: CreateCanvasConfigRequest): Promise<CanvasConfig> {
  const { data, error } = await supabase
    .from('canvas_configs')
    .insert({
      project_id: request.project_id,
      width: request.width ?? 1920,
      height: request.height ?? 1080,
      background_color: request.background_color ?? '#0f172a',
      zoom: request.zoom ?? 1.0,
      pan_x: request.pan_x ?? 0,
      pan_y: request.pan_y ?? 0,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create canvas config: ${error.message}`);
  }

  return data;
}

export async function updateCanvasConfig(
  projectId: string,
  updates: Partial<Omit<CanvasConfig, 'id' | 'project_id' | 'created_at' | 'updated_at'>>
): Promise<CanvasConfig> {
  const { data, error } = await supabase
    .from('canvas_configs')
    .update(updates)
    .eq('project_id', projectId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update canvas config: ${error.message}`);
  }

  return data;
}

// =============================================
// LAYER OPERATIONS
// =============================================

export async function getLayersByCanvasConfig(canvasConfigId: string): Promise<CanvasLayer[]> {
  const { data, error } = await supabase
    .from('canvas_layers')
    .select('*')
    .eq('canvas_config_id', canvasConfigId)
    .order('order_index', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch layers: ${error.message}`);
  }

  return data;
}

export async function getLayerWithStrokes(layerId: string): Promise<CanvasLayerWithStrokes> {
  const { data, error } = await supabase
    .from('canvas_layers')
    .select(`
      *,
      canvas_strokes (
        *
      )
    `)
    .eq('id', layerId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch layer with strokes: ${error.message}`);
  }

  // Sort strokes by stroke_order
  if (data.canvas_strokes) {
    data.canvas_strokes.sort((a, b) => a.stroke_order - b.stroke_order);
  }

  return data as CanvasLayerWithStrokes;
}

export async function createLayer(request: CreateLayerRequest): Promise<CanvasLayer> {
  const { data, error } = await supabase
    .from('canvas_layers')
    .insert({
      canvas_config_id: request.canvas_config_id,
      name: request.name,
      order_index: request.order_index,
      visible: request.visible ?? true,
      locked: request.locked ?? false,
      opacity: request.opacity ?? 1.0,
      blend_mode: request.blend_mode ?? 'normal',
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create layer: ${error.message}`);
  }

  return data;
}

export async function updateLayer(layerId: string, updates: UpdateLayerRequest): Promise<CanvasLayer> {
  const { data, error } = await supabase
    .from('canvas_layers')
    .update(updates)
    .eq('id', layerId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update layer: ${error.message}`);
  }

  return data;
}

export async function deleteLayer(layerId: string): Promise<void> {
  const { error } = await supabase
    .from('canvas_layers')
    .delete()
    .eq('id', layerId);

  if (error) {
    throw new Error(`Failed to delete layer: ${error.message}`);
  }
}

export async function reorderLayers(layerUpdates: Array<{ id: string; order_index: number }>): Promise<void> {
  // Update multiple layers in a transaction-like manner
  const promises = layerUpdates.map(({ id, order_index }) =>
    supabase
      .from('canvas_layers')
      .update({ order_index })
      .eq('id', id)
  );

  const results = await Promise.all(promises);

  const errors = results.filter(r => r.error);
  if (errors.length > 0) {
    throw new Error(`Failed to reorder layers: ${errors[0].error?.message}`);
  }
}

// =============================================
// STROKE OPERATIONS
// =============================================

export async function getStrokesByLayer(
  layerId: string,
  options?: { limit?: number; offset?: number }
): Promise<PaginatedStrokes> {
  const limit = options?.limit ?? 100;
  const offset = options?.offset ?? 0;

  const { data, error, count } = await supabase
    .from('canvas_strokes')
    .select('*', { count: 'exact' })
    .eq('layer_id', layerId)
    .order('stroke_order', { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Failed to fetch strokes: ${error.message}`);
  }

  return {
    strokes: data,
    total: count ?? 0,
    hasMore: (count ?? 0) > offset + limit,
  };
}

export async function createStroke(request: CreateStrokeRequest): Promise<CanvasStroke> {
  const { data, error } = await supabase
    .from('canvas_strokes')
    .insert({
      layer_id: request.layer_id,
      stroke_data: request.stroke_data,
      stroke_order: request.stroke_order,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create stroke: ${error.message}`);
  }

  return data;
}

export async function createStrokeBatch(requests: CreateStrokeRequest[]): Promise<CanvasStroke[]> {
  const { data, error } = await supabase
    .from('canvas_strokes')
    .insert(
      requests.map(r => ({
        layer_id: r.layer_id,
        stroke_data: r.stroke_data,
        stroke_order: r.stroke_order,
      }))
    )
    .select();

  if (error) {
    throw new Error(`Failed to create strokes batch: ${error.message}`);
  }

  return data;
}

export async function deleteStroke(strokeId: string): Promise<void> {
  const { error } = await supabase
    .from('canvas_strokes')
    .delete()
    .eq('id', strokeId);

  if (error) {
    throw new Error(`Failed to delete stroke: ${error.message}`);
  }
}

export async function deleteStrokesByLayer(layerId: string): Promise<void> {
  const { error } = await supabase
    .from('canvas_strokes')
    .delete()
    .eq('layer_id', layerId);

  if (error) {
    throw new Error(`Failed to delete strokes: ${error.message}`);
  }
}

export async function getNextStrokeOrder(layerId: string): Promise<number> {
  const { data, error } = await supabase
    .from('canvas_strokes')
    .select('stroke_order')
    .eq('layer_id', layerId)
    .order('stroke_order', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return 0; // No strokes yet
    throw new Error(`Failed to get next stroke order: ${error.message}`);
  }

  return (data?.stroke_order ?? -1) + 1;
}

// =============================================
// VERSION OPERATIONS (UNDO/REDO)
// =============================================

export async function getVersions(projectId: string, limit: number = 15): Promise<CanvasVersion[]> {
  const { data, error } = await supabase
    .from('canvas_versions')
    .select('*')
    .eq('project_id', projectId)
    .order('version_number', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch versions: ${error.message}`);
  }

  return data;
}

export async function getLatestVersion(projectId: string): Promise<CanvasVersion | null> {
  const { data, error } = await supabase
    .from('canvas_versions')
    .select('*')
    .eq('project_id', projectId)
    .order('version_number', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // No versions yet
    throw new Error(`Failed to fetch latest version: ${error.message}`);
  }

  return data;
}

export async function createVersion(request: CreateVersionRequest): Promise<CanvasVersion> {
  // First, cleanup old versions (keep last 15)
  await cleanupOldVersions(request.project_id);

  const { data, error } = await supabase
    .from('canvas_versions')
    .insert({
      project_id: request.project_id,
      version_number: request.version_number,
      snapshot_data: request.snapshot_data,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create version: ${error.message}`);
  }

  return data;
}

export async function getNextVersionNumber(projectId: string): Promise<number> {
  const { data, error } = await supabase
    .from('canvas_versions')
    .select('version_number')
    .eq('project_id', projectId)
    .order('version_number', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return 1; // First version
    throw new Error(`Failed to get next version number: ${error.message}`);
  }

  return (data?.version_number ?? 0) + 1;
}

export async function cleanupOldVersions(projectId: string): Promise<void> {
  const { error } = await supabase.rpc('cleanup_old_canvas_versions', {
    p_project_id: projectId,
  });

  if (error) {
    throw new Error(`Failed to cleanup old versions: ${error.message}`);
  }
}

// =============================================
// INITIALIZATION & MIGRATION HELPERS
// =============================================

export async function initializeCanvasForProject(projectId: string): Promise<{
  config: CanvasConfig;
  defaultLayer: CanvasLayer;
}> {
  // Create canvas config
  const config = await createCanvasConfig({ project_id: projectId });

  // Create default layer
  const defaultLayer = await createLayer({
    canvas_config_id: config.id,
    name: 'Layer 1',
    order_index: 0,
  });

  return { config, defaultLayer };
}

export async function canvasConfigExists(projectId: string): Promise<boolean> {
  const config = await getCanvasConfig(projectId);
  return config !== null;
}
