import { Quality, Scale } from './types';

export type ReplicateModelInfo = {
  slug: string;
  input: Record<string, unknown>;
  supportsOutscale: boolean;
  nativeScales: number[];
  maxOutscale?: number;
};

export type OrchestrationStep = {
  slug: string;
  scale: number;
  outscale?: number;
  input: Record<string, unknown>;
};

const PHOTO_MODEL: ReplicateModelInfo = {
  slug: 'nightmareai/real-esrgan:42fed1c4974146d4d2414e2be2c5277c7fcf05fcc3a73abf41610695738c1d7b',
  input: { face_enhance: true },
  supportsOutscale: true,
  nativeScales: [2, 4],
  maxOutscale: 4,
};

const ART_TEXT_MODEL: ReplicateModelInfo = {
  slug: 'jingyunliang/swinir:660d922d33153019e8c263a3bba265de882e7f4f70396546b6c9c8f9d47a021a',
  input: {},
  supportsOutscale: false,
  nativeScales: [2, 4],
};

const ANIME_MODEL: ReplicateModelInfo = {
  slug: 'cjwbw/real-esrgan:d0ee3d708c9b911f122a4ad90046c5d26a0293b99476d697f6bb7f2e251ce2d4',
  input: { anime: true },
  supportsOutscale: true,
  nativeScales: [2, 4],
  maxOutscale: 4,
};

const ANIME_SMALL_MODEL: ReplicateModelInfo = {
  slug: 'shreejalmaharjan-27/waifu2x:8cd6c1cee46a1ceebce8f3d4e4d1f1a6e296f4d3d1d3a0e6319c8c9b1b2c2a9',
  input: {},
  supportsOutscale: false,
  nativeScales: [2],
};

const CONTROLNET_TILE_MODEL: ReplicateModelInfo = {
  slug: 'cjwbw/controlnet-tile-resize:ba56d5417f3f2cfb8647dd0a1059159f061d7abf6c88c88cba41c4d1aba2fe66',
  input: {
    model: 'ControlNetTile',
    prompt: 'high quality detailed upscale with preserved structure',
    negative_prompt: 'blurry, artifacts, distortions',
    tile_size: 512,
  },
  supportsOutscale: true,
  nativeScales: [2, 4],
  maxOutscale: 4,
};

function withPhotoModel(scale: number, faceEnhance: boolean): ReplicateModelInfo {
  return {
    ...PHOTO_MODEL,
    input: { ...PHOTO_MODEL.input, face_enhance: faceEnhance && scale <= 4 },
  };
}

function resolveModelForSegment(category: Quality, scale: number): ReplicateModelInfo {
  switch (category) {
    case 'photo':
      // Photo ESRGAN handles 2x/4x natively and supports outscale for intermediate factors
      return withPhotoModel(scale, true);

    case 'art':
    case 'text':
      if (scale <= 2) {
        // Use photo ESRGAN for low factors to maintain detail without artifacts
        return withPhotoModel(scale, false);
      }
      if (scale <= 4) {
        return { ...ART_TEXT_MODEL };
      }
      // Higher factors rely on photo ESRGAN which supports outscale chaining
      return withPhotoModel(scale, false);

    case 'anime':
      if (scale <= 2) {
        return { ...ANIME_SMALL_MODEL };
      }
      if (scale <= 4) {
        return { ...ANIME_MODEL };
      }
      // Anime ESRGAN supports outscale for intermediate factors beyond 4x
      return { ...ANIME_MODEL };

    default:
      return withPhotoModel(scale, true);
  }
}

export function selectModelFor(
  category: Quality,
  scale: number,
  options: { maxDetail?: boolean; userSelectedModel?: string } = {}
): ReplicateModelInfo {
  if (options.userSelectedModel && options.userSelectedModel !== 'auto') {
    const explicitModel = getModelById(options.userSelectedModel, scale);
    if (typeof console !== 'undefined') {
      console.info('[ModelSelect] user-selected model', {
        category,
        requestedScale: scale,
        slug: explicitModel.slug,
      });
    }
    return explicitModel;
  }

  if (options.maxDetail && scale >= 4) {
    if (typeof console !== 'undefined') {
      console.info('[ModelSelect] max-detail override', {
        category,
        requestedScale: scale,
        slug: CONTROLNET_TILE_MODEL.slug,
      });
    }
    return CONTROLNET_TILE_MODEL;
  }

  const resolved = resolveModelForSegment(category, scale);
  if (typeof console !== 'undefined') {
    console.info('[ModelSelect] automatic selection', {
      category,
      requestedScale: scale,
      slug: resolved.slug,
    });
  }
  return resolved;
}

function getModelById(modelId: string, scale: number): ReplicateModelInfo {
  switch (modelId) {
    case 'photo-real-esrgan':
      return withPhotoModel(scale, true);
    case 'art-swinir':
      return { ...ART_TEXT_MODEL };
    case 'anime-real-esrgan':
      return { ...ANIME_MODEL };
    case 'anime-waifu2x':
      return { ...ANIME_SMALL_MODEL };
    case 'controlnet-tile':
      return { ...CONTROLNET_TILE_MODEL };
    default:
      return withPhotoModel(scale, true);
  }
}

function getSmartModelForScale(category: Quality, scale: number): ReplicateModelInfo | null {
  // Legacy helper is now a thin wrapper around the new resolver to maintain backwards compatibility
  return resolveModelForSegment(category, scale);
}

export function buildScaleChain(target: number): number[] {
  const chain: number[] = [];
  let remaining = target;

  while (remaining > 4) {
    chain.push(4);
    remaining /= 4;
  }

  if (remaining > 1) {
    chain.push(remaining);
  }

  return chain;
}

export function createOrchestrationSteps(
  category: Quality,
  targetScale: number,
  options: { maxDetail?: boolean; userSelectedModel?: string } = {}
): OrchestrationStep[] {
  const chain = buildScaleChain(targetScale);
  const steps: OrchestrationStep[] = [];

  for (const segment of chain) {
    if (segment <= 1) {
      continue;
    }

    const model = selectModelFor(category, segment, options);

    if (model.nativeScales.includes(segment)) {
      steps.push({ slug: model.slug, scale: segment, input: model.input });
      continue;
    }

    if (model.supportsOutscale && model.nativeScales.length) {
      const base = Math.max(...model.nativeScales.filter(ns => ns <= segment));
      const outscale = segment / base;
      const maxOutscale = model.maxOutscale ?? outscale;
      steps.push({
        slug: model.slug,
        scale: base,
        outscale: Math.min(outscale, maxOutscale),
        input: model.input,
      });
      continue;
    }

    throw new Error('Unable to create orchestration steps with available models.');
  }

  const product = steps.reduce((acc, step) => acc * step.scale * (step.outscale ?? 1), 1);
  if (Math.abs(product - targetScale) > 0.05) {
    throw new Error('Orchestration steps failed to match requested scale.');
  }

  if (typeof console !== 'undefined') {
    console.info('[UpscalePlan] orchestration steps', {
      category,
      targetScale,
      steps: steps.map(step => ({
        slug: step.slug,
        scale: step.scale,
        outscale: step.outscale ?? null,
      })),
    });
  }

  return steps;
}
