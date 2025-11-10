import React, { useState } from 'react';
import { Clock, Download, Trash2, Eye, Calendar, Zap, Image as ImageIcon } from 'lucide-react';
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
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({
  history,
  onViewImage,
  onDownloadImage,
  onDeleteItem
}) => {
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');

  const filteredHistory = history.filter(item => {
    if (selectedFilter === 'all') return true;
    return item.imageType === selectedFilter;
  });

  const sortedHistory = [...filteredHistory].sort((a, b) => {
    if (sortBy === 'newest') return b.timestamp.getTime() - a.timestamp.getTime();
    if (sortBy === 'oldest') return a.timestamp.getTime() - b.timestamp.getTime();
    if (sortBy === 'scale') return b.scale - a.scale;
    return 0;
  });

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
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
      {/* Filters and Controls */}
      <GlassCard 
        title="History Controls" 
        description="Filter and sort your processing history"
        icon={<Clock className="w-5 h-5" />}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            </select>
          </div>
        </div>
      </GlassCard>

      {/* History Items */}
      {sortedHistory.length === 0 ? (
        <GlassCard 
          title="No History Yet" 
          description="Your upscaled images will appear here"
          icon={<ImageIcon className="w-5 h-5" />}
        >
          <div className="text-center text-gray-400 py-8">
            <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No processing history yet</p>
            <p className="text-sm">Start upscaling images to see them here</p>
          </div>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {sortedHistory.map((item) => (
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
                  
                  {/* Overlay Actions */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg flex items-center justify-center space-x-2">
                    <button
                      onClick={() => onViewImage(item.upscaledImage)}
                      className="p-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                    >
                      <Eye className="w-4 h-4 text-white" />
                    </button>
                    <button
                      onClick={() => onDownloadImage(item.upscaledImage, `upscaled-${item.id}`)}
                      className="p-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                    >
                      <Download className="w-4 h-4 text-white" />
                    </button>
                    <button
                      onClick={() => onDeleteItem(item.id)}
                      className="p-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
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

                  <div className="flex items-center space-x-2 text-sm text-gray-400">
                    <Calendar className="w-4 h-4" />
                    <span>{formatDate(item.timestamp)}</span>
                  </div>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
};

export default HistoryPanel;

