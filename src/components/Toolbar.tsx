import React, { useMemo, useState, useRef, useEffect } from 'react';
import ImageTypeSelector from './ImageTypeSelector';
import ScaleWheel from './ScaleWheel';
import { getAvailableScalesForImageType } from '../services/modelSelectionService';
import { useThemeLab } from '../contexts/ThemeContext';
import { ChevronDown } from 'lucide-react';
import { IMAGE_TYPES } from '../services/modelSelectionService';
import { estimateTokenCost, formatTokenCost } from '../utils/tokenEstimation';
import { detectBrowser, getBrowserWarning, isScaleSafeForBrowser } from '../utils/browserDetection';
import type { Scale } from '../../shared/types';

interface ToolbarProps {
  upscaleSettings: {
    scale: number;
    quality: string;
    outputFormat: string;
    qualityMode?: 'speed' | 'quality'; // NEW
  };
  onSettingsChange: (settings: any) => void;
  userProfile: any;
  realUserProfile?: any;
  currentProcessing: any;
  onUpscale: () => void;
  latestUploadedFile: any;
  isApiConfigured: boolean;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  upscaleSettings,
  onSettingsChange,
  userProfile,
  realUserProfile,
  currentProcessing,
  onUpscale,
  latestUploadedFile,
  isApiConfigured
}) => {
  const { tone } = useThemeLab();
  
  // Calculate adaptive text color based on tone for WCAG compliance
  // Tone <= 63%: dark/medium backgrounds, use light text (96% lightness)
  // Tone > 63%: light backgrounds, use dark text (12-20% lightness)
  const adaptiveTextColor = useMemo(() => {
    if (tone <= 63) {
      // Dark/medium backgrounds: use light text (WCAG AA: 4.5:1 minimum)
      return 'hsl(0, 0%, 96%)';
    } else {
      // Light backgrounds: use dark text (WCAG AA: 4.5:1 minimum)
      return 'hsl(0, 0%, 12%)';
    }
  }, [tone]);
  
  // Calculate text color for disclaimer text - white/light at 63% and below
  // For high contrast on light backgrounds, use darker shade
  const disclaimerTextColor = useMemo(() => {
    // At 63% and below (dark/medium backgrounds), use white/light text
    if (tone <= 63) {
      return 'hsl(0, 0%, 96%)'; // Light gray/white
    }
    // Above 63%, use darker text for WCAG compliance on light backgrounds
    // Using 25% lightness for better contrast (meets 4.5:1 ratio on light backgrounds)
    return 'hsl(0, 0%, 25%)';
  }, [tone]);
  
  // Calculate muted/secondary text color (for "Drag to adjust" and similar)
  const mutedTextColor = useMemo(() => {
    if (tone <= 63) {
      // Dark/medium backgrounds: use lighter muted text
      return 'hsl(0, 0%, 75%)';
    } else {
      // Light backgrounds: use darker muted text
      return 'hsl(0, 0%, 35%)';
    }
  }, [tone]);

  // Calculate button text color - needs to be dark at high tones (75%+) for visibility
  const buttonTextColor = useMemo(() => {
    if (tone <= 50) {
      // Dark backgrounds: use light text
      return 'hsl(0, 0%, 96%)';
    } else if (tone <= 75) {
      // Medium-light backgrounds (50-75%): still use light text for contrast
      return 'hsl(0, 0%, 96%)';
    } else {
      // Light backgrounds (75%+): use dark text for visibility
      return 'hsl(0, 0%, 12%)';
    }
  }, [tone]);

  // Calculate button border color - always visible greyed-out outline at all tone percentages
  const buttonBorderColor = useMemo(() => {
    if (tone <= 50) {
      // Dark backgrounds: use lighter grey border for visibility
      return 'hsl(0, 0%, 40%)';
    } else {
      // Light backgrounds: use darker grey border for visibility
      return 'hsl(0, 0%, 60%)';
    }
  }, [tone]);
  
  const planInfo = React.useMemo(() => {
    // Infer plan from upscales if subscription_tiers is not loaded
    const inferPlanFromUpscales = (upscales: number | null | undefined): string => {
      if (!upscales) return 'basic';
      if (upscales >= 2750) return 'mega';
      if (upscales >= 1250) return 'enterprise';
      if (upscales >= 500) return 'pro';
      return 'basic';
    };

    // Use realUserProfile if available, otherwise fall back to userProfile
    const profile = realUserProfile || userProfile;

    // Get plan from profile (database profile from context)
    let rawPlan = (
      profile?.subscription_tiers?.name?.toLowerCase()?.trim() ||
      profile?.subscription_tier?.toLowerCase()?.trim() ||
      profile?.subscriptionTier?.toLowerCase()?.trim() ||
      ''
    );
    
    // If subscription_tiers is null/empty but we have monthly_upscales_limit, infer the plan
    if ((!rawPlan || rawPlan === '') && profile?.monthly_upscales_limit) {
      rawPlan = inferPlanFromUpscales(profile.monthly_upscales_limit);
      console.log('[Toolbar] Inferred plan from upscales:', rawPlan, 'from limit:', profile.monthly_upscales_limit);
    }
    
    const plan = (rawPlan || 'basic').toLowerCase();
    console.log('[Toolbar] Plan for scale limits:', plan, {
      hasRealUserProfile: !!realUserProfile,
      hasUserProfile: !!userProfile,
      monthly_upscales_limit: profile?.monthly_upscales_limit,
      subscription_tiers: profile?.subscription_tiers
    });
    
    const allowedForImageType = getAvailableScalesForImageType(
      upscaleSettings.quality, 
      plan as PlanTier
    );
    return { plan, allowedForImageType };
  }, [upscaleSettings.quality, userProfile, realUserProfile]);

  const outputFormats = [
    { value: 'original', label: 'Original' },
    { value: 'jpg', label: 'JPEG' },
    { value: 'png', label: 'PNG' },
    { value: 'webp', label: 'WebP' }
  ];
  const isUpscaleDisabled = !!currentProcessing || !latestUploadedFile || !isApiConfigured;

  // Calculate token cost estimate
  const tokenEstimate = useMemo(() => {
    if (!latestUploadedFile?.file) {
      return { tokens: 1, requiresTiling: false };
    }

    // Get image dimensions from the file
    const img = new Image();
    const url = URL.createObjectURL(latestUploadedFile.file);
    
    return new Promise<{ width: number; height: number }>((resolve) => {
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
        URL.revokeObjectURL(url);
      };
      img.src = url;
    }).then(({ width, height }) => {
      return estimateTokenCost(width, height, upscaleSettings.scale as Scale, upscaleSettings.quality);
    }).catch(() => {
      return { tokens: 1, requiresTiling: false };
    });
  }, [latestUploadedFile, upscaleSettings.scale, upscaleSettings.quality]);

  // Simplified sync version for initial render
  const [tokenCostDisplay, setTokenCostDisplay] = React.useState<string>('1 token');
  
  React.useEffect(() => {
    if (latestUploadedFile?.file) {
      const img = new Image();
      const url = URL.createObjectURL(latestUploadedFile.file);
      
      img.onload = () => {
        const estimate = estimateTokenCost(img.width, img.height, upscaleSettings.scale as Scale, upscaleSettings.quality);
        setTokenCostDisplay(formatTokenCost(estimate));
        URL.revokeObjectURL(url);
      };
      img.src = url;
    } else {
      setTokenCostDisplay('1 token');
    }
  }, [latestUploadedFile, upscaleSettings.scale]);

  // Quality mode helper
  const qualityMode = upscaleSettings.qualityMode || 'speed';
  const setQualityMode = (mode: 'speed' | 'quality') => {
    onSettingsChange({ ...upscaleSettings, qualityMode: mode });
  };

  // Browser detection and warnings
  const browserInfo = useMemo(() => detectBrowser(), []);
  
  const browserWarning = useMemo(() => {
    return getBrowserWarning(browserInfo, upscaleSettings.scale);
  }, [browserInfo, upscaleSettings.scale]);
  
  const scaleDisclaimer = useMemo(() => {
    const isArt = upscaleSettings.quality === 'art' || upscaleSettings.quality === 'text';
    const isHighScale = upscaleSettings.scale >= 20;
    
    if (isArt && isHighScale) {
      return `Art & Illustrations at ${upscaleSettings.scale}x uses multiple SwinIR passes for maximum artistic quality. This may require more tokens, especially for larger images.`;
    }
    
    return null;
  }, [upscaleSettings.quality, upscaleSettings.scale]);

  // Calculate stage count for cost estimation
  const getStageCount = (scale: number): number => {
    if (scale <= 8) return 1;
    const chains: Record<number, number> = {
      10: 2, 12: 2, 16: 2, 24: 3, 32: 3
    };
    return chains[scale] || Math.ceil(Math.log2(scale));
  };

  const estimatedCost = (() => {
    const stages = getStageCount(upscaleSettings.scale);
    const costPerStage = qualityMode === 'quality' ? 0.005 : 0.0025;
    return (stages * costPerStage).toFixed(4);
  })();

  return (
    <div className="w-full toolbar-shell relative z-30 mt-2 sm:mt-4">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 pt-[6px] pb-0 sm:pt-[14px] sm:pb-0">
        {/* Desktop Layout - 1024px+ */}
        <div className="hidden lg:flex items-center justify-center gap-8 relative min-h-[180px] pb-6">
          {/* Left side - Image Type & Processing Mode */}
          <div className="flex flex-col space-y-4 absolute left-0 top-[calc(50%-15px)] -translate-y-1/2 pl-[24px]">
            <div className="flex flex-col space-y-2">
              <label className="text-xs font-medium uppercase tracking-wider" style={{ color: adaptiveTextColor }}>
                Image Type
              </label>
              <ImageTypeSelector
                selectedType={upscaleSettings.quality}
                onTypeChange={(type) => onSettingsChange({ ...upscaleSettings, quality: type })}
                disabled={!!currentProcessing}
              />
            </div>
            
            {/* Processing Mode Toggle */}
            <div className="flex flex-col space-y-2">
              <label className="text-xs font-medium uppercase tracking-wider" style={{ color: adaptiveTextColor }}>
                Processing Mode
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setQualityMode('speed')}
                  disabled={!!currentProcessing}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-all duration-300 ${
                    qualityMode === 'speed' 
                      ? 'text-white shadow-lg'
                      : 'text-gray-400 hover:bg-gray-700/30'
                  } ${!!currentProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  style={qualityMode === 'speed' ? {
                    background: 'linear-gradient(to right, var(--primary), var(--secondary))'
                  } : {
                    backgroundColor: 'rgba(31, 41, 55, 0.5)'
                  }}
                >
                  ⚡ Speed
                </button>
                <button
                  onClick={() => setQualityMode('quality')}
                  disabled={!!currentProcessing}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-all duration-300 ${
                    qualityMode === 'quality' 
                      ? 'text-white shadow-lg'
                      : 'text-gray-400 hover:bg-gray-700/30'
                  } ${!!currentProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  style={qualityMode === 'quality' ? {
                    background: 'linear-gradient(to right, var(--primary), var(--secondary))'
                  } : {
                    backgroundColor: 'rgba(31, 41, 55, 0.5)'
                  }}
                >
                  ✨ Quality
                </button>
              </div>
              {qualityMode === 'quality' && (
                <div className="text-xs text-amber-400 mt-1 max-w-[200px]">
                  ⚠️ Uses 2-4x more credits for enhanced quality
                </div>
              )}
            </div>
          </div>

          {/* Center - Scale Factor dial only */}
          <div className="flex items-center space-x-6 absolute left-[calc(50%+60px)] -translate-x-1/2 top-[calc(50%-35px)] -translate-y-1/2">
            <div className="w-24 h-24 transition-all duration-300" style={{ filter: 'drop-shadow(0 0 12px color-mix(in oklab, var(--primary) 30%, transparent 70%))' }}>
              <ScaleWheel
                scales={planInfo.allowedForImageType}
                selectedScale={upscaleSettings.scale}
                onScaleChange={(scale) => onSettingsChange({ ...upscaleSettings, scale })}
                disabled={!!currentProcessing}
              />
            </div>
            <div className="flex flex-col items-center space-y-1 translate-x-[20px] translate-y-[25px]">
                <div className="text-[21px] font-bold" style={{ color: adaptiveTextColor }}>
                  {upscaleSettings.scale}x
              </div>
              <label className="text-xs font-medium uppercase tracking-wider" style={{ color: adaptiveTextColor }}>
                Scale Factor
              </label>
              <span className="text-[10px]" style={{ color: mutedTextColor }}>Drag to adjust</span>
            </div>
          </div>

          {/* Dynamic disclaimers for scale and browser */}
          {(scaleDisclaimer || browserWarning) && (
            <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 max-w-[600px] text-center pb-5">
              {scaleDisclaimer && (
                <div className="text-[10px] italic mb-1" style={{ 
                  color: tone <= 50 ? 'rgba(255, 200, 100, 0.9)' : 'rgba(150, 100, 30, 0.9)'
                }}>
                  ℹ️ {scaleDisclaimer}
                </div>
              )}
              {browserWarning && (
                <div className="text-[10px] italic" style={{ 
                  color: tone <= 50 ? 'rgba(255, 150, 100, 0.9)' : 'rgba(180, 80, 30, 0.9)'
                }}>
                  ⚠️ {browserWarning}
                </div>
              )}
            </div>
          )}
          {!scaleDisclaimer && !browserWarning && upscaleSettings.scale >= 12 && (
            <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 text-[10px] italic pb-5" style={{ color: disclaimerTextColor }}>
              12x+ uses advanced tiling techniques to achieve larger images. Results may vary.
            </div>
          )}

          {/* Right side - Output Format and Upscale Button */}
          {/* OUTPUT FORMAT positioned 30-40px to the right of scale factor text, vertically centered */}
          {/* Scale factor is centered at 50%+60px, dial is 96px, gap is 24px, text is ~100px wide, translate-x is 20px */}
          {/* So right edge of scale factor ≈ 50% + 60px + 110px + 20px = 50% + 190px, then add 35px spacing */}
          <div className="flex items-center space-x-4 absolute left-[calc(50%+215px)] top-[calc(50%-10px)] -translate-y-1/2">
            {/* Output Format */}
            <div className="flex flex-col space-y-2">
              <label className="text-xs font-medium uppercase tracking-wider" style={{ color: adaptiveTextColor }}>
                Output Format
              </label>
              <div className="grid grid-cols-2 gap-[10px]">
                {outputFormats.map((format) => (
                  <button
                    key={format.value}
                    onClick={() => onSettingsChange({ ...upscaleSettings, outputFormat: format.value })}
                    disabled={!!currentProcessing}
                    className={`
                      relative px-3 py-2 rounded-lg border-2 transition-all duration-300
                      text-xs font-semibold min-w-[70px]
                      ${currentProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-105'}
                    `}
                    style={{
                      borderColor: upscaleSettings.outputFormat === format.value 
                        ? 'var(--primary)' 
                        : 'var(--border)',
                      background: upscaleSettings.outputFormat === format.value
                        ? 'color-mix(in oklab, var(--primary) 12%, transparent 88%)'
                        : 'transparent',
                      color: upscaleSettings.outputFormat === format.value
                        ? 'var(--primary)'
                        : adaptiveTextColor,
                      boxShadow: upscaleSettings.outputFormat === format.value
                        ? '0 0 25px color-mix(in oklab, var(--primary) 20%, transparent 80%)'
                        : 'none'
                    }}
                  >
                    {upscaleSettings.outputFormat === format.value && (
                      <div className="absolute inset-0 rounded-lg animate-pulse" style={{ background: 'color-mix(in oklab, var(--primary) 8%, transparent 92%)' }} />
                    )}
                    <span className="relative z-10 font-bold tracking-wide">{format.label}</span>
                  </button>
                ))}
              </div>
            </div>

          </div>
          
          {/* Upscale Button - Absolutely positioned to align with right edge of upscaled image box, to the right of OUTPUT FORMAT */}
          <div className="flex flex-col items-end space-y-1 absolute right-[calc(5%-40px)] top-[calc(50%+2px)] -translate-y-1/2">
              <button
                onClick={onUpscale}
                disabled={isUpscaleDisabled}
                aria-busy={currentProcessing ? 'true' : 'false'}
              className={`ziggurat-button ${latestUploadedFile ? 'has-image' : ''}`}
              style={{ 
                color: buttonTextColor, 
                minWidth: '120px', 
                padding: '16px 24px',
                borderColor: buttonBorderColor
              }}
              >
                <span className="relative z-10 flex items-center justify-center space-x-2 text-[14px]">
                  {currentProcessing ? (
                    <>
                      <div
                        className="w-4 h-4 rounded-full animate-spin"
                        style={{
                          borderWidth: '2px',
                          borderStyle: 'solid',
                        borderColor: buttonTextColor,
                          borderTopColor: 'transparent',
                        }}
                        aria-hidden="true"
                      />
                    <span style={{ color: buttonTextColor }}>Upscaling...</span>
                    </>
                  ) : (
                    <>
                    <span style={{ color: buttonTextColor }}>Upscale Image</span>
                    </>
                  )}
                </span>
              </button>
              {/* Token Cost Estimate */}
              {!currentProcessing && latestUploadedFile && (
                <div className="text-xs" style={{ color: mutedTextColor }}>
                  {tokenCostDisplay}
                </div>
              )}
          </div>
        </div>

        {/* Tablet Layout - 768px to 1023px */}
        <div className="hidden md:grid lg:hidden gap-10">
          <div className="grid grid-cols-12 gap-8 items-center">
            <div className="col-span-7 flex flex-col space-y-2 pl-[76px]">
              <label className="text-xs font-medium uppercase tracking-wider" style={{ color: adaptiveTextColor }}>
                Image Type
              </label>
              <ImageTypeSelector
                selectedType={upscaleSettings.quality}
                onTypeChange={(type) => onSettingsChange({ ...upscaleSettings, quality: type })}
                disabled={!!currentProcessing}
              />
            </div>
            <div className="col-span-5 flex items-center justify-start gap-6 pr-4 translate-x-5">
              <div className="w-24 h-24 shrink-0 translate-x-[15px]">
                <ScaleWheel
                  scales={planInfo.allowedForImageType}
                  selectedScale={upscaleSettings.scale}
                  onScaleChange={(scale) => onSettingsChange({ ...upscaleSettings, scale })}
                  disabled={!!currentProcessing}
                />
              </div>
              <div className="flex flex-col justify-center space-y-1 text-center translate-x-[70px] translate-y-[30px]">
                <div className="text-[21px] font-bold leading-none" style={{ color: adaptiveTextColor }}>
                  {upscaleSettings.scale}x
                </div>
                <label className="text-xs font-medium uppercase tracking-wider" style={{ color: adaptiveTextColor }}>
                  Scale Factor
                </label>
                <span className="text-[11px]" style={{ color: mutedTextColor }}>Drag to adjust</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-8 items-center">
            <div className="col-span-7 flex flex-col space-y-2 pl-[76px]">
              <label className="text-xs font-medium uppercase tracking-wider" style={{ color: adaptiveTextColor }}>
                Output Format
              </label>
              <div className="grid grid-cols-2 gap-[10px] w-[460px]">
                {outputFormats.map((format) => (
                  <button
                    key={format.value}
                    onClick={() => onSettingsChange({ ...upscaleSettings, outputFormat: format.value })}
                    disabled={!!currentProcessing}
                    className={`
                      relative px-3 py-2 rounded-lg border-2 transition-all duration-300
                      text-xs font-semibold w-full
                      ${currentProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-[1.02]'}
                    `}
                    style={{
                      borderColor: upscaleSettings.outputFormat === format.value 
                        ? 'var(--primary)' 
                        : 'var(--border)',
                      background: upscaleSettings.outputFormat === format.value
                        ? 'color-mix(in oklab, var(--primary) 15%, transparent 85%)'
                        : 'transparent',
                      color: upscaleSettings.outputFormat === format.value
                        ? 'var(--primary)'
                        : adaptiveTextColor,
                      boxShadow: upscaleSettings.outputFormat === format.value
                        ? 'var(--shadow-2)'
                        : 'none'
                    }}
                  >
                    {upscaleSettings.outputFormat === format.value && (
                      <div className="absolute inset-0 rounded-lg animate-pulse" style={{ background: 'color-mix(in oklab, var(--primary) 10%, transparent 90%)' }} />
                    )}
                    <span className="relative z-10 font-bold tracking-wide">{format.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="col-span-5 flex justify-center pr-0 translate-y-[20px] -translate-x-[80px]">
              <button
                onClick={onUpscale}
                disabled={isUpscaleDisabled}
                aria-busy={currentProcessing ? 'true' : 'false'}
                className={`ziggurat-button ${latestUploadedFile ? 'has-image' : ''}`}
                style={{ color: buttonTextColor }}
              >
                <span className="relative z-10 flex items-center justify-center space-x-2 text-[14px]">
                  {currentProcessing ? (
                    <>
                      <div
                        className="w-4 h-4 rounded-full animate-spin"
                        style={{
                          borderWidth: '2px',
                          borderStyle: 'solid',
                          borderColor: buttonTextColor,
                          borderTopColor: 'transparent',
                        }}
                        aria-hidden="true"
                      />
                      <span style={{ color: buttonTextColor }}>Upscaling...</span>
                    </>
                  ) : (
                    <>
                      <span style={{ color: buttonTextColor }}>Upscale Image</span>
                    </>
                  )}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Layout - < 768px */}
        <div className="md:hidden">
          <MobileToolbarContent
            upscaleSettings={upscaleSettings}
            onSettingsChange={onSettingsChange}
            currentProcessing={currentProcessing}
            planInfo={planInfo}
            outputFormats={outputFormats}
            adaptiveTextColor={adaptiveTextColor}
            mutedTextColor={mutedTextColor}
            isUpscaleDisabled={isUpscaleDisabled}
            onUpscale={onUpscale}
            buttonTextColor={buttonTextColor}
            disclaimerTextColor={disclaimerTextColor}
            latestUploadedFile={latestUploadedFile}
            tokenCostDisplay={tokenCostDisplay}
          />
        </div>
      </div>
    </div>
  );
};

// Mobile Toolbar Component
const MobileToolbarContent: React.FC<{
  upscaleSettings: any;
  onSettingsChange: (settings: any) => void;
  currentProcessing: any;
  planInfo: any;
  outputFormats: any[];
  adaptiveTextColor: string;
  mutedTextColor: string;
  disclaimerTextColor: string;
  isUpscaleDisabled: boolean;
  onUpscale: () => void;
  buttonTextColor: string;
  latestUploadedFile: any;
  tokenCostDisplay: string;
}> = ({
  upscaleSettings,
  onSettingsChange,
  currentProcessing,
  planInfo,
  outputFormats,
  adaptiveTextColor,
  mutedTextColor,
  disclaimerTextColor,
  isUpscaleDisabled,
  onUpscale,
  buttonTextColor,
  latestUploadedFile,
  tokenCostDisplay,
}) => {
  const [isImageTypeOpen, setIsImageTypeOpen] = useState(false);
  const [isOutputFormatOpen, setIsOutputFormatOpen] = useState(false);
  const imageTypeRef = useRef<HTMLDivElement>(null);
  const outputFormatRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (imageTypeRef.current && !imageTypeRef.current.contains(event.target as Node)) {
        setIsImageTypeOpen(false);
      }
      if (outputFormatRef.current && !outputFormatRef.current.contains(event.target as Node)) {
        setIsOutputFormatOpen(false);
      }
    };

    if (isImageTypeOpen || isOutputFormatOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isImageTypeOpen, isOutputFormatOpen]);

  const availableTypes = Object.values(IMAGE_TYPES).filter(type => type.id !== 'extreme');
  const selectedImageType = availableTypes.find(type => type.id === upscaleSettings.quality) || availableTypes[0];
  const otherImageTypes = availableTypes.filter(type => type.id !== upscaleSettings.quality);

  // Set dropdown width to 112px (same as "OUTPUT FORMAT" text width)
  const dropdownWidth = 112;

  return (
    <div className="mt-[1px] mb-0 pb-0">
      {/* Top row: Image Type (left), Scale Factor (center), Output Format (right) */}
      <div className="flex items-center justify-between gap-4 relative" style={{ minHeight: 'calc(-20px + 80px + 90px + 40px)', marginBottom: '20px' }}>
        {/* Left - Image Type Dropdown */}
        <div className="relative flex-shrink-0 flex flex-col items-center" ref={imageTypeRef} style={{ width: `${dropdownWidth}px`, justifyContent: 'center', marginTop: '-33px' }}>
          <label className="text-xs font-medium uppercase tracking-wider mb-2 block text-center absolute" style={{ color: adaptiveTextColor, top: '-24px' }}>
                Image Type
              </label>
          <div className="flex items-center justify-center" style={{ height: '80px', width: `${dropdownWidth}px` }}>
            <button
            onClick={() => setIsImageTypeOpen(!isImageTypeOpen)}
                disabled={!!currentProcessing}
            className={`
              relative rounded-xl border-2 transition-all duration-300
              h-[70px] bg-cover bg-center overflow-hidden
              ${currentProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
            style={{
              width: `${dropdownWidth}px`,
              borderColor: 'var(--primary)',
              boxShadow: '0 0 20px color-mix(in oklab, var(--primary) 20%, transparent 80%)',
              backgroundImage: selectedImageType.exampleImage ? `url(${selectedImageType.exampleImage})` : undefined
            }}
          >
            <div 
              className="absolute inset-0 rounded-xl"
              style={{
                background: 'linear-gradient(to bottom right, color-mix(in oklab, var(--primary) 15%, transparent 85%), color-mix(in oklab, var(--secondary) 12%, transparent 88%))'
              }}
            />
            <div className="relative z-10 flex items-center justify-center h-full gap-1.5 px-2">
              <span 
                className="font-bold text-xs leading-tight"
                style={{
                  color: 'white',
                  textShadow: '0 0 8px color-mix(in oklab, var(--primary) 80%, transparent 20%), 0 0 16px color-mix(in oklab, var(--primary) 60%, transparent 40%), 0 2px 4px rgba(0, 0, 0, 0.8)'
                }}
              >
                {selectedImageType.name}
              </span>
              <ChevronDown className="w-4 h-4 shrink-0" style={{ color: 'white', filter: 'drop-shadow(0 0 4px rgba(0,0,0,0.8))' }} />
            </div>
          </button>

          {/* Image Type Dropdown */}
          {isImageTypeOpen && (
            <div
              className="absolute top-full left-0 mt-2 rounded-lg border shadow-lg z-50"
              style={{
                width: `${dropdownWidth}px`,
                background: 'var(--elev)',
                borderColor: 'var(--border)',
                boxShadow: 'var(--shadow-1)',
              }}
            >
              {otherImageTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => {
                    onSettingsChange({ ...upscaleSettings, quality: type.id });
                    setIsImageTypeOpen(false);
                  }}
                  className="w-full h-[70px] rounded-lg border-2 mb-2 last:mb-0 bg-cover bg-center overflow-hidden relative transition-all duration-200 hover:scale-105 hover:border-[var(--primary)]"
                  style={{
                    borderColor: 'var(--border)',
                    backgroundImage: type.exampleImage ? `url(${type.exampleImage})` : undefined
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--primary)';
                    e.currentTarget.style.boxShadow = '0 0 15px color-mix(in oklab, var(--primary) 40%, transparent 60%)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div className="absolute inset-0 bg-black/50 rounded-lg transition-opacity duration-200 hover:bg-black/30" />
                  <span className="relative z-10 font-bold text-xs text-white px-1 flex items-center justify-center h-full">
                    {type.name}
                  </span>
                </button>
              ))}
            </div>
          )}
            </div>
          </div>

        {/* Center - Scale Factor (centered horizontally and vertically with dropdowns) */}
        <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center" style={{ top: '0px' }}>
              <div className="w-20 h-20">
                <ScaleWheel
                  scales={planInfo.allowedForImageType}
                  selectedScale={upscaleSettings.scale}
                  onScaleChange={(scale) => onSettingsChange({ ...upscaleSettings, scale })}
                  disabled={!!currentProcessing}
                />
              </div>
          <div className="flex items-center gap-2" style={{ marginTop: '90px' }}>
            <div className="text-[21px] font-bold" style={{ color: adaptiveTextColor }}>
                  {upscaleSettings.scale}x
                </div>
            <div className="flex flex-col items-start">
              <label className="text-xs font-medium uppercase tracking-wider" style={{ color: adaptiveTextColor }}>
                Scale Factor
              </label>
              <span className="text-[10px]" style={{ color: mutedTextColor }}>Drag to adjust</span>
              </div>
            </div>
          </div>

        {/* Right - Output Format Dropdown */}
        <div className="relative flex-shrink-0 ml-auto flex flex-col items-center" ref={outputFormatRef} style={{ width: `${dropdownWidth}px`, justifyContent: 'center', marginTop: '-33px' }}>
          <label className="text-xs font-medium uppercase tracking-wider mb-2 block text-center whitespace-nowrap absolute" style={{ color: adaptiveTextColor, top: '-24px' }}>
              Output Format
            </label>
          <div className="flex items-center justify-center" style={{ height: '80px', width: `${dropdownWidth}px` }}>
            <button
            onClick={() => setIsOutputFormatOpen(!isOutputFormatOpen)}
            disabled={!!currentProcessing}
            className={`
              relative rounded-xl border-2 transition-all duration-300
              h-[70px] flex items-center justify-center gap-2
              ${currentProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
            style={{
              width: `${dropdownWidth}px`,
              borderColor: 'var(--primary)',
              background: 'color-mix(in oklab, var(--primary) 12%, transparent 88%)',
              color: 'var(--primary)',
              boxShadow: '0 0 25px color-mix(in oklab, var(--primary) 20%, transparent 80%)'
            }}
          >
            <span className="font-bold tracking-wide text-xs">
              {outputFormats.find(f => f.value === upscaleSettings.outputFormat)?.label || 'Original'}
            </span>
            <ChevronDown className="w-4 h-4 shrink-0" style={{ color: 'var(--primary)' }} />
          </button>

          {/* Output Format Dropdown */}
          {isOutputFormatOpen && (
            <div
              className="absolute top-full right-0 mt-2 rounded-lg border shadow-lg z-50"
              style={{
                width: `${dropdownWidth}px`,
                background: 'var(--elev)',
                borderColor: 'var(--border)',
                boxShadow: 'var(--shadow-1)',
              }}
            >
              {outputFormats.map((format) => (
                <button
                  key={format.value}
                  onClick={() => {
                    onSettingsChange({ ...upscaleSettings, outputFormat: format.value });
                    setIsOutputFormatOpen(false);
                  }}
                  className={`
                    w-full px-3 py-2 rounded-lg border-2 mb-2 last:mb-0 text-xs font-semibold
                    transition-all duration-200
                    ${upscaleSettings.outputFormat === format.value ? '' : 'opacity-70'}
                  `}
                  style={{
                    borderColor: upscaleSettings.outputFormat === format.value 
                      ? 'var(--primary)' 
                      : 'var(--border)',
                    background: upscaleSettings.outputFormat === format.value
                      ? 'color-mix(in oklab, var(--primary) 12%, transparent 88%)'
                      : 'transparent',
                    color: upscaleSettings.outputFormat === format.value
                      ? 'var(--primary)'
                      : adaptiveTextColor,
                  }}
                  onMouseEnter={(e) => {
                    if (upscaleSettings.outputFormat !== format.value) {
                      e.currentTarget.style.borderColor = 'var(--primary)';
                      e.currentTarget.style.background = 'color-mix(in oklab, var(--primary) 8%, transparent 92%)';
                      e.currentTarget.style.opacity = '1';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (upscaleSettings.outputFormat !== format.value) {
                      e.currentTarget.style.borderColor = 'var(--border)';
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.opacity = '0.7';
                    }
                  }}
                >
                  {format.label}
                </button>
              ))}
            </div>
          )}
          </div>
            </div>
          </div>

      {/* Upscale Button - Naturally flows after scale factor text */}
      <div className="w-full flex justify-center mt-[30px]">
            <button
              onClick={onUpscale}
              disabled={isUpscaleDisabled}
              aria-busy={currentProcessing ? 'true' : 'false'}
          className={`ziggurat-button w-full max-w-[320px] ${latestUploadedFile ? 'has-image' : ''}`}
          style={{ color: buttonTextColor }}
            >
              <span className="relative z-10 flex items-center justify-center space-x-2 text-[14px]">
                {currentProcessing ? (
                  <>
                    <div
                      className="w-4 h-4 rounded-full animate-spin"
                      style={{
                        borderWidth: '2px',
                        borderStyle: 'solid',
                    borderColor: buttonTextColor,
                        borderTopColor: 'transparent',
                      }}
                      aria-hidden="true"
                    />
                <span style={{ color: buttonTextColor }}>Upscaling...</span>
                  </>
                ) : (
                  <>
                <span style={{ color: buttonTextColor }}>Upscale Image</span>
                  </>
                )}
              </span>
            </button>
            {/* Token Cost Estimate */}
            {!currentProcessing && latestUploadedFile && (
              <div className="text-xs text-center mt-2" style={{ color: disclaimerTextColor }}>
                {tokenCostDisplay}
              </div>
            )}
          </div>

      {/* Disclaimer - Naturally flows after the Upscale Button */}
      <div className="w-full flex justify-center mt-5">
        <div className="w-full max-w-[320px]">
          <p className="text-center text-[11px] italic px-6 pb-5" style={{ color: disclaimerTextColor }}>
            12x - 32x Uses advanced tiling techniques to achieve larger images. Results may vary.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Toolbar;
