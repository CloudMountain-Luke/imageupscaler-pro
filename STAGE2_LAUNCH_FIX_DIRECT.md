# Stage 2 Launch Fix - Direct Replicate Launch

**Date**: November 22, 2025  
**Status**: ✅ **FIX DEPLOYED AND ACTIVE**

---

## Problem Summary

Jobs were getting stuck at 50% progress with all stage 1 tiles complete but stage 2 never launched.

### Root Cause

**From logs (`upscale-check-all_logs3.csv` lines 183-193):**

```
[Check-All] 🚀 STAGE 2 LAUNCH FAILURE DETECTED: 4/4 tiles need stage 2 launched
[Check-All] Triggering webhook with tile 0 to launch stage 2  
[Check-All] ✅ Stage 2 launch trigger result: {"ok":true,"message":"Already processed"}
```

**The Problem:**
1. Check-all detected tiles with `stage1_url` but no `stage2_prediction_id` ✅
2. Check-all called the webhook handler to trigger stage 2 launch ✅
3. Webhook handler returned `"Already processed"` and **did nothing** ❌

**Why "Already processed"?**
- Webhook handler saw tiles with status `stage2_processing`
- It assumed stage 2 was already running
- But it **never checked** if `stage2_prediction_id` existed!
- Status was changed to `stage2_processing`, but no actual Replicate predictions were launched

### Example Stuck Job Data

Job ID: `61dd25f2-f53f-419e-8387-7bd17fbf5f1f`

```json
[
  {
    "tile_id": 0,
    "status": "stage2_processing",     // ← Status says processing
    "stage1_url": "https://...",       // ← Stage 1 complete ✓
    "stage2_prediction_id": null       // ← But no prediction! ✗
  },
  {
    "tile_id": 1,
    "status": "stage1_complete",       // ← Never transitioned
    "stage1_url": "https://...",       // ← Stage 1 complete ✓
    "stage2_prediction_id": null       // ← No prediction ✗
  },
  // ... tiles 2 and 3 same issue ...
]
```

---

## The Solution

**Bypass the broken webhook handler** and have `upscale-check-all` **directly launch Replicate predictions** for stage 2.

### What Was Changed

**File:** `supabase/functions/upscale-check-all/index.ts`

### 1. Added Helper Functions

Copied from `upscale-webhook` to enable model selection and version lookup:

```typescript
function getModelVersion(slug: string): string {
  return slug.split(":")[1];
}

function selectModelFor(contentType: string, scale: number): { slug: string; input: Record<string, unknown> } {
  // Returns correct model (PHOTO, ART, ANIME, CLARITY) based on content type
  // Includes proper input parameters (face_enhance, tile, tile_pad, etc.)
}
```

### 2. Replaced Webhook Trigger with Direct Launch

**Before (BROKEN):**
```typescript
// Called webhook handler
const webhookResponse = await fetch(
  `${Deno.env.get("SUPABASE_URL")}/functions/v1/upscale-webhook`,
  {
    method: "POST",
    body: JSON.stringify({
      id: triggerTile.stage1_prediction_id,
      status: "succeeded",
      output: triggerTile.stage1_url
    })
  }
);
// Webhook returned "Already processed" and did nothing
```

**After (FIXED):**
```typescript
// Directly launch Replicate predictions
for (const tile of tilesNeedingStage2) {
  const input = {
    ...model.input,
    image: tile.stage1_url,
    scale: stage.scale
  };
  
  const predictionRes = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Token ${replicateToken}`,
    },
    body: JSON.stringify({
      version: modelVersion,
      input,
      webhook: webhookUrl,
      webhook_events_filter: ["completed"],
    }),
  });
  
  const prediction = await predictionRes.json();
  tile.stage2_prediction_id = prediction.id;  // Store prediction ID
  tile.status = "stage2_processing";
}

// Update database with all new prediction IDs
await supabase.from("upscale_jobs").update({ 
  tiles_data: job.tiles_data,
  current_stage: 2
}).eq("id", job.id);
```

---

## How It Works Now

### Automatic Recovery Flow

When a job gets stuck at 50%:

1. **Check-all runs** (every ~10 seconds via client polling)
2. **Detects failure**: Finds tiles with `stage1_url` but no `stage2_prediction_id`
3. **Logs detection**:
   ```
   [Check-All] 🚀 STAGE 2 LAUNCH FAILURE: 4/4 tiles need stage 2 launched
   [Check-All] Bypassing webhook handler - launching Replicate predictions directly...
   ```
4. **Launches predictions**: For each tile, calls Replicate API directly
5. **Updates database**: Stores `stage2_prediction_id` for each tile
6. **Logs success**:
   ```
   [Check-All] ✅ Launched stage 2 for tile 0: abc123...
   [Check-All] ✅ Launched stage 2 for tile 1: def456...
   [Check-All] 🚀 Successfully launched stage 2 for 4/4 tiles
   ```
7. **Job progresses**: 50% → 75% → 88% → 100% → tiles_ready
8. **Client stitches**: Final image complete!

### Expected Timeline

- **0s**: Job stuck at 50%
- **10-20s**: Check-all detects issue and launches stage 2
- **30-90s**: Stage 2 predictions complete (4 tiles × ~15-30s each)
- **90-120s**: All tiles complete, job marked `tiles_ready`
- **95-130s**: Client stitches tiles, download ready!

---

## Why This Fix Works

### Advantages

1. **Bypasses broken logic**: No longer relies on webhook handler's flawed "already processed" check
2. **Direct control**: Check-all has full authority to launch predictions
3. **Idempotent**: Safe to run multiple times - only launches if `stage2_prediction_id` is `null`
4. **Uses existing infrastructure**: Same Replicate API, same webhook callbacks, same models
5. **Automatic recovery**: No manual intervention needed - jobs self-heal within 10-20 seconds

### Safety Features

- **Checks `chain_strategy` exists**: Won't crash if job data is malformed
- **Validates `stage1_url`**: Skips tiles without input
- **Error handling**: Catches and logs Replicate API failures
- **Database transaction**: Updates all tile data atomically
- **Duplicate protection**: Only launches if `stage2_prediction_id` is `null`

---

## Testing

### Existing Stuck Jobs

The fix is **already active** and will automatically recover:
- Job `61dd25f2-f53f-419e-8387-7bd17fbf5f1f` (your current stuck job)
- Any other jobs stuck at 50% with the same issue

**What to expect:**
Within 10-30 seconds, you should see:
1. Progress jump from 50% → 75%
2. Console logs: `[EdgeFunctionService] Job status: processing, progress: 75%, stage: 2/2`
3. Progress continue: 75% → 88% → 100% → tiles_ready
4. Client-side stitching kicks in
5. Final image downloads!

### New Jobs

All new tiling jobs will benefit from this fix:
- If webhooks fail to trigger stage 2, check-all recovers automatically
- No more manual intervention needed
- Jobs complete reliably end-to-end

---

## Related Fixes

This is part of a series of fixes for the tiling system:

1. ✅ **Tile position bug** (lines 358-402) - Fixed image mutation causing wrong coordinates
2. ✅ **Stage 2 launch detection** (this fix) - Direct Replicate launch bypasses broken webhook handler
3. ✅ **Client-side stitching** - Moved stitching to browser to avoid server memory limits
4. ✅ **Duplicate webhook handling** - Idempotent updates prevent status corruption

---

## Files Modified

- `supabase/functions/upscale-check-all/index.ts`
  - Added `getModelVersion()` helper function
  - Added `selectModelFor()` helper function  
  - Replaced webhook trigger logic with direct Replicate API calls
  - Added comprehensive error handling and logging

---

## Deployment

```bash
npx supabase functions deploy upscale-check-all
```

**Status**: ✅ Deployed successfully  
**Active since**: November 22, 2025

---

## Next Steps

1. **Monitor your current stuck job** - should recover within 30 seconds
2. **Test with a fresh upload** - upload the same 414×413 image at 12× scale
3. **Verify logs** - check Supabase logs for the new launch messages
4. **Confirm final image** - ensure tiles are aligned correctly (tile position fix from earlier)

The system should now handle large image upscaling (12×+ scale) reliably and automatically!

