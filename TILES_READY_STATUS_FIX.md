# Tiles Ready Status Fix - Jobs Stuck at 100%

**Date**: November 21, 2025  
**Status**: In Progress

## Problem Summary

Jobs are getting stuck at 100% progress with status "processing" instead of transitioning to "tiles_ready". This prevents client-side stitching from being triggered.

### Symptoms

- Progress shows 100% (all tiles completed stage 2)
- Job status remains "processing" forever
- All webhooks marked as "Duplicate webhook ignored" (this is correct behavior)
- Client never receives "tiles_ready" signal
- No stitching happens

### Current Stuck Job

- **Job ID**: `745efe5f-9a18-4e2a-9315-b167ec4055ae`
- **Progress**: 100% (stage 2/2)
- **Status**: "processing" (should be "tiles_ready")
- **Action**: Will be cancelled manually

## Root Cause Analysis

The webhook handler's transition logic in `handleTileWebhook` has a race condition:

```typescript
// Line 467-472 in upscale-webhook/index.ts
const completedTiles = job.tiles_data.filter((t: TileData) => 
  t.status === targetStatus || t.status === "stage2_complete"
).length;

if (completedTiles.length === job.tiles_data.length) {
  // All stages complete, mark as tiles_ready...
  await supabase.from("upscale_jobs").update({...}).eq("id", job.id);
}
```

**Race Condition**: When multiple tile webhooks arrive nearly simultaneously:
1. Webhook for tile 1 arrives → updates tile 1 to "stage2_complete" → checks count (3/4 complete) → exits
2. Webhook for tile 2 arrives → updates tile 2 to "stage2_complete" → checks count (4/4 complete) → updates status
3. Webhook for tile 3 arrives → updates tile 3 to "stage2_complete" → checks count (4/4 complete) → tries to update status AGAIN
4. Webhook for tile 4 arrives → marked as duplicate, ignored

**Problem**: The database update at step 3 may use STALE job data fetched before tile 4 completed, or the update may fail silently because the job was already modified.

## Solution

### 1. Fix Webhook Handler (Idempotent Status Update)

**File**: `supabase/functions/upscale-webhook/index.ts`

**Changes to `handleTileWebhook` function**:

```typescript
// After updating tiles_data, REFETCH the job to get latest data
const { data: refreshedJob, error: refreshError } = await supabase
  .from("upscale_jobs")
  .select("*")
  .eq("id", job.id)
  .single();

if (refreshError || !refreshedJob) {
  console.error(`[Tile Webhook] Failed to refetch job`);
  return;
}

// Check completion status on FRESH data
const completedTiles = refreshedJob.tiles_data.filter((t: TileData) => 
  t.status === targetStatus || t.status === "stage2_complete"
).length;

console.log(`[Tile Webhook] Progress: ${completedTiles}/${refreshedJob.tiles_data.length} tiles complete`);

if (completedTiles === refreshedJob.tiles_data.length) {
  if (isStage1 && refreshedJob.total_stages > 1) {
    // Launch stage 2...
  } else {
    // ONLY update if status is still "processing" (idempotent)
    const { data: updated, error: updateError } = await supabase
      .from("upscale_jobs")
      .update({
        status: "tiles_ready",
        last_webhook_at: new Date().toISOString()
      })
      .eq("id", refreshedJob.id)
      .eq("status", "processing")  // 🔥 CRITICAL: Only update if still processing
      .select();
    
    if (updateError) {
      console.error(`[Tile Webhook] ❌ FAILED to update status:`, updateError);
    } else if (!updated || updated.length === 0) {
      console.log(`[Tile Webhook] Status already updated (no rows affected)`);
    } else {
      console.log(`[Tile Webhook] ✅ Job ${refreshedJob.id} marked as tiles_ready!`);
    }
  }
}
```

**Key Improvements**:
1. **Refetch job** before checking completion count (ensures fresh data)
2. **Conditional update** with `.eq("status", "processing")` (idempotent)
3. **Check update result** to confirm rows were affected
4. **Better logging** to track exactly what happens

### 2. Add Recovery Mechanism to upscale-check-all

**File**: `supabase/functions/upscale-check-all/index.ts`

**Add new recovery logic** for stuck tiling jobs:

```typescript
// After checking regular jobs, check for stuck tiling jobs
const { data: tilingJobs, error: tilingError } = await supabase
  .from("upscale_jobs")
  .select("*")
  .eq("status", "processing")
  .eq("using_tiling", true)
  .lt("created_at", oldThreshold); // Older than 30 seconds

if (tilingJobs && tilingJobs.length > 0) {
  console.log(`[check-all] Found ${tilingJobs.length} tiling jobs to check`);
  
  for (const job of tilingJobs) {
    // Check if all tiles are complete
    if (!job.tiles_data || !Array.isArray(job.tiles_data)) continue;
    
    const finalStatus = job.total_stages === 1 ? "stage1_complete" : "stage2_complete";
    const completedTiles = job.tiles_data.filter(t => t.status === finalStatus).length;
    const totalTiles = job.tiles_data.length;
    
    console.log(`[check-all] Job ${job.id}: ${completedTiles}/${totalTiles} tiles complete`);
    
    // If all tiles are complete but status is still "processing", fix it
    if (completedTiles === totalTiles && job.status === "processing") {
      console.log(`[check-all] 🔧 RECOVERING stuck job ${job.id} - marking as tiles_ready`);
      
      const { error: fixError } = await supabase
        .from("upscale_jobs")
        .update({
          status: "tiles_ready",
          last_webhook_at: new Date().toISOString()
        })
        .eq("id", job.id)
        .eq("status", "processing");
      
      if (fixError) {
        console.error(`[check-all] Failed to fix job ${job.id}:`, fixError);
      } else {
        console.log(`[check-all] ✅ Successfully recovered job ${job.id}`);
        results.push({
          jobId: job.id,
          action: "recovered_stuck_tiling_job",
          status: "success"
        });
      }
    } else if (completedTiles < totalTiles) {
      // Some tiles are incomplete - check each tile's prediction status on Replicate
      for (const tile of job.tiles_data) {
        const currentPredictionId = job.current_stage === 1 
          ? tile.stage1_prediction_id 
          : tile.stage2_prediction_id;
        
        if (!currentPredictionId) continue;
        
        // Check tile status on Replicate (same logic as regular jobs)...
      }
    }
  }
}
```

**Key Features**:
1. **Detects stuck jobs** with all tiles complete but still "processing"
2. **Auto-recovers** by updating status to "tiles_ready"
3. **Falls back to tile-by-tile checking** if some tiles are incomplete
4. **Logs recovery actions** for debugging

### 3. Cancel Current Stuck Job

**SQL Command** (to be run via Supabase SQL editor or CLI):

```sql
-- Check current state
SELECT id, status, current_stage, total_stages, using_tiling,
       (tiles_data::jsonb) as tiles_data
FROM upscale_jobs 
WHERE id = '745efe5f-9a18-4e2a-9315-b167ec4055ae';

-- Cancel the stuck job
UPDATE upscale_jobs 
SET 
  status = 'failed',
  error_message = 'Job cancelled - stuck at 100% progress. Fixed in deployment.',
  completed_at = NOW()
WHERE id = '745efe5f-9a18-4e2a-9315-b167ec4055ae'
  AND status = 'processing';
```

### 4. Enhanced Logging

Add more detailed logging throughout the process:

```typescript
console.log(`[Tile Webhook] 📊 Tile ${tile.tile_id} stage ${currentStage} status: ${webhook.status}`);
console.log(`[Tile Webhook] 📊 Tiles progress: ${completedTiles}/${job.tiles_data.length} complete`);
console.log(`[Tile Webhook] 🎯 Attempting status update: processing → tiles_ready`);
console.log(`[Tile Webhook] ✅ Status update successful, rows affected: ${updated.length}`);
```

## Testing Plan

### 1. Deploy Fixes
```bash
npx supabase functions deploy upscale-webhook upscale-check-all --no-verify-jwt
```

### 2. Test New Job
- Upload 414×413 test image at 12× scale
- Monitor browser console for progress updates
- Watch for "tiles_ready" status
- Verify client-side stitching triggers
- Confirm final image is 4968×4956 pixels

### 3. Monitor Logs
- Check Supabase logs for "Job XXX marked as tiles_ready!"
- Verify no "Duplicate webhook ignored" errors after first webhook
- Check for any "FAILED to update status" errors

### 4. Test Recovery
- If a job gets stuck, wait 30 seconds
- Verify `upscale-check-all` recovers it automatically
- Check logs for "RECOVERING stuck job"

## Expected Outcomes

### Before Fix
```
Job progress: 0% → 13% → 25% → 38% → 50% → 63% → 88% → 100%
Status: "processing" → "processing" → "processing" (STUCK FOREVER)
Client: Keeps polling, never completes
```

### After Fix
```
Job progress: 0% → 13% → 25% → 38% → 50% → 63% → 88% → 100%
Status: "processing" → "processing" → "tiles_ready" ✅
Client: Detects tiles_ready → Downloads tiles → Stitches in browser → Shows final image
Total time: ~30-35 seconds
```

## Files Modified

1. ✅ `supabase/functions/upscale-webhook/index.ts` - Fix race condition in handleTileWebhook
2. ✅ `supabase/functions/upscale-check-all/index.ts` - Add tiling job recovery
3. ✅ SQL command to cancel stuck job
4. ✅ This documentation file

## Deployment Checklist

- [ ] Cancel stuck job `745efe5f-9a18-4e2a-9315-b167ec4055ae`
- [ ] Update `upscale-webhook` function with idempotent status update
- [ ] Update `upscale-check-all` function with tiling recovery
- [ ] Deploy both functions
- [ ] Test new 12× upscale
- [ ] Verify tiles_ready status is set correctly
- [ ] Verify client-side stitching works
- [ ] Monitor for any new issues

## Success Metrics

✅ Job completes to "tiles_ready" status within 30 seconds  
✅ Client-side stitching triggers automatically  
✅ Final image has correct dimensions (12× original)  
✅ No jobs stuck at 100% progress  
✅ Recovery mechanism catches any missed transitions  

---

**Next Steps**: Execute the fixes and test with a new upscale job.



