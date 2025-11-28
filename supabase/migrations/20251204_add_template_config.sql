-- Add template_config and split_info columns for multi-stage splitting
-- template_config: Pre-calculated stage configurations from templates
-- split_info: Current split state when job is paused for client-side splitting

ALTER TABLE upscale_jobs 
ADD COLUMN IF NOT EXISTS template_config JSONB DEFAULT NULL;

ALTER TABLE upscale_jobs 
ADD COLUMN IF NOT EXISTS split_info JSONB DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN upscale_jobs.template_config IS 'Pre-calculated template configuration defining tile counts and split factors for each stage';
COMMENT ON COLUMN upscale_jobs.split_info IS 'Current split state when job status is needs_split, contains completedStage, nextStage, splitFactor, currentTileCount, expectedTileCount';





