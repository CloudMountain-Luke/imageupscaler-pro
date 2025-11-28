-- Remove automatic stage advancement from RPC
-- The webhook code needs to check if splitting is required BEFORE advancing the stage
-- Previously, the RPC would advance current_stage automatically, preventing the webhook
-- from pausing the job for client-side splitting

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
  v_all_complete BOOLEAN := FALSE;
BEGIN
  url_key := 'stage' || p_stage || '_url';
  target_status := 'stage' || p_stage || '_complete';
  
  -- Lock the row first to prevent concurrent modifications
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
    -- Stage already advanced by another process, just return updated data
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
    v_all_complete := TRUE;
    -- NOTE: We do NOT advance current_stage here anymore!
    -- The webhook code will decide whether to:
    -- 1. Set status to 'needs_split' for client-side splitting, OR
    -- 2. Advance to next stage and launch tiles
  END IF;
  
  -- Return results
  RETURN QUERY SELECT 
    v_all_complete,
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





