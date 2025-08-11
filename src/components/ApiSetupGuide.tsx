import React, { useState } from 'react';
import { ExternalLink, Copy, Check, AlertCircle, Key, CreditCard, Database, Settings } from 'lucide-react';

export function ApiSetupGuide() {
  const [copiedStep, setCopiedStep] = useState<number | null>(null);

  const [showGpuInfo, setShowGpuInfo] = useState(false);

  const copyToClipboard = (text: string, step: number) => {
    navigator.clipboard.writeText(text);
    setCopiedStep(step);
    setTimeout(() => setCopiedStep(null), 2000);
  };

  const steps = [
    {
      title: "Create Replicate Account",
      description: "Sign up for a free account to get $10 in credits",
      action: "Visit Replicate",
      url: "https://replicate.com",
      icon: ExternalLink
    },
    {
      title: "Get Your API Token", 
      description: "Navigate to Account Settings → API Tokens",
      action: "Go to Account Settings",
      url: "https://replicate.com/account",
      icon: Key
    },
    {
      title: "Configure Supabase Dashboard",
      description: "Set up environment variables and storage configuration",
      action: "Open Supabase Dashboard",
      url: "https://dashboard.example.com/project/settings",
      icon: Database
    },
    {
      title: "Create Environment File",
      description: "Add your token to a .env file in your project root",
      code: "VITE_REPLICATE_API_TOKEN=r8_your_token_here",
      icon: Copy
    },
    {
      title: "Restart Development Server",
      description: "Stop and restart your dev server to load the new environment variable",
      code: "npm run dev",
      icon: Copy
    }
  ];

  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-xl p-6 border border-gray-200/50 max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <Key className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Setup AI Image Upscaling</h2>
        <p className="text-gray-600">Follow these steps to enable professional AI-powered image enhancement</p>
      </div>

      <div className="space-y-6">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <div key={index} className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-sm font-bold text-blue-600">{index + 1}</span>
                </div>
              </div>
              
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">{step.title}</h3>
                <p className="text-gray-600 mb-3">{step.description}</p>
                
                {step.url && (
                  <a
                    href={step.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Icon className="w-4 h-4" />
                    <span>{step.action}</span>
                  </a>
                )}
                
                {step.code && (
                  <div className="bg-gray-900 rounded-lg p-3 mt-2">
                    <div className="flex items-center justify-between">
                      <code className="text-green-400 text-sm font-mono">{step.code}</code>
                      <button
                        onClick={() => copyToClipboard(step.code!, index)}
                        className="p-1 hover:bg-gray-800 rounded transition-colors"
                      >
                        {copiedStep === index ? (
                          <Check className="w-4 h-4 text-green-400" />
                        ) : (
                          <Copy className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 p-4 bg-green-50 border border-green-200 rounded-lg">
        <div className="flex items-start space-x-3">
          <CreditCard className="w-5 h-5 text-green-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-green-800">Free Credits Included</h4>
            <p className="text-sm text-green-700 mt-1">
              New Replicate accounts get $10 in free credits - enough for ~1,800 image upscaling operations!
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <div className="flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-amber-800">GPU Server Configuration</h4>
            <p className="text-sm text-amber-700 mt-1">
              The current ESRGAN_API_URL contains a placeholder "YOUR_GPU_HOST" that needs to be replaced with your actual GPU server hostname.
            </p>
            <button
              onClick={() => setShowGpuInfo(!showGpuInfo)}
              className="mt-2 text-sm bg-amber-600 text-white px-3 py-1 rounded hover:bg-amber-700 transition-colors"
            >
              {showGpuInfo ? 'Hide' : 'Show'} GPU Setup Options
            </button>
            
            {showGpuInfo && (
              <div className="mt-3 p-3 bg-white rounded border text-sm">
                <h5 className="font-medium text-gray-900 mb-2">Options:</h5>
                <ul className="space-y-1 text-gray-700">
                  <li><strong>Recommended:</strong> Use Replicate API (no server setup needed)</li>
                  <li><strong>Advanced:</strong> Set up your own GPU server with Real-ESRGAN</li>
                  <li><strong>Alternative:</strong> Use Leonardo.ai or Stability.ai APIs</li>
                </ul>
                <p className="mt-2 text-xs text-gray-600">
                  See GPU_HOST_SETUP.md for detailed instructions on each option.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start space-x-3">
          <Settings className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-800">Backend Setup Required</h4>
            <p className="text-sm text-blue-700 mt-1">
              Complete the backend configuration to enable serverless functions for faster, more secure AI processing.
            </p>
            <a 
              href="/BACKEND_SETUP.md" 
              target="_blank"
              className="inline-flex items-center space-x-1 mt-2 text-sm text-blue-600 hover:text-blue-800"
            >
              <span>View detailed setup guide</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
      <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <div className="flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-amber-800">Security Note</h4>
            <p className="text-sm text-amber-700 mt-1">
              Never commit your .env file to version control. Keep your API token secure and don't share it publicly.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}