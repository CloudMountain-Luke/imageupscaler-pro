import React, { useState, useEffect, useCallback } from 'react';
import { Clock, Download, Trash2, Eye, Calendar, AlertTriangle, RefreshCw } from 'lucide-react';
import GlassCard from './GlassCard';

interface HistoryItem {
  id: string;
  originalImage: string;
  upscaledImage: string;
  scale: number;
  imageType: string;
  timestamp: Date;
  processingTime: number;
  fileSize: string;
}

interface HistoryPanelProps {
  history: HistoryItem[];
  onViewImage: (imageUrl: string) => void;
  onDownloadImage: (imageUrl: string, filename: string) => void;
  onDeleteItem: (id: string) => void;
  onClearAll?: () => void;
  onUpdateHistory?: (items: HistoryItem[]) => void;
}

// Configuration
const HISTORY_CONFIG = {
  RETENTION_DAYS: 30, // Keep history for 30 days
  MAX_ITEMS: 100, // Maximum number of items to keep
  STORAGE_KEY: 'upscale-forge-history',
  CLEANUP_INTERVAL: 24 * 60 * 60 * 1000, // Run cleanup every 24 hours
  LAST_CLEANUP_KEY: 'upscale-forge-last-cleanup',
};

// Helper to check if an item is expired
const isExpired = (timestamp: Date): boolean => {
  const now = new Date();
  const expiryDate = new Date(timestamp);
  expiryDate.setDate(expiryDate.getDate() + HISTORY_CONFIG.RETENTION_DAYS);
  return now > expiryDate;
};

// Helper to get days until expiry
const getDaysUntilExpiry = (timestamp: Date): number => {
  const now = new Date();
  const expiryDate = new Date(timestamp);
  expiryDate.setDate(expiryDate.getDate() + HISTORY_CONFIG.RETENTION_DAYS);
  const diffTime = expiryDate.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
};

export const HistoryPanel: React.FC<HistoryPanelProps> = ({
  history,
  onViewImage,
  onDownloadImage,
  onDeleteItem,
  onClearAll,
  onUpdateHistory
}) => {
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [showCleanupNotice, setShowCleanupNotice] = useState(false);
  const [itemsToCleanup, setItemsToCleanup] = useState(0);

  // Run cleanup on mount and periodically
  const runCleanup = useCallback(() => {
    if (!onUpdateHistory) return;

    const now = Date.now();
    const lastCleanup = localStorage.getItem(HISTORY_CONFIG.LAST_CLEANUP_KEY);
    const lastCleanupTime = lastCleanup ? parseInt(lastCleanup, 10) : 0;

    // Only run if enough time has passed since last cleanup
    if (now - lastCleanupTime < HISTORY_CONFIG.CLEANUP_INTERVAL && lastCleanupTime > 0) {
      return;
    }

    // Find expired items
    const expiredCount = history.filter(item => isExpired(item.timestamp)).length;
    
    if (expiredCount > 0) {
      // Remove expired items
      const cleanedHistory = history.filter(item => !isExpired(item.timestamp));
      
      // Also enforce max items limit (keep newest)
      const limitedHistory = cleanedHistory
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, HISTORY_CONFIG.MAX_ITEMS);

      onUpdateHistory(limitedHistory);
      setItemsToCleanup(expiredCount);
      setShowCleanupNotice(true);
      
      // Auto-hide notice after 5 seconds
      setTimeout(() => setShowCleanupNotice(false), 5000);
    }

    // Update last cleanup time
    localStorage.setItem(HISTORY_CONFIG.LAST_CLEANUP_KEY, now.toString());
  }, [history, onUpdateHistory]);

  useEffect(() => {
    runCleanup();
  }, [runCleanup]);

  // Check for items expiring soon (within 3 days)
  const expiringSoonCount = history.filter(item => {
    const days = getDaysUntilExpiry(item.timestamp);
    return days > 0 && days <= 3;
  }).length;

  const filteredHistory = history.filter(item => {
    if (selectedFilter === 'all') return true;
    if (selectedFilter === 'expiring') return getDaysUntilExpiry(item.timestamp) <= 3;
    return item.imageType === selectedFilter;
  });

  const sortedHistory = [...filteredHistory].sort((a, b) => {
    if (sortBy === 'newest') return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    if (sortBy === 'oldest') return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    if (sortBy === 'scale') return b.scale - a.scale;
    if (sortBy === 'expiring') return getDaysUntilExpiry(a.timestamp) - getDaysUntilExpiry(b.timestamp);
    return 0;
  });

  const formatDate = (date: Date) => {
    const d = new Date(date);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(d);
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

  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to clear all history? This cannot be undone.')) {
      onClearAll?.();
    }
  };

  return (
    <div className="space-y-6">
      {/* Cleanup Notice */}
      {showCleanupNotice && (
        <div className="bg-blue-500/20 border border-blue-500/30 rounded-xl p-4 flex items-center gap-3">
          <RefreshCw className="w-5 h-5 text-blue-400" />
          <p className="text-blue-200 text-sm">
            Auto-cleanup removed {itemsToCleanup} expired item{itemsToCleanup !== 1 ? 's' : ''} (older than {HISTORY_CONFIG.RETENTION_DAYS} days).
          </p>
        </div>
      )}

      {/* Expiring Soon Warning */}
      {expiringSoonCount > 0 && (
        <div className="bg-amber-500/20 border border-amber-500/30 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400" />
          <p className="text-amber-200 text-sm">
            {expiringSoonCount} item{expiringSoonCount !== 1 ? 's' : ''} will expire within 3 days. Download them to keep permanently.
          </p>
        </div>
      )}

      {/* Filters and Controls */}
      <GlassCard 
        title="History Controls" 
        description={`${history.length} of ${HISTORY_CONFIG.MAX_ITEMS} items • Auto-deletes after ${HISTORY_CONFIG.RETENTION_DAYS} days`}
        icon={<Clock className="w-5 h-5" />}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Filter by Image Type */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Filter by Type
            </label>
            <select
              value={selectedFilter}
              onChange={(e) => setSelectedFilter(e.target.value)}
              className="w-full rounded-lg border border-gray-600 bg-gray-800/50 text-white py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Types</option>
              <option value="photo">Photos</option>
              <option value="anime">Anime</option>
              <option value="art">Art</option>
              <option value="text">Text</option>
              {expiringSoonCount > 0 && (
                <option value="expiring">⚠️ Expiring Soon ({expiringSoonCount})</option>
              )}
            </select>
          </div>

          {/* Sort Options */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Sort by
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full rounded-lg border border-gray-600 bg-gray-800/50 text-white py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="scale">Highest Scale</option>
              <option value="expiring">Expiring Soonest</option>
            </select>
          </div>

          {/* Clear All Button */}
          <div className="flex items-end">
            <button
              onClick={handleClearAll}
              disabled={history.length === 0}
              className="w-full py-2 px-4 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Clear All History
            </button>
          </div>
        </div>
      </GlassCard>

      {/* History Items */}
      {sortedHistory.length === 0 ? (
        <GlassCard 
          title="No History Yet" 
          description="Your upscaled images will appear here"
          icon={<Clock className="w-5 h-5" />}
        >
          <div className="text-center text-gray-400 py-8">
            <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No processing history yet</p>
            <p className="text-sm">Start upscaling images to see them here</p>
          </div>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {sortedHistory.map((item) => {
            const daysLeft = getDaysUntilExpiry(item.timestamp);
            const isExpiringSoon = daysLeft <= 3;
            
            return (
              <GlassCard key={item.id} className="hover:scale-105 transition-transform duration-300">
                <div className="space-y-4">
                  {/* Image Preview */}
                  <div className="relative group">
                    <div className="aspect-square rounded-lg overflow-hidden bg-gray-800">
                      <img
                        src={item.upscaledImage}
                        alt="Upscaled"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    
                    {/* Expiry Badge */}
                    {isExpiringSoon && (
                      <div className="absolute top-2 left-2 px-2 py-1 rounded-full bg-amber-500/80 text-white text-xs font-medium flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {daysLeft === 0 ? 'Expires today' : `${daysLeft}d left`}
                      </div>
                    )}
                    
                    {/* Overlay Actions */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg flex items-center justify-center space-x-2">
                      <button
                        onClick={() => onViewImage(item.upscaledImage)}
                        className="p-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                        title="View"
                      >
                        <Eye className="w-4 h-4 text-white" />
                      </button>
                      <button
                        onClick={() => onDownloadImage(item.upscaledImage, `upscaled-${item.id}`)}
                        className="p-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                        title="Download"
                      >
                        <Download className="w-4 h-4 text-white" />
                      </button>
                      <button
                        onClick={() => onDeleteItem(item.id)}
                        className="p-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4 text-white" />
                      </button>
                    </div>
                  </div>

                  {/* Item Details */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="text-2xl">{getImageTypeIcon(item.imageType)}</span>
                        <div>
                          <div className="font-semibold text-white">{item.scale}x Scale</div>
                          <div className="text-sm text-gray-400 capitalize">{item.imageType}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-400">{item.fileSize}</div>
                        <div className="text-xs text-gray-500">{item.processingTime}s</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center space-x-2 text-gray-400">
                        <Calendar className="w-4 h-4" />
                        <span>{formatDate(item.timestamp)}</span>
                      </div>
                      <div className={`text-xs ${isExpiringSoon ? 'text-amber-400' : 'text-gray-500'}`}>
                        {daysLeft === 0 ? 'Expires today' : `${daysLeft}d until expiry`}
                      </div>
                    </div>
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default HistoryPanel;
