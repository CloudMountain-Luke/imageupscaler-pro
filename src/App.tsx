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
import { PricingPlans } from './components/PricingPlans';
import { Footer } from './components/Footer'; // Import the new Footer component
import { TermsOfService } from './components/TermsOfService'; // Import new policy pages
import { PrivacyPolicy } from './components/PrivacyPolicy';
import { RefundPolicy } from './components/RefundPolicy';

import { Download, Clock, CheckCircle, AlertCircle, Upload, Sparkles, Plus } from 'lucide-react';
import { useDropzone } from 'react-dropzone';

const SUPPORTED_FORMATS = edgeFunctionService.getSupportedFormats();
const MAX_FILE_SIZE = edgeFunctionService.getMaxFileSize();

type ActiveTab = 'upscaler' | 'queue' | 'history' | 'stats' | 'billing' | 'account' | 'pricing' | 'terms' | 'privacy' | 'refund'; // Add new policy tabs
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
  const [showHomepage, setShowHomepage] = useState(true);
  const [previousTab, setPreviousTab] = useState<ActiveTab | null>(null);

  React.useEffect(() => {
    if (isReady) {
      setShowHomepage(!user);
    }
  }, [user, isReady]);
  
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
    setSidebarState('open');
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

  // Listen for navigation events from header dropdown and footer
  React.useEffect(() => {
    const handleNavigateToAccount = () => setActiveTab('account');
    const handleNavigateToBilling = () => setActiveTab('billing');
    const handleShowPricingPlans = () => {
      setPreviousTab(activeTab);
      setActiveTab('pricing');
      setSidebarState('open');
    };
    const handleNavigateToTerms = () => {
      setPreviousTab(activeTab);
      setActiveTab('terms');
      setSidebarState('open');
    };
    const handleNavigateToPrivacy = () => {
      setPreviousTab(activeTab);
      setActiveTab('privacy');
      setSidebarState('open');
    };
    const handleNavigateToRefund = () => {
      setPreviousTab(activeTab);
      setActiveTab('refund');
      setSidebarState('open');
    };

    window.addEventListener('navigate-to-account', handleNavigateToAccount);
    window.addEventListener('navigate-to-billing', handleNavigateToBilling);
    window.addEventListener('show-pricing-plans', handleShowPricingPlans);
    window.addEventListener('navigate-to-terms', handleNavigateToTerms); // New event listener
    window.addEventListener('navigate-to-privacy', handleNavigateToPrivacy); // New event listener
    window.addEventListener('navigate-to-refund', handleNavigateToRefund); // New event listener

    return () => {
      window.removeEventListener('navigate-to-account', handleNavigateToAccount);
      window.removeEventListener('navigate-to-billing', handleNavigateToBilling);
      window.removeEventListener('show-pricing-plans', handleShowPricingPlans);
      window.removeEventListener('navigate-to-terms', handleNavigateToTerms); // Cleanup
      window.removeEventListener('navigate-to-privacy', handleNavigateToPrivacy); // Cleanup
      window.removeEventListener('navigate-to-refund', handleNavigateToRefund); // Cleanup
    };
  }, [activeTab]);

  // Show homepage for non-authenticated users
  if (showHomepage) {
    return (
      <div className="min-h-screen flex flex-col"> {/* Removed bg-gray-900 here */}
        <Homepage onGetStarted={handleGetStarted} onLogin={handleLogin} />
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          selectedPlan={selectedPlan}
         onAuthSuccess={handleAuthSuccess}
        />
        <Footer /> {/* Render footer on homepage */}
      </div>
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
            <ImageUpscaler />
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
      case 'pricing':
        return (
          <PricingPlans 
            onGetStarted={handleGetStarted} 
            onBack={() => setActiveTab(previousTab || 'upscaler')}
          />
        );
      case 'terms': // New case for Terms of Service
        return <TermsOfService />;
      case 'privacy': // New case for Privacy Policy
        return <PrivacyPolicy />;
      case 'refund': // New case for Refund Policy
        return <RefundPolicy />;
      default:
        return <div>Content for {activeTab}</div>;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 via-orange-50 to-green-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <Header 
        onMenuClick={() => setSidebarState(sidebarState === 'hidden' ? 'open' : 'hidden')}
        sidebarState={sidebarState}
        isApiConfigured={isApiConfigured}
        onLogout={handleLogout}
      />
      
      <div className="flex flex-1"> {/* flex-1 to push footer to bottom */}
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
      <Footer /> {/* Render footer globally */}
    </div>
  );
}

export default App;

