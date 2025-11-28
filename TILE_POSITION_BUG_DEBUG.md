# Tile Position Bug - Enhanced Logging Deployed

**Date**: November 22, 2025  
**Status**: 🔍 Debugging in progress

---

## Summary

✅ **Stage 2 Launch Fix: WORKING!**
- Jobs now successfully progress from 50% → 100% → tiles_ready
- Recovery mechanism fixed

❌ **NEW BUG: Tile Position Calculation**
- Bottom-right tile (tile 4, grid position 1,1) has incorrect coordinates
- Expected: `pos(191,191) size(10×10)`
- Actual: `pos(63,63) size(10×10)`
- Causes tile to be drawn at wrong location on canvas

## What We Know

### From Database (Job 17966002):
```json
[
  {"x": 0, "y": 0, "width": 255, "height": 255, "tile_id": 0},     // ✓ Correct
  {"x": 191, "y": 0, "width": 64, "height": 255, "tile_id": 1},    // ✓ Correct
  {"x": 0, "y": 191, "width": 64, "height": 64, "tile_id": 2},     // ✓ Correct
  {"x": 63, "y": 63, "width": 10, "height": 10, "tile_id": 3}      // ✗ WRONG!
]
```

### Expected Values:
For a 414×413 image with 2×2 grid, tileWidth=223, overlap=32:

| Tile | Grid (tx,ty) | Expected Position | Actual Position | Status |
|------|--------------|-------------------|-----------------|--------|
| 0    | (0,0)        | (0, 0)           | (0, 0)          | ✓ OK   |
| 1    | (1,0)        | (191, 0)         | (191, 0)        | ✓ OK   |
| 2    | (0,1)        | (0, 191)         | (0, 191)        | ✓ OK   |
| 3    | (1,1)        | (191, 191)       | (63, 63)        | ✗ BUG  |

### Position Calculation Formula:
```typescript
const x = tx * grid.tileWidth - (tx > 0 ? grid.overlap : 0);
const y = ty * grid.tileHeight - (ty > 0 ? grid.overlap : 0);
```

For tile 3 (tx=1, ty=1):
- Expected: x = 1 * 223 - 32 = 191, y = 1 * 223 - 32 = 191
- Actual: x = 63, y = 63

**If x = 63, then solving backwards:**
```
63 = 1 * tileWidth - 32
tileWidth = 95
```

This suggests that either:
1. `grid.tileWidth` is 95 instead of 223 (but logs show 223!)
2. The formula is being calculated incorrectly
3. There's a bug in the loop logic

---

## Enhanced Logging Deployed

I've added detailed debug logging to `supabase/functions/upscale-init/index.ts` in the `splitImageIntoTiles` function:

### New Logs Will Show:
```
[Tiling Debug] Grid (tx,ty): calculated x=XXX, y=YYY (tileWidth=223, tileHeight=223, overlap=32)
[Tiling Debug] Calculated width=XXX, height=YYY (image: 414×413)
[Tiling] Tile X/4: pos(finalX,finalY) size(finalWidth×finalHeight) [before clamp: pos(x,y) size(width×height)]
```

This will show:
- The grid position (tx, ty)
- The calculated x, y BEFORE clamping
- The grid parameters being used
- The image dimensions
- The calculated width/height
- The final values AFTER clamping

---

## Next Steps

### 1. Test Again

Please upload the **same 414×413 dog image** at **12× scale** again.

### 2. Check Supabase Logs

Go to: **Supabase Dashboard → Edge Functions → upscale-init → Logs**

Look for entries like:
```
[Tiling Debug] Grid (1,1): calculated x=191, y=191 (tileWidth=223, tileHeight=223, overlap=32)
[Tiling Debug] Calculated width=223, height=222 (image: 414×413)
[Tiling] Tile 4/4: pos(191,191) size(223×222) [before clamp: pos(191,191) size(223×222)]
```

**OR** if the bug is still present:
```
[Tiling Debug] Grid (1,1): calculated x=63, y=63 (tileWidth=95, tileHeight=95, overlap=32)
[Tiling Debug] Calculated width=10, height=10 (image: 255×255)
[Tiling] Tile 4/4: pos(63,63) size(10×10) [before clamp: pos(63,63) size(10×10)]
```

### 3. Provide Logs

Please copy and paste:
- The full `[Tiling Debug]` lines for **all 4 tiles**
- The `[Tiling] Splitting...` line
- The `[Tiling] Grid:` line

---

## Hypothesis

Based on the data, I suspect one of these issues:

### A) Grid Calculation Bug
The grid might be calculated with different dimensions than expected. Maybe:
- `grid.tileWidth` is being calculated as 95 instead of 223
- The grid calculation formula on line 354 has a bug

### B) Image Dimension Issue
The image being decoded in `splitImageIntoTiles` might be:
- 255×255 instead of 414×413
- Getting resized or cropped somewhere

### C) Loop/Index Bug
Maybe the tiles are being indexed or ordered incorrectly, causing tile 4 to use parameters from a different position.

The enhanced logging will reveal which of these is the actual issue!

---

## Files Modified

- ✅ `supabase/functions/upscale-init/index.ts` - Added enhanced debug logging (lines 411-434)
- ✅ Deployed at: 2025-11-22T02:10:00Z

---

**Ready for testing!** Please run the same upscale again and provide the debug logs.

