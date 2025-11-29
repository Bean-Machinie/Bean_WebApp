-- Migration: Add unique constraint to canvases.project_id for upsert support
-- This allows us to use ON CONFLICT for efficient updates

-- Add unique constraint if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'canvases_project_id_key'
    ) THEN
        ALTER TABLE canvases
        ADD CONSTRAINT canvases_project_id_key UNIQUE (project_id);
    END IF;
END $$;

-- Verify the constraint was added
SELECT
    conname as constraint_name,
    contype as constraint_type
FROM pg_constraint
WHERE conrelid = 'canvases'::regclass
    AND conname = 'canvases_project_id_key';
