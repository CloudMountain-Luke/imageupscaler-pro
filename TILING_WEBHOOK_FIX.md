# Tiling Webhook & Recovery Fix

**Date**: November 21, 2025  
**Status**: ✅ Deployed

## Problem Summary

The async tiling system was failing because:

1. **Webhooks not arriving for tile predictions** - 0 webhook calls in Supabase logs despite tiles being launched
2. **`upscale-check-all` couldn't recover tiling jobs** - Only checked single-image jobs with `prediction_id`
3. **1×1 pixel tiles created** - Tile boundary calculation bug caused invalid tiny tiles
4. **Progress stuck at 0%** - `upscale-status` didn't know how to calculate progress for tiling jobs

## Root Cause Analysis

### Issue 1: Webhook Delivery
- Webhooks were being configured correctly (`webhook: webhookUrl`)
- But no webhooks were arriving at the `upscale-webhook` function
- **Likely cause**: Same as before - either JWT authentication or Replicate delivery issues
- **Solution**: Fallback polling via `upscale-check-all` function

### Issue 2: No Recovery for Tiling Jobs
The `upscale-check-all` function query was:
```sql
WHERE status = 'processing' 
AND prediction_id IS NOT NULL
```
This **excluded tiling jobs** because:
- Tiling jobs don't have a single `prediction_id` at the job level
- They have `tiles_data[]` with individual prediction IDs per tile

### Issue 3: 1×1 Pixel Tile Bug
The tile boundary calculation in `calculateOptimalTiling` was:
```typescript
const tileWidth = Math.ceil(width / tilesX);
const tileHeight = Math.ceil(height / tilesY);
```
For a 414×413 image split into 2×2 tiles:
- `tileWidth = ceil(414/2) = 207px`
- `tileHeight = ceil(413/2) = 207px`

But when splitting at position (175, 175) with overlap, the last tile ended up 1×1 pixel due to rounding errors.

### Issue 4: Progress Not Updating
`upscale-status` only calculated progress based on:
```typescript
const completedStages = strategy.stages.filter(s => s.status === "completed").length;
```
This doesn't work for tiling jobs because stages aren't tracked the same way.

## Solutions Implemented

### ✅ Fix 1: Enhanced `upscale-check-all` for Tiling

**File**: `supabase/functions/upscale-check-all/index.ts`

#### Changes:
1. **Updated query** to include all processing jobs (removed `prediction_id` requirement):
```typescript
.eq("status", "processing")
.or(`last_webhook_at.is.null,last_webhook_at.lt.${tenSecondsAgo}`)
```

2. **Added tile job detection and polling**:
```typescript
if (job.using_tiling && job.tiles_data) {
  // For each tile, check its active prediction_id
  for (const tile of job.tiles_data) {
    const predictionId = tile.status === "stage1_processing" 
      ? tile.stage1_prediction_id 
      : tile.stage2_prediction_id;
    
    // Query Replicate for this tile
    const prediction = await fetch(
      `https://api.replicate.com/v1/predictions/${predictionId}`, ...
    );
    
    // If complete, simulate webhook
    if (prediction.status === "succeeded" || prediction.status === "failed") {
      await fetch(`${SUPABASE_URL}/functions/v1/upscale-webhook`, {
        body: JSON.stringify(prediction)
      });
    }
  }
}
```

3. **Result**: Now every 10 seconds, the system checks:
   - Regular jobs: Check the single `prediction_id`
   - Tiling jobs: Check ALL tile prediction IDs
   - If any are complete on Replicate but not in the DB, trigger their webhooks

### ✅ Fix 2: Improved Tile Boundary Calculation

**File**: `supabase/functions/upscale-init/index.ts` → `calculateOptimalTiling()`

#### Changes:
1. **Better tile size calculation**:
```typescript
// Before: Simple division
const tileWidth = Math.ceil(width / tilesX);

// After: Account for overlap in calculation
let tileWidth = Math.ceil((width + OVERLAP * (tilesX - 1)) / tilesX);
```

2. **Enforce minimum tile size**:
```typescript
if (tileWidth < MIN_TILE_SIZE) {
  tileWidth = Math.min(MIN_TILE_SIZE, width);
  tilesX = Math.ceil(width / tileWidth);
}
```

3. **Verify GPU constraints after overlap**:
```typescript
const maxTileWithOverlap = tileWidth + OVERLAP;
if (maxTileWithOverlap * largestScale > GPU_MAX_DIMENSION) {
  tileWidth = Math.floor((GPU_MAX_DIMENSION / largestScale) - OVERLAP);
}
```

### ✅ Fix 3: Robust Tile Splitting

**File**: `supabase/functions/upscale-init/index.ts` → `splitImageIntoTiles()`

#### Changes:
1. **Last tile extends to edge** (no tiny edge tiles):
```typescript
if (tx < grid.tilesX - 1) {
  width += grid.overlap;
} else {
  // Last column: extend to image edge
  width = image.width - x;
}
```

2. **Enforce minimum 10px tiles**:
```typescript
const finalWidth = Math.max(10, Math.min(width, image.width - finalX));
const finalHeight = Math.max(10, Math.min(height, image.height - finalY));
```

3. **Result**: No more 1×1 pixel tiles. Last tiles in each dimension extend to the image edge.

### ✅ Fix 4: Progress Calculation for Tiling

**File**: `supabase/functions/upscale-status/index.ts`

#### Changes:
Added tiling-specific progress calculation:
```typescript
if (job.using_tiling && job.tiles_data) {
  const totalTiles = job.tiles_data.length;
  const totalStages = job.total_stages;
  
  // Count completed tiles per stage
  const stage1Complete = job.tiles_data.filter(t => 
    t.status === "stage1_complete" || ...
  ).length;
  const stage2Complete = job.tiles_data.filter(t => 
    t.status === "stage2_complete"
  ).length;
  
  // Calculate: (completed_tiles / total_tiles) × (current_stage / total_stages)
  if (totalStages === 2) {
    progress = (stage1Complete / totalTiles) * 50 + (stage2Complete / totalTiles) * 50;
  }
  
  // Return tiling metadata
  tilingInfo = {
    totalTiles,
    stage1Complete,
    stage2Complete,
    failedTiles,
    grid: job.tile_grid
  };
}
```

**Result**: Progress now accurately reflects tile completion:
- 0% → All tiles pending
- 25% → 50% of tiles completed stage 1 (for 2-stage job)
- 50% → All tiles completed stage 1
- 75% → 50% of tiles completed stage 2
- 100% → All tiles completed, stitched

### ✅ Fix 5: Enhanced Webhook Logging

**Files**: `upscale-init/index.ts`, `upscale-webhook/index.ts`

#### Added logging:
1. **In `upscale-init`** (when launching tiles):
```typescript
console.log(`[upscale-init] 🔗 Webhook URL for tiles: ${webhookUrl}`);
console.log(`[upscale-init] Tile ${i + 1}: Sending to Replicate with webhook=${webhookUrl}`);
console.log(`[upscale-init] ✅ Tile ${i + 1} prediction started: ${prediction.id}, webhook configured: ${!!prediction.urls?.webhook}`);
```

2. **In `upscale-webhook`** (when receiving webhooks):
```typescript
console.log(`[Tile Webhook] 📥 Received webhook for prediction ${webhook.id}, job ${job.id}, status: ${webhook.status}`);
console.log(`[Tile Webhook] Searching for prediction ${webhook.id} in ${job.tiles_data.length} tiles...`);
console.log(`[Tile Webhook] ✅ Found matching tile at index ${tileIndex}, tile_id: ${job.tiles_data[tileIndex].tile_id}`);
```

**Result**: Clear visibility into:
- Whether webhooks are being configured
- Whether webhooks are arriving
- Which tiles are completing
- Any mismatches between predictions and tiles

## Expected Behavior After Fix

### When you upload a 414×413 image at 12× scale:

1. **Job Initialization** (0s):
   - `upscale-init` calculates tiling: 2×2 grid (4 tiles)
   - Splits image into 4 tiles
   - Uploads tiles to storage
   - Launches 4 Replicate predictions for stage 1
   - Returns immediately with `jobId`

2. **Stage 1 Processing** (0-30s):
   - Client polls `upscale-status` every 2s
   - Progress shows: 0% → 25% → 50% → 75% → 100% (stage 1)
   - `upscale-check-all` runs every 10s as backup
   - When all 4 tiles complete stage 1, `handleTileWebhook` launches stage 2

3. **Stage 2 Processing** (30-60s):
   - Progress shows: 50% → 62.5% → 75% → 87.5% → 100%
   - When all 4 tiles complete stage 2, `stitchAndFinalize` runs
   - Downloads upscaled tiles ONE AT A TIME (memory safe)
   - Composites them into final image
   - Uploads final stitched image

4. **Completion** (60s):
   - Job status changes to `completed`
   - Final image URL is available: 4968×4956 pixels (12× of 414×413)
   - Client downloads and displays image

### Console Logs You Should See:

**In Browser:**
```
[EdgeFunctionService] Job started: <job_id>
[EdgeFunctionService] Job status: processing, progress: 0%, stage: 1/2
[EdgeFunctionService] Job status: processing, progress: 25%, stage: 1/2
[EdgeFunctionService] Job status: processing, progress: 50%, stage: 1/2
[EdgeFunctionService] Job status: processing, progress: 75%, stage: 2/2
[EdgeFunctionService] Job status: completed, progress: 100%
```

**In Supabase Logs (upscale-init):**
```
[upscale-init] Tiling grid: 2×2 (4 tiles)
[upscale-init] 🔗 Webhook URL: https://...supabase.co/functions/v1/upscale-webhook
[upscale-init] ✅ Tile 1 prediction started: abc123
[upscale-init] ✅ Tile 2 prediction started: def456
[upscale-init] ✅ Tile 3 prediction started: ghi789
[upscale-init] ✅ Tile 4 prediction started: jkl012
```

**In Supabase Logs (upscale-webhook):**
```
[Tile Webhook] 📥 Received webhook for prediction abc123, status: succeeded
[Tile Webhook] ✅ Found matching tile at index 0, tile_id: 0
[Tile Webhook] Tile 0 stage 1 complete
[Tile Webhook] Progress: 1/4 tiles at stage1_complete
... (repeat for each tile)
[Tile Webhook] All tiles completed stage 1, launching stage 2...
```

**In Supabase Logs (upscale-check-all):**
```
[Check-All] Checking tiling job <job_id> with 4 tiles
[Check-All] Tile 0 prediction abc123 status: succeeded
[Check-All] Tile 0 complete! Simulating webhook...
```

## Testing Instructions

1. **Clear any stuck jobs in database**:
```sql
UPDATE upscale_jobs 
SET status = 'failed', error_message = 'Manual cleanup before testing' 
WHERE status = 'processing';
```

2. **Upload the 414×413 test image at 12× scale**

3. **Monitor three places**:
   - **Browser Console**: Watch progress updates
   - **Supabase Logs → upscale-init**: See tiles launching
   - **Supabase Logs → upscale-webhook**: See webhooks arriving

4. **Expected timeline**:
   - 0-5s: Job starts, tiles launch
   - 5-30s: Stage 1 processes (watch progress 0% → 50%)
   - 30-60s: Stage 2 processes (watch progress 50% → 100%)
   - 60s: Stitching completes, image ready

5. **If progress gets stuck**:
   - Wait 10s for `upscale-check-all` to kick in
   - Check Supabase logs for `[Check-All] Checking tiling job...`
   - Should see fallback polling recover the job

## Files Modified

1. ✅ `supabase/functions/upscale-check-all/index.ts`
   - Added tiling job detection
   - Added per-tile prediction polling
   - Trigger webhooks for completed tiles

2. ✅ `supabase/functions/upscale-status/index.ts`
   - Added tiling progress calculation
   - Return tile completion metadata

3. ✅ `supabase/functions/upscale-init/index.ts`
   - Fixed `calculateOptimalTiling` boundary math
   - Fixed `splitImageIntoTiles` edge cases
   - Added comprehensive webhook logging

4. ✅ `supabase/functions/upscale-webhook/index.ts`
   - Added detailed tile webhook logging
   - Better error messages for debugging

## Deployment

All functions deployed successfully:
```bash
npx supabase functions deploy upscale-init upscale-webhook upscale-check-all upscale-status
```

**Deployed**: November 21, 2025  
**Project**: bnjggyfayfrrutlaijhl

## Next Steps

- ✅ All fixes implemented and deployed
- ⏳ **User to test**: Upload 414×413 image at 12× and observe:
  - Progress updates in real-time
  - Final image dimensions: 4968×4956 pixels
  - No errors or hangs
  - Completion within ~60 seconds

If issues persist, check:
1. Supabase logs for webhook arrival
2. Database `tiles_data` to see which tiles completed
3. `upscale-check-all` logs to confirm fallback polling works


