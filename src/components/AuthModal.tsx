import React, { useState } from 'react';
import { X, Mail, Lock, User, Eye, EyeOff, Key } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin?: (email: string, password: string) => void;
  onRegister?: (email: string, password: string, name: string, promoCode?: string) => void;
  selectedPlan?: string;
  onAuthSuccess?: () => void;
}

export function AuthModal({ isOpen, onClose, onLogin, onRegister, selectedPlan, onAuthSuccess }: AuthModalProps) {
  const { isReady, user, userProfile, login, register, recoverPassword } = useAuth();
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    confirmPassword: '',
    promoCode: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [authError, setAuthError] = useState<string>('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [recoveryMessage, setRecoveryMessage] = useState<string>('');
  const [recoverySuccess, setRecoverySuccess] = useState(false);

  // If not open, render nothing — avoids rendering logic while provider may still be initializing
  if (!isOpen) return null;

  // Never destructure or access fields that might be undefined. Gate on isReady.
  if (!isReady) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div 
          className="rounded-2xl max-w-md w-full p-6 relative"
          style={{
            background: 'var(--surface)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <div role="dialog" aria-busy="true" className="text-center">
            <p style={{ color: 'var(--text-primary)' }}>Loading authentication…</p>
          </div>
        </div>
      </div>
    );
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (!isLoginMode) {
      if (!formData.name) {
        newErrors.name = 'Name is required';
      }
      if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    try {
      setAuthError('');
      
     console.log('Attempting authentication...', { isLoginMode, email: formData.email });
     
      if (isLoginMode) {
        if (onLogin) {
          await onLogin(formData.email, formData.password);
        } else {
         console.log('Calling login function...');
          await login(formData.email, formData.password);
        }
       console.log('Login successful');
      } else {
        if (onRegister) {
          await onRegister(formData.email, formData.password, formData.name, formData.promoCode);
        } else {
         console.log('Calling register function...');
          await register(formData.email, formData.password, formData.name, formData.promoCode);
        }
       console.log('Registration successful');
      }
      
      // If we get here, auth was successful
     console.log('Authentication completed, closing modal and calling onAuthSuccess');
      onClose();
      onAuthSuccess?.();
    } catch (error) {
      console.error('Authentication error:', error);
      if (error instanceof Error) {
        if (error.message.includes('User already registered')) {
          setAuthError('An account with this email already exists. Please sign in instead.');
        } else {
          setAuthError(error.message);
        }
      } else {
        setAuthError('Authentication failed. Please try again.');
      }
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!forgotPasswordEmail) {
      setRecoveryMessage('Please enter your email address.');
      return;
    }

    if (!/\S+@\S+\.\S+/.test(forgotPasswordEmail)) {
      setRecoveryMessage('Please enter a valid email address.');
      return;
    }

    try {
      const result = await recoverPassword(forgotPasswordEmail);
      setRecoveryMessage(result.message);
      setRecoverySuccess(result.success);
    } catch {
      setRecoveryMessage('Failed to send password reset email. Please try again.');
      setRecoverySuccess(false);
    }
  };

  const getPlanName = (planId: string) => {
    switch (planId) {
      case 'basic': return 'Basic Plan';
      case 'pro': return 'Pro Plan';
      case 'enterprise': return 'Enterprise Plan';
      default: return '';
    }
  };

  const signedIn = !!user;

  // Input field styles using theme colors
  const inputStyle = {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    color: 'var(--text-primary)',
  };

  const inputErrorStyle = {
    ...inputStyle,
    border: '1px solid #ef4444',
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div 
        className="rounded-2xl max-w-md w-full p-6 relative shadow-2xl"
        style={{
          background: 'var(--surface)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full transition-colors"
          style={{ 
            color: 'var(--text-muted)',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          <X className="w-5 h-5" />
        </button>

        {signedIn ? (
          <div className="text-center">
            <h2 
              className="text-2xl font-bold mb-4"
              style={{ color: 'var(--text-primary)' }}
            >
              Welcome back!
            </h2>
            <p 
              className="mb-6"
              style={{ color: 'var(--text-muted)' }}
            >
              You are signed in as {userProfile?.displayName}
            </p>
            <button 
              className="px-6 py-3 rounded-lg font-medium transition-all duration-200 text-white"
              style={{
                background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
              }}
              onClick={() => {
                onClose();
                onAuthSuccess?.();
              }}
            >
              Continue
            </button>
          </div>
        ) : (
          <>
            <div className="text-center mb-6">
              <h2 
                className="text-2xl font-bold mb-2"
                style={{ color: 'var(--text-primary)' }}
              >
                {showForgotPassword ? 'Reset Password' : isLoginMode ? 'Welcome Back' : 'Create Account'}
              </h2>
              {selectedPlan && (
                <div 
                  className="rounded-lg p-3 mb-4"
                  style={{
                    background: 'linear-gradient(135deg, color-mix(in oklab, var(--primary) 20%, transparent 80%), color-mix(in oklab, var(--secondary) 20%, transparent 80%))',
                    border: '1px solid color-mix(in oklab, var(--primary) 30%, transparent 70%)',
                  }}
                >
                  <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                    You've selected the <span className="font-semibold">{getPlanName(selectedPlan)}</span>
                  </p>
                </div>
              )}
              <p style={{ color: 'var(--text-muted)' }}>
                {showForgotPassword
                  ? 'Enter your email address and we\'ll send you a link to reset your password'
                  : isLoginMode 
                  ? 'Sign in to your account to continue' 
                  : 'Create your account to get started'
                }
              </p>
            </div>

            {showForgotPassword ? (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                {recoveryMessage && (
                  <div 
                    className="rounded-lg p-3 mb-4"
                    style={{
                      background: recoverySuccess 
                        ? 'rgba(34, 197, 94, 0.1)' 
                        : 'rgba(239, 68, 68, 0.1)',
                      border: `1px solid ${recoverySuccess ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                    }}
                  >
                    <p 
                      className="text-sm"
                      style={{ color: recoverySuccess ? '#22c55e' : '#ef4444' }}
                    >
                      {recoveryMessage}
                    </p>
                  </div>
                )}

                <div>
                  <label 
                    className="block text-sm font-medium mb-1"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5" style={{ color: 'var(--text-muted)' }} />
                    <input
                      type="email"
                      value={forgotPasswordEmail}
                      onChange={(e) => setForgotPasswordEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-lg focus:outline-none focus:ring-2 transition-all"
                      style={{
                        ...inputStyle,
                        '--tw-ring-color': 'var(--primary)',
                      } as React.CSSProperties}
                      placeholder="Enter your email"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-lg font-medium transition-all duration-200 text-white"
                  style={{
                    background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                  }}
                >
                  Send Reset Email
                </button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotPassword(false);
                      setRecoveryMessage('');
                      setRecoverySuccess(false);
                      setForgotPasswordEmail('');
                    }}
                    className="font-medium transition-opacity hover:opacity-80"
                    style={{ color: 'var(--primary)' }}
                  >
                    Back to Sign In
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
              {authError && (
                <div 
                  className="rounded-lg p-3 mb-4"
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                  }}
                >
                  <p className="text-sm" style={{ color: '#ef4444' }}>{authError}</p>
                </div>
              )}

              {!isLoginMode && (
                <div>
                  <label 
                    className="block text-sm font-medium mb-1"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5" style={{ color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-lg focus:outline-none focus:ring-2 transition-all"
                      style={errors.name ? inputErrorStyle : inputStyle}
                      placeholder="Enter your full name"
                    />
                  </div>
                  {errors.name && <p className="text-sm mt-1" style={{ color: '#ef4444' }}>{errors.name}</p>}
                </div>
              )}

              <div>
                <label 
                  className="block text-sm font-medium mb-1"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5" style={{ color: 'var(--text-muted)' }} />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-lg focus:outline-none focus:ring-2 transition-all"
                    style={errors.email ? inputErrorStyle : inputStyle}
                    placeholder="Enter your email"
                  />
                </div>
                {errors.email && <p className="text-sm mt-1" style={{ color: '#ef4444' }}>{errors.email}</p>}
              </div>

              <div>
                <label 
                  className="block text-sm font-medium mb-1"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5" style={{ color: 'var(--text-muted)' }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    className="w-full pl-10 pr-12 py-3 rounded-lg focus:outline-none focus:ring-2 transition-all"
                    style={errors.password ? inputErrorStyle : inputStyle}
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 transition-opacity hover:opacity-80"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {errors.password && <p className="text-sm mt-1" style={{ color: '#ef4444' }}>{errors.password}</p>}
              </div>

              {!isLoginMode && (
                <div>
                  <label 
                    className="block text-sm font-medium mb-1"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5" style={{ color: 'var(--text-muted)' }} />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={formData.confirmPassword}
                      onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                      className="w-full pl-10 pr-12 py-3 rounded-lg focus:outline-none focus:ring-2 transition-all"
                      style={errors.confirmPassword ? inputErrorStyle : inputStyle}
                      placeholder="Confirm your password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 transition-opacity hover:opacity-80"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {errors.confirmPassword && <p className="text-sm mt-1" style={{ color: '#ef4444' }}>{errors.confirmPassword}</p>}
                </div>
              )}
              
              {!isLoginMode && (
                <div>
                  <label 
                    className="block text-sm font-medium mb-1"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Promo Code (Optional)
                  </label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5" style={{ color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      value={formData.promoCode}
                      onChange={(e) => handleInputChange('promoCode', e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-lg focus:outline-none focus:ring-2 transition-all"
                      style={errors.promoCode ? inputErrorStyle : inputStyle}
                      placeholder="Enter promo code"
                    />
                  </div>
                  {errors.promoCode && <p className="text-sm mt-1" style={{ color: '#ef4444' }}>{errors.promoCode}</p>}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3 rounded-lg font-medium transition-all duration-200 text-white"
                style={{
                  background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                }}
              >
                {isLoginMode ? 'Sign In' : 'Sign Up'}
              </button>
              </form>
            )}

            {!showForgotPassword && (
              <div className="mt-6 text-center">
              <p style={{ color: 'var(--text-muted)' }}>
                {isLoginMode ? "Don't have an account?" : "Already have an account?"}
                <button
                  onClick={() => {
                    setIsLoginMode(!isLoginMode);
                    setErrors({});
                    setAuthError('');
                    setFormData({ email: '', password: '', name: '', confirmPassword: '', promoCode: '' });
                  }}
                  className="ml-2 font-medium transition-opacity hover:opacity-80"
                  style={{ color: 'var(--primary)' }}
                >
                  {isLoginMode ? 'Sign up' : 'Sign in'}
                </button>
              </p>
              </div>
            )}

            {isLoginMode && !showForgotPassword && (
              <div className="mt-4 text-center">
                <button 
                  onClick={() => {
                    setShowForgotPassword(true);
                    setAuthError('');
                    setRecoveryMessage('');
                    setRecoverySuccess(false);
                  }}
                  className="text-sm transition-opacity hover:opacity-80"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Forgot your password?
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
