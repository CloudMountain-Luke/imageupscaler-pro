-- Add tiling support to upscale_jobs table

-- Add columns for tile tracking
ALTER TABLE upscale_jobs ADD COLUMN IF NOT EXISTS tile_grid JSONB;
ALTER TABLE upscale_jobs ADD COLUMN IF NOT EXISTS tiles_data JSONB;
ALTER TABLE upscale_jobs ADD COLUMN IF NOT EXISTS using_tiling BOOLEAN DEFAULT FALSE;

-- Add comments
COMMENT ON COLUMN upscale_jobs.tile_grid IS 'Grid configuration for tiled processing: {tilesX, tilesY, tileWidth, tileHeight, overlap, totalTiles}';
COMMENT ON COLUMN upscale_jobs.tiles_data IS 'Array of tile objects: [{tile_id, x, y, width, height, stage1_url, stage2_url, status}]';
COMMENT ON COLUMN upscale_jobs.using_tiling IS 'Whether this job uses adaptive tiling';

-- Create index for faster tile job queries
CREATE INDEX IF NOT EXISTS idx_upscale_jobs_using_tiling ON upscale_jobs(using_tiling) WHERE using_tiling = true;


