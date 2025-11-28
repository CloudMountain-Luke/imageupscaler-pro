-- Fix ALL ambiguous column references in complete_tile_and_check_stage
-- Previous fix only renamed tiles_data, but current_stage etc. also conflict

-- Drop and recreate with ALL columns renamed to avoid conflicts
DROP FUNCTION IF EXISTS complete_tile_and_check_stage(UUID, INT, TEXT, TEXT, INT);

CREATE OR REPLACE FUNCTION complete_tile_and_check_stage(
  p_job_id UUID,
  p_tile_id INT,
  p_status TEXT,
  p_stage_url TEXT,
  p_stage INT
) RETURNS TABLE (
  all_complete BOOLEAN,
  job_tiles_data JSONB,
  job_total_stages INT,
  job_current_stage INT,
  job_chain_strategy JSONB,
  job_content_type TEXT,
  job_using_tiling BOOLEAN,
  job_tile_grid JSONB
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
  FOR UPDATE;
  
  -- Update the tile's status and URL
  UPDATE upscale_jobs j
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
    FROM jsonb_array_elements(j.tiles_data) elem
  )
  WHERE j.id = p_job_id
  RETURNING j.tiles_data INTO updated_tiles;
  
  -- Check if job's current_stage matches the stage we're completing
  IF v_current_stage != p_stage THEN
    RETURN QUERY SELECT 
      FALSE,
      updated_tiles,
      v_total_stages,
      v_current_stage,
      v_chain_strategy,
      v_content_type,
      v_using_tiling,
      v_tile_grid;
    RETURN;
  END IF;
  
  -- Count complete tiles
  SELECT 
    COUNT(*) FILTER (
      WHERE elem->>'status' = target_status 
      AND elem->>url_key IS NOT NULL 
      AND elem->>url_key != ''
    ),
    COUNT(*) FILTER (WHERE elem->>'status' != 'failed')
  INTO complete_count, non_failed_count
  FROM jsonb_array_elements(updated_tiles) elem;
  
  -- Check if ALL non-failed tiles have completed
  IF complete_count = non_failed_count AND non_failed_count > 0 THEN
    -- Atomically advance current_stage using table alias
    UPDATE upscale_jobs j
    SET current_stage = p_stage + 1 
    WHERE j.id = p_job_id 
    AND j.current_stage = p_stage;
    
    IF FOUND THEN
      v_should_advance := TRUE;
      v_current_stage := p_stage + 1;
    END IF;
  END IF;
  
  -- Return results (no column name aliases needed - positional)
  RETURN QUERY SELECT 
    v_should_advance,
    updated_tiles,
    v_total_stages,
    v_current_stage,
    v_chain_strategy,
    v_content_type,
    v_using_tiling,
    v_tile_grid;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION complete_tile_and_check_stage TO authenticated;
GRANT EXECUTE ON FUNCTION complete_tile_and_check_stage TO service_role;









