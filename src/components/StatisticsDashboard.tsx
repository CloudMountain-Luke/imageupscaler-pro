import React, { useState } from 'react';
import { BarChart3, TrendingUp, Clock, Zap, Image as ImageIcon, Calendar, Activity } from 'lucide-react';
import GlassCard from './GlassCard';

interface StatisticsData {
  totalUpscales: number;
  totalImages: number;
  averageScale: number;
  totalProcessingTime: number;
  mostUsedScale: number;
  mostUsedType: string;
  upscalesThisWeek: number;
  upscalesThisMonth: number;
  averageProcessingTime: number;
  totalFileSize: string;
  scaleDistribution: { scale: number; count: number }[];
  typeDistribution: { type: string; count: number }[];
  weeklyActivity: { day: string; count: number }[];
}

interface StatisticsDashboardProps {
  data: StatisticsData;
  timeRange: 'week' | 'month' | 'year' | 'all';
  onTimeRangeChange: (range: 'week' | 'month' | 'year' | 'all') => void;
}

export const StatisticsDashboard: React.FC<StatisticsDashboardProps> = ({
  data,
  timeRange,
  onTimeRangeChange
}) => {
  const [selectedMetric, setSelectedMetric] = useState('overview');

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  const getImageTypeIcon = (type: string) => {
    const icons = {
      'photo': '📸',
      'anime': '🎌',
      'art': '🎨',
      'text': '📄'
    };
    return icons[type as keyof typeof icons] || '🖼️';
  };

  return (
    <div className="space-y-6">
      {/* Time Range Selector */}
      <GlassCard 
        title="Time Range" 
        description="Select the time period for statistics"
        icon={<Calendar className="w-5 h-5" />}
      >
        <div className="flex space-x-2">
          {[
            { value: 'week', label: 'This Week' },
            { value: 'month', label: 'This Month' },
            { value: 'year', label: 'This Year' },
            { value: 'all', label: 'All Time' }
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => onTimeRangeChange(option.value as any)}
              className={`px-4 py-2 rounded-lg transition-all duration-300 ${
                timeRange === option.value
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </GlassCard>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <GlassCard className="hover:scale-105 transition-transform duration-300">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-blue-600/20 rounded-lg">
              <Zap className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{formatNumber(data.totalUpscales)}</div>
              <div className="text-sm text-gray-400">Total Upscales</div>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="hover:scale-105 transition-transform duration-300">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-green-600/20 rounded-lg">
              <ImageIcon className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{formatNumber(data.totalImages)}</div>
              <div className="text-sm text-gray-400">Images Processed</div>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="hover:scale-105 transition-transform duration-300">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-purple-600/20 rounded-lg">
              <TrendingUp className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{data.averageScale.toFixed(1)}x</div>
              <div className="text-sm text-gray-400">Average Scale</div>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="hover:scale-105 transition-transform duration-300">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-orange-600/20 rounded-lg">
              <Clock className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{formatTime(data.totalProcessingTime)}</div>
              <div className="text-sm text-gray-400">Total Time</div>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Detailed Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scale Distribution */}
        <GlassCard 
          title="Scale Distribution" 
          description="Most commonly used scales"
          icon={<BarChart3 className="w-5 h-5" />}
        >
          <div className="space-y-3">
            {data.scaleDistribution.map((item) => (
              <div key={item.scale} className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-lg">{item.scale}x</span>
                  <div className="w-24 bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${(item.count / Math.max(...data.scaleDistribution.map(d => d.count))) * 100}%` }}
                    />
                  </div>
                </div>
                <span className="text-sm text-gray-400">{item.count}</span>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Type Distribution */}
        <GlassCard 
          title="Image Type Distribution" 
          description="Most processed image types"
          icon={<Activity className="w-5 h-5" />}
        >
          <div className="space-y-3">
            {data.typeDistribution.map((item) => (
              <div key={item.type} className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-lg">{getImageTypeIcon(item.type)}</span>
                  <span className="capitalize">{item.type}</span>
                  <div className="w-24 bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-green-500 to-blue-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${(item.count / Math.max(...data.typeDistribution.map(d => d.count))) * 100}%` }}
                    />
                  </div>
                </div>
                <span className="text-sm text-gray-400">{item.count}</span>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      {/* Weekly Activity */}
      <GlassCard 
        title="Weekly Activity" 
        description="Your upscaling activity over the past week"
        icon={<TrendingUp className="w-5 h-5" />}
      >
        <div className="grid grid-cols-7 gap-2">
          {data.weeklyActivity.map((day, index) => (
            <div key={day.day} className="text-center">
              <div className="text-xs text-gray-400 mb-2">{day.day}</div>
              <div className="relative">
                <div className="w-full bg-gray-700 rounded-full h-16 flex items-end">
                  <div 
                    className="w-full bg-gradient-to-t from-blue-500 to-purple-500 rounded-full transition-all duration-500"
                    style={{ height: `${(day.count / Math.max(...data.weeklyActivity.map(d => d.count))) * 100}%` }}
                  />
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-bold text-white">{day.count}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <GlassCard className="text-center">
          <div className="space-y-2">
            <div className="text-3xl font-bold text-white">{data.mostUsedScale}x</div>
            <div className="text-sm text-gray-400">Most Used Scale</div>
          </div>
        </GlassCard>

        <GlassCard className="text-center">
          <div className="space-y-2">
            <div className="text-3xl font-bold text-white">{formatTime(data.averageProcessingTime)}</div>
            <div className="text-sm text-gray-400">Avg Processing Time</div>
          </div>
        </GlassCard>

        <GlassCard className="text-center">
          <div className="space-y-2">
            <div className="text-3xl font-bold text-white">{data.totalFileSize}</div>
            <div className="text-sm text-gray-400">Total File Size</div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
};

export default StatisticsDashboard;

