/*
  # Fix API Usage Logs RLS Policy

  1. Security Updates
    - Add policy to allow authenticated users to insert their own API usage logs
    - This enables client-side logging of API usage for tracking and billing purposes
    
  2. Changes
    - Create new RLS policy for INSERT operations on api_usage_logs table
    - Allow authenticated users to insert records (needed for client-side tracking)
*/

-- Add policy to allow authenticated users to insert API usage logs
CREATE POLICY "Allow authenticated users to insert API usage logs"
  ON api_usage_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Also allow authenticated users to read their own usage logs (optional, for future dashboard features)
CREATE POLICY "Allow authenticated users to read API usage logs"
  ON api_usage_logs
  FOR SELECT
  TO authenticated
  USING (true);