-- Fix race condition where multiple webhooks can trigger stage transitions
-- Uses current_stage as a lock to ensure only ONE webhook advances the stage

-- Drop and recreate with proper locking
DROP FUNCTION IF EXISTS complete_tile_and_check_stage(UUID, INT, TEXT, TEXT, INT);

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
  updated_tiles JSONB;
  v_total_stages INT;
  v_current_stage INT;
  v_chain_strategy JSONB;
  v_content_type TEXT;
  v_using_tiling BOOLEAN;
  v_tile_grid JSONB;
  complete_count INT;
  non_failed_count INT;
  v_should_advance BOOLEAN := FALSE;
BEGIN
  url_key := 'stage' || p_stage || '_url';
  target_status := 'stage' || p_stage || '_complete';
  
  -- CRITICAL: Lock the row first to prevent concurrent stage transitions
  -- This ensures only ONE webhook can check/advance the stage at a time
  SELECT 
    j.current_stage,
    j.total_stages,
    j.chain_strategy,
    j.content_type,
    j.using_tiling,
    j.tile_grid
  INTO 
    v_current_stage,
    v_total_stages,
    v_chain_strategy,
    v_content_type,
    v_using_tiling,
    v_tile_grid
  FROM upscale_jobs j
  WHERE j.id = p_job_id
  FOR UPDATE;  -- Row-level lock prevents concurrent modifications
  
  -- Update the tile's status and URL
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
  WHERE id = p_job_id
  RETURNING tiles_data INTO updated_tiles;
  
  -- Check if job's current_stage matches the stage we're completing
  -- If not, another webhook already advanced the stage - don't trigger again
  IF v_current_stage != p_stage THEN
    -- Stage already advanced by another webhook, just return updated data
    RETURN QUERY SELECT 
      FALSE AS all_complete,
      updated_tiles AS tiles_data,
      v_total_stages AS total_stages,
      v_current_stage AS current_stage,
      v_chain_strategy AS chain_strategy,
      v_content_type AS content_type,
      v_using_tiling AS using_tiling,
      v_tile_grid AS tile_grid;
    RETURN;
  END IF;
  
  -- Count tiles that are TRULY complete for this stage:
  -- 1. Has the correct status (e.g., stage1_complete)
  -- 2. Has the stage URL populated (e.g., stage1_url is not null/empty)
  SELECT 
    COUNT(*) FILTER (
      WHERE elem->>'status' = target_status 
      AND elem->>url_key IS NOT NULL 
      AND elem->>url_key != ''
    ),
    COUNT(*) FILTER (WHERE elem->>'status' != 'failed')
  INTO complete_count, non_failed_count
  FROM jsonb_array_elements(updated_tiles) elem;
  
  -- Check if ALL non-failed tiles have completed this stage with URLs
  IF complete_count = non_failed_count AND non_failed_count > 0 THEN
    -- ATOMICALLY advance current_stage to prevent other webhooks from also triggering
    -- This is the key fix: only the FIRST webhook to see all tiles complete will advance
    UPDATE upscale_jobs 
    SET current_stage = p_stage + 1 
    WHERE id = p_job_id 
    AND current_stage = p_stage;  -- Double-check we're still on this stage
    
    -- Check if we actually updated (we won the race)
    IF FOUND THEN
      v_should_advance := TRUE;
      v_current_stage := p_stage + 1;  -- Update local variable for return
    END IF;
  END IF;
  
  -- Return results
  RETURN QUERY SELECT 
    v_should_advance AS all_complete,
    updated_tiles AS tiles_data,
    v_total_stages AS total_stages,
    v_current_stage AS current_stage,
    v_chain_strategy AS chain_strategy,
    v_content_type AS content_type,
    v_using_tiling AS using_tiling,
    v_tile_grid AS tile_grid;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION complete_tile_and_check_stage TO authenticated;
GRANT EXECUTE ON FUNCTION complete_tile_and_check_stage TO service_role;









