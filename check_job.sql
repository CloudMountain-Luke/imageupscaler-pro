SELECT 
  id,
  status,
  current_stage,
  total_stages,
  prediction_id,
  current_output_url,
  final_output_url,
  error_message,
  chain_strategy->>'qualityMode' as quality_mode,
  created_at
FROM upscale_jobs 
WHERE id = '34136e92-99e4-4b4e-84ad-6b07ad496346';
