import React, { useState, useMemo, Suspense, lazy } from 'react';
import { ArrowRight, Sparkles, Shield, TrendingUp, LogIn, ChevronDown, ChevronUp, Info, Palette, Zap, Image, FileText, Wand2, Download, Upload, Camera, Paintbrush, Film, Type, Check } from 'lucide-react';

// Lazy load heavy components
const PricingPlans = lazy(() => import('./PricingPlans').then(m => ({ default: m.PricingPlans })));
import { ThemeProvider, useThemeLab } from '../contexts/ThemeContext';
import { ThemeControls } from './ThemeControls';
// HexagonGridCSS removed for cleaner background
import { BeforeAfterSlider } from './BeforeAfterSlider';
import { FloatingGallery, defaultGalleryImages } from './FloatingGallery';
import { EmberParticles } from './EmberParticles';
import { FadeInOnScroll } from './ParallaxSection';
import { RotatingImageCard } from './RotatingImageCard';

interface HomepageProps {
  onGetStarted: (plan: string) => void;
  onLogin?: () => void;
}

// Preset details data
const presetDetails = [
  {
    id: 'photo',
    name: 'Photo',
    icon: Camera,
    tagline: 'Perfect for real-world photography',
    description: 'Our Photo preset uses Real-ESRGAN models specifically trained on photographic content. It excels at preserving natural skin tones, fabric textures, and environmental details.',
    bestFor: [
      'Portrait photography',
      'Landscape and nature shots',
      'Product photography',
      'Real estate images',
      'Event and wedding photos',
    ],
    features: [
      'Preserves natural skin tones and textures',
      'Enhances fine details like hair and fabric',
      'Maintains realistic color gradients',
      'Reduces noise while keeping sharpness',
      'Optimized for JPEG compression artifacts',
    ],
    techNote: 'Uses Real-ESRGAN x4plus model with face enhancement for portraits.',
  },
  {
    id: 'art',
    name: 'Art & Illustrations',
    icon: Paintbrush,
    tagline: 'Ideal for digital and traditional artwork',
    description: 'The Art preset is tuned for illustrations, digital paintings, and graphic designs. It preserves brush strokes, maintains clean edges, and respects the artistic intent of the original.',
    bestFor: [
      'Digital paintings and illustrations',
      'Graphic design assets',
      'Concept art and sketches',
      'Logos and icons',
      'Scanned traditional artwork',
    ],
    features: [
      'Preserves brush strokes and artistic textures',
      'Maintains clean vector-like edges',
      'Enhances color vibrancy without oversaturation',
      'Respects flat color areas',
      'Great for print-ready enlargements',
    ],
    techNote: 'Uses SwinIR model optimized for artistic content with edge preservation.',
  },
  {
    id: 'anime',
    name: 'Anime & Cartoons',
    icon: Film,
    tagline: 'Specialized for cel-shaded and animated content',
    description: 'Purpose-built for anime, manga, cartoons, and cel-shaded art. This preset understands the unique characteristics of animated content and enhances them appropriately.',
    bestFor: [
      'Anime screenshots and artwork',
      'Manga and comic panels',
      'Cartoon illustrations',
      'Game sprites and pixel art',
      'Character art and fan art',
    ],
    features: [
      'Preserves clean line art',
      'Maintains flat color regions',
      'Enhances cel-shading gradients',
      'Reduces compression artifacts common in anime',
      'Respects the stylized look of animated content',
    ],
    techNote: 'Uses Real-ESRGAN anime model trained specifically on anime/manga datasets.',
  },
  {
    id: 'text',
    name: 'Text & Documents',
    icon: Type,
    tagline: 'Optimized for readability and sharp text',
    description: 'The Text preset prioritizes legibility and sharp edges. Perfect for documents, screenshots, presentations, and any content where text clarity is paramount.',
    bestFor: [
      'Scanned documents and PDFs',
      'Screenshots with text',
      'Presentation slides',
      'UI mockups and wireframes',
      'Infographics and charts',
    ],
    features: [
      'Maximum text sharpness and clarity',
      'Preserves thin lines and small details',
      'Reduces blur around text edges',
      'Maintains high contrast for readability',
      'Great for OCR preprocessing',
    ],
    techNote: 'Uses specialized sharpening with edge-aware processing for text clarity.',
  },
];

// Preset Details Component (no tab buttons - controlled by clicking image boxes)
function PresetDetailsPanel({ 
  textColor, 
  mutedTextColor, 
  activePresetId 
}: { 
  textColor: string; 
  mutedTextColor: string;
  activePresetId: string;
}) {
  const activePreset = presetDetails.find(p => p.id === activePresetId) || presetDetails[0];
  const Icon = activePreset.icon;
  
  return (
    <div id="preset-details" className="scroll-mt-24">
      {/* Tab Content */}
      <div 
        className="rounded-2xl p-8 glass-card"
        style={{ borderColor: 'color-mix(in oklab, var(--primary) 20%, transparent 80%)' }}
      >
        <div className="grid md:grid-cols-2 gap-8">
          {/* Left Column - Description */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div 
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                  boxShadow: '0 8px 25px color-mix(in oklab, var(--primary) 40%, transparent 60%)',
                }}
              >
                <Icon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-bold" style={{ color: textColor }}>
                  {activePreset.name}
                </h3>
                <p className="text-sm" style={{ color: 'var(--primary)' }}>
                  {activePreset.tagline}
                </p>
              </div>
            </div>
            
            <p className="mb-6" style={{ color: mutedTextColor }}>
              {activePreset.description}
            </p>
            
            <h4 className="font-semibold mb-3" style={{ color: textColor }}>
              Best For:
            </h4>
            <ul className="space-y-2 mb-6">
              {activePreset.bestFor.map((item, i) => (
                <li key={i} className="flex items-center gap-2">
                  <Check className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--primary)' }} />
                  <span style={{ color: mutedTextColor }}>{item}</span>
                </li>
              ))}
            </ul>
            
            <div 
              className="text-xs p-3 rounded-lg"
              style={{ 
                background: 'color-mix(in oklab, var(--primary) 10%, transparent 90%)',
                color: mutedTextColor,
              }}
            >
              <strong style={{ color: 'var(--primary)' }}>Technical:</strong> {activePreset.techNote}
            </div>
          </div>
          
          {/* Right Column - Features */}
          <div>
            <h4 className="font-semibold mb-4" style={{ color: textColor }}>
              Key Features:
            </h4>
            <div className="space-y-3">
              {activePreset.features.map((feature, i) => (
                <div 
                  key={i}
                  className="flex items-start gap-3 p-3 rounded-lg transition-all duration-300 hover:scale-[1.02]"
                  style={{ 
                    background: 'color-mix(in oklab, var(--elev) 30%, transparent 70%)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div 
                    className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ 
                      background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                    }}
                  >
                    <Check className="w-3 h-3 text-white" />
                  </div>
                  <span style={{ color: textColor }}>{feature}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Inner component that uses ThemeLab context
function HomepageContent({ onGetStarted, onLogin }: HomepageProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [activePresetId, setActivePresetId] = useState('photo');
  const { tone, isLabOpen, openLab, closeLab, setColorScheme } = useThemeLab();

  // Set Forge color scheme on mount
  React.useEffect(() => {
    setColorScheme('forge');
  }, [setColorScheme]);

  // Calculate text colors based on tone (matching dashboard Header)
  const textColor = useMemo(() => {
    return tone <= 50 ? 'hsl(0, 0%, 96%)' : 'hsl(0, 0%, 12%)';
  }, [tone]);

  const mutedTextColor = useMemo(() => {
    return tone <= 50 ? 'hsl(0, 0%, 75%)' : 'hsl(0, 0%, 35%)';
  }, [tone]);

  const faqs = [
    {
      question: "How does AI image upscaling work?",
      answer: "Our AI uses advanced Real-ESRGAN and SwinIR models to analyze your image and intelligently add pixels, preserving details and textures while increasing resolution up to 24x the original size."
    },
    {
      question: "What file formats are supported?",
      answer: "We support JPEG, PNG, WebP, GIF, BMP, TIFF, AVIF, and HEIC/HEIF formats up to 25MB per file. You can also convert between formats during the upscaling process."
    },
    {
      question: "What are the limitations?",
      answer: "AI upscaling enhances existing detail but cannot recreate information that wasn't in the original image. Best results are achieved with images under 1000px. Very large images may require more processing time."
    },
    {
      question: "How is Upscale Forge different from other upscalers?",
      answer: "We offer up to 24x scaling - 3-6x higher than most competitors. Our specialized presets for Photo, Art, Anime, and Text ensure optimal results for your specific content type."
    },
    {
      question: "Can I cancel my subscription anytime?",
      answer: "Yes, you can cancel your subscription at any time. You'll continue to have access until the end of your current billing period."
    }
  ];

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  return (
    <div 
      className="min-h-screen relative overflow-x-hidden"
      style={{ background: 'var(--surface)' }}
    >
      {/* Background Effects Layer - Simplified for performance */}
      <div className="fixed inset-0 pointer-events-none">
        {/* Background removed - cleaner look */}
        
        {/* Ambient Glow from Bottom */}
        <div 
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[200%] h-[70%]"
          style={{
            background: `radial-gradient(ellipse at center bottom, color-mix(in oklab, var(--primary) 10%, transparent 90%) 0%, transparent 60%)`,
          }}
        />
      </div>

      {/* Header */}
      <header 
        className="sticky top-0 z-50 backdrop-blur-xl border-b"
        style={{
          background: 'color-mix(in oklab, var(--surface) 85%, transparent 15%)',
          borderColor: 'var(--border)',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            {/* Logo */}
            <div className="flex items-center">
              <img 
                src="/images/UpscaleForge-Logo_500px_sm.png" 
                alt="Upscale Forge" 
                className="w-[100px] h-auto"
              />
            </div>
            
            {/* Right side - UI Lab + Sign In */}
            <div className="flex items-center gap-4">
              {/* UI Lab Toggle */}
              <button
                onClick={isLabOpen ? closeLab : openLab}
                className="flex items-center gap-2 px-4 py-2 rounded-full border transition-all duration-300 hover:scale-105"
                style={{
                  background: 'color-mix(in oklab, var(--elev) 50%, transparent 50%)',
                  borderColor: 'var(--border)',
                  color: textColor,
                }}
              >
                <Palette className="w-4 h-4" />
                <span className="text-sm font-medium hidden sm:inline">
                  {isLabOpen ? 'Close UI Lab' : 'UI Lab'}
                </span>
              </button>

              {/* Sign In Button */}
              <button
                onClick={onLogin}
                className="flex items-center space-x-2 text-white px-5 py-2.5 rounded-lg font-medium transition-all duration-300 hover:scale-105 neon-glow-subtle"
                style={{
                  background: 'linear-gradient(to right, var(--primary), var(--secondary))',
                  boxShadow: '0 4px 20px color-mix(in oklab, var(--primary) 40%, transparent 60%)',
                }}
              >
                <LogIn className="w-4 h-4" strokeWidth={2.5} />
                <span>Sign In</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* UI Lab Panel */}
      {isLabOpen && (
        <div className="fixed top-24 right-4 z-50">
          <ThemeControls />
        </div>
      )}

      {/* ============================================
          SECTION 1: HERO WITH FLOATING GALLERY
          ============================================ */}
      <section className="relative min-h-[85vh] flex items-center overflow-hidden">
        {/* Floating Gallery Background */}
        <FloatingGallery images={defaultGalleryImages} className="opacity-60" />
        
        {/* Ember Particles in Hero - reduced count */}
        <EmberParticles count={12} intensity="low" color="mixed" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 xl:px-16 pt-4 pb-12 relative z-10" style={{ marginTop: '-60px' }}>
          <div className="text-center">
            {/* Exclusivity Badge */}
            <FadeInOnScroll delay={0}>
              <div 
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8 glass-card animate-pulse-glow"
                style={{ borderColor: 'color-mix(in oklab, var(--primary) 40%, transparent 60%)' }}
              >
                <Sparkles className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                <span className="text-sm font-medium" style={{ color: textColor }}>
                  The upscaler serious creators choose
                </span>
              </div>
            </FadeInOnScroll>
            
            {/* Headline with Glow */}
            <FadeInOnScroll delay={0.1}>
              <h1 
                className="text-5xl md:text-7xl font-bold mb-6 glow-text"
                style={{ color: textColor }}
              >
                Forge{' '}
                <span className="gradient-text">Stunning</span>
                {' '}Detail
              </h1>
            </FadeInOnScroll>
            
            <FadeInOnScroll delay={0.2}>
              <h2 
                className="text-xl md:text-2xl font-medium mb-8 max-w-2xl mx-auto"
                style={{ color: mutedTextColor }}
              >
                AI upscaling up to <span style={{ color: 'var(--primary)' }}>24x</span>.
                {' '}No other web tool comes close.
              </h2>
            </FadeInOnScroll>
            
            {/* CTA Button */}
            <FadeInOnScroll delay={0.3}>
              <div className="mb-10">
                <button
                  onClick={() => onGetStarted('free')}
                  className="group inline-flex items-center space-x-3 text-white px-10 py-5 rounded-2xl font-semibold text-xl transition-all duration-300 hover:scale-105 animate-pulse-glow"
                  style={{
                    background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                    boxShadow: `
                      0 0 40px color-mix(in oklab, var(--primary) 50%, transparent 50%),
                      0 10px 40px color-mix(in oklab, var(--primary) 40%, transparent 60%)
                    `,
                  }}
                >
                  <span>Start Forging — Free</span>
                  <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                </button>
                <p className="mt-4 text-sm" style={{ color: mutedTextColor }}>
                  5 upscales free. No credit card required.
                </p>
              </div>
            </FadeInOnScroll>
            
            {/* Feature Badges */}
            <FadeInOnScroll delay={0.4}>
              <div className="flex flex-wrap justify-center gap-4">
                {[
                  { icon: Zap, text: 'No Watermarks', color: 'var(--primary)' },
                  { icon: Download, text: 'No Downloads', color: 'var(--secondary)' },
                  { icon: Shield, text: 'No Limits', color: 'var(--accent)' },
                ].map((badge, i) => (
                  <div 
                    key={i}
                    className="flex items-center space-x-2 rounded-full px-5 py-2.5 glass-card"
                    style={{ borderColor: `color-mix(in oklab, ${badge.color} 30%, transparent 70%)` }}
                  >
                    <badge.icon className="w-4 h-4" style={{ color: badge.color }} />
                    <span className="text-sm font-medium" style={{ color: textColor }}>{badge.text}</span>
                  </div>
                ))}
              </div>
            </FadeInOnScroll>
          </div>
        </div>
        
        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <ChevronDown className="w-8 h-8" style={{ color: mutedTextColor }} />
        </div>
      </section>

      {/* Section Divider */}
      <div className="section-divider" />

      {/* ============================================
          SECTION 2: HEXAGON REVEAL BEFORE/AFTER
          ============================================ */}
      <section className="relative py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeInOnScroll>
            <div className="text-center mb-16">
              <h2 
                className="text-3xl md:text-5xl font-bold mb-4"
                style={{ color: textColor }}
              >
                See the{' '}
                <span className="gradient-text">Transformation</span>
              </h2>
              <p className="text-lg" style={{ color: mutedTextColor }}>
                Watch as AI enhances every pixel
              </p>
            </div>
          </FadeInOnScroll>
          
          <FadeInOnScroll delay={0.2}>
            <BeforeAfterSlider
              beforeImage="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=40"
              afterImage="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1600&q=95"
              beforeLabel="Original"
              afterLabel="Enhanced 24x"
              stats={{
                before: '480px',
                after: '11,520px',
                scale: '24x'
              }}
              autoPlay={true}
              autoPlaySpeed={7}
              className="max-w-4xl mx-auto"
            />
          </FadeInOnScroll>
        </div>
      </section>

      {/* Section Divider */}
      <div className="section-divider" />

      {/* ============================================
          SECTION 3: WHY UPSCALE FORGE (USP CARDS)
          ============================================ */}
      <section className="relative py-24">
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <FadeInOnScroll>
            <div className="text-center mb-16">
              <h2 
                className="text-3xl md:text-5xl font-bold mb-4"
                style={{ color: textColor }}
              >
                Why Choose{' '}
                <span className="gradient-text">Upscale Forge</span>?
              </h2>
              <p className="text-lg max-w-2xl mx-auto" style={{ color: mutedTextColor }}>
                The secret weapon for creators who demand more
              </p>
            </div>
          </FadeInOnScroll>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: TrendingUp,
                title: '24x Upscaling',
                description: '3x higher than Topaz, 6x higher than Picsart',
                color: 'var(--primary)',
                delay: 0.1
              },
              {
                icon: Wand2,
                title: '4 AI Presets',
                description: 'Photo, Art, Anime, Text — each optimized',
                color: 'var(--secondary)',
                delay: 0.2
              },
              {
                icon: Shield,
                title: 'No Watermarks',
                description: 'Your images, your way. Always.',
                color: 'var(--accent)',
                delay: 0.3
              },
              {
                icon: Zap,
                title: 'Web-Based',
                description: 'No downloads. Works everywhere.',
                color: 'var(--primary)',
                delay: 0.4
              },
            ].map((feature, i) => (
              <FadeInOnScroll key={i} delay={feature.delay}>
                <div 
                  className="relative p-6 rounded-2xl glass-card steel-card transition-all duration-300 hover:scale-105 group h-full"
                  style={{
                    borderColor: `color-mix(in oklab, ${feature.color} 20%, transparent 80%)`,
                  }}
                >
                  {/* Hexagon Icon Background - 47x52px (width x height) */}
                  <div 
                    className="mb-4 flex items-center justify-center hex-badge"
                    style={{
                      width: '47px',
                      height: '52px',
                      background: `linear-gradient(135deg, ${feature.color}, color-mix(in oklab, ${feature.color} 70%, var(--secondary) 30%))`,
                      boxShadow: `0 8px 30px color-mix(in oklab, ${feature.color} 40%, transparent 60%)`,
                    }}
                  >
                    <feature.icon className="w-6 h-6 text-white" />
                  </div>
                  
                  <h3 className="text-xl font-bold mb-2" style={{ color: textColor }}>
                    {feature.title}
                  </h3>
                  <p className="text-sm" style={{ color: mutedTextColor }}>
                    {feature.description}
                  </p>
                  
                  {/* Hover Glow */}
                  <div 
                    className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                    style={{
                      boxShadow: `inset 0 0 30px color-mix(in oklab, ${feature.color} 10%, transparent 90%)`,
                    }}
                  />
                </div>
              </FadeInOnScroll>
            ))}
          </div>
          
          {/* Competitive Comparison */}
          <FadeInOnScroll delay={0.5}>
            <div 
              className="mt-16 p-8 rounded-2xl glass-card text-center"
              style={{ borderColor: 'color-mix(in oklab, var(--primary) 30%, transparent 70%)' }}
            >
              <p className="text-lg mb-4" style={{ color: mutedTextColor }}>
                While others limit you to 4x or 8x...
              </p>
              <p 
                className="text-3xl md:text-4xl font-bold glow-text-strong"
                style={{ color: 'var(--primary)' }}
              >
                We take you to 24x
              </p>
            </div>
          </FadeInOnScroll>
        </div>
      </section>

      {/* Section Divider */}
      <div className="section-divider" />

      {/* ============================================
          SECTION 4: HOW IT WORKS (3 STEPS)
          ============================================ */}
      <section className="relative py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeInOnScroll>
            <div className="text-center mb-16">
              <h2 
                className="text-3xl md:text-5xl font-bold mb-4"
                style={{ color: textColor }}
              >
                How It{' '}
                <span className="gradient-text">Works</span>
              </h2>
              <p className="text-lg" style={{ color: mutedTextColor }}>
                Professional results in three simple steps
              </p>
            </div>
          </FadeInOnScroll>

          <div className="relative">
            {/* Connecting Line */}
            <div 
              className="absolute top-12 left-0 right-0 h-0.5 hidden md:block"
              style={{
                background: `linear-gradient(90deg, transparent, var(--primary), var(--secondary), var(--primary), transparent)`,
                boxShadow: '0 0 20px var(--primary)',
              }}
            />
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                {
                  step: '01',
                  icon: Upload,
                  title: 'Upload',
                  description: 'Drop any image up to 25MB. JPEG, PNG, WebP supported.',
                  delay: 0.1
                },
                {
                  step: '02',
                  icon: Wand2,
                  title: 'Choose Scale',
                  description: 'Select 2x to 24x and pick your AI preset.',
                  delay: 0.2
                },
                {
                  step: '03',
                  icon: Download,
                  title: 'Download',
                  description: 'Get your print-ready image in seconds.',
                  delay: 0.3
                },
              ].map((step, i) => (
                <FadeInOnScroll key={i} delay={step.delay}>
                  <div className="relative text-center">
                    {/* Step Number in Hexagon - 96x101px (width x height) */}
                    <div 
                      className="mx-auto mb-6 flex items-center justify-center hex-badge relative z-10"
                      style={{
                        width: '96px',
                        height: '101px',
                        background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                        boxShadow: '0 10px 40px color-mix(in oklab, var(--primary) 50%, transparent 50%)',
                      }}
                    >
                      <step.icon className="w-10 h-10 text-white" />
                    </div>
                    
                    <div 
                      className="text-sm font-bold mb-2"
                      style={{ color: 'var(--primary)' }}
                    >
                      STEP {step.step}
                    </div>
                    
                    <h3 className="text-xl font-bold mb-2" style={{ color: textColor }}>
                      {step.title}
                    </h3>
                    <p className="text-sm" style={{ color: mutedTextColor }}>
                      {step.description}
                    </p>
                  </div>
                </FadeInOnScroll>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Section Divider */}
      <div className="section-divider" />

      {/* ============================================
          SECTION 5: AI PRESETS SHOWCASE
          ============================================ */}
      <section id="presets" className="relative py-24">
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <FadeInOnScroll>
            <div className="text-center mb-16">
              <h2 
                className="text-3xl md:text-5xl font-bold mb-4"
                style={{ color: textColor }}
              >
                Optimized for{' '}
                <span className="gradient-text">Every Image Type</span>
              </h2>
              <p className="text-lg" style={{ color: mutedTextColor }}>
                Specialized AI models for different content
              </p>
            </div>
          </FadeInOnScroll>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
            {[
              { 
                name: 'Photos', 
                icon: Image, 
                desc: 'Portraits, landscapes, products', 
                images: [
                  '/images/dooze-test-123.jpg', // Your dog Dooze
                  '/images/man-portrait_1-1_sm.webp', // Man portrait
                  '/images/mountain-landscape_1-1_sm.webp', // Mountain landscape
                  '/images/ocean-waves-sunset.webp', // Ocean waves sunset
                ],
                id: 'photo'
              },
              { 
                name: 'Art & Illustrations', 
                icon: Sparkles, 
                desc: 'Paintings, illustrations, designs', 
                images: [
                  '/images/Fete_de_nuit_small_opt.webp', // Garden party painting
                  '/images/abstract-eye_opt.webp', // Abstract eye painting
                  '/images/art-illustrations_sm.webp', // Art illustrations
                  '/images/woman-portrait_1-1.webp', // Portrait art style
                ],
                id: 'art'
              },
              { 
                name: 'Anime & Cartoons', 
                icon: Wand2, 
                desc: 'Anime, cartoons, comics', 
                images: [
                  '/images/anime-sm.webp', // Anime artwork
                  '/images/colorful-anime_1-1_sm.webp', // Colorful anime
                  '/images/acfromspace_sm_1-1_sm.webp', // Digital art style
                  '/images/chibi-anime-korean-pop-singer_1-1_sm.webp', // Artistic illustration (chibi)
                ],
                id: 'anime'
              },
              { 
                name: 'Text & Documents', 
                icon: FileText, 
                desc: 'Documents, screenshots, logos', 
                images: [
                  '/images/text-sm.webp', // Documents
                  '/images/charts-data_1-1.webp', // Charts/data
                  '/images/office-docs_1-1.webp', // Office docs
                  '/images/books-text_1-1.webp', // Books/text
                ],
                id: 'text'
              },
            ].map((preset, i) => {
              const isActive = activePresetId === preset.id;
              return (
                <FadeInOnScroll key={i} delay={i * 0.1}>
                  <button
                    onClick={() => {
                      setActivePresetId(preset.id);
                    }}
                    className="block relative rounded-xl overflow-hidden glass-card group cursor-pointer transition-all duration-300 hover:scale-105 w-full text-left"
                    style={{ 
                      borderColor: isActive 
                        ? 'var(--primary)' 
                        : 'color-mix(in oklab, var(--primary) 20%, transparent 80%)',
                      boxShadow: isActive 
                        ? '0 0 30px color-mix(in oklab, var(--primary) 40%, transparent 60%)' 
                        : 'none',
                    }}
                  >
                    <RotatingImageCard
                      images={preset.images}
                      alt={preset.name}
                      interval={3000}
                      slotIndex={i}
                      totalSlots={4}
                      className="aspect-square"
                    >
                      {/* Gradient overlay */}
                      <div 
                        className="absolute inset-0"
                        style={{
                          background: 'linear-gradient(to top, var(--surface) 0%, transparent 60%)',
                        }}
                      />
                    </RotatingImageCard>
                    
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <preset.icon className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                        <h3 className="font-bold" style={{ color: textColor }}>{preset.name}</h3>
                      </div>
                      <p className="text-xs" style={{ color: mutedTextColor }}>{preset.desc}</p>
                    </div>
                    
                    {/* Active indicator */}
                    {isActive && (
                      <div 
                        className="absolute top-3 right-3 px-2 py-1 rounded-full text-xs font-medium"
                        style={{
                          background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                          color: 'white',
                        }}
                      >
                        Selected
                      </div>
                    )}
                    
                    {/* Hover Overlay (only when not active) */}
                    {!isActive && (
                      <div 
                        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center"
                        style={{
                          background: 'linear-gradient(135deg, color-mix(in oklab, var(--primary) 30%, transparent 70%), color-mix(in oklab, var(--secondary) 20%, transparent 80%))',
                        }}
                      >
                        <span className="text-white text-sm font-medium px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-sm">
                          View Details
                        </span>
                      </div>
                    )}
                  </button>
                </FadeInOnScroll>
              );
            })}
          </div>
          
          {/* Preset Details Panel (controlled by clicking boxes above) */}
          <PresetDetailsPanel 
            textColor={textColor} 
            mutedTextColor={mutedTextColor} 
            activePresetId={activePresetId}
          />
        </div>
      </section>

      {/* Section Divider */}
      <div className="section-divider" />

      {/* ============================================
          SECTION 6: PRICING (Lazy Loaded)
          ============================================ */}
      <section className="relative py-8">
        <Suspense fallback={
          <div className="flex items-center justify-center py-24">
            <div className="animate-pulse text-center">
              <div className="h-8 w-48 bg-gray-700/50 rounded mx-auto mb-4"></div>
              <div className="h-4 w-64 bg-gray-700/30 rounded mx-auto"></div>
            </div>
          </div>
        }>
          <PricingPlans onGetStarted={onGetStarted} />
        </Suspense>
      </section>

      {/* Section Divider */}
      <div className="section-divider" />

      {/* ============================================
          SECTION 7: FAQ
          ============================================ */}
      <section className="relative py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeInOnScroll>
            <div className="text-center mb-12">
              <h2 
                className="text-3xl md:text-4xl font-bold mb-4"
                style={{ color: textColor }}
              >
                Frequently Asked{' '}
                <span className="gradient-text">Questions</span>
              </h2>
            </div>
          </FadeInOnScroll>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <FadeInOnScroll key={index} delay={index * 0.05}>
                <div 
                  className="rounded-xl overflow-hidden glass-card"
                  style={{ borderColor: 'color-mix(in oklab, var(--border) 50%, transparent 50%)' }}
                >
                  <button
                    onClick={() => toggleFaq(index)}
                    className="w-full p-6 text-left flex items-center justify-between transition-colors"
                    style={{ 
                      background: openFaq === index 
                        ? 'color-mix(in oklab, var(--primary) 5%, transparent 95%)' 
                        : 'transparent' 
                    }}
                  >
                    <h3 className="text-lg font-semibold pr-4" style={{ color: textColor }}>
                      {faq.question}
                    </h3>
                    {openFaq === index ? (
                      <ChevronUp className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--primary)' }} />
                    ) : (
                      <ChevronDown className="w-5 h-5 flex-shrink-0" style={{ color: mutedTextColor }} />
                    )}
                  </button>
                  {openFaq === index && (
                    <div className="px-6 pb-6">
                      <p style={{ color: mutedTextColor }}>
                        {faq.answer}
                      </p>
                    </div>
                  )}
                </div>
              </FadeInOnScroll>
            ))}
          </div>
        </div>
      </section>

      {/* Section Divider */}
      <div className="section-divider" />

      {/* ============================================
          SECTION 8: FINAL CTA
          ============================================ */}
      <section className="relative py-24 overflow-hidden">
        {/* Gradient Background */}
        <div 
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse at center, color-mix(in oklab, var(--primary) 15%, transparent 85%) 0%, transparent 60%),
              var(--surface)
            `,
          }}
        />
        
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative text-center">
          <FadeInOnScroll>
            <h2 
              className="text-4xl md:text-6xl font-bold mb-6 glow-text"
              style={{ color: textColor }}
            >
              Ready to{' '}
              <span className="gradient-text">Forge</span>
              {' '}Something Amazing?
            </h2>
          </FadeInOnScroll>
          
          <FadeInOnScroll delay={0.1}>
            <p className="text-xl mb-10" style={{ color: mutedTextColor }}>
              Join creators who demand more from their images
            </p>
          </FadeInOnScroll>
          
          <FadeInOnScroll delay={0.2}>
            <button
              onClick={() => onGetStarted('free')}
              className="group inline-flex items-center space-x-3 text-white px-12 py-6 rounded-2xl font-bold text-2xl transition-all duration-300 hover:scale-105"
              style={{
                background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                boxShadow: `
                  0 0 60px color-mix(in oklab, var(--primary) 60%, transparent 40%),
                  0 15px 50px color-mix(in oklab, var(--primary) 50%, transparent 50%)
                `,
              }}
            >
              <span>Start Free — 5 Upscales on Us</span>
              <ArrowRight className="w-7 h-7 group-hover:translate-x-2 transition-transform" />
            </button>
          </FadeInOnScroll>
          
          <FadeInOnScroll delay={0.3}>
            <p className="mt-6 text-sm" style={{ color: mutedTextColor }}>
              No credit card required • Cancel anytime
            </p>
          </FadeInOnScroll>
        </div>
      </section>

      {/* Disclaimer */}
      <section className="py-12">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div 
            className="rounded-xl p-6 glass-card"
            style={{ borderColor: 'color-mix(in oklab, var(--accent) 20%, transparent 80%)' }}
          >
            <div className="flex items-start space-x-3">
              <Info className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--accent)' }} />
              <p className="text-sm" style={{ color: mutedTextColor }}>
                <strong style={{ color: textColor }}>About AI Upscaling:</strong> Results depend on original image quality. AI enhancement adds detail based on patterns learned from millions of images, but cannot recreate information that wasn't in the original. Best results with images under 1000px. Processing time varies based on image size and selected scale.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// Main export - wraps content in ThemeProvider with Forge scheme (tone 15 = dark)
export function Homepage({ onGetStarted, onLogin }: HomepageProps) {
  return (
    <ThemeProvider initialTone={15}>
      <HomepageContent onGetStarted={onGetStarted} onLogin={onLogin} />
    </ThemeProvider>
  );
}
