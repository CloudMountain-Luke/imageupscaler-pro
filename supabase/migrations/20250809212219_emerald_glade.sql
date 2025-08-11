/*
  # Create upscale_usage table

  1. New Tables
    - `upscale_usage`
      - `id` (uuid, primary key)
      - `created_at` (timestamp with time zone)
      - `user_id` (uuid, foreign key to user_profiles)
      - `upscale_details` (jsonb, optional details about the upscale job)

  2. Security
    - Enable RLS on `upscale_usage` table
    - Add policy for users to select their own usage data
    - Add policy for users to insert their own usage data

  3. Foreign Keys
    - `user_id` references `user_profiles(id)` for data integrity
*/

CREATE TABLE IF NOT EXISTS public.upscale_usage (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    user_id uuid NOT NULL,
    upscale_details jsonb,
    CONSTRAINT upscale_usage_pkey PRIMARY KEY (id),
    CONSTRAINT upscale_usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id)
);

-- Enable RLS on the new table
ALTER TABLE public.upscale_usage ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (good practice)
DROP POLICY IF EXISTS "upscale_usage_select_own" ON public.upscale_usage;
DROP POLICY IF EXISTS "upscale_usage_insert_own" ON public.upscale_usage;

-- Create a policy to allow users to SELECT their own usage data
CREATE POLICY "upscale_usage_select_own"
ON public.upscale_usage
FOR SELECT
USING (auth.uid() = user_id);

-- Create a policy to allow users to INSERT their own usage data
CREATE POLICY "upscale_usage_insert_own"
ON public.upscale_usage
FOR INSERT
WITH CHECK (auth.uid() = user_id);