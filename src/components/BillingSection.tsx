import React, { useState, useMemo } from 'react';
import { Check, CreditCard, Star, Zap, Crown, Calendar, DollarSign, Plus, Edit3, AlertCircle, TrendingUp } from 'lucide-react';
import { useThemeLab } from '../contexts/ThemeContext';
import { useImageProcessing } from '../contexts/ImageProcessingContext';

export function BillingSection() {
  const { tone } = useThemeLab();
  const { realUserProfile, userStats } = useImageProcessing();
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [showEditPayment, setShowEditPayment] = useState(false);

  // Pricing matches homepage: Basic $7.99, Pro $19.99, Enterprise $39.99, Mega $79.99
  const planPrices: Record<string, number> = {
    basic: 7.99,
    pro: 19.99,
    enterprise: 39.99,
    mega: 79.99
  };
  const planTokens: Record<string, number> = {
    basic: 100,
    pro: 500,
    enterprise: 1250,
    mega: 2750
  };

  // Infer plan from tokens if subscription_tiers is not loaded
  const inferPlanFromTokens = (tokens: number | null | undefined): string => {
    if (!tokens) return 'basic';
    if (tokens >= 2750) return 'mega';
    if (tokens >= 1250) return 'enterprise';
    if (tokens >= 500) return 'pro';
    return 'basic';
  };

  const currentPlan = useMemo(() => {
    // Debug logging
    console.log('[BillingSection] realUserProfile:', realUserProfile);
    console.log('[BillingSection] subscription_tiers:', realUserProfile?.subscription_tiers);
    console.log('[BillingSection] subscription_tier_id:', realUserProfile?.subscription_tier_id);
    console.log('[BillingSection] monthly_upscales_limit:', realUserProfile?.monthly_upscales_limit);

    // Get plan name from subscription_tiers, or infer from monthly_upscales_limit
    let planName = realUserProfile?.subscription_tiers?.name?.toLowerCase()?.trim();
    
    // If subscription_tiers is null/empty but we have monthly_upscales_limit, infer the plan
    if ((!planName || planName === '') && realUserProfile?.monthly_upscales_limit) {
      planName = inferPlanFromTokens(realUserProfile.monthly_upscales_limit);
      console.log('[BillingSection] Inferred plan from tokens:', planName, 'from limit:', realUserProfile.monthly_upscales_limit);
    }
    
    // If still no plan, try to infer from monthly_upscales_limit even if subscription_tiers exists but name is missing
    if ((!planName || planName === '') && realUserProfile?.monthly_upscales_limit) {
      planName = inferPlanFromTokens(realUserProfile.monthly_upscales_limit);
      console.log('[BillingSection] Inferred plan (fallback):', planName);
    }
    
    // Fallback to Basic if still no plan
    planName = planName || 'basic';
    
    console.log('[BillingSection] Final planName:', planName);
    
    const name = planName.charAt(0).toUpperCase() + planName.slice(1).toLowerCase();
    const tokensIncluded = realUserProfile?.subscription_tiers?.monthly_upscales 
      || realUserProfile?.monthly_upscales_limit 
      || planTokens[planName] 
      || 100;
    const tokensUsed = realUserProfile?.current_month_upscales || userStats?.usedThisMonth || 0;
    
    // Calculate next billing date (30 days from now)
    const nextBillingDate = new Date();
    nextBillingDate.setDate(nextBillingDate.getDate() + 30);
    
    // Get price from subscription_tiers, or use planPrices based on inferred/actual plan
    const price = realUserProfile?.subscription_tiers?.monthly_price || planPrices[planName] || 7.99;
    
    console.log('[BillingSection] Final plan:', { name, planName, tokensIncluded, price });
    
    return {
      name,
      price,
    billingCycle: 'monthly',
      tokensIncluded,
      tokensUsed,
      nextBillingDate: nextBillingDate.toISOString().split('T')[0],
    status: 'active'
  };
  }, [realUserProfile, userStats]);

  const paymentMethods = [
    {
      id: 1,
      type: 'visa',
      last4: '4242',
      expiryMonth: 12,
      expiryYear: 2027,
      isDefault: true
    },
    {
      id: 2,
      type: 'mastercard',
      last4: '8888',
      expiryMonth: 8,
      expiryYear: 2026,
      isDefault: false
    }
  ];

  const billingHistory = [
    {
      id: 1,
      date: '2025-01-15',
      amount: 24.99,
      status: 'paid',
      description: 'Pro Plan - Monthly'
    },
    {
      id: 2,
      date: '2024-12-15',
      amount: 24.99,
      status: 'paid',
      description: 'Pro Plan - Monthly'
    },
    {
      id: 3,
      date: '2024-11-15',
      amount: 24.99,
      status: 'paid',
      description: 'Pro Plan - Monthly'
    }
  ];

  const getCardIcon = (type: string) => {
    switch (type) {
      case 'visa':
        return '💳';
      case 'mastercard':
        return '💳';
      case 'amex':
        return '💳';
      default:
        return '💳';
    }
  };

  const usagePercentage = (currentPlan.tokensUsed / currentPlan.tokensIncluded) * 100;
  const remainingTokens = currentPlan.tokensIncluded - currentPlan.tokensUsed;
  const daysUntilBilling = Math.ceil((new Date(currentPlan.nextBillingDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

  const textColor = useMemo(() => {
    return tone <= 50 ? 'hsl(0, 0%, 96%)' : 'hsl(0, 0%, 12%)';
  }, [tone]);

  const mutedTextColor = useMemo(() => {
    return tone <= 50 ? 'hsl(0, 0%, 75%)' : 'hsl(0, 0%, 35%)';
  }, [tone]);

  // Text color for elements on var(--elev) backgrounds
  // At 50% tone, --elev is light (#DBE0EA), so we need dark text
  const elevTextColor = useMemo(() => {
    if (tone <= 40) {
      return 'hsl(0, 0%, 96%)'; // Light text for dark elev backgrounds
    } else {
      return 'hsl(0, 0%, 15%)'; // Dark text for light elev backgrounds (including 50%)
    }
  }, [tone]);

  const elevMutedTextColor = useMemo(() => {
    if (tone <= 40) {
      return 'hsl(0, 0%, 75%)'; // Light muted text for dark elev backgrounds
    } else {
      return 'hsl(0, 0%, 45%)'; // Dark grey muted text for light elev backgrounds (including 50%)
    }
  }, [tone]);

  // Color for status indicators and accents on elev backgrounds
  const elevAccentColor = useMemo(() => {
    if (tone <= 40) {
      return 'var(--primary)'; // Use primary color on dark backgrounds
    } else {
      // On light backgrounds, use a darker version of primary or dark grey
      return 'hsl(220, 60%, 35%)'; // Dark blue-grey for good contrast
    }
  }, [tone]);

  return (
    <div style={{ maxWidth: 'calc(100vw - 590px)', margin: '0 290px 0 300px', padding: '2rem 0' }}>
      <h2 className="text-2xl font-bold mb-6" style={{ color: textColor }}>Billing & Account</h2>
      <div className="space-y-5">

      {/* Current Plan Overview */}
      <div className="backdrop-blur-sm rounded-xl p-6 border" style={{ 
        background: 'var(--elev)',
        borderColor: 'var(--border)',
        boxShadow: 'var(--shadow-1)'
      }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-semibold" style={{ color: elevTextColor }}>Current Plan</h3>
            <p style={{ color: elevMutedTextColor }}>Manage your subscription and usage</p>
          </div>
          <div className="flex items-center space-x-2 px-4 py-2 rounded-lg" style={{
            background: `linear-gradient(to right, var(--primary), color-mix(in oklab, var(--primary) 70%, var(--secondary) 30%))`,
            color: 'var(--on-primary)'
          }}>
            <Zap className="w-4 h-4" />
            <span className="font-medium">{currentPlan.name} Plan</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Plan Details */}
          <div className="rounded-lg p-4" style={{ background: 'var(--elev)' }}>
            <div className="flex items-center space-x-2 mb-2">
              <DollarSign className="w-5 h-5" style={{ color: tone <= 40 ? 'var(--primary)' : elevAccentColor }} />
              <h4 className="font-medium" style={{ color: elevTextColor }}>Monthly Bill</h4>
            </div>
            <p className="text-2xl font-bold" style={{ color: elevTextColor }}>${currentPlan.price}</p>
            <p className="text-sm" style={{ color: elevMutedTextColor }}>per month</p>
          </div>

          {/* Next Billing */}
          <div className="rounded-lg p-4" style={{ background: 'var(--elev)' }}>
            <div className="flex items-center space-x-2 mb-2">
              <Calendar className="w-5 h-5" style={{ color: tone <= 40 ? 'var(--secondary)' : elevAccentColor }} />
              <h4 className="font-medium" style={{ color: elevTextColor }}>Next Billing</h4>
            </div>
            <p className="text-2xl font-bold" style={{ color: elevTextColor }}>{daysUntilBilling}</p>
            <p className="text-sm" style={{ color: elevMutedTextColor }}>days remaining</p>
            <p className="text-xs mt-1" style={{ color: elevMutedTextColor }}>
              {new Date(currentPlan.nextBillingDate).toLocaleDateString()}
            </p>
          </div>

          {/* Usage */}
          <div className="rounded-lg p-4" style={{ background: 'var(--elev)' }}>
            <div className="flex items-center space-x-2 mb-2">
              <TrendingUp className="w-5 h-5" style={{ color: tone <= 40 ? 'var(--accent)' : elevAccentColor }} />
              <h4 className="font-medium" style={{ color: elevTextColor }}>Usage</h4>
            </div>
            <p className="text-2xl font-bold" style={{ color: elevTextColor }}>{currentPlan.tokensUsed}</p>
            <p className="text-sm" style={{ color: elevMutedTextColor }}>of {currentPlan.tokensIncluded} tokens</p>
            <div className="w-full rounded-full h-2 mt-2" style={{ background: 'color-mix(in oklab, var(--border) 50%, transparent 50%)' }}>
              <div 
                className="h-2 rounded-full transition-all duration-300"
                style={{ 
                  width: `${Math.min(100, usagePercentage)}%`,
                  background: `linear-gradient(to right, var(--primary), color-mix(in oklab, var(--primary) 70%, var(--secondary) 30%))`
                }}
              />
            </div>
          </div>
        </div>

        {/* Usage Alert */}
        {usagePercentage > 80 && (
          <div className="mt-4 p-3 border rounded-lg" style={{
            background: 'color-mix(in oklab, var(--accent) 15%, transparent 85%)',
            borderColor: 'var(--accent)'
          }}>
            <div className="flex items-start space-x-2">
              <AlertCircle className="w-5 h-5 mt-0.5" style={{ color: 'var(--accent)' }} />
              <div>
                <h4 className="font-medium" style={{ color: 'var(--text)' }}>Usage Alert</h4>
                <p className="text-sm" style={{ color: 'var(--muted)' }}>
                  You've used {Math.round(usagePercentage)}% of your monthly tokens. 
                  {remainingTokens} tokens remaining.
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* Token Usage Information */}
        <div className="mt-4 p-4 rounded-lg border" style={{
          background: tone <= 50 ? 'rgba(100, 100, 100, 0.1)' : 'rgba(200, 200, 200, 0.1)',
          borderColor: 'var(--border)'
        }}>
          <h4 className="font-medium mb-2" style={{ color: 'var(--text)', fontSize: '13px' }}>About Token Usage</h4>
          <ul className="space-y-1.5 text-xs" style={{ color: 'var(--muted)', lineHeight: '1.5' }}>
            <li>• <strong>Photos & Anime:</strong> 1 token per upscale for most images</li>
            <li>• <strong>Art & Illustrations:</strong> Uses premium SwinIR 4x processing for superior artistic quality. Token costs reflect actual processing (minimum 4x). Large images may require tiling (additional tokens).</li>
            <li>• <strong>High scales (20x-64x):</strong> May require multiple processing passes and additional tokens</li>
            <li>• <strong>Large images:</strong> Images over 1400px may be tiled for processing, using one token per tile</li>
          </ul>
        </div>
      </div>

      {/* Payment Methods */}
      <div className="backdrop-blur-sm rounded-xl p-6 border" style={{ 
        background: 'var(--elev)',
        borderColor: 'var(--border)',
        boxShadow: 'var(--shadow-1)'
      }}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold" style={{ color: elevTextColor }}>Payment Methods</h3>
          <button
            onClick={() => setShowAddPayment(true)}
            className="flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200"
            style={{
              background: `linear-gradient(to right, var(--primary), color-mix(in oklab, var(--primary) 70%, var(--secondary) 30%))`,
              color: 'var(--on-primary)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.filter = 'brightness(1.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.filter = 'brightness(1)';
            }}
          >
            <Plus className="w-4 h-4" />
            <span>Add Payment Method</span>
          </button>
        </div>

        <div className="space-y-3">
          {paymentMethods.map((method) => (
            <div key={method.id} className="flex items-center justify-between p-4 rounded-lg" style={{ background: 'var(--elev)' }}>
              <div className="flex items-center space-x-3">
                <span className="text-2xl">{getCardIcon(method.type)}</span>
                <div>
                  <p className="font-medium" style={{ color: elevTextColor }}>
                    •••• •••• •••• {method.last4}
                  </p>
                  <p className="text-sm" style={{ color: elevMutedTextColor }}>
                    Expires {method.expiryMonth}/{method.expiryYear}
                    {method.isDefault && (
                      <span className="ml-2 px-2 py-0.5 rounded-full text-xs" style={{
                        background: tone <= 40 
                          ? 'color-mix(in oklab, var(--primary) 20%, transparent 80%)'
                          : 'color-mix(in oklab, var(--primary) 25%, transparent 75%)',
                        color: tone <= 40 ? 'var(--primary)' : elevAccentColor
                      }}>
                        Default
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowEditPayment(true)}
                className="p-2 transition-colors"
                style={{ color: elevMutedTextColor }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = elevTextColor;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = elevMutedTextColor;
                }}
              >
                <Edit3 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Billing History */}
      <div className="backdrop-blur-sm rounded-xl p-6 border" style={{ 
        background: 'var(--elev)',
        borderColor: 'var(--border)',
        boxShadow: 'var(--shadow-1)'
      }}>
        <h3 className="text-xl font-semibold mb-6" style={{ color: elevTextColor }}>Billing History</h3>
        
        <div className="space-y-3">
          {billingHistory.map((bill) => (
            <div key={bill.id} className="flex items-center justify-between p-4 rounded-lg" style={{ background: 'var(--elev)' }}>
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 rounded-full" style={{ 
                  background: tone <= 40 ? 'var(--primary)' : elevAccentColor
                }}></div>
                <div>
                  <p className="font-medium" style={{ color: elevTextColor }}>{bill.description}</p>
                  <p className="text-sm" style={{ color: elevMutedTextColor }}>
                    {new Date(bill.date).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-medium" style={{ color: elevTextColor }}>${bill.amount}</p>
                <p className="text-sm capitalize" style={{ 
                  color: tone <= 40 ? 'var(--primary)' : elevAccentColor
                }}>{bill.status}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Plan Management */}
      <div className="backdrop-blur-sm rounded-xl p-6 border" style={{ 
        background: 'var(--elev)',
        borderColor: 'var(--border)',
        boxShadow: 'var(--shadow-1)'
      }}>
        <h3 className="text-xl font-semibold mb-4" style={{ color: elevTextColor }}>Plan Management</h3>
        
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('show-pricing-plans'))}
            className="flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200"
            style={{
              background: `linear-gradient(to right, var(--primary), color-mix(in oklab, var(--primary) 70%, var(--secondary) 30%))`,
              color: 'var(--on-primary)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.filter = 'brightness(1.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.filter = 'brightness(1)';
            }}
          >
            <Star className="w-4 h-4" />
            <span>Upgrade Plan</span>
          </button>
          
          <button 
            className="flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200"
            style={{
              background: 'var(--elev)',
              color: elevTextColor,
              border: '1px solid var(--border)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'color-mix(in oklab, var(--elev) 80%, var(--surface) 20%)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--elev)';
            }}
          >
            <Calendar className="w-4 h-4" />
            <span>Change Billing Cycle</span>
          </button>
          
          <button 
            className="flex items-center space-x-2 px-4 py-2 rounded-lg border transition-all duration-200"
            style={{
              color: 'var(--accent)',
              borderColor: 'var(--accent)',
              background: 'transparent'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'color-mix(in oklab, var(--accent) 15%, transparent 85%)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <span>Cancel Subscription</span>
          </button>
        </div>
      </div>

      {/* Add Payment Method Modal Placeholder */}
      {showAddPayment && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'rgba(0, 0, 0, 0.5)' }}>
          <div className="rounded-xl p-6 max-w-md w-full mx-4 border" style={{
            background: 'var(--elev)',
            borderColor: 'var(--border)',
            boxShadow: 'var(--shadow-1)'
          }}>
            <h3 className="text-xl font-semibold mb-4" style={{ color: 'var(--text)' }}>Add Payment Method</h3>
            <p className="mb-4" style={{ color: 'var(--muted)' }}>
              Payment method integration will be added during deployment phase.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowAddPayment(false)}
                className="flex-1 px-4 py-2 rounded-lg transition-colors"
                style={{
                  background: 'var(--elev)',
                  color: elevTextColor,
                  border: '1px solid var(--border)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'color-mix(in oklab, var(--elev) 80%, var(--surface) 20%)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--elev)';
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
