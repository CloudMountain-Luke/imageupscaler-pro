-- Migration: Atomic tile updates to prevent race conditions
-- This creates RPC functions for atomically updating individual tiles
-- without overwriting concurrent updates to other tiles

-- Function to atomically update a single tile's status and URLs
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
BEGIN
  -- Build the updated tiles_data array atomically
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
  FROM upscale_jobs, jsonb_array_elements(tiles_data) elem
  WHERE id = p_job_id;

  -- Update the job with the new tiles_data
  UPDATE upscale_jobs
  SET tiles_data = updated_tiles,
      updated_at = NOW()
  WHERE id = p_job_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get job with row-level lock for stage completion check
-- This prevents multiple webhooks from simultaneously deciding to launch next stage
CREATE OR REPLACE FUNCTION get_job_for_stage_check(
  p_job_id UUID
) RETURNS TABLE (
  id UUID,
  status TEXT,
  tiles_data JSONB,
  total_stages INT,
  current_stage INT,
  chain_strategy JSONB,
  using_tiling BOOLEAN,
  grid_cols INT,
  grid_rows INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    j.id,
    j.status,
    j.tiles_data,
    j.total_stages,
    j.current_stage,
    j.chain_strategy,
    j.using_tiling,
    j.grid_cols,
    j.grid_rows
  FROM upscale_jobs j
  WHERE j.id = p_job_id
  FOR UPDATE;  -- Row-level lock
END;
$$ LANGUAGE plpgsql;

-- Function to atomically update tile status for stage launch
-- Sets tile to processing and stores prediction ID
CREATE OR REPLACE FUNCTION set_tile_processing(
  p_job_id UUID,
  p_tile_id INT,
  p_stage INT,
  p_prediction_id TEXT
) RETURNS VOID AS $$
DECLARE
  updated_tiles JSONB;
  status_value TEXT;
  prediction_key TEXT;
BEGIN
  status_value := 'stage' || p_stage || '_processing';
  prediction_key := 'stage' || p_stage || '_prediction_id';
  
  SELECT jsonb_agg(
    CASE 
      WHEN (elem->>'tile_id')::int = p_tile_id THEN
        elem 
        || jsonb_build_object('status', status_value)
        || jsonb_build_object(prediction_key, p_prediction_id)
      ELSE elem
    END
  ) INTO updated_tiles
  FROM upscale_jobs, jsonb_array_elements(tiles_data) elem
  WHERE id = p_job_id;

  UPDATE upscale_jobs
  SET tiles_data = updated_tiles,
      updated_at = NOW()
  WHERE id = p_job_id;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION update_tile_data TO authenticated;
GRANT EXECUTE ON FUNCTION update_tile_data TO service_role;
GRANT EXECUTE ON FUNCTION get_job_for_stage_check TO authenticated;
GRANT EXECUTE ON FUNCTION get_job_for_stage_check TO service_role;
GRANT EXECUTE ON FUNCTION set_tile_processing TO authenticated;
GRANT EXECUTE ON FUNCTION set_tile_processing TO service_role;

