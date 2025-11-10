import React, { useState, useCallback, useEffect } from 'react';
import { useAuth } from './contexts/AuthContext';
import { useImageProcessing } from './contexts/ImageProcessingContext';
import { edgeFunctionService } from './services/edgeFunctionService';
import { Header } from './components/Header';
import { Toolbar } from './components/Toolbar';
import { Homepage } from './components/Homepage';
import { AuthModal } from './components/AuthModal';
import { ResetPassword } from './components/ResetPassword';
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
import { ThemeControls } from './components/ThemeControls';
import { useThemeLab } from './contexts/ThemeContext';

import { Download, Clock, CheckCircle, AlertCircle, Upload, Sparkles, Plus, LogIn } from 'lucide-react';
import { useDropzone } from 'react-dropzone';

const SUPPORTED_FORMATS = edgeFunctionService.getSupportedFormats();
const MAX_FILE_SIZE = edgeFunctionService.getMaxFileSize();

type ActiveTab = 'upscaler' | 'queue' | 'history' | 'stats' | 'billing' | 'account' | 'pricing' | 'terms' | 'privacy' | 'refund';

function App() {
  const { isLabOpen } = useThemeLab();
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
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [showHomepage, setShowHomepage] = useState(true);
  const [homepagePolicy, setHomepagePolicy] = useState<'terms' | 'privacy' | 'refund' | null>(null);
  const [previousTab, setPreviousTab] = useState<ActiveTab | null>(null);
  const [showResetPassword, setShowResetPassword] = useState(false);

  // Disable automatic session-based routing; default to homepage until explicit login

  // Detect password reset flow from Supabase email link
  useEffect(() => {
    const hash = window.location.hash;
    // Check for Supabase recovery token
    if (hash && (hash.includes('type=recovery') || hash.includes('access_token'))) {
      setShowResetPassword(true);
      setShowHomepage(false);
    }
  }, []);

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
  };

  const handleLogout = async () => {
    console.log('handleLogout called');
    console.log('Current user:', user?.email);
    await logout();
    setShowHomepage(true);
    setActiveTab('upscaler');
    clearUploadedFiles();
    console.log('App state reset to homepage');
  };

  const handleResetPasswordSuccess = () => {
    setShowResetPassword(false);
    setShowHomepage(false);
    // Clear the hash from URL
    window.history.replaceState(null, '', window.location.pathname);
  };

  const handleResetPasswordCancel = () => {
    setShowResetPassword(false);
    setShowHomepage(true);
    // Clear the hash from URL
    window.history.replaceState(null, '', window.location.pathname);
  };

  // Listen for navigation events from header dropdown and footer
  React.useEffect(() => {
    const handleNavigateToAccount = () => setActiveTab('account');
    const handleNavigateToBilling = () => setActiveTab('billing');
    const handleNavigateToUpscaler = () => {
      setShowHomepage(false);
      setActiveTab('upscaler');
    };
    const handleLogoClick = () => {
      if (user) {
        handleNavigateToUpscaler();
      } else {
        handleShowHomepage();
      }
    };
    const handleShowHomepage = () => {
      setShowHomepage(true);
      setActiveTab('upscaler');
      setHomepagePolicy(null);
    };
    const handleShowPricingPlans = () => {
      setPreviousTab(activeTab);
      setActiveTab('pricing');
      setShowHomepage(false);
    };
    const handleNavigateToTerms = () => {
      if (showHomepage) {
        setHomepagePolicy('terms');
        return;
      }
      setPreviousTab(activeTab);
      setActiveTab('terms');
      setShowHomepage(false);
    };
    const handleNavigateToPrivacy = () => {
      if (showHomepage) {
        setHomepagePolicy('privacy');
        return;
      }
      setPreviousTab(activeTab);
      setActiveTab('privacy');
      setShowHomepage(false);
    };
    const handleNavigateToRefund = () => {
      if (showHomepage) {
        setHomepagePolicy('refund');
        return;
      }
      setPreviousTab(activeTab);
      setActiveTab('refund');
      setShowHomepage(false);
    };

    window.addEventListener('navigate-to-account', handleNavigateToAccount);
    window.addEventListener('navigate-to-billing', handleNavigateToBilling);
    window.addEventListener('show-pricing-plans', handleShowPricingPlans);
    window.addEventListener('navigate-to-upscaler', handleNavigateToUpscaler);
    window.addEventListener('show-homepage', handleShowHomepage);
    window.addEventListener('logo-click', handleLogoClick);
    window.addEventListener('navigate-to-terms', handleNavigateToTerms); // New event listener
    window.addEventListener('navigate-to-privacy', handleNavigateToPrivacy); // New event listener
    window.addEventListener('navigate-to-refund', handleNavigateToRefund); // New event listener

    return () => {
      window.removeEventListener('navigate-to-account', handleNavigateToAccount);
      window.removeEventListener('navigate-to-billing', handleNavigateToBilling);
      window.removeEventListener('show-pricing-plans', handleShowPricingPlans);
      window.removeEventListener('navigate-to-upscaler', handleNavigateToUpscaler);
      window.removeEventListener('show-homepage', handleShowHomepage);
      window.removeEventListener('logo-click', handleLogoClick);
      window.removeEventListener('navigate-to-terms', handleNavigateToTerms); // Cleanup
      window.removeEventListener('navigate-to-privacy', handleNavigateToPrivacy); // Cleanup
      window.removeEventListener('navigate-to-refund', handleNavigateToRefund); // Cleanup
    };
  }, [activeTab]);

  // Show password reset modal if triggered by email link
  if (showResetPassword) {
    return (
      <div className="min-h-screen bg-castle-stone text-slate-100">
        <ResetPassword 
          onSuccess={handleResetPasswordSuccess}
          onCancel={handleResetPasswordCancel}
        />
      </div>
    );
  }

  // Show homepage for non-authenticated users
  if (showHomepage) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 via-orange-50 to-green-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900"> {/* Background spans behind header */}
        {homepagePolicy === 'terms' || homepagePolicy === 'privacy' || homepagePolicy === 'refund' ? (
          <>
            {/* Public header (homepage-style) */}
            <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200/50 dark:border-gray-700/50 sticky top-0 z-50">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between py-4">
                  <div className="flex items-center space-x-2">
                    <img 
                      src="/CMG Logo_2023_Landscape_300px-42.png" 
                      alt="CMG Logo" 
                      className="w-[150px] h-auto cursor-pointer"
                      onClick={() => window.dispatchEvent(new CustomEvent('logo-click'))}
                    />
                  </div>
                  <button
                    onClick={handleLogin}
                    className="flex items-center space-x-2 text-white px-4 py-2 rounded-lg font-medium border-2 border-[#9ddcff] hover:border-[#a1deff] hover:shadow-lg hover:shadow-[#a1deff]/50 hover:scale-105 transition-all duration-300 login-button-animated-gradient"
                  >
                    <LogIn className="w-4 h-4" strokeWidth={2.5} />
                    <span>Sign In</span>
                  </button>
                </div>
              </div>
            </header>
            <div className="flex-1 min-h-screen">
              <div className="pt-0 pb-10">
                {/* Back button now rendered within each policy component header, positioned to the left of container */}
                {homepagePolicy === 'terms' && <TermsOfService />}
                {homepagePolicy === 'privacy' && <PrivacyPolicy />}
                {homepagePolicy === 'refund' && <RefundPolicy />}
              </div>
            </div>
          </>
        ) : (
          <Homepage onGetStarted={handleGetStarted} onLogin={handleLogin} />
        )}
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
        return <div className="py-10"><TermsOfService /></div>;
      case 'privacy': // New case for Privacy Policy
        return <div className="py-10"><PrivacyPolicy /></div>;
      case 'refund': // New case for Refund Policy
        return <div className="py-10"><RefundPolicy /></div>;
      default:
        return <div>Content for {activeTab}</div>;
    }
  };

  return (
    <div className="min-h-screen bg-castle-stone text-slate-100">
      <Header 
        remainingUpscales={Math.max(0, (userStats?.monthly_upscales_limit || 0) - (userStats?.current_month_upscales || 0))}
        isActive={isApiConfigured}
        userName={userProfile?.displayName || user?.email || null}
      />
      
      {/* Toolbar - Only show for upscaler tab */}
      {activeTab === 'upscaler' && (
        <Toolbar 
          upscaleSettings={upscaleSettings}
          onSettingsChange={setUpscaleSettings}
          userProfile={userProfile}
          currentProcessing={currentProcessing}
          onUpscale={handleUpscaleImage}
          latestUploadedFile={latestUploadedFile}
          isApiConfigured={isApiConfigured}
        />
      )}
      
      <main className="flex-1 flex items-start justify-center p-6 pt-[42px] overflow-auto">
        <div className="w-full max-w-7xl px-0 sm:px-2 lg:px-4">
          {activeTab === 'upscaler' ? (
            <div className="space-y-6">
              <ImageUpscaler />
              {latestProcessedImage && (
                <div className="mt-8">
                  <ImageComparison />
                </div>
              )}
              {isLabOpen && (
                <div className="mt-10">
                  <ThemeControls />
                </div>
              )}
            </div>
          ) : (
            renderMainContent()
          )}
        </div>
      </main>

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
