import React, { useState } from 'react';
import { Check, Star, Zap, Crown, ArrowRight, Upload, Sparkles, Users, Shield, Clock, TrendingUp, LogIn, ChevronDown, ChevronUp } from 'lucide-react';
import { PricingPlans } from './PricingPlans'; // Import the new component

interface HomepageProps {
  onGetStarted: (plan: string) => void;
  onLogin?: () => void;
}

export function Homepage({ onGetStarted, onLogin }: HomepageProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    {
      question: "How does AI image upscaling work?",
      answer: "Our AI uses advanced Real-ESRGAN models to analyze your image and intelligently add pixels, preserving details and textures while increasing resolution up to 8x the original size."
    },
    {
      question: "What file formats are supported?",
      answer: "We support JPEG, PNG, and WebP formats up to 25MB per file. You can also convert between formats during the upscaling process."
    },
    {
      question: "Can I cancel my subscription anytime?",
      answer: "Yes, you can cancel your subscription at any time. You'll continue to have access until the end of your current billing period."
    },
    {
      question: "Is there an API available?",
      answer: "Yes, Pro and Enterprise plans include API access for integrating our upscaling technology into your applications and workflows."
    }
  ];

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  // handleNavigate function removed from here

  return (
    <div className="min-h-screen flex flex-col"> {/* Added flex-col for sticky footer */}
      {/* Header */}
      <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200/50 dark:border-gray-700/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center space-x-2">
              <img 
                src="/CMG Logo_2023_Landscape_300px-42.png" 
                alt="CMG Logo" 
                className="w-[150px] h-auto"
              />
            </div>
            
            <button
              onClick={onLogin}
              className="flex items-center space-x-2 text-white px-4 py-2 rounded-lg font-medium border-2 border-[#9ddcff] hover:border-[#a1deff] hover:shadow-lg hover:shadow-[#a1deff]/50 hover:scale-105 transition-all duration-300 login-button-animated-gradient"
            >
              <LogIn className="w-4 h-4" strokeWidth={2.5} />
              <span>Sign In</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="relative overflow-hidden flex-1"> {/* flex-1 to push footer to bottom */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-8">
              ImageUpscale Pro
            </h1>
            
            <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto">
              <span className="block">Transform your images with AI‑powered upscaling.</span>
              <span className="block">Get crystal‑clear, high‑resolution results in seconds.</span>
            </p>
            
            <div className="flex flex-wrap justify-center gap-4 mb-12">
              <div className="flex items-center space-x-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-full px-4 py-2 border border-gray-200/50">
                <Sparkles className="w-5 h-5 text-blue-600" />
                <span className="text-gray-700 dark:text-gray-300">AI-Powered Enhancement</span>
              </div>
              <div className="flex items-center space-x-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-full px-4 py-2 border border-gray-200/50">
                <Clock className="w-5 h-5 text-green-600" />
                <span className="text-gray-700 dark:text-gray-300">15-60 Second Processing</span>
              </div>
              <div className="flex items-center space-x-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-full px-4 py-2 border border-gray-200/50">
                <Shield className="w-5 h-5 text-purple-600" />
                <span className="text-gray-700 dark:text-gray-300">Professional Quality</span>
              </div>
            </div>
            
            {/* Demo Image Placeholder */}
            <div className="mb-12">
              <img
                src="https://images.pexels.com/photos/3861958/pexels-photo-3861958.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750"
                alt="Abstract representation of digital image enhancement"
                className="max-w-xl mx-auto mb-4 rounded-lg shadow-2xl"
              />
              <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                See the difference AI upscaling makes
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Why Choose ImageUpscale Pro?
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Professional-grade AI upscaling at competitive prices
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          <div className="text-center p-6 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl border border-gray-200/50">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Up to 8x Scaling</h3>
            <p className="text-gray-600 dark:text-gray-300">Scale your images 2x, 4x, or 8x while preserving quality and detail</p>
          </div>

          <div className="text-center p-6 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl border border-gray-200/50">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">AI-Powered Quality</h3>
            <p className="text-gray-600 dark:text-gray-300">Advanced Real-ESRGAN models optimized for photos, art, and anime</p>
          </div>

          <div className="text-center p-6 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl border border-gray-200/50">
            <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-teal-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Lightning Fast</h3>
            <p className="text-gray-600 dark:text-gray-300">Get professional results in 15-60 seconds with our optimized processing</p>
          </div>
        </div>
      </div>

      {/* Pricing Section - Now renders the new PricingPlans component */}
      <PricingPlans onGetStarted={onGetStarted} onBack={() => {}} /> {/* onBack is not used here, but required by prop type */}

      {/* FAQ Section */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Frequently Asked Questions
          </h2>
        </div>

        <div className="space-y-6">
          {faqs.map((faq, index) => (
            <div key={index} className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl border border-gray-200/50 overflow-hidden">
              <button
                onClick={() => toggleFaq(index)}
                className="w-full p-6 text-left flex items-center justify-between hover:bg-gray-50/50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {faq.question}
                </h3>
                {openFaq === index ? (
                  <ChevronUp className="w-5 h-5 text-gray-500 flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-500 flex-shrink-0" />
                )}
              </button>
              {openFaq === index && (
                <div className="px-6 pb-6">
                  <p className="text-gray-600 dark:text-gray-300">
                    {faq.answer}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Footer - Removed from Homepage.tsx */}
    </div>
  );
}
