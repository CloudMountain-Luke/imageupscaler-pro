import React, { useState } from 'react';
import { Eye, EyeOff, Lock, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface ResetPasswordProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function ResetPassword({ onSuccess, onCancel }: ResetPasswordProps) {
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!password || !confirmPassword) {
      setError('Please fill in all fields.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await updatePassword(password);
      
      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          onSuccess();
        }, 2000);
      } else {
        setError(result.message || 'Failed to reset password. Please try again.');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-8 relative border border-gray-200 dark:border-slate-700">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center"
                 style={{ 
                   background: 'color-mix(in oklab, var(--primary) 20%, transparent 80%)',
                   border: '2px solid var(--primary)'
                 }}>
              <CheckCircle className="w-8 h-8" style={{ color: 'var(--primary)' }} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Password Reset Successful!
            </h2>
            <p className="text-gray-600 dark:text-slate-400">
              Your password has been updated. Redirecting you now...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-8 relative border border-gray-200 dark:border-slate-700">
        <div className="mb-6">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full flex items-center justify-center"
               style={{ 
                 background: 'color-mix(in oklab, var(--primary) 15%, transparent 85%)',
               }}>
            <Lock className="w-6 h-6" style={{ color: 'var(--primary)' }} />
          </div>
          <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-2">
            Reset Your Password
          </h2>
          <p className="text-center text-gray-600 dark:text-slate-400 text-sm">
            Enter your new password below
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* New Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              New Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 pr-12 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                style={{ 
                  focusRing: 'var(--focus-ring)'
                }}
                placeholder="Enter new password"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300"
                disabled={isLoading}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              Confirm Password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 pr-12 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                style={{ 
                  focusRing: 'var(--focus-ring)'
                }}
                placeholder="Confirm new password"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300"
                disabled={isLoading}
              >
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-start space-x-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Buttons */}
          <div className="flex space-x-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-3 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 text-white rounded-lg font-medium transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
              style={{
                background: 'linear-gradient(to right, var(--primary), color-mix(in oklab, var(--primary) 70%, var(--secondary) 30%))',
                boxShadow: '0 4px 14px color-mix(in oklab, var(--primary) 30%, transparent 70%)'
              }}
              disabled={isLoading}
            >
              {isLoading ? 'Resetting...' : 'Reset Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

