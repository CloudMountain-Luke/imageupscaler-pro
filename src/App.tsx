import React, { useState, useCallback } from 'react';
import { useAuth } from './contexts/AuthContext';
import { useImageProcessing } from './contexts/ImageProcessingContext';
import { edgeFunctionService } from './services/edgeFunctionService';
import { Header } from './components/Header';
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
import { Footer } from './components/Footer';
import { TermsOfService } from './components/TermsOfService';
import { PrivacyPolicy } from './components/PrivacyPolicy';
import { RefundPolicy } from './components/RefundPolicy';
import { ThemeControls } from './components/ThemeControls';
import { useThemeLab } from './contexts/ThemeContext';
import { UpscaleTrackingService } from './services/upscaleTrackingService';
import { CookieConsent } from './components/CookieConsent';
import { CookieSettingsModal } from './components/CookieSettingsModal';

import { Download, Clock, CheckCircle, AlertCircle, Upload, Sparkles, Plus } from 'lucide-react';
import { useDropzone } from 'react-dropzone';

const SUPPORTED_FORMATS = edgeFunctionService.getSupportedFormats();
const MAX_FILE_SIZE = edgeFunctionService.getMaxFileSize();

type ActiveTab = 'upscaler' | 'queue' | 'history' | 'stats' | 'billing' | 'account' | 'pricing' | 'terms' | 'privacy' | 'refund'; // Add new policy tabs

function App() {
  const { isLabOpen, closeLab } = useThemeLab();
  const { user, userProfile, logout, isReady } = useAuth();
  const {
    uploadedFiles,
    processedImages,
    processQueue,
    processing,
    userStats,
    realUserProfile,
    addToQueue,
    addUploadedFile,
    clearUploadedFiles,
  } = useImageProcessing();

  const [activeTab, setActiveTab] = useState<ActiveTab>('upscaler');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [showHomepage, setShowHomepage] = useState(true);
  const [previousTab, setPreviousTab] = useState<ActiveTab | null>(null);

  // Track if we're in the process of logging out to prevent useEffect from interfering
  const isLoggingOutRef = React.useRef(false);

  React.useEffect(() => {
    if (isReady && !isLoggingOutRef.current) {
      setShowHomepage(!user);
    }
  }, [user, isReady]);
  
  // Track if we've attempted to update to Mega plan
  const hasUpdatedToMegaRef = React.useRef(false);
  
  // Expose update function globally for manual triggering
  React.useEffect(() => {
    (window as any).updateToMegaPlan = async () => {
      if (!user) {
        console.error('User not authenticated');
        return;
      }
      try {
        console.log('Manually updating to Mega Plan...');
        const currentProfile = await UpscaleTrackingService.getUserProfile(user.id);
        console.log('Current profile:', currentProfile);
        const currentPlan = currentProfile?.subscription_tiers?.name?.toLowerCase();
        console.log('Current plan:', currentPlan);
        
        if (currentPlan === 'mega') {
          console.log('User is already on Mega Plan');
          return;
        }

        console.log(`Updating from ${currentPlan} to Mega...`);
        const updatedProfile = await UpscaleTrackingService.updateSubscriptionTier('mega');
        console.log('Successfully updated to Mega Plan:', updatedProfile);
        
        // Wait a moment for database to update
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Trigger multiple refreshes to ensure it's loaded
        window.dispatchEvent(new CustomEvent('refresh-user-profile'));
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('refresh-user-profile'));
        }, 1000);
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('refresh-user-profile'));
        }, 2000);
        
        alert('Successfully updated to Mega Plan! The page will refresh in 2 seconds.');
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } catch (error: any) {
        console.error('Error updating subscription tier:', error);
        console.error('Error details:', {
          message: error?.message,
          name: error?.name,
          stack: error?.stack
        });
        alert(`Error updating plan: ${error?.message || 'Unknown error'}. Check console for details.`);
        // If the error is that the tier doesn't exist, log a helpful message
        if (error?.message?.includes('not found') || error?.message?.includes('mega')) {
          console.error('Mega tier may not exist in database. Please run the migration: 20251118020525_add_mega_tier_and_fix_pricing.sql');
          alert('Mega tier not found in database. Please run the migration first.');
        }
      }
    };
  }, [user]);

  // Update subscription tier to Mega Plan when user is authenticated
  React.useEffect(() => {
    if (user && isReady && !hasUpdatedToMegaRef.current) {
      const updateToMega = async () => {
        try {
          // Check current plan first
          const currentProfile = await UpscaleTrackingService.getUserProfile(user.id);
          console.log('[Auto-Update] Current profile:', currentProfile);
          const currentPlan = currentProfile?.subscription_tiers?.name?.toLowerCase();
          console.log('[Auto-Update] Current plan:', currentPlan);
          
          if (currentPlan === 'mega') {
            console.log('[Auto-Update] User is already on Mega Plan');
            hasUpdatedToMegaRef.current = true;
            return;
          }

          console.log(`[Auto-Update] Current plan: ${currentPlan}, updating to Mega...`);
          const updatedProfile = await UpscaleTrackingService.updateSubscriptionTier('mega');
          console.log('[Auto-Update] Successfully updated to Mega Plan:', updatedProfile);
          hasUpdatedToMegaRef.current = true;
          
          // Wait a moment for database to update
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Trigger a refresh of the user profile in ImageProcessingContext
          window.dispatchEvent(new CustomEvent('refresh-user-profile'));
          
          // Force another refresh after a delay to ensure it's loaded
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('refresh-user-profile'));
          }, 1000);
        } catch (error: any) {
          console.error('[Auto-Update] Error updating subscription tier:', error);
          console.error('[Auto-Update] Error details:', {
            message: error?.message,
            name: error?.name,
            stack: error?.stack
          });
          // If the error is that the tier doesn't exist, log a helpful message
          if (error?.message?.includes('not found') || error?.message?.includes('mega')) {
            console.error('[Auto-Update] Mega tier may not exist in database. Please run the migration: 20251118020525_add_mega_tier_and_fix_pricing.sql');
            console.error('[Auto-Update] You can manually trigger the update by running: window.updateToMegaPlan() in the console');
          }
        }
      };
      // Add a small delay to ensure everything is loaded
      setTimeout(() => {
        updateToMega();
      }, 1000);
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
  };

  const handleLogout = async () => {
    console.log('handleLogout called');
    console.log('Current user:', user?.email);
    try {
      // Set flag to prevent useEffect from interfering
      isLoggingOutRef.current = true;
      // Force show homepage immediately
    setShowHomepage(true);
    setActiveTab('upscaler');
      // Clear uploaded files
    clearUploadedFiles();
      // Logout and wait for it to complete
      await logout();
      // Ensure homepage is still shown after logout
      setShowHomepage(true);
      console.log('Logout completed, homepage should be visible');
    } catch (error) {
      console.error('Logout error:', error);
      // Even if logout fails, show homepage
      setShowHomepage(true);
    } finally {
      // Reset flag after a brief delay to allow state to settle
      setTimeout(() => {
        isLoggingOutRef.current = false;
      }, 500);
    }
  };

  // Listen for navigation events from header dropdown and footer
  React.useEffect(() => {
    const handleNavigateToAccount = () => setActiveTab('account');
    const handleNavigateToBilling = () => setActiveTab('billing');
    const handleNavigateToDashboard = () => setActiveTab('upscaler');
    const handleNavigateToHistory = () => setActiveTab('history');
    const handleShowPricingPlans = () => {
      setPreviousTab(activeTab);
      setActiveTab('pricing');
      };
    const handleNavigateToTerms = () => {
      setPreviousTab(activeTab);
      setActiveTab('terms');
      };
    const handleNavigateToPrivacy = () => {
      setPreviousTab(activeTab);
      setActiveTab('privacy');
      };
    const handleNavigateToRefund = () => {
      setPreviousTab(activeTab);
      setActiveTab('refund');
      };
    // Handle start new upscale - navigate to dashboard and clear state
    const handleStartNewUpscale = () => {
      setActiveTab('upscaler');
      // The ImageUploader component will handle clearing files via its own listener
      };

    window.addEventListener('navigate-to-account', handleNavigateToAccount);
    window.addEventListener('navigate-to-billing', handleNavigateToBilling);
    window.addEventListener('navigate-to-dashboard', handleNavigateToDashboard);
    window.addEventListener('navigate-to-history', handleNavigateToHistory);
    window.addEventListener('show-pricing-plans', handleShowPricingPlans);
    window.addEventListener('navigate-to-terms', handleNavigateToTerms); // New event listener
    window.addEventListener('navigate-to-privacy', handleNavigateToPrivacy); // New event listener
    window.addEventListener('navigate-to-refund', handleNavigateToRefund); // New event listener
    window.addEventListener('start-new-upscale', handleStartNewUpscale); // Navigate to dashboard on new upscale

    return () => {
      window.removeEventListener('navigate-to-account', handleNavigateToAccount);
      window.removeEventListener('navigate-to-billing', handleNavigateToBilling);
      window.removeEventListener('navigate-to-dashboard', handleNavigateToDashboard);
      window.removeEventListener('navigate-to-history', handleNavigateToHistory);
      window.removeEventListener('show-pricing-plans', handleShowPricingPlans);
      window.removeEventListener('navigate-to-terms', handleNavigateToTerms); // Cleanup
      window.removeEventListener('navigate-to-privacy', handleNavigateToPrivacy); // Cleanup
      window.removeEventListener('navigate-to-refund', handleNavigateToRefund); // Cleanup
      window.removeEventListener('start-new-upscale', handleStartNewUpscale); // Cleanup
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
        
        {/* Cookie Consent - must be in both returns */}
        <CookieConsent />
        <CookieSettingsModal />
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


  // Compute remaining upscales using realUserProfile from database (most accurate)
  const remainingUpscales = (() => {
    // First priority: Use realUserProfile from database (has subscription_tiers relationship)
    if (realUserProfile) {
      // Try subscription_tiers first (most accurate)
      if (realUserProfile.subscription_tiers?.monthly_upscales && typeof realUserProfile.subscription_tiers.monthly_upscales === 'number') {
        const used = realUserProfile.current_month_upscales ?? 0;
        const remaining = Math.max(0, realUserProfile.subscription_tiers.monthly_upscales - used);
        console.log('[App] Remaining tokens from subscription_tiers:', remaining, {
          limit: realUserProfile.subscription_tiers.monthly_upscales,
          used,
          plan: realUserProfile.subscription_tiers.name
        });
        return remaining;
      }
      // Fallback to monthly_upscales_limit
      if (realUserProfile.monthly_upscales_limit && typeof realUserProfile.monthly_upscales_limit === 'number') {
        const used = realUserProfile.current_month_upscales ?? 0;
        const remaining = Math.max(0, realUserProfile.monthly_upscales_limit - used);
        console.log('[App] Remaining tokens from monthly_upscales_limit:', remaining, {
          limit: realUserProfile.monthly_upscales_limit,
          used
        });
        return remaining;
      }
      // Infer from monthly_upscales_limit if subscription_tiers is null
      if (realUserProfile.monthly_upscales_limit) {
        const used = realUserProfile.current_month_upscales ?? 0;
        const remaining = Math.max(0, realUserProfile.monthly_upscales_limit - used);
        console.log('[App] Remaining tokens (inferred):', remaining);
        return remaining;
      }
    }
    
    // Second priority: Use userStats
    if (userStats?.monthly_upscales_limit && typeof userStats.current_month_upscales === 'number') {
      const remaining = Math.max(0, userStats.monthly_upscales_limit - userStats.current_month_upscales);
      console.log('[App] Remaining tokens from userStats:', remaining);
      return remaining;
    }
    
    // Fallback: Use defaults based on tier name
    const tier = (
      realUserProfile?.subscription_tiers?.name ||
      realUserProfile?.subscription_tier ||
      userProfile?.subscription_tiers?.name ||
      userProfile?.subscription_tier ||
      ''
    ).toLowerCase();
    const defaults: Record<string, number> = { basic: 100, pro: 500, enterprise: 1250, mega: 2750 };
    const defaultLimit = defaults[tier] ?? 250;
    console.log('[App] Remaining tokens (default):', defaultLimit, { tier });
    return defaultLimit;
  })();
  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--surface)' }}>
      <Header 
        isApiConfigured={isApiConfigured}
        remainingUpscales={remainingUpscales}
        userName={user?.email || userProfile?.name || null}
        onLogout={handleLogout}
      />
      
      <div className="flex flex-1">
        <main className="flex-1">
          {renderMainContent()}
        </main>
      </div>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        selectedPlan={selectedPlan}
       onAuthSuccess={handleAuthSuccess}
      />
      
      {/* UI Lab Modal Pop-up */}
      {isLabOpen && (
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{ 
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(4px)'
          }}
          onClick={(e) => {
            // Close when clicking the backdrop
            if (e.target === e.currentTarget) {
              closeLab();
            }
          }}
        >
          <div 
            className="relative max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <ThemeControls />
          </div>
        </div>
      )}
      
      <Footer /> {/* Render footer globally */}
      
      {/* Cookie Consent Banner & Settings Modal */}
      <CookieConsent />
      <CookieSettingsModal />
    </div>
  );
}

export default App;

