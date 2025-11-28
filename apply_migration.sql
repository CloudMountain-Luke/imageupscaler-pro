-- Add original_width and original_height columns to upscale_jobs table
ALTER TABLE upscale_jobs
ADD COLUMN IF NOT EXISTS original_width INT,
ADD COLUMN IF NOT EXISTS original_height INT;

-- Add comments for documentation
COMMENT ON COLUMN upscale_jobs.original_width IS 'Original image width in pixels (before upscaling)';
COMMENT ON COLUMN upscale_jobs.original_height IS 'Original image height in pixels (before upscaling)';

-- Verify the columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'upscale_jobs' 
AND column_name IN ('original_width', 'original_height');
