import React from 'react';
import { useImageProcessing } from '../contexts/ImageProcessingContext';
import { useAuth } from '../contexts/AuthContext';
import { UpscaleTrackingService } from '../services/upscaleTrackingService';
import { Download, Calendar, Image as ImageIcon, Clock } from 'lucide-react';

export function ProcessingHistory() {
  const { processedImages, processQueue } = useImageProcessing();
  const { user } = useAuth();
  const [historyItems, setHistoryItems] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  
  React.useEffect(() => {
    const fetchHistory = async () => {
      if (user?.id) {
        setLoading(true);
        try {
          const data = await UpscaleTrackingService.getUserTransactionHistory(user.id, 20);
          setHistoryItems(data);
        } catch (error) {
          console.error('Failed to fetch processing history:', error);
          setHistoryItems([]);
        } finally {
          setLoading(false);
        }
      } else {
        setHistoryItems([]);
        setLoading(false);
      }
    };

    fetchHistory();
  }, [user?.id]);

  // Combine database history with current processing items
  const allHistoryItems = [
    ...historyItems.map(item => ({
      id: item.id,
      file: { name: item.original_image_url?.split('/').pop() || 'Unknown' },
      settings: { 
        scale: item.scale_factor,
        quality: item.quality_preset 
      },
      status: item.status,
      originalImage: item.original_image_url,
      upscaledImage: item.upscaled_image_url,
      processedAt: new Date(item.created_at).getTime(),
      originalWidth: null,
      originalHeight: null,
      upscaledWidth: null,
      upscaledHeight: null
    })),
    ...processQueue.filter(item => item.status === 'processing')
  ].sort((a, b) => (b.processedAt || Date.now()) - (a.processedAt || Date.now()));

  if (loading) {
    return (
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl p-8 text-center border border-gray-200/50 dark:border-gray-700/50">
        <Clock className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4 animate-spin" />
        <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Loading History...</h3>
        <p className="text-gray-500 dark:text-gray-400">Please wait while we fetch your past upscales.</p>
      </div>
    );
  }

  if (allHistoryItems.length === 0) {
    return (
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl p-8 text-center border border-gray-200/50 dark:border-gray-700/50">
        <ImageIcon className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">No processing history</h3>
        <p className="text-gray-500 dark:text-gray-400">Your completed image upscaling jobs will appear here</p>
      </div>
    );
  }

  const handleDownload = (imageUrl: string, filename: string) => {
    // Use fetch to download the image and create a blob URL to avoid CORS issues
    fetch(imageUrl)
      .then(response => response.blob())
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      })
      .catch(error => {
        console.error('Download failed:', error);
        // Fallback: open in new tab
        window.open(imageUrl, '_blank');
      });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Processing History</h2>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {allHistoryItems.filter(item => item.status === 'completed').length} completed, {' '}
          {allHistoryItems.filter(item => item.status === 'processing').length} processing
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {allHistoryItems.map((item) => (
          <div key={item.id} className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl overflow-hidden border border-gray-200/50 dark:border-gray-700/50 hover:shadow-lg transition-all duration-300">
            <div className="aspect-video bg-gray-100 dark:bg-gray-800 relative">
              <img
                src={item.originalImage}
                alt="Original"
                className="w-full h-full object-cover"
              />
              <div className="absolute top-2 left-2 bg-black/50 text-white px-2 py-1 rounded text-xs">
                Original
              </div>
              <div className="absolute top-2 right-2 text-white px-2 py-1 rounded text-xs" style={{background: 'linear-gradient(to right, #0082CA, #98D738)'}}>
                {item.settings.scale}x
              </div>
              <div className="absolute top-2 right-2 bg-gradient-to-r from-blue-600 to-green-600 text-white px-2 py-1 rounded text-xs">
                {item.settings.scale}x
              </div>
              {item.status === 'processing' && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <div className="text-white text-center">
                    <Clock className="w-8 h-8 mx-auto mb-2 animate-spin text-white" />
                    <p className="text-sm">{item.currentStep || 'Processing...'}</p>
                    <p className="text-xs">{Math.round(item.progress)}%</p>
                    {item.timeRemaining !== undefined && item.timeRemaining > 0 && (
                      <p className="text-xs mt-1">{item.timeRemaining}s remaining</p>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-4">
              <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate mb-2">
                {item.file.name}
              </h3>
              
              <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400 mb-3">
                <div className="flex items-center space-x-1">
                  <Calendar className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                  <span>
                    {item.status === 'processing' ? 'Processing...' : 
                     new Date(item.processedAt || Date.now()).toLocaleDateString()}
                  </span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-xs mb-4">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Original:</span>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {item.originalWidth || '...'} × {item.originalHeight || '...'}px
                  </p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Upscaled:</span>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {item.upscaledWidth || '...'} × {item.upscaledHeight || '...'}px
                  </p>
                </div>
              </div>
              
              {item.status === 'completed' && item.upscaledImage ? (
                <button
                  onClick={() => handleDownload(item.upscaledImage!, `upscaled_${item.file.name}`)}
                  className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-orange-500 to-green-600 hover:from-orange-600 hover:to-green-700 text-white py-2 rounded-lg transition-all duration-200"
                >
                  <Download className="w-4 h-4" />
                  <span>Download</span>
                </button>
              ) : (
                <div className="w-full flex items-center justify-center space-x-2 bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 py-2 rounded-lg">
                  <Clock className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  <span>{item.currentStep || 'Processing...'}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}