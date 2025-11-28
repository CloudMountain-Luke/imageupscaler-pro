-- Fix RPC functions to use proper row-level locking
-- The previous version had a race condition: SELECT and UPDATE were not atomic
-- This caused concurrent webhooks to overwrite each other's tile updates

-- Drop existing functions first
DROP FUNCTION IF EXISTS update_tile_data(UUID, INT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS set_tile_processing(UUID, INT, INT, TEXT);

-- Function to atomically update a single tile's status and URLs
-- Uses FOR UPDATE to lock the row during the read-modify-write cycle
CREATE OR REPLACE FUNCTION update_tile_data(
  p_job_id UUID,
  p_tile_id INT,
  p_status TEXT,
  p_stage1_url TEXT DEFAULT NULL,
  p_stage2_url TEXT DEFAULT NULL,
  p_stage3_url TEXT DEFAULT NULL,
  p_stage2_prediction_id TEXT DEFAULT NULL,
  p_stage3_prediction_id TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  updated_tiles JSONB;
  current_tiles JSONB;
BEGIN
  -- First, lock the row and get current tiles_data
  SELECT tiles_data INTO current_tiles
  FROM upscale_jobs
  WHERE id = p_job_id
  FOR UPDATE;  -- Row-level lock prevents concurrent modifications
  
  -- Build the updated tiles_data array
  SELECT jsonb_agg(
    CASE 
      WHEN (elem->>'tile_id')::int = p_tile_id THEN
        elem 
        || jsonb_build_object('status', p_status)
        || CASE WHEN p_stage1_url IS NOT NULL 
           THEN jsonb_build_object('stage1_url', p_stage1_url) 
           ELSE '{}'::jsonb END
        || CASE WHEN p_stage2_url IS NOT NULL 
           THEN jsonb_build_object('stage2_url', p_stage2_url) 
           ELSE '{}'::jsonb END
        || CASE WHEN p_stage3_url IS NOT NULL 
           THEN jsonb_build_object('stage3_url', p_stage3_url) 
           ELSE '{}'::jsonb END
        || CASE WHEN p_stage2_prediction_id IS NOT NULL 
           THEN jsonb_build_object('stage2_prediction_id', p_stage2_prediction_id) 
           ELSE '{}'::jsonb END
        || CASE WHEN p_stage3_prediction_id IS NOT NULL 
           THEN jsonb_build_object('stage3_prediction_id', p_stage3_prediction_id) 
           ELSE '{}'::jsonb END
      ELSE elem
    END
  ) INTO updated_tiles
  FROM jsonb_array_elements(current_tiles) elem;

  -- Update the job with the new tiles_data
  UPDATE upscale_jobs
  SET tiles_data = updated_tiles
  WHERE id = p_job_id;
END;
$$ LANGUAGE plpgsql;

-- Function to atomically update tile status for stage launch
-- Uses FOR UPDATE to lock the row during the read-modify-write cycle
CREATE OR REPLACE FUNCTION set_tile_processing(
  p_job_id UUID,
  p_tile_id INT,
  p_stage INT,
  p_prediction_id TEXT
) RETURNS VOID AS $$
DECLARE
  updated_tiles JSONB;
  current_tiles JSONB;
  status_value TEXT;
  prediction_key TEXT;
BEGIN
  status_value := 'stage' || p_stage || '_processing';
  prediction_key := 'stage' || p_stage || '_prediction_id';
  
  -- First, lock the row and get current tiles_data
  SELECT tiles_data INTO current_tiles
  FROM upscale_jobs
  WHERE id = p_job_id
  FOR UPDATE;  -- Row-level lock prevents concurrent modifications
  
  -- Build the updated tiles_data array
  SELECT jsonb_agg(
    CASE 
      WHEN (elem->>'tile_id')::int = p_tile_id THEN
        elem 
        || jsonb_build_object('status', status_value)
        || jsonb_build_object(prediction_key, p_prediction_id)
      ELSE elem
    END
  ) INTO updated_tiles
  FROM jsonb_array_elements(current_tiles) elem;

  -- Update the job with the new tiles_data
  UPDATE upscale_jobs
  SET tiles_data = updated_tiles
  WHERE id = p_job_id;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION update_tile_data TO authenticated;
GRANT EXECUTE ON FUNCTION update_tile_data TO service_role;
GRANT EXECUTE ON FUNCTION set_tile_processing TO authenticated;
GRANT EXECUTE ON FUNCTION set_tile_processing TO service_role;









