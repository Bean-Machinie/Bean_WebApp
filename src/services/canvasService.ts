import { supabase } from '../lib/supabaseClient';
import type { Layer, CanvasData, CanvasDataV1, CanvasDataV2, CanvasDataV3 } from '../types/canvas';
import { generateClientId } from '../lib/utils';

/**
 * NEW APPROACH: Store entire canvas as single JSON document
 * Much faster than individual stroke rows
 * Follows Konva best practices
 *
 * Version 2 adds multi-layer support with automatic migration from V1
 * Version 3 adds editable shapes support with automatic migration from V2
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
 * Migrate V2 (layer-based) to V3 (with editable shapes)
 */
function migrateV2toV3(oldData: CanvasDataV2): CanvasDataV3 {
  return {
    layers: oldData.layers.map(layer => ({
      ...layer,
      shapes: [], // Add empty shapes array to existing layers
    })),
    activeLayerId: oldData.activeLayerId,
    version: 3 as const,
  };
}

/**
 * Save entire canvas state to database
 * Single write operation - much faster than per-stroke saves
 * Now supports multi-layer V3 format with editable shapes
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

    // Store as V3 format with layers and shapes
    const canvasData: CanvasDataV3 = {
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
          ...(stroke.shapeType && { shapeType: stroke.shapeType }),
          ...(stroke.fillColor && { fillColor: stroke.fillColor }),
          ...(stroke.closed !== undefined && { closed: stroke.closed }),
        })),
        shapes: layer.shapes || [], // Include shapes array (empty if none)
      })),
      activeLayerId,
      version: 3 as const,
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
 * Automatically migrates V1 → V2 → V3 if needed
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
    let canvasData: CanvasDataV3;

    if ('version' in rawData && rawData.version === 3) {
      // Already V3 format
      canvasData = rawData;
    } else if ('version' in rawData && rawData.version === 2) {
      // V2 format - migrate to V3
      console.log('Migrating canvas from V2 to V3 format');
      canvasData = migrateV2toV3(rawData);
    } else {
      // V1 format or no version - migrate V1 → V2 → V3
      console.log('Migrating canvas from V1 to V3 format');
      const v2Data = migrateV1toV2(rawData as CanvasDataV1);
      canvasData = migrateV2toV3(v2Data);
    }

    // Convert to Layer[] with full Stroke and Shape objects
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
        ...(stroke.shapeType && { shapeType: stroke.shapeType }),
        ...(stroke.fillColor && { fillColor: stroke.fillColor }),
        ...(stroke.closed !== undefined && { closed: stroke.closed }),
      })),
      shapes: layer.shapes || [], // Include shapes array
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
