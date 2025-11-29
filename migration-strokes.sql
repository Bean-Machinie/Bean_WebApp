-- Phase 3: Canvas Stroke Persistence System
-- Migration: Create strokes table with indexes and RLS policies

-- Create strokes table for canvas projects
CREATE TABLE IF NOT EXISTS strokes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Stroke data (stored as JSON for atomic stroke operations)
  points JSONB NOT NULL,           -- Array of coordinate pairs [x1, y1, x2, y2, ...]
  color TEXT NOT NULL,              -- Hex color code
  stroke_width INTEGER NOT NULL,    -- Brush size in pixels
  tool TEXT NOT NULL,               -- 'pen' or 'eraser'

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_tool CHECK (tool IN ('pen', 'eraser')),
  CONSTRAINT valid_stroke_width CHECK (stroke_width >= 1 AND stroke_width <= 50),
  CONSTRAINT valid_color CHECK (color ~ '^#[0-9A-Fa-f]{6}$')
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_strokes_project_id ON strokes(project_id);
CREATE INDEX IF NOT EXISTS idx_strokes_created_at ON strokes(project_id, created_at);

-- Row Level Security
ALTER TABLE strokes ENABLE ROW LEVEL SECURITY;

-- Users can only see their own strokes
CREATE POLICY "Users can view own strokes" ON strokes
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own strokes
CREATE POLICY "Users can insert own strokes" ON strokes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can delete their own strokes (for future undo feature)
CREATE POLICY "Users can delete own strokes" ON strokes
  FOR DELETE USING (auth.uid() = user_id);
