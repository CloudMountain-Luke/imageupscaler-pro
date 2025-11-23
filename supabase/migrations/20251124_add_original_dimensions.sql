-- Add original image dimensions to upscale_jobs table
-- These are needed for server-side downscaling of Art & Illustrations

ALTER TABLE upscale_jobs
ADD COLUMN IF NOT EXISTS original_width INT,
ADD COLUMN IF NOT EXISTS original_height INT;

-- Add comment explaining the columns
COMMENT ON COLUMN upscale_jobs.original_width IS 'Original image width in pixels (before upscaling)';
COMMENT ON COLUMN upscale_jobs.original_height IS 'Original image height in pixels (before upscaling)';

