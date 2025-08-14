import React, { useState, useCallback } from 'react';
import { useAuth } from './contexts/AuthContext';
import { useImageProcessing } from './contexts/ImageProcessingContext';
import { edgeFunctionService } from './services/edgeFunctionService';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { Homepage } from './components/Homepage';
import { AuthModal } from './components/AuthModal';
import { ImageUploader } from './components/ImageUploader';
import { ProcessingHistory } from './components/ProcessingHistory';
import { UserStats } from './components/UserStats';
import { UserAccount } from './components/UserAccount';
import { BillingSection } from './components/BillingSection';
import { ApiSetupGuide } from './components/ApiSetupGuide';
import { Download, Clock, CheckCircle, AlertCircle, Upload, Sparkles, Plus } from 'lucide-react';
import { useDropzone } from 'react-dropzone';

const SUPPORTED_FORMATS = edgeFunctionService.getSupportedFormats();
const MAX_FILE_SIZE = edgeFunctionService.getMaxFileSize();

type ActiveTab = 'upscaler' | 'queue' | 'history' | 'stats' | 'billing' | 'account';
type SidebarState = 'open' | 'collapsed' | 'hidden';

function App() {
  const { user, userProfile, logout } = useAuth();
  const {
    uploadedFiles,
    processedImages,
    processQueue,
    processing,
    userStats,
    addToQueue,
    addUploadedFile,
    clearUploadedFiles,
  } = useImageProcessing();

  const [activeTab, setActiveTab] = useState<ActiveTab>('upscaler');
  const [sidebarState, setSidebarState] = useState<SidebarState>('open');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [showHomepage, setShowHomepage] = useState(!user);

  const [upscaleSettings, setUpscaleSettings] = useState({
    scale: 2,
    quality: 'photo',
    outputFormat: 'original'
  });

  // Get the latest uploaded file and processed image
  const latestUploadedFile = uploadedFiles[uploadedFiles.length - 1];
  const latestProcessedImage = processedImages.find(img => img.status === 'completed');
  const currentProcessing = processQueue.find(item => item.status === 'processing');
  const isApiConfigured = edgeFunctionService.isConfigured();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      const imageUrl = URL.createObjectURL(file);
      addUploadedFile(file, imageUrl);
    }
  }, [addUploadedFile]);

  const handleUpscaleImage = useCallback(() => {
    if (latestUploadedFile && !currentProcessing) {
      const processingItem = {
        id: Date.now(),
        file: latestUploadedFile.file,
        settings: upscaleSettings,
        status: 'pending' as const,
        progress: 0,
        originalImage: latestUploadedFile.imageUrl,
      };
      addToQueue(processingItem);
    }
  }, [latestUploadedFile, currentProcessing, upscaleSettings, addToQueue]);

  const handleGetStarted = (plan: string) => {
    setSelectedPlan(plan);
    setShowAuthModal(true);
  };

  const handleLogin = () => {
    setShowAuthModal(true);
  };

  const handleAuthSuccess = () => {
    setShowAuthModal(false);
    setShowHomepage(false);
  };

  const handleLogout = () => {
    logout();
    setShowHomepage(true);
    setActiveTab('upscaler');
    setSidebarState('hidden');
    clearUploadedFiles();
  };

  // Listen for navigation events from header dropdown
  React.useEffect(() => {
    const handleNavigateToAccount = () => setActiveTab('account');
    const handleNavigateToBilling = () => setActiveTab('billing');

    window.addEventListener('navigate-to-account', handleNavigateToAccount);
    window.addEventListener('navigate-to-billing', handleNavigateToBilling);

    return () => {
      window.removeEventListener('navigate-to-account', handleNavigateToAccount);
      window.removeEventListener('navigate-to-billing', handleNavigateToBilling);
    };
  }, []);

  // Show homepage for non-authenticated users
  if (showHomepage) {
    return (
      <>
        <Homepage onGetStarted={handleGetStarted} onLogin={handleLogin} />
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          selectedPlan={selectedPlan}
        />
      </>
    );
  }

  // Helper component for the image display boxes
  const ImageUploadBox = ({ label, image, onImageUpload, isProcessing = false }: {
    label: string;
    image?: string;
    onImageUpload: (files: File[]) => void;
    isProcessing?: boolean;
  }) => {
    const { getRootProps, getInputProps, isDragActive } = useDropzone({
      onDrop: onImageUpload,
      multiple: false,
      accept: {
        'image/jpeg': ['.jpeg', '.jpg'],
        'image/png': ['.png'],
        'image/webp': ['.webp'],
      },
      disabled: label === "Upscaled Image"
    });

    return (
      <div
        {...getRootProps()}
        className={`bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl p-6 shadow-inner min-h-[300px] flex flex-col items-center justify-center relative border-2 border-dashed border-gray-200/50 dark:border-gray-700/50 transition-colors ${
          label === "Upscaled Image" ? 'cursor-default' : 'hover:border-blue-500 cursor-pointer'
        }`}
      >
        <input {...getInputProps()} />
        <label className="text-gray-600 dark:text-gray-400 text-sm font-medium absolute top-4 left-4">{label}</label>
        {image ? (
          <img src={image} alt={label} className="max-h-full max-w-full object-contain rounded-md" />
        ) : (
          <div className="flex flex-col items-center justify-center p-4 text-center">
            {label === "Upscaled Image" ? (
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center mb-4">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
            ) : (
              <Upload className="w-16 h-16 text-gray-400 mb-4" />
            )}
            <span className="text-gray-500 dark:text-gray-400">
              {label === "Upscaled Image" ? (
                isProcessing ? 'Processing...' : 'Upscaled image will appear here'
              ) : (
                isDragActive ? 'Drop the image here ...' : 'Click to upload or drag & drop'
              )}
            </span>
          </div>
        )}
        {isProcessing && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          </div>
        )}
      </div>
    );
  };

  const renderMainContent = () => {
    if (!isApiConfigured && activeTab === 'upscaler') {
      return <ApiSetupGuide />;
    }

    switch (activeTab) {
      case 'upscaler':
        return (
          <div className="space-y-6">
            {/* Main Title */}
            <div className="text-center mb-8">
              <h1 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                AI Image Upscaler
              </h1>
              <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
                Transform your images with professional AI-powered upscaling
              </p>
            </div>

            {/* Desktop Layout */}
            <div className="hidden md:flex flex-col space-y-6">
              <div className="flex flex-col lg:flex-row lg:space-x-6 space-y-6 lg:space-y-0">
                <div className="flex-1 space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <ImageUploadBox
                      label="Original Image"
                      image={latestUploadedFile?.imageUrl}
                      onImageUpload={onDrop}
                    />
                    <ImageUploadBox
                      label="Upscaled Image"
                      image={latestProcessedImage?.upscaledImage}
                      onImageUpload={() => {}}
                      isProcessing={!!currentProcessing}
                    />
                  </div>
                </div>

                {/* Controls Panel */}
                <div className="w-full lg:w-80 space-y-4">
                  <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl p-6 border border-gray-200/50 dark:border-gray-700/50">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Settings</h3>
                    
                    {/* Scale Factor */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Scale Factor
                      </label>
                      <select
                        value={upscaleSettings.scale}
                        onChange={(e) => setUpscaleSettings({ ...upscaleSettings, scale: Number(e.target.value) })}
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value={2}>2x</option>
                        <option value={4}>4x</option>
                        <option value={8}>8x</option>
                      </select>
                    </div>

                    {/* Quality Preset */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Quality Preset
                      </label>
                      <select
                        value={upscaleSettings.quality}
                        onChange={(e) => setUpscaleSettings({ ...upscaleSettings, quality: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="photo">Photo</option>
                        <option value="art">Art/Illustration</option>
                        <option value="anime">Anime</option>
                        <option value="text">Text</option>
                      </select>
                    </div>

                    {/* Output Format */}
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Output Format
                      </label>
                      <select
                        value={upscaleSettings.outputFormat}
                        onChange={(e) => setUpscaleSettings({ ...upscaleSettings, outputFormat: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="original">Original</option>
                        <option value="png">PNG</option>
                        <option value="jpg">JPEG</option>
                        <option value="webp">WebP</option>
                      </select>
                    </div>

                    {/* Upscale Button */}
                    <button
                      onClick={handleUpscaleImage}
                      disabled={!!currentProcessing || !latestUploadedFile || !isApiConfigured}
                      className={`w-full px-6 py-3 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center space-x-2 ${
                        (!!currentProcessing || !latestUploadedFile || !isApiConfigured) 
                          ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed' 
                          : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl'
                      }`}
                    >
                      <Sparkles className="w-5 h-5" />
                      <span>{currentProcessing ? 'Processing...' : 'AI Upscale'}</span>
                    </button>

                    {/* Processing Status */}
                    {currentProcessing && (
                      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <div className="flex items-center space-x-2 mb-2">
                          <Clock className="w-4 h-4 text-blue-600" />
                          <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                            {currentProcessing.currentStep || 'Processing...'}
                          </span>
                        </div>
                        <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${currentProcessing.progress}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-blue-600 dark:text-blue-300 mt-1">
                          <span>{Math.round(currentProcessing.progress)}%</span>
                          {currentProcessing.timeRemaining !== undefined && currentProcessing.timeRemaining > 0 && (
                            <span>{currentProcessing.timeRemaining}s remaining</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile Layout */}
            <div className="flex flex-col space-y-4 md:hidden">
              <ImageUploadBox
                label="Original Image"
                image={latestUploadedFile?.imageUrl}
                onImageUpload={onDrop}
              />

              {/* Mobile Controls */}
              <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl p-4 border border-gray-200/50 dark:border-gray-700/50">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Scale</label>
                    <select
                      value={upscaleSettings.scale}
                      onChange={(e) => setUpscaleSettings({ ...upscaleSettings, scale: Number(e.target.value) })}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 py-2 px-3"
                    >
                      <option value={2}>2x</option>
                      <option value={4}>4x</option>
                      <option value={8}>8x</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Quality</label>
                    <select
                      value={upscaleSettings.quality}
                      onChange={(e) => setUpscaleSettings({ ...upscaleSettings, quality: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 py-2 px-3"
                    >
                      <option value="photo">Photo</option>
                      <option value="art">Art</option>
                      <option value="anime">Anime</option>
                    </select>
                  </div>
                </div>

                <button
                  onClick={handleUpscaleImage}
                  disabled={!!currentProcessing || !latestUploadedFile || !isApiConfigured}
                  className={`w-full px-6 py-3 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center space-x-2 ${
                    (!!currentProcessing || !latestUploadedFile || !isApiConfigured) 
                      ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed' 
                      : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white'
                  }`}
                >
                  <Sparkles className="w-5 h-5" />
                  <span>{currentProcessing ? 'Processing...' : 'AI Upscale'}</span>
                </button>
              </div>

              <ImageUploadBox
                label="Upscaled Image"
                image={latestProcessedImage?.upscaledImage}
                onImageUpload={() => {}}
                isProcessing={!!currentProcessing}
              />
            </div>
          </div>
        );
      case 'history':
        return <ProcessingHistory />;
      case 'stats':
        return <UserStats />;
      case 'account':
        return <UserAccount />;
      case 'billing':
        return <BillingSection />;
      default:
        return <div>Content for {activeTab}</div>;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-orange-50 to-green-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <Header 
        onMenuClick={() => setSidebarState(sidebarState === 'hidden' ? 'open' : 'hidden')}
        sidebarState={sidebarState}
        onLogout={handleLogout}
      />
      
      <div className="flex">
        <Sidebar 
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          sidebarState={sidebarState}
          setSidebarState={setSidebarState}
        />
        
        <main className={`flex-1 p-6 transition-all duration-300 ${
          sidebarState === 'open' ? 'lg:ml-64' : sidebarState === 'collapsed' ? 'lg:ml-20' : 'ml-0'
        }`}>
          {renderMainContent()}
        </main>
      </div>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        selectedPlan={selectedPlan}
      />
    </div>
  );
}

export default App;