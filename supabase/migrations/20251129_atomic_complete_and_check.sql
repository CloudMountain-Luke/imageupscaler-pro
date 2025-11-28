-- Single atomic RPC that updates a tile AND checks if all tiles completed the stage
-- This prevents race conditions where separate update/check calls see inconsistent data

-- Drop old functions that are no longer needed
DROP FUNCTION IF EXISTS update_tile_data(UUID, INT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS get_job_for_stage_check(UUID);

-- Main atomic function: updates tile status/URL and checks if stage is complete
-- Returns the updated tiles_data and whether all tiles completed
CREATE OR REPLACE FUNCTION complete_tile_and_check_stage(
  p_job_id UUID,
  p_tile_id INT,
  p_status TEXT,
  p_stage_url TEXT,
  p_stage INT
) RETURNS TABLE (
  all_complete BOOLEAN,
  tiles_data JSONB,
  total_stages INT,
  current_stage INT,
  chain_strategy JSONB,
  content_type TEXT,
  using_tiling BOOLEAN,
  tile_grid JSONB
) AS $$
DECLARE
  url_key TEXT;
  target_status TEXT;
BEGIN
  url_key := 'stage' || p_stage || '_url';
  target_status := 'stage' || p_stage || '_complete';
  
  -- Lock the row and update the tile in one atomic operation
  UPDATE upscale_jobs
  SET tiles_data = (
    SELECT jsonb_agg(
      CASE 
        WHEN (elem->>'tile_id')::int = p_tile_id THEN
          elem 
          || jsonb_build_object('status', p_status)
          || jsonb_build_object(url_key, p_stage_url)
        ELSE elem
      END
    )
    FROM jsonb_array_elements(upscale_jobs.tiles_data) elem
  )
  WHERE id = p_job_id;
  
  -- Return the updated data with completion check
  -- The completion check happens AFTER the update, in the same transaction
  RETURN QUERY
  SELECT 
    -- Check if all non-failed tiles have completed this stage
    (
      SELECT COUNT(*) = 0 OR COUNT(*) FILTER (WHERE elem->>'status' = target_status) = 
             COUNT(*) FILTER (WHERE elem->>'status' != 'failed')
      FROM jsonb_array_elements(j.tiles_data) elem
    ) AS all_complete,
    j.tiles_data,
    j.total_stages,
    j.current_stage,
    j.chain_strategy,
    j.content_type,
    j.using_tiling,
    j.tile_grid
  FROM upscale_jobs j
  WHERE j.id = p_job_id;
END;
$$ LANGUAGE plpgsql;

-- Keep set_tile_processing for launching tiles (with proper locking)
DROP FUNCTION IF EXISTS set_tile_processing(UUID, INT, INT, TEXT);

CREATE OR REPLACE FUNCTION set_tile_processing(
  p_job_id UUID,
  p_tile_id INT,
  p_stage INT,
  p_prediction_id TEXT
) RETURNS VOID AS $$
DECLARE
  status_value TEXT;
  prediction_key TEXT;
BEGIN
  status_value := 'stage' || p_stage || '_processing';
  prediction_key := 'stage' || p_stage || '_prediction_id';
  
  -- Lock and update atomically
  UPDATE upscale_jobs
  SET tiles_data = (
    SELECT jsonb_agg(
      CASE 
        WHEN (elem->>'tile_id')::int = p_tile_id THEN
          elem 
          || jsonb_build_object('status', status_value)
          || jsonb_build_object(prediction_key, p_prediction_id)
        ELSE elem
      END
    )
    FROM jsonb_array_elements(upscale_jobs.tiles_data) elem
  )
  WHERE id = p_job_id;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION complete_tile_and_check_stage TO authenticated;
GRANT EXECUTE ON FUNCTION complete_tile_and_check_stage TO service_role;
GRANT EXECUTE ON FUNCTION set_tile_processing TO authenticated;
GRANT EXECUTE ON FUNCTION set_tile_processing TO service_role;









