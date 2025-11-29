import { supabase } from '../lib/supabaseClient';
import type { Stroke, StrokeDTO } from '../types/canvas';

/**
 * Save a stroke to the database
 * Returns the stroke ID from the database
 * Non-blocking - errors are returned, not thrown
 */
export async function saveStroke(projectId: string, stroke: Stroke): Promise<string> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    const strokeData = {
      project_id: projectId,
      user_id: user.id,
      points: stroke.points,
      color: stroke.color,
      stroke_width: stroke.strokeWidth,
      tool: stroke.tool,
    };

    const { data, error } = await supabase
      .from('strokes')
      .insert([strokeData])
      .select('id')
      .single();

    if (error) {
      console.error('Failed to save stroke:', error);
      throw error;
    }

    return data.id;
  } catch (error) {
    console.error('Error in saveStroke:', error);
    throw error;
  }
}

/**
 * Load all strokes for a project
 * Returns strokes in drawing order (oldest first)
 * Single batch query - no per-stroke rendering
 */
export async function loadStrokes(projectId: string): Promise<Stroke[]> {
  try {
    const { data, error } = await supabase
      .from('strokes')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Failed to load strokes:', error);
      throw error;
    }

    // Transform DB format to client format
    const strokes: Stroke[] = (data as StrokeDTO[]).map(dto => ({
      id: dto.id,
      points: dto.points,
      color: dto.color,
      strokeWidth: dto.stroke_width,
      tool: dto.tool as 'pen' | 'eraser',
    }));

    return strokes;
  } catch (error) {
    console.error('Error in loadStrokes:', error);
    return []; // Return empty array on error - don't crash
  }
}

/**
 * Delete a stroke from the database
 * For future undo feature
 */
export async function deleteStroke(strokeId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('strokes')
      .delete()
      .eq('id', strokeId);

    if (error) {
      console.error('Failed to delete stroke:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in deleteStroke:', error);
    throw error;
  }
}
