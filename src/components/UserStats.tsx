import React from 'react';
import { useImageProcessing } from '../contexts/ImageProcessingContext';
import { useAuth } from '../contexts/AuthContext';
import { TrendingUp, Image as ImageIcon, Calendar } from 'lucide-react';

export function UserStats() {
  const { processedImages, userStats } = useImageProcessing();
  const { user } = useAuth();
  
  // Use real tracking data if available, fallback to processed images
  const currentMonthUpscales = userStats?.current_month_upscales || processedImages.filter(item => item.status === 'completed').length;
  const totalUpscales = userStats?.total_upscales || processedImages.filter(item => item.status === 'completed').length;
  const monthlyLimit = userStats?.monthly_limit || 500;
  const usagePercentage = userStats?.usage_percentage || Math.round((currentMonthUpscales / monthlyLimit) * 100);
  const daysUntilReset = userStats?.days_until_reset || 30;

  const stats = [
    {
      title: 'Images Processed',
      value: currentMonthUpscales,
      icon: ImageIcon,
      color: 'text-blue-600 bg-blue-100',
      description: 'This month'
    },
    {
      title: 'Total Processed',
      value: totalUpscales,
      icon: TrendingUp,
      color: 'text-green-600 bg-green-100',
      description: 'All time'
    },
    {
      title: 'Days Until Reset',
      value: daysUntilReset,
      icon: Calendar,
      color: 'text-orange-600 bg-orange-100',
      description: 'Billing cycle'
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Usage Statistics</h2>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl p-6 border border-gray-200/50 dark:border-gray-700/50">
              <div className="flex items-center">
                <div className={`p-3 rounded-lg ${stat.color} mr-4`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stat.value}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{stat.description}</p>
                </div>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-2">{stat.title}</h3>
            </div>
          );
        })}
      </div>

      {/* Usage Breakdown */}
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl p-6 border border-gray-200/50 dark:border-gray-700/50">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Monthly Usage</h3>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {currentMonthUpscales} / {monthlyLimit} upscales
          </div>
        </div>
        
        {/* Usage Progress Bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Current Usage</span>
            <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{usagePercentage}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
            <div 
              className={`h-3 rounded-full transition-all duration-300 ${
                usagePercentage >= 90 ? 'bg-gradient-to-r from-red-500 to-red-600' :
                usagePercentage >= 80 ? 'bg-gradient-to-r from-yellow-500 to-orange-500' :
                'bg-gradient-to-r from-blue-500 to-green-500'
              }`}
              style={{ width: `${Math.min(100, usagePercentage)}%` }}
            />
          </div>
          {usagePercentage >= 80 && (
            <p className="text-sm text-amber-600 dark:text-amber-400 mt-2">
              {usagePercentage >= 90 ? 
                'You\'re approaching your monthly limit. Consider upgrading your plan.' :
                'You\'ve used most of your monthly upscales.'
              }
            </p>
          )}
        </div>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700">
            <span className="text-gray-700 dark:text-gray-300">2x Upscaling</span>
            <div className="flex items-center space-x-3">
              <div className="w-32 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div className="bg-gradient-to-r from-blue-500 to-teal-600 h-2 rounded-full" 
                     style={{ width: `${currentMonthUpscales > 0 ? (processedImages.filter(item => item.settings?.scale === 2).length / currentMonthUpscales) * 100 : 0}%` }}></div>
              </div>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {processedImages.filter(item => item.settings?.scale === 2).length}
              </span>
            </div>
          </div>
          
          <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700">
            <span className="text-gray-700 dark:text-gray-300">4x Upscaling</span>
            <div className="flex items-center space-x-3">
              <div className="w-32 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div className="bg-gradient-to-r from-cyan-500 to-teal-600 h-2 rounded-full" 
                     style={{ width: `${currentMonthUpscales > 0 ? (processedImages.filter(item => item.settings?.scale === 4).length / currentMonthUpscales) * 100 : 0}%` }}></div>
              </div>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {processedImages.filter(item => item.settings?.scale === 4).length}
              </span>
            </div>
          </div>
          
          <div className="flex items-center justify-between py-3">
            <span className="text-gray-700 dark:text-gray-300">8x Upscaling</span>
            <div className="flex items-center space-x-3">
              <div className="w-32 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div className="bg-gradient-to-r from-teal-500 to-cyan-600 h-2 rounded-full" 
                     style={{ width: `${currentMonthUpscales > 0 ? (processedImages.filter(item => item.settings?.scale === 8).length / currentMonthUpscales) * 100 : 0}%` }}></div>
              </div>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {processedImages.filter(item => item.settings?.scale === 8).length}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Usage Limits */}
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl p-6 border border-gray-200/50 dark:border-gray-700/50">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Usage Limits</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="space-y-2">
            <p className="text-gray-600 dark:text-gray-400">Monthly limit: {monthlyLimit} upscales</p>
            <p className="text-gray-600 dark:text-gray-400">Remaining: {Math.max(0, monthlyLimit - currentMonthUpscales)} upscales</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Resets in {daysUntilReset} days
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}