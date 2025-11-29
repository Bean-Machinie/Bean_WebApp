-- Cleanup Obsolete Canvas Tables
-- We now use the simplified 'canvases' table with JSON storage
-- These tables are no longer needed:
--   - strokes (old per-stroke storage)
--   - canvas_configs, canvas_layers, canvas_strokes, canvas_versions (unused complex structure)

-- IMPORTANT: This will delete ALL data in these tables!
-- Make sure you've migrated any important data to the new canvases table first.

-- Drop the old strokes table (replaced by canvases.canvas_data)
DROP TABLE IF EXISTS public.strokes CASCADE;

-- Drop the unused complex canvas structure
DROP TABLE IF EXISTS public.canvas_strokes CASCADE;
DROP TABLE IF EXISTS public.canvas_layers CASCADE;
DROP TABLE IF EXISTS public.canvas_configs CASCADE;
DROP TABLE IF EXISTS public.canvas_versions CASCADE;

-- Verify what tables remain
SELECT
    tablename,
    schemaname
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Expected remaining tables:
-- - assets
-- - canvases (this is what we use now!)
-- - profiles
-- - projects
