import React, { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useThemeLab } from '../contexts/ThemeContext';
import { useImageProcessing } from '../contexts/ImageProcessingContext';
import { User, Mail, Lock, CreditCard, MapPin, Phone, Edit3, Save, X, Eye, EyeOff } from 'lucide-react';

export function UserAccount() {
  const { userProfile, user } = useAuth();
  const { realUserProfile } = useImageProcessing();
  const { tone } = useThemeLab();
  
  // Calculate adaptive text colors based on tone
  const textColor = useMemo(() => {
    return tone <= 50 ? 'hsl(0, 0%, 96%)' : 'hsl(0, 0%, 12%)';
  }, [tone]);

  const mutedTextColor = useMemo(() => {
    return tone <= 50 ? 'hsl(0, 0%, 75%)' : 'hsl(0, 0%, 35%)';
  }, [tone]);

  const elevTextColor = useMemo(() => {
    return tone <= 40 ? 'hsl(0, 0%, 96%)' : 'hsl(0, 0%, 15%)';
  }, [tone]);
  
  const [isEditing, setIsEditing] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    displayName: userProfile?.displayName || '',
    email: userProfile?.email || '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    country: ''
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handlePasswordChange = (field: string, value: string) => {
    setPasswordData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.displayName.trim()) {
      newErrors.displayName = 'Display name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validatePasswordForm = () => {
    const newErrors: Record<string, string> = {};

    if (!passwordData.currentPassword) {
      newErrors.currentPassword = 'Current password is required';
    }

    if (!passwordData.newPassword) {
      newErrors.newPassword = 'New password is required';
    } else if (passwordData.newPassword.length < 6) {
      newErrors.newPassword = 'Password must be at least 6 characters';
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      // Here you would update the user profile in the database
      console.log('Saving user profile:', formData);
      setIsEditing(false);
      // Show success message
    } catch (error) {
      console.error('Error saving profile:', error);
      setErrors({ general: 'Failed to save profile. Please try again.' });
    }
  };

  const handlePasswordUpdate = async () => {
    if (!validatePasswordForm()) return;

    try {
      // Here you would update the user password
      console.log('Updating password');
      setShowPasswordChange(false);
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      // Show success message
    } catch (error) {
      console.error('Error updating password:', error);
      setErrors({ password: 'Failed to update password. Please try again.' });
    }
  };

  const handleCancel = () => {
    setFormData({
      displayName: userProfile?.displayName || '',
      email: userProfile?.email || '',
      phone: '',
      address: '',
      city: '',
      state: '',
      zipCode: '',
      country: ''
    });
    setIsEditing(false);
    setErrors({});
  };

  return (
    <div style={{ maxWidth: 'calc(100vw - 590px)', margin: '0 290px 0 300px', padding: '2rem 0' }}>
      <h2 className="text-2xl font-bold mb-6" style={{ color: textColor }}>Account & Settings</h2>
      <div className="space-y-5">
      {/* Profile Information */}
      <div className="backdrop-blur-sm rounded-xl p-6 border" style={{
        background: 'var(--elev)',
        borderColor: 'var(--border)',
        boxShadow: 'var(--shadow-1)'
      }}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold" style={{ color: elevTextColor }}>Profile Information</h3>
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center space-x-2 transition-colors"
              style={{ color: 'var(--primary)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.filter = 'brightness(1.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.filter = 'brightness(1)';
              }}
            >
              <Edit3 className="w-4 h-4" />
              <span>Edit</span>
            </button>
          ) : (
            <div className="flex items-center space-x-2">
              <button
                onClick={handleSave}
                className="flex items-center space-x-2 px-3 py-1.5 rounded-lg transition-all"
                style={{
                  background: 'linear-gradient(to right, var(--primary), var(--secondary))',
                  color: 'white'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.filter = 'brightness(1.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.filter = 'brightness(1)';
                }}
              >
                <Save className="w-4 h-4" />
                <span>Save</span>
              </button>
              <button
                onClick={handleCancel}
                className="flex items-center space-x-2 px-3 py-1.5 rounded-lg transition-all"
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
                <X className="w-4 h-4" />
                <span>Cancel</span>
              </button>
            </div>
          )}
        </div>

        {errors.general && (
          <div className="mb-4 p-3 border rounded-lg" style={{
            background: 'color-mix(in oklab, var(--accent) 15%, transparent 85%)',
            borderColor: 'var(--accent)'
          }}>
            <p className="text-sm" style={{ color: 'var(--accent)' }}>{errors.general}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Display Name */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: elevTextColor }}>
              Display Name
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5" style={{ color: mutedTextColor }} />
              <input
                type="text"
                value={formData.displayName}
                onChange={(e) => handleInputChange('displayName', e.target.value)}
                disabled={!isEditing}
                className="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:outline-none"
                style={{
                  background: isEditing ? 'var(--surface)' : 'var(--elev)',
                  color: elevTextColor,
                  borderColor: errors.displayName ? 'var(--accent)' : 'var(--border)',
                  '--tw-ring-color': 'var(--primary)'
                } as React.CSSProperties}
                placeholder="Enter your display name"
              />
            </div>
            {errors.displayName && <p className="text-sm mt-1" style={{ color: 'var(--accent)' }}>{errors.displayName}</p>}
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: elevTextColor }}>
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5" style={{ color: mutedTextColor }} />
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                disabled={!isEditing}
                className="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:outline-none"
                style={{
                  background: isEditing ? 'var(--surface)' : 'var(--elev)',
                  color: elevTextColor,
                  borderColor: errors.email ? 'var(--accent)' : 'var(--border)',
                  '--tw-ring-color': 'var(--primary)'
                } as React.CSSProperties}
                placeholder="Enter your email"
              />
            </div>
            {errors.email && <p className="text-sm mt-1" style={{ color: 'var(--accent)' }}>{errors.email}</p>}
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: elevTextColor }}>
              Phone Number (Optional)
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5" style={{ color: mutedTextColor }} />
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                disabled={!isEditing}
                className="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:outline-none"
                style={{
                  background: isEditing ? 'var(--surface)' : 'var(--elev)',
                  color: elevTextColor,
                  borderColor: 'var(--border)',
                  '--tw-ring-color': 'var(--primary)'
                } as React.CSSProperties}
                placeholder="Enter your phone number"
              />
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: elevTextColor }}>
              Address (Optional)
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5" style={{ color: mutedTextColor }} />
              <input
                type="text"
                value={formData.address}
                onChange={(e) => handleInputChange('address', e.target.value)}
                disabled={!isEditing}
                className="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:outline-none"
                style={{
                  background: isEditing ? 'var(--surface)' : 'var(--elev)',
                  color: elevTextColor,
                  borderColor: 'var(--border)',
                  '--tw-ring-color': 'var(--primary)'
                } as React.CSSProperties}
                placeholder="Enter your address"
              />
            </div>
          </div>

          {/* City */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: elevTextColor }}>
              City (Optional)
            </label>
            <input
              type="text"
              value={formData.city}
              onChange={(e) => handleInputChange('city', e.target.value)}
              disabled={!isEditing}
              className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:outline-none"
              style={{
                background: isEditing ? 'var(--surface)' : 'var(--elev)',
                color: elevTextColor,
                borderColor: 'var(--border)',
                '--tw-ring-color': 'var(--primary)'
              } as React.CSSProperties}
              placeholder="Enter your city"
            />
          </div>

          {/* State */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: elevTextColor }}>
              State/Province (Optional)
            </label>
            <input
              type="text"
              value={formData.state}
              onChange={(e) => handleInputChange('state', e.target.value)}
              disabled={!isEditing}
              className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:outline-none"
              style={{
                background: isEditing ? 'var(--surface)' : 'var(--elev)',
                color: elevTextColor,
                borderColor: 'var(--border)',
                '--tw-ring-color': 'var(--primary)'
              } as React.CSSProperties}
              placeholder="Enter your state/province"
            />
          </div>
        </div>
      </div>

      {/* Password Section */}
      <div className="backdrop-blur-sm rounded-xl p-6 border" style={{
        background: 'var(--elev)',
        borderColor: 'var(--border)',
        boxShadow: 'var(--shadow-1)'
      }}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold" style={{ color: elevTextColor }}>Password & Security</h3>
          <button
            onClick={() => setShowPasswordChange(!showPasswordChange)}
            className="flex items-center space-x-2 transition-colors"
            style={{ color: 'var(--primary)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.filter = 'brightness(1.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.filter = 'brightness(1)';
            }}
          >
            <Lock className="w-4 h-4" />
            <span>Change Password</span>
          </button>
        </div>

        {showPasswordChange && (
          <div className="space-y-4">
            {errors.password && (
              <div className="p-3 border rounded-lg" style={{
                background: 'color-mix(in oklab, var(--accent) 15%, transparent 85%)',
                borderColor: 'var(--accent)'
              }}>
                <p className="text-sm" style={{ color: 'var(--accent)' }}>{errors.password}</p>
              </div>
            )}

            {/* Current Password */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: elevTextColor }}>
                Current Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5" style={{ color: mutedTextColor }} />
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={passwordData.currentPassword}
                  onChange={(e) => handlePasswordChange('currentPassword', e.target.value)}
                  className="w-full pl-10 pr-12 py-3 border rounded-lg focus:ring-2 focus:outline-none"
                  style={{
                    background: 'var(--surface)',
                    color: elevTextColor,
                    borderColor: errors.currentPassword ? 'var(--accent)' : 'var(--border)',
                    '--tw-ring-color': 'var(--primary)'
                  } as React.CSSProperties}
                  placeholder="Enter current password"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 transition-colors"
                  style={{ color: mutedTextColor }}
                >
                  {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.currentPassword && <p className="text-sm mt-1" style={{ color: 'var(--accent)' }}>{errors.currentPassword}</p>}
            </div>

            {/* New Password */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: elevTextColor }}>
                New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5" style={{ color: mutedTextColor }} />
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={passwordData.newPassword}
                  onChange={(e) => handlePasswordChange('newPassword', e.target.value)}
                  className="w-full pl-10 pr-12 py-3 border rounded-lg focus:ring-2 focus:outline-none"
                  style={{
                    background: 'var(--surface)',
                    color: elevTextColor,
                    borderColor: errors.newPassword ? 'var(--accent)' : 'var(--border)',
                    '--tw-ring-color': 'var(--primary)'
                  } as React.CSSProperties}
                  placeholder="Enter new password"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 transition-colors"
                  style={{ color: mutedTextColor }}
                >
                  {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.newPassword && <p className="text-sm mt-1" style={{ color: 'var(--accent)' }}>{errors.newPassword}</p>}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: elevTextColor }}>
                Confirm New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5" style={{ color: mutedTextColor }} />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={passwordData.confirmPassword}
                  onChange={(e) => handlePasswordChange('confirmPassword', e.target.value)}
                  className="w-full pl-10 pr-12 py-3 border rounded-lg focus:ring-2 focus:outline-none"
                  style={{
                    background: 'var(--surface)',
                    color: elevTextColor,
                    borderColor: errors.confirmPassword ? 'var(--accent)' : 'var(--border)',
                    '--tw-ring-color': 'var(--primary)'
                  } as React.CSSProperties}
                  placeholder="Confirm new password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 transition-colors"
                  style={{ color: mutedTextColor }}
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.confirmPassword && <p className="text-sm mt-1" style={{ color: 'var(--accent)' }}>{errors.confirmPassword}</p>}
            </div>

            <div className="flex space-x-3">
              <button
                onClick={handlePasswordUpdate}
                className="px-4 py-2 rounded-lg transition-all"
                style={{
                  background: 'linear-gradient(to right, var(--primary), var(--secondary))',
                  color: 'white'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.filter = 'brightness(1.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.filter = 'brightness(1)';
                }}
              >
                Update Password
              </button>
              <button
                onClick={() => {
                  setShowPasswordChange(false);
                  setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                  setErrors({});
                }}
                className="px-4 py-2 rounded-lg transition-all"
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
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Subscription Section */}
      <div className="backdrop-blur-sm rounded-xl p-6 border" style={{
        background: 'var(--elev)',
        borderColor: 'var(--border)',
        boxShadow: 'var(--shadow-1)'
      }}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold" style={{ color: elevTextColor }}>Subscription</h3>
          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent('navigate-to-billing'));
            }}
            className="flex items-center space-x-2 transition-colors"
            style={{ color: 'var(--primary)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.filter = 'brightness(1.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.filter = 'brightness(1)';
            }}
          >
            <CreditCard className="w-4 h-4" />
            <span>Manage Subscription</span>
          </button>
        </div>

        <div className="rounded-lg p-4" style={{ background: 'var(--surface)' }}>
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium" style={{ color: elevTextColor }}>Current Plan</h4>
              {(() => {
                // Infer plan from upscales if subscription_tiers is not loaded
                const inferPlanFromUpscales = (upscales: number | null | undefined): string => {
                  if (!upscales) return 'basic';
                  if (upscales >= 2750) return 'mega';
                  if (upscales >= 1250) return 'enterprise';
                  if (upscales >= 500) return 'pro';
                  return 'basic';
                };

                let planName = realUserProfile?.subscription_tiers?.name?.toLowerCase()?.trim();
                
                // If subscription_tiers is null/empty but we have monthly_upscales_limit, infer the plan
                if ((!planName || planName === '') && realUserProfile?.monthly_upscales_limit) {
                  planName = inferPlanFromUpscales(realUserProfile.monthly_upscales_limit);
                  console.log('[UserAccount] Inferred plan from upscales:', planName, 'from limit:', realUserProfile.monthly_upscales_limit);
                }
                
                // If still no plan, try to infer from monthly_upscales_limit
                if ((!planName || planName === '') && realUserProfile?.monthly_upscales_limit) {
                  planName = inferPlanFromUpscales(realUserProfile.monthly_upscales_limit);
                }
                
                planName = planName || 'basic';
                console.log('[UserAccount] Final planName:', planName);
                
                const planUpscales = realUserProfile?.subscription_tiers?.monthly_upscales 
                  || realUserProfile?.monthly_upscales_limit 
                  || (planName === 'basic' ? 100 : planName === 'pro' ? 500 : planName === 'enterprise' ? 1250 : 2750);
                const planPrices: Record<string, number> = {
                  basic: 7.99,
                  pro: 19.99,
                  enterprise: 39.99,
                  mega: 79.99
                };
                const displayName = planName.charAt(0).toUpperCase() + planName.slice(1).toLowerCase();
                const price = realUserProfile?.subscription_tiers?.monthly_price || planPrices[planName] || 7.99;
                
                return (
                  <>
                    <p className="text-sm" style={{ color: mutedTextColor }}>
                      {displayName} Plan - {planUpscales.toLocaleString()} upscales/month
                    </p>
                  </>
                );
              })()}
            </div>
            <div className="text-right">
              {(() => {
                // Infer plan from upscales if subscription_tiers is not loaded
                const inferPlanFromUpscales = (upscales: number | null | undefined): string => {
                  if (!upscales) return 'basic';
                  if (upscales >= 2750) return 'mega';
                  if (upscales >= 1250) return 'enterprise';
                  if (upscales >= 500) return 'pro';
                  return 'basic';
                };

                let planName = realUserProfile?.subscription_tiers?.name?.toLowerCase()?.trim();
                
                // If subscription_tiers is null/empty but we have monthly_upscales_limit, infer the plan
                if ((!planName || planName === '') && realUserProfile?.monthly_upscales_limit) {
                  planName = inferPlanFromUpscales(realUserProfile.monthly_upscales_limit);
                  console.log('[UserAccount] Inferred plan from upscales:', planName, 'from limit:', realUserProfile.monthly_upscales_limit);
                }
                
                // If still no plan, try to infer from monthly_upscales_limit
                if ((!planName || planName === '') && realUserProfile?.monthly_upscales_limit) {
                  planName = inferPlanFromUpscales(realUserProfile.monthly_upscales_limit);
                }
                
                planName = planName || 'basic';
                console.log('[UserAccount] Final planName:', planName);
                
                const planPrices: Record<string, number> = {
                  basic: 7.99,
                  pro: 19.99,
                  enterprise: 39.99,
                  mega: 79.99
                };
                const price = realUserProfile?.subscription_tiers?.monthly_price || planPrices[planName] || 7.99;
                
                return (
                  <>
                    <p className="font-bold" style={{ color: elevTextColor }}>${price.toFixed(2)}/month</p>
                    <p className="text-sm" style={{ color: 'var(--primary)' }}>Active</p>
                  </>
                );
              })()}
            </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
