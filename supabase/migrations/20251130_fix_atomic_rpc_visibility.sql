-- Fix atomic RPC to ensure UPDATE is visible to completion check
-- AND verify that tiles have their stage URLs before marking stage complete

-- Drop and recreate with fixed logic
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
BEGIN
  url_key := 'stage' || p_stage || '_url';
  target_status := 'stage' || p_stage || '_complete';
  
  -- Update and get the new tiles_data in one operation using RETURNING
  -- This guarantees we see the updated data, not a stale snapshot
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
  RETURNING 
    upscale_jobs.tiles_data,
    upscale_jobs.total_stages,
    upscale_jobs.current_stage,
    upscale_jobs.chain_strategy,
    upscale_jobs.content_type,
    upscale_jobs.using_tiling,
    upscale_jobs.tile_grid
  INTO 
    updated_tiles,
    v_total_stages,
    v_current_stage,
    v_chain_strategy,
    v_content_type,
    v_using_tiling,
    v_tile_grid;
  
  -- CRITICAL: Count tiles that are TRULY complete
  -- A tile is only complete if it has BOTH:
  -- 1. The correct status (e.g., stage1_complete)
  -- 2. The stage URL is populated (e.g., stage1_url is not null/empty)
  -- This prevents launching the next stage before all tiles have their URLs
  SELECT 
    COUNT(*) FILTER (
      WHERE elem->>'status' = target_status 
      AND elem->>url_key IS NOT NULL 
      AND elem->>url_key != ''
    ),
    COUNT(*) FILTER (WHERE elem->>'status' != 'failed')
  INTO complete_count, non_failed_count
  FROM jsonb_array_elements(updated_tiles) elem;
  
  -- Return results
  -- Only mark all_complete = true if EVERY non-failed tile has both status AND URL
  RETURN QUERY SELECT 
    (complete_count = non_failed_count AND non_failed_count > 0) AS all_complete,
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

