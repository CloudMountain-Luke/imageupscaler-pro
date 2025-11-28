import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useThemeLab } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabaseClient';
import { Download, Calendar, Image as ImageIcon, Clock, CheckCircle, XCircle, Loader, Sparkles, X, Trash2, Square, CheckSquare } from 'lucide-react';

interface UpscaleJob {
  id: string;
  user_id: string;
  input_url: string;
  final_output_url: string | null;
  content_type: string;
  target_scale: number;
  status: string;
  created_at: string;
  completed_at: string | null;
  using_tiling: boolean;
  chain_strategy: {
    targetScale: number;
    stages: { scale: number }[];
  };
}

export function ProcessingHistory() {
  const { user } = useAuth();
  const { tone } = useThemeLab();
  const [historyJobs, setHistoryJobs] = React.useState<UpscaleJob[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState<'all' | 'completed' | 'processing' | 'failed'>('all');
  const [selectedJobs, setSelectedJobs] = React.useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = React.useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = React.useState(1);
  const ITEMS_PER_PAGE = 12; // Show 12 items per page

  // Calculate adaptive text colors based on tone
  const textColor = React.useMemo(() => {
    return tone <= 50 ? 'hsl(0, 0%, 96%)' : 'hsl(0, 0%, 12%)';
  }, [tone]);

  const mutedTextColor = React.useMemo(() => {
    return tone <= 50 ? 'hsl(0, 0%, 75%)' : 'hsl(0, 0%, 35%)';
  }, [tone]);

  const elevTextColor = React.useMemo(() => {
    return tone <= 40 ? 'hsl(0, 0%, 96%)' : 'hsl(0, 0%, 15%)';
  }, [tone]);
  
  React.useEffect(() => {
    const fetchHistory = async () => {
      if (user?.id) {
        setLoading(true);
        try {
          // Query upscale_jobs table for user's jobs
          const { data, error } = await supabase
            .from('upscale_jobs')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(100); // Get more for pagination
          
          if (error) {
            console.error('Failed to fetch job history:', error);
            setHistoryJobs([]);
          } else {
            setHistoryJobs(data || []);
          }
        } catch (error) {
          console.error('Failed to fetch processing history:', error);
          setHistoryJobs([]);
        } finally {
          setLoading(false);
        }
      } else {
        setHistoryJobs([]);
        setLoading(false);
      }
    };

    fetchHistory();
  }, [user?.id]); // ONLY depend on user?.id to prevent infinite loops
  
  // Separate effect for periodic refresh (only if processing jobs exist)
  React.useEffect(() => {
    const hasProcessingJobs = historyJobs.some(job => job.status === 'processing');
    
    if (!hasProcessingJobs || !user?.id) {
      return; // No need to refresh if no processing jobs
    }
    
    const refreshHistory = async () => {
      try {
        const { data, error } = await supabase
          .from('upscale_jobs')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(100);
        
        if (!error && data) {
          setHistoryJobs(data);
        }
      } catch (error) {
        console.error('Failed to refresh history:', error);
      }
    };
    
    // Refresh every 30 seconds only if there are processing jobs
    const interval = setInterval(refreshHistory, 30000);
    return () => clearInterval(interval);
  }, [historyJobs, user?.id]); // Include historyJobs to check for processing status

  // Filter jobs based on selected filter
  const filteredJobs = historyJobs.filter(job => {
    if (filter === 'all') return true;
    if (filter === 'completed') return job.status === 'completed' || job.status === 'tiles_ready';
    if (filter === 'processing') return job.status === 'processing';
    if (filter === 'failed') return job.status === 'failed';
    return true;
  });
  
  // Pagination calculations
  const totalPages = Math.ceil(filteredJobs.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedJobs = filteredJobs.slice(startIndex, endIndex);
  
  // Reset to page 1 when filter changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [filter]);
  
  // Get status badge info
  const getStatusBadge = (status: string) => {
    // Calculate badge colors based on tone for proper contrast
    const getBadgeColors = (baseHue: number, baseSat: number) => {
      if (tone <= 50) {
        // Dark mode: light background, bright text
        return {
          bg: `hsla(${baseHue}, ${baseSat}%, 50%, 0.2)`,
          text: `hsl(${baseHue}, ${baseSat}%, 75%)`
        };
      } else {
        // Light mode: saturated background, dark text
        return {
          bg: `hsl(${baseHue}, ${baseSat}%, 90%)`,
          text: `hsl(${baseHue}, ${baseSat}%, 30%)`
        };
      }
    };

    switch (status) {
      case 'completed': {
        const colors = getBadgeColors(142, 70); // Green
        return { icon: CheckCircle, text: 'Completed', bg: colors.bg, textColor: colors.text };
      }
      case 'tiles_ready': {
        const colors = getBadgeColors(217, 70); // Blue
        return { icon: Sparkles, text: 'Ready', bg: colors.bg, textColor: colors.text };
      }
      case 'processing': {
        const colors = getBadgeColors(45, 90); // Yellow
        return { icon: Loader, text: 'Processing', bg: colors.bg, textColor: colors.text };
      }
      case 'failed': {
        const colors = getBadgeColors(0, 70); // Red
        return { icon: XCircle, text: 'Failed', bg: colors.bg, textColor: colors.text };
      }
      case 'partial_success': {
        const colors = getBadgeColors(30, 90); // Orange
        return { icon: CheckCircle, text: 'Partial', bg: colors.bg, textColor: colors.text };
      }
      default: {
        const colors = getBadgeColors(0, 0); // Gray
        return { icon: Clock, text: 'Pending', bg: colors.bg, textColor: colors.text };
      }
    }
  };
  
  // Get content type badge color
  const getContentTypeBadge = (contentType: string) => {
    const getBadgeColors = (baseHue: number, baseSat: number) => {
      if (tone <= 50) {
        return {
          bg: `hsla(${baseHue}, ${baseSat}%, 50%, 0.2)`,
          text: `hsl(${baseHue}, ${baseSat}%, 75%)`
        };
      } else {
        return {
          bg: `hsl(${baseHue}, ${baseSat}%, 90%)`,
          text: `hsl(${baseHue}, ${baseSat}%, 30%)`
        };
      }
    };

    let colors;
    switch (contentType) {
      case 'photo':
        colors = getBadgeColors(270, 70); // Purple
        break;
      case 'anime':
        colors = getBadgeColors(330, 70); // Pink
        break;
      case 'art':
        colors = getBadgeColors(230, 70); // Indigo
        break;
      case 'text':
        colors = getBadgeColors(190, 70); // Cyan
        break;
      default:
        colors = getBadgeColors(0, 0); // Gray
    }
    
    return { bg: colors.bg, text: colors.text };
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div 
          className="backdrop-blur-sm rounded-xl p-8 text-center"
          style={{ 
            background: 'var(--elev)',
            borderWidth: '1px',
            borderStyle: 'solid',
            borderColor: 'var(--border)'
          }}
        >
          <Clock className="w-16 h-16 mx-auto mb-4 animate-spin" style={{ color: mutedTextColor }} />
          <h3 className="text-xl font-semibold mb-2" style={{ color: textColor }}>Loading History...</h3>
          <p style={{ color: mutedTextColor }}>Please wait while we fetch your past upscales.</p>
        </div>
      </div>
    );
  }

  if (historyJobs.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div 
          className="backdrop-blur-sm rounded-xl p-8 text-center"
          style={{ 
            background: 'var(--elev)',
            borderWidth: '1px',
            borderStyle: 'solid',
            borderColor: 'var(--border)'
          }}
        >
          <ImageIcon className="w-16 h-16 mx-auto mb-4" style={{ color: mutedTextColor }} />
          <h3 className="text-xl font-semibold mb-2" style={{ color: textColor }}>No processing history</h3>
          <p style={{ color: mutedTextColor }}>Your completed image upscaling jobs will appear here</p>
        </div>
      </div>
    );
  }

  const handleDownload = (imageUrl: string, jobId: string) => {
    // Use fetch to download the image and create a blob URL to avoid CORS issues
    fetch(imageUrl)
      .then(response => response.blob())
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `upscaled_${jobId}.png`;
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

  const handleCancelJob = async (jobId: string) => {
    try {
      const { error } = await supabase
        .from('upscale_jobs')
        .update({ status: 'failed', error_message: 'Cancelled by user' })
        .eq('id', jobId)
        .eq('status', 'processing'); // Only cancel if still processing

      if (error) {
        console.error('Failed to cancel job:', error);
      } else {
        // Update local state immediately
        setHistoryJobs(prev => 
          prev.map(job => 
            job.id === jobId 
              ? { ...job, status: 'failed', error_message: 'Cancelled by user' }
              : job
          )
        );
      }
    } catch (error) {
      console.error('Error cancelling job:', error);
    }
  };

  const handleCancelAllJobs = async () => {
    try {
      const { error } = await supabase
        .from('upscale_jobs')
        .update({ status: 'failed', error_message: 'Cancelled by user' })
        .eq('user_id', user?.id)
        .eq('status', 'processing');

      if (error) {
        console.error('Failed to cancel all jobs:', error);
      } else {
        // Update local state
        setHistoryJobs(prev => 
          prev.map(job => 
            job.status === 'processing' 
              ? { ...job, status: 'failed', error_message: 'Cancelled by user' }
              : job
          )
        );
      }
    } catch (error) {
      console.error('Error cancelling all jobs:', error);
    }
  };

  const handleToggleSelection = (jobId: string) => {
    setSelectedJobs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(jobId)) {
        newSet.delete(jobId);
      } else {
        newSet.add(jobId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedJobs.size === filteredJobs.length) {
      setSelectedJobs(new Set());
    } else {
      setSelectedJobs(new Set(filteredJobs.map(job => job.id)));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedJobs.size === 0) return;
    
    if (!confirm(`Are you sure you want to delete ${selectedJobs.size} job(s) from history? This cannot be undone.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('upscale_jobs')
        .delete()
        .in('id', Array.from(selectedJobs))
        .eq('user_id', user?.id); // Safety check

      if (error) {
        console.error('Failed to delete jobs:', error);
        alert('Failed to delete some jobs. Please try again.');
      } else {
        // Update local state
        setHistoryJobs(prev => prev.filter(job => !selectedJobs.has(job.id)));
        setSelectedJobs(new Set());
        setIsSelectionMode(false);
      }
    } catch (error) {
      console.error('Error deleting jobs:', error);
      alert('An error occurred while deleting jobs.');
    }
  };

  // Pagination component - centered
  const PaginationControls = ({ alignTop = false }: { alignTop?: boolean }) => {
    if (filteredJobs.length <= ITEMS_PER_PAGE) return null;
    
    return (
      <div className={`flex flex-col items-center ${alignTop ? 'space-y-2' : 'space-y-3'}`}>
        {/* Navigation */}
        <div className="flex items-center space-x-6">
          {/* Previous */}
          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ color: currentPage === 1 ? mutedTextColor : textColor, fontSize: '14px', fontWeight: '500' }}
          >
            ← Prev
          </button>
          
          {/* Page numbers */}
          <div className="flex items-center space-x-4">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
              const showPage = 
                page === 1 || 
                page === totalPages || 
                (page >= currentPage - 1 && page <= currentPage + 1);
              
              if (!showPage) {
                if (page === currentPage - 2 || page === currentPage + 2) {
                  return <span key={page} style={{ color: mutedTextColor }}>...</span>;
                }
                return null;
              }
              
              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className="transition-all"
                  style={{
                    color: page === currentPage ? 'var(--primary)' : textColor,
                    fontSize: page === currentPage ? '18px' : '16px',
                    fontWeight: page === currentPage ? '600' : '400',
                    textDecoration: page === currentPage ? 'underline' : 'none',
                    textUnderlineOffset: '4px'
                  }}
                >
                  {page}
                </button>
              );
            })}
          </div>
          
          {/* Next */}
          <button
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            className="transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ color: currentPage === totalPages ? mutedTextColor : textColor, fontSize: '14px', fontWeight: '500' }}
          >
            Next →
          </button>
        </div>
        
        {/* Page counter */}
        <div style={{ color: mutedTextColor, fontSize: '14px' }}>
          Showing {startIndex + 1}-{Math.min(endIndex, filteredJobs.length)} of {filteredJobs.length} jobs
        </div>
      </div>
    );
  };

  return (
    <div style={{ maxWidth: 'calc(100vw - 590px)', margin: '0 290px 0 300px', padding: '2rem 0' }} className="space-y-6">
      {/* Header with stats */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold" style={{ color: textColor }}>Upscale History</h2>
          <p className="text-sm mt-1" style={{ color: mutedTextColor }}>
            {historyJobs.filter(job => job.status === 'completed' || job.status === 'tiles_ready').length} completed, {' '}
            {historyJobs.filter(job => job.status === 'processing').length} processing, {' '}
            {historyJobs.filter(job => job.status === 'failed').length} failed
          </p>
        </div>
        
        {/* Filter tabs */}
        <div className="flex items-center space-x-2 rounded-lg p-1" style={{ background: 'var(--elev)' }}>
          {(['all', 'completed', 'processing', 'failed'] as const).map((filterOption) => (
            <button
              key={filterOption}
              onClick={() => setFilter(filterOption)}
              className="px-4 py-2 rounded-md text-sm font-medium transition-all"
              style={{
                background: filter === filterOption ? 'linear-gradient(to right, var(--primary), var(--secondary))' : 'transparent',
                color: filter === filterOption ? '#fff' : mutedTextColor,
                boxShadow: filter === filterOption ? '0 1px 2px 0 rgba(0, 0, 0, 0.05)' : 'none'
              }}
            >
              {filterOption.charAt(0).toUpperCase() + filterOption.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Action buttons and Pagination row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Cancel All Processing Jobs */}
        {historyJobs.some(job => job.status === 'processing') && (
          <button
            onClick={handleCancelAllJobs}
            className="flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200 font-medium text-sm"
            style={{
              background: tone <= 50 ? 'rgba(220, 38, 38, 0.2)' : 'rgba(220, 38, 38, 0.1)',
              color: tone <= 50 ? 'rgb(252, 165, 165)' : 'rgb(185, 28, 28)'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = tone <= 50 ? 'rgba(220, 38, 38, 0.3)' : 'rgba(220, 38, 38, 0.2)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = tone <= 50 ? 'rgba(220, 38, 38, 0.2)' : 'rgba(220, 38, 38, 0.1)';
            }}
          >
            <X className="w-4 h-4" />
            <span>Cancel All Processing</span>
          </button>
        )}

        {/* Select/Delete Mode Toggle */}
        <button
          onClick={() => {
            setIsSelectionMode(!isSelectionMode);
            setSelectedJobs(new Set());
          }}
          className="flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200 font-medium text-sm"
          style={{
            background: isSelectionMode ? 'var(--elev)' : (tone <= 50 ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)'),
            color: isSelectionMode ? elevTextColor : (tone <= 50 ? 'rgb(147, 197, 253)' : 'rgb(29, 78, 216)')
          }}
        >
          <Square className="w-4 h-4" />
          <span>{isSelectionMode ? 'Cancel' : 'Select'}</span>
        </button>

        {/* Select All / Delete Selected (only in selection mode) */}
        {isSelectionMode && (
          <>
            <button
              onClick={handleSelectAll}
              className="flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200 font-medium text-sm"
              style={{
                background: tone <= 50 ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.1)',
                color: tone <= 50 ? 'rgb(165, 180, 252)' : 'rgb(67, 56, 202)'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = tone <= 50 ? 'rgba(99, 102, 241, 0.3)' : 'rgba(99, 102, 241, 0.2)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = tone <= 50 ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.1)';
              }}
            >
              <CheckSquare className="w-4 h-4" />
              <span>{selectedJobs.size === filteredJobs.length ? 'Deselect All' : 'Select All'}</span>
            </button>

            {selectedJobs.size > 0 && (
              <button
                onClick={handleDeleteSelected}
                className="flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200 font-medium text-sm text-white"
                style={{
                  background: 'linear-gradient(to right, rgb(220, 38, 38), rgb(185, 28, 28))',
                  boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(to right, rgb(185, 28, 28), rgb(153, 27, 27))';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(to right, rgb(220, 38, 38), rgb(185, 28, 28))';
                }}
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete {selectedJobs.size} Selected</span>
              </button>
            )}
          </>
        )}
      </div>
      
      {/* Pagination at top (centered, top-aligned) */}
      <div style={{ marginTop: '-0.5rem' }}>
        <PaginationControls alignTop={true} />
      </div>

      {/* Jobs grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {paginatedJobs.map((job) => {
          const statusBadge = getStatusBadge(job.status);
          const StatusIcon = statusBadge.icon;
          
          return (
            <div key={job.id} className="backdrop-blur-sm rounded-xl overflow-hidden border-2 transition-all duration-300"
              style={{
                background: 'var(--elev)',
                borderColor: selectedJobs.has(job.id) ? 'var(--primary)' : 'var(--border)',
                boxShadow: selectedJobs.has(job.id) ? '0 10px 15px -3px rgba(0, 0, 0, 0.1)' : 'none'
              }}>
              {/* Image preview */}
              <div className="aspect-video relative" style={{ background: 'var(--surface)' }}>
                {/* Selection checkbox (only in selection mode) */}
                {isSelectionMode && (
                  <button
                    onClick={() => handleToggleSelection(job.id)}
                    className="absolute top-2 left-2 z-10 w-8 h-8 flex items-center justify-center rounded-lg shadow-lg border-2 transition-all"
                    style={{
                      background: 'var(--elev)',
                      borderColor: selectedJobs.has(job.id) ? 'var(--primary)' : 'var(--border)'
                    }}
                  >
                    {selectedJobs.has(job.id) ? (
                      <CheckSquare className="w-5 h-5" style={{ color: 'var(--primary)' }} />
                    ) : (
                      <Square className="w-5 h-5" style={{ color: mutedTextColor }} />
                    )}
                  </button>
                )}

                <img
                  src={job.input_url}
                  alt="Original"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iI2VlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxOCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIG5vdCBmb3VuZDwvdGV4dD48L3N2Zz4=';
                  }}
                />
                
                {/* Scale badge */}
                <div className="absolute top-2 right-2 text-white px-3 py-1 rounded-full text-sm font-bold shadow-lg"
                  style={{ background: 'linear-gradient(to right, var(--primary), var(--secondary))' }}>
                  {job.target_scale}×
                </div>
                
                {/* Tiling badge */}
                {job.using_tiling && !isSelectionMode && (
                  <div 
                    className="absolute top-2 left-2 text-white px-2 py-1 rounded text-xs font-medium"
                    style={{ 
                      background: tone <= 50 
                        ? 'linear-gradient(to right, var(--primary), var(--secondary))' 
                        : 'linear-gradient(to right, hsl(30, 90%, 45%), hsl(50, 90%, 50%))',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3)'
                    }}
                  >
                    Tiled
                  </div>
                )}
              </div>
              
              {/* Job details */}
              <div className="p-4 space-y-3">
                {/* Status and content type */}
                <div className="flex items-center justify-between">
                  <span 
                    className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-medium"
                    style={{ background: statusBadge.bg, color: statusBadge.textColor }}
                  >
                    <StatusIcon className="w-3 h-3" />
                    <span>{statusBadge.text}</span>
                  </span>
                  <span 
                    className="px-2.5 py-1 rounded-full text-xs font-medium capitalize"
                    style={{ 
                      background: getContentTypeBadge(job.content_type).bg, 
                      color: getContentTypeBadge(job.content_type).text 
                    }}
                  >
                    {job.content_type}
                  </span>
                </div>
                
                {/* Date */}
                <div className="flex items-center space-x-2 text-xs" style={{ color: mutedTextColor }}>
                  <Calendar className="w-3.5 h-3.5" />
                  <span>
                    {new Date(job.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
                
                {/* Processing info */}
                <div className="text-xs space-y-1">
                  <div className="flex justify-between" style={{ color: mutedTextColor }}>
                    <span>Scale Factor:</span>
                    <span className="font-semibold" style={{ color: elevTextColor }}>{job.target_scale}×</span>
                  </div>
                  <div className="flex justify-between" style={{ color: mutedTextColor }}>
                    <span>Stages:</span>
                    <span className="font-semibold" style={{ color: elevTextColor }}>
                      {job.chain_strategy?.stages?.length || 1}
                    </span>
                  </div>
                  {job.using_tiling && (
                    <div className="flex justify-between" style={{ color: mutedTextColor }}>
                      <span>Method:</span>
                      <span className="font-semibold" style={{ color: 'var(--accent)' }}>Adaptive Tiling</span>
                    </div>
                  )}
                </div>
                
                {/* Download/Cancel buttons */}
                {(job.status === 'completed' || job.status === 'tiles_ready') && job.final_output_url ? (
                  <button
                    onClick={() => handleDownload(job.final_output_url!, job.id)}
                    className="w-full flex items-center justify-center space-x-2 text-white py-2.5 rounded-lg transition-all duration-200 font-medium shadow-sm hover:shadow-md"
                    style={{ background: 'linear-gradient(to right, var(--primary), var(--secondary))' }}
                  >
                    <Download className="w-4 h-4" />
                    <span>Download</span>
                  </button>
                ) : job.status === 'processing' ? (
                  <div className="space-y-2">
                    <div 
                      className="w-full flex items-center justify-center space-x-2 py-2.5 rounded-lg"
                      style={{
                        background: tone <= 50 ? 'rgba(234, 179, 8, 0.2)' : 'rgba(234, 179, 8, 0.1)',
                        color: tone <= 50 ? 'rgb(250, 204, 21)' : 'rgb(161, 98, 7)'
                      }}
                    >
                      <Loader className="w-4 h-4 animate-spin" />
                      <span className="font-medium">Processing...</span>
                    </div>
                    <button
                      onClick={() => handleCancelJob(job.id)}
                      className="w-full flex items-center justify-center space-x-2 py-2 rounded-lg transition-all duration-200 text-sm font-medium"
                      style={{
                        background: tone <= 50 ? 'rgba(220, 38, 38, 0.2)' : 'rgba(220, 38, 38, 0.1)',
                        color: tone <= 50 ? 'rgb(252, 165, 165)' : 'rgb(185, 28, 28)'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.background = tone <= 50 ? 'rgba(220, 38, 38, 0.3)' : 'rgba(220, 38, 38, 0.2)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.background = tone <= 50 ? 'rgba(220, 38, 38, 0.2)' : 'rgba(220, 38, 38, 0.1)';
                      }}
                    >
                      <X className="w-4 h-4" />
                      <span>Cancel Job</span>
                    </button>
                  </div>
                ) : job.status === 'failed' ? (
                  <div 
                    className="w-full flex items-center justify-center space-x-2 py-2.5 rounded-lg"
                    style={{
                      background: tone <= 50 ? 'rgba(220, 38, 38, 0.2)' : 'rgba(220, 38, 38, 0.1)',
                      color: tone <= 50 ? 'rgb(252, 165, 165)' : 'rgb(185, 28, 28)'
                    }}
                  >
                    <XCircle className="w-4 h-4" />
                    <span className="font-medium">Failed</span>
                  </div>
                ) : (
                  <div 
                    className="w-full flex items-center justify-center space-x-2 py-2.5 rounded-lg"
                    style={{ background: 'var(--surface)', color: mutedTextColor }}
                  >
                    <Clock className="w-4 h-4" />
                    <span className="font-medium">Pending</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Pagination at bottom (centered) */}
      <PaginationControls alignTop={false} />
      
      {filteredJobs.length === 0 && (
        <div 
          className="backdrop-blur-sm rounded-xl p-12 text-center"
          style={{
            background: 'var(--elev)',
            borderWidth: '1px',
            borderStyle: 'solid',
            borderColor: 'var(--border)'
          }}
        >
          <ImageIcon className="w-16 h-16 mx-auto mb-4" style={{ color: mutedTextColor }} />
          <h3 className="text-xl font-semibold mb-2" style={{ color: textColor }}>
            No {filter !== 'all' ? filter : ''} jobs found
          </h3>
          <p style={{ color: mutedTextColor }}>
            {filter === 'all' 
              ? 'Your upscaling jobs will appear here once you start processing images.'
              : `No ${filter} jobs to display. Try a different filter.`
            }
          </p>
        </div>
      )}
    </div>
  );
}