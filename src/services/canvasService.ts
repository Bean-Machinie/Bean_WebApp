import { supabase } from '../lib/supabaseClient';
import type { Layer, CanvasData, CanvasDataV1, CanvasDataV2 } from '../types/canvas';
import { generateClientId } from '../lib/utils';

/**
 * NEW APPROACH: Store entire canvas as single JSON document
 * Much faster than individual stroke rows
 * Follows Konva best practices
 *
 * Version 2 adds multi-layer support with automatic migration from V1
 */

/**
 * Migrate V1 (flat stroke array) to V2 (layer-based)
 */
function migrateV1toV2(oldData: CanvasDataV1): CanvasDataV2 {
  const defaultLayerId = generateClientId();

  return {
    layers: [{
      id: defaultLayerId,
      name: 'Layer 1',
      visible: true,
      order: 0,
      strokes: oldData.lines.map((line, index) => ({
        clientId: `migrated-${index}`,
        tool: line.tool,
        points: line.points,
        color: line.color,
        strokeWidth: line.strokeWidth,
        saveState: 'saved' as const,
      })),
    }],
    activeLayerId: defaultLayerId,
    version: 2 as const,
  };
}

/**
 * Save entire canvas state to database
 * Single write operation - much faster than per-stroke saves
 * Now supports multi-layer V2 format
 */
export async function saveCanvas(
  projectId: string,
  layers: Layer[],
  activeLayerId: string
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    // Store as V2 format with layers
    const canvasData: CanvasDataV2 = {
      layers: layers.map(layer => ({
        id: layer.id,
        name: layer.name,
        visible: layer.visible,
        order: layer.order,
        strokes: layer.strokes.map(stroke => ({
          clientId: stroke.clientId,
          tool: stroke.tool,
          points: stroke.points,
          color: stroke.color,
          strokeWidth: stroke.strokeWidth,
        })),
      })),
      activeLayerId,
      version: 2 as const,
    };

    // Upsert - insert or update existing canvas
    const { error } = await supabase
      .from('canvases')
      .upsert({
        project_id: projectId,
        user_id: user.id,
        canvas_data: canvasData,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'project_id',
      });

    if (error) {
      console.error('Failed to save canvas:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in saveCanvas:', error);
    throw error;
  }
}

/**
 * Load canvas state from database
 * Single read operation - much faster than per-stroke loads
 * Automatically migrates V1 → V2 if needed
 */
export async function loadCanvas(projectId: string): Promise<{
  layers: Layer[];
  activeLayerId: string;
}> {
  try {
    const { data, error } = await supabase
      .from('canvases')
      .select('canvas_data')
      .eq('project_id', projectId)
      .maybeSingle();

    if (error) {
      console.error('Failed to load canvas:', error);
      throw error;
    }

    // No canvas saved yet - return empty structure
    if (!data || !data.canvas_data) {
      return { layers: [], activeLayerId: '' };
    }

    const rawData = data.canvas_data as CanvasData;

    // Check version and migrate if needed
    let canvasData: CanvasDataV2;

    if ('version' in rawData && rawData.version === 2) {
      // Already V2 format
      canvasData = rawData;
    } else {
      // V1 format or no version - migrate
      console.log('Migrating canvas from V1 to V2 format');
      canvasData = migrateV1toV2(rawData as CanvasDataV1);
    }

    // Convert to Layer[] with full Stroke objects
    const layers: Layer[] = canvasData.layers.map(layer => ({
      id: layer.id,
      name: layer.name,
      visible: layer.visible,
      order: layer.order,
      strokes: layer.strokes.map((stroke) => ({
        clientId: stroke.clientId,
        tool: stroke.tool,
        points: stroke.points,
        color: stroke.color,
        strokeWidth: stroke.strokeWidth,
        saveState: 'saved' as const,
      })),
    }));

    return {
      layers,
      activeLayerId: canvasData.activeLayerId,
    };
  } catch (error) {
    console.error('Error in loadCanvas:', error);
    return { layers: [], activeLayerId: '' }; // Return empty on error - don't crash
  }
}
