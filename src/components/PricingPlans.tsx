import React, { useState, useMemo } from 'react';
import { Check, Star, Zap, Crown, ArrowRight, Upload, Gift, Lock, TrendingUp } from 'lucide-react';
import { useThemeLab } from '../contexts/ThemeContext';

interface PricingPlansProps {
  onGetStarted: (plan: string) => void;
}

interface PlanFeature {
  text: string;
  included: boolean;
  highlight?: boolean;
}

interface Plan {
  id: string;
  name: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  upscales: number;
  maxScale: string;
  features: PlanFeature[];
  icon: React.ElementType;
  popular: boolean;
  isFree?: boolean;
  upgradeHook?: string;
}

export function PricingPlans({ onGetStarted }: PricingPlansProps) {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const { tone } = useThemeLab();

  // Calculate text colors based on tone
  const textColor = useMemo(() => {
    return tone <= 50 ? 'hsl(0, 0%, 96%)' : 'hsl(0, 0%, 12%)';
  }, [tone]);

  const mutedTextColor = useMemo(() => {
    return tone <= 50 ? 'hsl(0, 0%, 70%)' : 'hsl(0, 0%, 40%)';
  }, [tone]);

  const plans: Plan[] = [
    {
      id: 'free',
      name: 'Free',
      description: 'Try AI upscaling risk-free',
      monthlyPrice: 0,
      yearlyPrice: 0,
      upscales: 5,
      maxScale: '4x',
      features: [
        { text: '5 AI upscales (lifetime)', included: true },
        { text: 'Up to 4x scaling', included: true },
        { text: 'Photo & Art presets', included: true },
        { text: 'JPEG, PNG, WebP support', included: true },
        { text: 'Anime & Text presets', included: false },
      ],
      icon: Gift,
      popular: false,
      isFree: true,
      upgradeHook: 'Unlock higher scales + more presets',
    },
    {
      id: 'starter',
      name: 'Starter',
      description: 'Great for personal projects',
      monthlyPrice: 4.99,
      yearlyPrice: 49.99,
      upscales: 75,
      maxScale: '8x',
      features: [
        { text: '75 upscales per month', included: true },
        { text: 'Up to 8x scaling', included: true, highlight: true },
        { text: 'Photo & Art presets', included: true },
        { text: 'JPEG, PNG, WebP support', included: true },
        { text: 'Email support', included: true },
        { text: 'Anime & Text presets', included: false },
      ],
      icon: Upload,
      popular: false,
      upgradeHook: 'Unlock ALL presets + 16x scaling',
    },
    {
      id: 'pro',
      name: 'Pro',
      description: 'For professionals & creators',
      monthlyPrice: 12.99,
      yearlyPrice: 129.99,
      upscales: 300,
      maxScale: '16x',
      features: [
        { text: '300 upscales per month', included: true },
        { text: 'Up to 16x scaling', included: true, highlight: true },
        { text: 'ALL presets (Photo, Art, Anime, Text)', included: true, highlight: true },
        { text: 'JPEG, PNG, WebP support', included: true },
        { text: 'Priority support', included: true },
        { text: '24x scaling', included: false },
      ],
      icon: Zap,
      popular: true,
      upgradeHook: 'Unlock 24x scaling + more upscales',
    },
    {
      id: 'mega',
      name: 'Mega',
      description: 'Maximum power & capacity',
      monthlyPrice: 39.99,
      yearlyPrice: 399.99,
      upscales: 1500,
      maxScale: '24x',
      features: [
        { text: '1,500 upscales per month', included: true, highlight: true },
        { text: 'Up to 24x scaling (max)', included: true, highlight: true },
        { text: 'ALL presets (Photo, Art, Anime, Text)', included: true },
        { text: 'JPEG, PNG, WebP support', included: true },
        { text: 'Priority support', included: true },
      ],
      icon: Crown,
      popular: false,
    },
  ];

  const getPrice = (plan: Plan) => {
    return billingCycle === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice;
  };

  const getSavings = (plan: Plan) => {
    if (plan.monthlyPrice === 0) return 0;
    const monthlyTotal = plan.monthlyPrice * 12;
    const savings = monthlyTotal - plan.yearlyPrice;
    return Math.round((savings / monthlyTotal) * 100);
  };

  // Gradient colors for each plan
  const planGradients = {
    free: 'from-gray-500 to-gray-600',
    starter: 'from-blue-500 to-cyan-500',
    pro: 'from-orange-500 to-red-500',
    mega: 'from-purple-500 to-pink-500',
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 relative">
      <div className="text-center mb-12">
        <h2 
          className="text-3xl md:text-4xl font-bold mb-4"
          style={{ color: textColor }}
        >
          Choose Your Plan
        </h2>
        <p 
          className="text-xl mb-8"
          style={{ color: mutedTextColor }}
        >
          Simple pricing, powerful results
        </p>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center space-x-4 mb-8">
          <span 
            className="text-sm font-medium"
            style={{ color: billingCycle === 'monthly' ? textColor : mutedTextColor }}
          >
            Monthly
          </span>
          <button
            onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
            className="relative inline-flex h-7 w-14 items-center rounded-full transition-all duration-300"
            style={{
              background: billingCycle === 'yearly' 
                ? 'linear-gradient(to right, var(--primary), var(--secondary))' 
                : 'rgba(255, 255, 255, 0.2)',
              boxShadow: billingCycle === 'yearly' 
                ? '0 0 20px color-mix(in oklab, var(--primary) 40%, transparent 60%)' 
                : 'none',
            }}
          >
            <span
              className="inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform duration-300"
              style={{ transform: billingCycle === 'yearly' ? 'translateX(32px)' : 'translateX(4px)' }}
            />
          </button>
          <span 
            className="text-sm font-medium"
            style={{ color: billingCycle === 'yearly' ? textColor : mutedTextColor }}
          >
            Yearly
          </span>
          {billingCycle === 'yearly' && (
            <span 
              className="px-3 py-1 rounded-full text-xs font-semibold"
              style={{
                background: 'linear-gradient(to right, var(--primary), var(--secondary))',
                color: 'white',
              }}
            >
              Save 17%
            </span>
          )}
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {plans.map((plan) => {
          const Icon = plan.icon;
          const price = getPrice(plan);
          const savings = getSavings(plan);
          const gradient = planGradients[plan.id as keyof typeof planGradients];
          
          return (
            <div
              key={plan.id}
              className={`relative rounded-2xl p-6 flex flex-col glass-card transition-all duration-300 hover:scale-[1.02] ${
                plan.popular ? 'ring-2 ring-orange-500 scale-[1.02]' : ''
              }`}
              style={{
                borderColor: plan.popular 
                  ? 'var(--primary)' 
                  : 'color-mix(in oklab, var(--border) 50%, transparent 50%)',
                boxShadow: plan.popular 
                  ? '0 0 40px color-mix(in oklab, var(--primary) 30%, transparent 70%)' 
                  : undefined,
              }}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <div 
                    className="text-white px-4 py-1 rounded-full text-xs font-semibold flex items-center space-x-1"
                    style={{
                      background: 'linear-gradient(to right, var(--primary), var(--secondary))',
                      boxShadow: '0 4px 15px color-mix(in oklab, var(--primary) 40%, transparent 60%)',
                    }}
                  >
                    <Star className="w-3 h-3" />
                    <span>Most Popular</span>
                  </div>
                </div>
              )}

              <div className="text-center mb-6">
                <div 
                  className={`w-14 h-14 bg-gradient-to-br ${gradient} rounded-full flex items-center justify-center mx-auto mb-3`}
                  style={{
                    boxShadow: `0 8px 25px color-mix(in oklab, var(--primary) 30%, transparent 70%)`,
                  }}
                >
                  <Icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-1" style={{ color: textColor }}>
                  {plan.name}
                </h3>
                <p className="text-sm" style={{ color: mutedTextColor }}>
                  {plan.description}
                </p>
              </div>
              
              {/* Price */}
              <div className="text-center mb-4">
                {plan.isFree ? (
                  <span className="text-3xl font-bold" style={{ color: textColor }}>Free</span>
                ) : (
                  <>
                    <span className="text-3xl font-bold" style={{ color: textColor }}>${price}</span>
                    <span className="text-sm" style={{ color: mutedTextColor }}>
                      /{billingCycle === 'monthly' ? 'mo' : 'yr'}
                    </span>
                    {billingCycle === 'yearly' && savings > 0 && (
                      <div className="text-xs font-medium mt-1" style={{ color: 'var(--primary)' }}>
                        Save {savings}%
                      </div>
                    )}
                  </>
                )}
              </div>
              
              {/* Upscales & Scale */}
              <div 
                className="text-center py-3 rounded-lg mb-4"
                style={{ background: 'rgba(255, 255, 255, 0.05)' }}
              >
                <div className="text-lg font-semibold" style={{ color: textColor }}>
                  {plan.isFree 
                    ? `${plan.upscales} upscales` 
                    : `${plan.upscales.toLocaleString()}/mo`
                  }
                </div>
                <div className="text-xs" style={{ color: mutedTextColor }}>
                  Up to {plan.maxScale} scaling
                </div>
              </div>

              {/* Features */}
              <ul className="space-y-2 mb-6 flex-grow">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    {feature.included ? (
                      <Check 
                        className="w-4 h-4 mt-0.5 flex-shrink-0" 
                        style={{ color: feature.highlight ? 'var(--primary)' : '#22c55e' }} 
                      />
                    ) : (
                      <Lock 
                        className="w-4 h-4 mt-0.5 flex-shrink-0" 
                        style={{ color: mutedTextColor, opacity: 0.5 }} 
                      />
                    )}
                    <span 
                      className="text-sm"
                      style={{ 
                        color: feature.included 
                          ? (feature.highlight ? textColor : mutedTextColor)
                          : mutedTextColor,
                        opacity: feature.included ? 1 : 0.5,
                        textDecoration: feature.included ? 'none' : 'line-through',
                      }}
                    >
                      {feature.text}
                    </span>
                  </li>
                ))}
              </ul>

              {/* Upgrade Hook */}
              {plan.upgradeHook && (
                <div 
                  className="text-xs text-center mb-4 py-2 px-3 rounded-lg"
                  style={{ 
                    background: 'color-mix(in oklab, var(--primary) 10%, transparent 90%)',
                    color: 'var(--primary)',
                  }}
                >
                  <TrendingUp className="w-3 h-3 inline mr-1" />
                  {plan.upgradeHook}
                </div>
              )}

              {/* CTA Button */}
              <button
                onClick={() => onGetStarted(plan.id)}
                className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-300 flex items-center justify-center space-x-2 ${
                  plan.popular ? 'neon-glow-subtle' : ''
                }`}
                style={{
                  background: plan.popular 
                    ? 'linear-gradient(to right, var(--primary), var(--secondary))'
                    : `linear-gradient(to right, ${gradient.replace('from-', '').replace(' to-', ', ').replace('-500', '').replace('-600', '')})`,
                  color: 'white',
                  boxShadow: plan.popular 
                    ? '0 8px 25px color-mix(in oklab, var(--primary) 40%, transparent 60%)'
                    : undefined,
                }}
              >
                <span>{plan.isFree ? 'Start Free' : `Choose ${plan.name}`}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
