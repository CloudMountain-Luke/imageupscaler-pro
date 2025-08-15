import React, { useState, useCallback } from 'react';
import { useAuth } from './contexts/AuthContext';
import { useImageProcessing } from './contexts/ImageProcessingContext';
import { edgeFunctionService } from './services/edgeFunctionService';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { Homepage } from './components/Homepage';
import { AuthModal } from './components/AuthModal';
import ImageUpscaler from './components/ImageUploader';
import { ProcessingHistory } from './components/ProcessingHistory';
import { UserStats } from './components/UserStats';
import { UserAccount } from './components/UserAccount';
import { BillingSection } from './components/BillingSection';
import { ApiSetupGuide } from './components/ApiSetupGuide';
import { ImageComparison } from './components/ImageComparison';
import { Download, Clock, CheckCircle, AlertCircle, Upload, Sparkles, Plus } from 'lucide-react';
import { useDropzone } from 'react-dropzone';

const SUPPORTED_FORMATS = edgeFunctionService.getSupportedFormats();
const MAX_FILE_SIZE = edgeFunctionService.getMaxFileSize();

type ActiveTab = 'upscaler' | 'queue' | 'history' | 'stats' | 'billing' | 'account';
type SidebarState = 'open' | 'collapsed' | 'hidden';

function App() {
  const { user, userProfile, logout, isReady } = useAuth();
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
  const [showHomepage, setShowHomepage] = useState(true); // Start with homepage until we know auth state

  // Update homepage state when auth state is ready
  React.useEffect(() => {
    if (isReady) {
      setShowHomepage(!user);
    }
  }, [user, isReady]);
  
  // Update homepage state when auth state changes
  React.useEffect(() => {
    if (isReady) {
      setShowHomepage(!user);
    }
  }, [user, isReady]);

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
   console.log('handleAuthSuccess called');
    setShowAuthModal(false);
    setShowHomepage(false);
    setSidebarState('open'); // <--- ADDED THIS LINE
  };

  const handleLogout = async () => {
    console.log('handleLogout called');
    console.log('Current sidebarState:', sidebarState, 'user:', user?.email);
    await logout();
    setShowHomepage(true);
    setActiveTab('upscaler');
    setSidebarState('hidden');
    clearUploadedFiles();
    console.log('App state reset to homepage');
  };

  // Listen for navigation events from header dropdown
  React.useEffect(() => {
    const handleNavigateToAccount = () => setActiveTab('account');
    const handleNavigateToBilling = () => setActiveTab('billing');
    const handleShowPricingPlans = () => { // <--- ADDED THIS HANDLER
      setShowHomepage(true);
      setActiveTab('upscaler'); // Optionally reset tab if homepage is shown
      setSidebarState('hidden'); // Hide sidebar when showing homepage
    };

    window.addEventListener('navigate-to-account', handleNavigateToAccount);
    window.addEventListener('navigate-to-billing', handleNavigateToBilling);
    window.addEventListener('show-pricing-plans', handleShowPricingPlans); // <--- ADDED THIS LISTENER

    return () => {
      window.removeEventListener('navigate-to-account', handleNavigateToAccount);
      window.removeEventListener('navigate-to-billing', handleNavigateToBilling);
      window.removeEventListener('show-pricing-plans', handleShowPricingPlans); // <--- CLEANUP
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
         onAuthSuccess={handleAuthSuccess}
        />
      </>
    );
  }

  const renderMainContent = () => {
    if (!isApiConfigured && activeTab === 'upscaler') {
      return <ApiSetupGuide />;
    }

    switch (activeTab) {
      case 'upscaler':
        return (
          <div className="space-y-6">
            {/* Use the dedicated ImageUploader component */}
            <ImageUpscaler />

            {/* Image Comparison Component */}
            {latestProcessedImage && (
              <div className="mt-8">
                <ImageComparison />
              </div>
            )}
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
        isApiConfigured={isApiConfigured}
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
       onAuthSuccess={handleAuthSuccess}
      />
    </div>
  );
}

export default App;

