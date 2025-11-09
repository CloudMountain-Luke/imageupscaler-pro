import React from 'react';
import ImageTypeSelector from './ImageTypeSelector';
import ScaleWheel from './ScaleWheel';
import { getAvailableScalesForImageType } from '../services/modelSelectionService';

interface ToolbarProps {
  upscaleSettings: {
    scale: number;
    quality: string;
    outputFormat: string;
  };
  onSettingsChange: (settings: any) => void;
  userProfile: any;
  currentProcessing: any;
  onUpscale: () => void;
  latestUploadedFile: any;
  isApiConfigured: boolean;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  upscaleSettings,
  onSettingsChange,
  userProfile,
  currentProcessing,
  onUpscale,
  latestUploadedFile,
  isApiConfigured
}) => {
  const planInfo = React.useMemo(() => {
    const rawPlan = (
      userProfile?.subscriptionTier ||
      userProfile?.subscription_tier ||
      userProfile?.subscription_tiers?.name ||
      'basic'
    );
    const plan = (typeof rawPlan === 'string' ? rawPlan : 'basic').toLowerCase();
    const allowedForImageType = getAvailableScalesForImageType(
      upscaleSettings.quality, 
      plan
    );
    return { plan, allowedForImageType };
  }, [userProfile, upscaleSettings.quality]);

  const outputFormats = [
    { value: 'original', label: 'Original' },
    { value: 'jpg', label: 'JPEG' },
    { value: 'png', label: 'PNG' },
    { value: 'webp', label: 'WebP' }
  ];
  const isUpscaleDisabled = !!currentProcessing || !latestUploadedFile || !isApiConfigured;

  return (
    <div className="w-full toolbar-shell relative z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-4 sm:py-6">
        {/* Desktop Layout */}
        <div className="hidden xl:flex items-center justify-center gap-8 relative min-h-[180px] pb-6">
          {/* Left side - Image Type */}
          <div className="flex flex-col space-y-3 absolute left-0 top-[calc(50%-10px)] -translate-y-1/2 pl-[24px]">
            <label className="text-sm font-medium uppercase tracking-wider muted-label">
              Image Type
            </label>
            <ImageTypeSelector
              selectedType={upscaleSettings.quality}
              onTypeChange={(type) => onSettingsChange({ ...upscaleSettings, quality: type })}
              disabled={!!currentProcessing}
            />
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
                <div className="text-[21px] font-bold" style={{ color: 'var(--primary)' }}>
                  {upscaleSettings.scale}x
              </div>
              <label className="text-xs font-medium uppercase tracking-wider muted-label">
                Scale Factor
              </label>
              <span className="text-[10px] text-gray-500">Drag to adjust</span>
            </div>
          </div>

          <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 text-[10px] text-gray-500 italic pb-5">
            Some scale factors use enhanced techniques to achieve the requested size; results may vary.
          </div>

          {/* Right side - Output Format and Upscale Button */}
          <div className="flex items-center space-x-4 absolute right-0 top-[calc(50%-10px)] -translate-y-1/2">
            {/* Output Format */}
            <div className="flex flex-col space-y-2">
              <label className="text-xs font-medium uppercase tracking-wider muted-label">
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
                        : 'var(--text)',
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

            {/* Upscale Button - Vertically centered with Output Format buttons */}
            <div className="flex items-center h-full translate-y-[10px]">
              <button
                onClick={onUpscale}
                disabled={isUpscaleDisabled}
                aria-busy={currentProcessing ? 'true' : 'false'}
                className="ziggurat-button"
              >
                <span className="relative z-10 flex items-center justify-center space-x-2 text-[14px]">
                  {currentProcessing ? (
                    <>
                      <div
                        className="w-4 h-4 rounded-full animate-spin"
                        style={{
                          borderWidth: '2px',
                          borderStyle: 'solid',
                          borderColor: 'var(--on-primary)',
                          borderTopColor: 'transparent',
                        }}
                        aria-hidden="true"
                      />
                      <span className="text-white">Upscaling...</span>
                    </>
                  ) : (
                    <>
                      <span className="text-white">Upscale Image</span>
                    </>
                  )}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Tablet Layout */}
        <div className="hidden lg:grid xl:hidden gap-10">
          <div className="grid grid-cols-12 gap-8 items-center">
            <div className="col-span-7 flex flex-col space-y-2 pl-[76px]">
              <label className="text-xs font-medium uppercase tracking-wider muted-label">
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
                <div className="text-[21px] font-bold leading-none" style={{ color: 'var(--primary)' }}>
                  {upscaleSettings.scale}x
                </div>
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Scale Factor
                </label>
                <span className="text-[11px] text-gray-500">Drag to adjust</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-8 items-center">
            <div className="col-span-7 flex flex-col space-y-2 pl-[76px]">
              <label className="text-xs font-medium uppercase tracking-wider muted-label">
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
                        : 'var(--text)',
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
                className="ziggurat-button"
              >
                <span className="relative z-10 flex items-center justify-center space-x-2 text-[14px]">
                  {currentProcessing ? (
                    <>
                      <div
                        className="w-4 h-4 rounded-full animate-spin"
                        style={{
                          borderWidth: '2px',
                          borderStyle: 'solid',
                          borderColor: 'var(--on-primary)',
                          borderTopColor: 'transparent',
                        }}
                        aria-hidden="true"
                      />
                      <span className="text-white">Upscaling...</span>
                    </>
                  ) : (
                    <>
                      <span className="text-white">Upscale Image</span>
                    </>
                  )}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Layout */}
        <div className="lg:hidden space-y-6">
          {/* Image Type - Mobile */}
          <div className="flex flex-col space-y-3 mt-6">
              <label className="text-sm font-medium uppercase tracking-wider muted-label">
                Image Type
              </label>
              <div className="w-full">
                <ImageTypeSelector
                  selectedType={upscaleSettings.quality}
                onTypeChange={(type) => onSettingsChange({ ...upscaleSettings, quality: type })}
                disabled={!!currentProcessing}
              />
            </div>
          </div>

          {/* Scale Factor - Mobile */}
          <div className="flex flex-col items-center space-y-4">
            <label className="text-sm font-medium uppercase tracking-wider muted-label">
              Scale Factor
            </label>
            <div className="flex items-center space-x-6">
              <div className="w-20 h-20">
                <ScaleWheel
                  scales={planInfo.allowedForImageType}
                  selectedScale={upscaleSettings.scale}
                  onScaleChange={(scale) => onSettingsChange({ ...upscaleSettings, scale })}
                  disabled={!!currentProcessing}
                />
              </div>
              <div className="flex flex-col items-center space-y-2 ml-8">
                <div className="text-2xl font-bold" style={{ color: 'var(--primary)' }}>
                  {upscaleSettings.scale}x
                </div>
                <div className="text-xs text-gray-500 flex items-center justify-center space-x-1">
                  <span>Drag to rotate</span>
                </div>
              </div>
            </div>
          </div>

          {/* Output Format - Mobile */}
          <div className="flex flex-col space-y-3">
            <label className="text-sm font-medium uppercase tracking-wider muted-label">
              Output Format
            </label>
            <div className="grid grid-cols-2 gap-[10px]">
              {outputFormats.map((format) => (
                <button
                  key={format.value}
                  onClick={() => onSettingsChange({ ...upscaleSettings, outputFormat: format.value })}
                  disabled={!!currentProcessing}
                  className={`
                    relative px-4 py-3 rounded-xl border-2 transition-all duration-300
                    text-sm font-semibold
                    ${currentProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-105'}
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
                      : 'var(--text)',
                    boxShadow: upscaleSettings.outputFormat === format.value
                      ? 'var(--shadow-2)'
                      : 'none'
                  }}
                >
                  {upscaleSettings.outputFormat === format.value && (
                    <div className="absolute inset-0 rounded-xl animate-pulse" style={{ background: 'color-mix(in oklab, var(--primary) 10%, transparent 90%)' }} />
                  )}
                  <span className="relative z-10 font-bold tracking-wide">{format.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Upscale Button - Mobile */}
          <div className="flex justify-center">
            <button
              onClick={onUpscale}
              disabled={isUpscaleDisabled}
              aria-busy={currentProcessing ? 'true' : 'false'}
              className="ziggurat-button w-full max-w-[320px]"
            >
              <span className="relative z-10 flex items-center justify-center space-x-2 text-[14px]">
                {currentProcessing ? (
                  <>
                    <div
                      className="w-4 h-4 rounded-full animate-spin"
                      style={{
                        borderWidth: '2px',
                        borderStyle: 'solid',
                        borderColor: 'var(--on-primary)',
                        borderTopColor: 'transparent',
                      }}
                      aria-hidden="true"
                    />
                    <span className="text-white">Upscaling...</span>
                  </>
                ) : (
                  <>
                    <span className="text-white">Upscale Image</span>
                  </>
                )}
              </span>
            </button>
          </div>
        </div>
      </div>
      <p className="xl:hidden mt-4 text-center text-[11px] italic px-6 muted-label pb-5">
        Some scale factors use enhanced techniques to achieve the requested size; results may vary.
      </p>
    </div>
  );
};

export default Toolbar;
