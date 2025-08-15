import React, { useState } from 'react';
import { Check, Star, Zap, Crown, ArrowRight, Upload, Sparkles, Users, Shield, Clock, TrendingUp, LogIn, ChevronDown, ChevronUp } from 'lucide-react';

interface PricingPlansProps {
  onGetStarted: (plan: string) => void;
}

export function PricingPlans({ onGetStarted }: PricingPlansProps) {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  const plans = [
    {
      id: 'basic',
      name: 'Basic',
      description: 'Perfect for personal projects and occasional use',
      monthlyPrice: 7.99,
      yearlyPrice: 79.99,
      upscales: 100,
      features: [
        '100 AI upscales per month',
        '2x, 4x, 8x scaling options',
        'Photo & Art quality presets',
        'JPEG, PNG, WebP support',
        'Basic customer support',
        'Download in original format'
      ],
      icon: Upload,
      color: 'from-blue-500 to-cyan-500',
      popular: false
    },
    {
      id: 'pro',
      name: 'Pro',
      description: 'Ideal for professionals and content creators',
      monthlyPrice: 24.99,
      yearlyPrice: 249.99,
      upscales: 500,
      features: [
        '500 AI upscales per month',
        '2x, 4x, 8x scaling options',
        'All quality presets (Photo, Art, Anime, Text)',
        'All format support + WebP conversion',
        'Priority customer support',
        'Batch processing',
        'API access',
        'Advanced download options'
      ],
      icon: Zap,
      color: 'from-orange-500 to-red-500',
      popular: true
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      description: 'For teams and high-volume processing needs',
      monthlyPrice: 49.99,
      yearlyPrice: 499.99,
      upscales: 2000,
      features: [
        '2000 AI upscales per month',
        'All scaling and quality options',
        'Custom quality presets',
        'All formats + custom output',
        'Dedicated account manager',
        'Unlimited batch processing',
        'Full API access with webhooks',
        'Custom integrations',
        'Team management',
        'Usage analytics'
      ],
      icon: Crown,
      color: 'from-purple-500 to-pink-500',
      popular: false
    }
  ];

  const getPrice = (plan: typeof plans[0]) => {
    return billingCycle === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice;
  };

  const getSavings = (plan: typeof plans[0]) => {
    const monthlyTotal = plan.monthlyPrice * 12;
    const savings = monthlyTotal - plan.yearlyPrice;
    return Math.round((savings / monthlyTotal) * 100);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="text-center mb-16">
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          Choose Your Plan
        </h2>
        <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
          Competitive pricing with no hidden fees
        </p>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center space-x-4 mb-12">
          <span className={`text-sm font-medium ${billingCycle === 'monthly' ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500'}`}>
            Monthly
          </span>
          <button
            onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              billingCycle === 'yearly' ? 'bg-gradient-to-r from-blue-600 to-green-600' : 'bg-gray-200'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                billingCycle === 'yearly' ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
          <span className={`text-sm font-medium ${billingCycle === 'yearly' ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500'}`}>
            Yearly
          </span>
          {billingCycle === 'yearly' && (
            <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
              Save up to 17%
            </span>
          )}
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {plans.map((plan) => {
          const Icon = plan.icon;
          const price = getPrice(plan);
          const savings = getSavings(plan);
          
          return (
            <div
              key={plan.id}
              className={`relative bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-2xl border-2 p-8 flex flex-col ${
                plan.popular 
                  ? 'border-orange-500 shadow-xl scale-105' 
                  : 'border-gray-200/50 dark:border-gray-700/50'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-4 py-1 rounded-full text-sm font-medium flex items-center space-x-1">
                    <Star className="w-4 h-4" />
                    <span>Most Popular</span>
                  </div>
                </div>
              )}

              <div className="text-center mb-8">
                <div className={`w-16 h-16 bg-gradient-to-br ${plan.color} rounded-full flex items-center justify-center mx-auto mb-4`}>
                  <Icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">{plan.name}</h3>
                <p className="text-gray-600 dark:text-gray-300 mb-4">{plan.description}</p>
                
                <div className="mb-4">
                  <span className="text-4xl font-bold text-gray-900 dark:text-gray-100">${price}</span>
                  <span className="text-gray-600 dark:text-gray-300">/{billingCycle === 'monthly' ? 'month' : 'year'}</span>
                  {billingCycle === 'yearly' && (
                    <div className="text-sm text-green-600 font-medium">Save {savings}%</div>
                  )}
                </div>
                
                <div className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">
                  {plan.upscales.toLocaleString()} upscales/month
                </div>
              </div>

              <ul className="space-y-3 mb-8 flex-grow">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start space-x-3">
                    <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700 dark:text-gray-300 text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => onGetStarted(plan.id)}
                className={`w-full py-3 px-6 rounded-lg font-medium transition-all duration-200 flex items-center justify-center space-x-2 ${
                  plan.popular
                    ? 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-lg'
                    : `bg-gradient-to-r ${plan.color} hover:shadow-lg text-white`
                }`}
              >
                <span>Choose {plan.name}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
