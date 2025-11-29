import { supabase } from '../lib/supabaseClient';
import type { Stroke } from '../types/canvas';

/**
 * NEW APPROACH: Store entire canvas as single JSON document
 * Much faster than individual stroke rows
 * Follows Konva best practices
 */

type CanvasData = {
  lines: Array<{
    tool: 'pen' | 'eraser';
    points: number[];
    color: string;
    strokeWidth: number;
  }>;
  version: number;
};

/**
 * Save entire canvas state to database
 * Single write operation - much faster than per-stroke saves
 */
export async function saveCanvas(projectId: string, lines: Stroke[]): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    // Convert Stroke[] to simple format for storage
    const canvasData: CanvasData = {
      lines: lines.map(line => ({
        tool: line.tool,
        points: line.points,
        color: line.color,
        strokeWidth: line.strokeWidth,
      })),
      version: 1,
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
 */
export async function loadCanvas(projectId: string): Promise<Stroke[]> {
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

    // No canvas saved yet
    if (!data || !data.canvas_data) {
      return [];
    }

    const canvasData = data.canvas_data as CanvasData;

    // Convert stored format back to Stroke[]
    // No clientId needed - we don't track individual strokes anymore
    const strokes: Stroke[] = canvasData.lines.map((line, index) => ({
      clientId: `loaded-${index}`, // Simple index-based ID
      tool: line.tool,
      points: line.points,
      color: line.color,
      strokeWidth: line.strokeWidth,
      saveState: 'saved' as const,
    }));

    return strokes;
  } catch (error) {
    console.error('Error in loadCanvas:', error);
    return []; // Return empty array on error - don't crash
  }
}
