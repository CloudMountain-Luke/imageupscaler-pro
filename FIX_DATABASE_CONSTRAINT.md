# Fix Database Constraint for tiles_ready Status

**Date**: November 21, 2025  
**Priority**: 🔥 CRITICAL - Blocking all jobs from completing

## Problem

The database CHECK constraint on `upscale_jobs.status` column doesn't include `'tiles_ready'` as a valid status, causing the recovery mechanism to fail with:

```
code: "23514"
message: 'new row for relation "upscale_jobs" violates check constraint "upscale_jobs_status_check"'
```

**Impact**: 
- All 4 tiling jobs are stuck at 100% progress
- Recovery mechanism detects them but can't fix them
- Client-side stitching never triggers

## The Fix

Run this SQL in your Supabase SQL Editor:

### Step 1: Navigate to SQL Editor
1. Go to: https://supabase.com/dashboard/project/bnjggyfayfrrutlaijhl/sql
2. Click "New Query"

### Step 2: Run This SQL

```sql
-- Add 'tiles_ready' status to upscale_jobs constraint
-- This status is used when all tiles are complete and ready for client-side stitching

-- Drop the existing constraint
ALTER TABLE upscale_jobs DROP CONSTRAINT IF EXISTS upscale_jobs_status_check;

-- Add the new constraint with 'tiles_ready' included
ALTER TABLE upscale_jobs ADD CONSTRAINT upscale_jobs_status_check 
CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'partial_success', 'tiles_ready'));

-- Verify the constraint was added
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conname = 'upscale_jobs_status_check';
```

### Step 3: Verify

After running the SQL, you should see output like:

```
conname                      | pg_get_constraintdef
-----------------------------|--------------------------------------------------
upscale_jobs_status_check    | CHECK ((status = ANY (ARRAY['pending'::text, ...
```

## What Happens Next

**Immediately after the constraint is fixed:**

1. **Next `upscale-check-all` run** (within 10-30 seconds):
   - Recovery mechanism will detect the 4 stuck jobs
   - Will update them to `"tiles_ready"` status
   - ✅ Jobs will complete successfully!

2. **Client will detect the status change**:
   - Browser sees `"tiles_ready"` status
   - Downloads 4 tile URLs
   - Stitches image in browser
   - Displays final 4968×4956 image

3. **New upscales will work perfectly**:
   - Webhook handler can set `"tiles_ready"` status
   - No more stuck jobs
   - Client-side stitching works end-to-end

## Stuck Jobs That Will Be Recovered

Once the constraint is fixed, these jobs will auto-recover:

| Job ID | Created | Status Now | Will Become |
|--------|---------|-----------|-------------|
| `91c1cb1e-1101-4886-add5-22b339edc512` | Nov 21, 23:26 | `processing` (100%) | `tiles_ready` ✅ |
| `745efe5f-9a18-4e2a-9315-b167ec4055ae` | Nov 21, 21:05 | `processing` (100%) | `tiles_ready` ✅ |
| `22a2ed02-b236-4e11-910a-ee4584aa7be2` | Nov 21, 18:27 | `processing` (100%) | `tiles_ready` ✅ |
| `fe79b505-40cc-4518-a591-320e39d279e9` | Nov 21, 05:26 | `processing` (100%) | `tiles_ready` ✅ |

## Expected Recovery Timeline

```
T+0s:   You run the SQL → Constraint updated
T+10s:  Client calls check-all → Detects stuck jobs
T+11s:  Recovery updates all 4 jobs to "tiles_ready"
T+12s:  Client detects "tiles_ready" for current job
T+15s:  Browser downloads 4 tiles
T+18s:  Browser stitches image
T+20s:  ✅ Final image displayed!
```

## Verification

After running the SQL, check the Supabase logs for `upscale-check-all`:

**Expected log messages:**
```
[Check-All] 🔧 RECOVERING stuck job 91c1cb1e... - all 4 tiles complete
[Check-All] ✅ Successfully recovered job 91c1cb1e... - marked as tiles_ready!
```

**No more errors like:**
```
[Check-All] ❌ Failed to recover job ... violates check constraint
```

## Why This Happened

The migration file `supabase/migrations/20251121_115515_tiles_ready_status.sql` was created but never executed because:
1. CLI had npm permission errors
2. Database connection URL format issues
3. File was in `supabase/migrations/` but not applied to remote database

The migration file has been replaced with: `supabase/migrations/20251121_add_tiles_ready_status.sql`

## Migration File Location

For future reference, the migration is stored at:
```
/Users/0ne/imageupscaler-pro/supabase/migrations/20251121_add_tiles_ready_status.sql
```

This ensures the constraint is properly set for any future deployments or local development.

---

## 🚀 Next Steps

1. ✅ Run the SQL above in Supabase Dashboard
2. ⏸️ Wait 10-30 seconds for recovery to kick in
3. ✅ Refresh your browser on the stuck job
4. ✅ Watch it complete with client-side stitching!
5. ✅ Test a new 12× upscale to verify end-to-end

**Once this is done, EVERYTHING should work perfectly!** 🎉



