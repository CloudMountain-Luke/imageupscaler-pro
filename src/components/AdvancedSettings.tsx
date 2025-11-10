import React, { useState } from 'react';
import { Settings, Save, RotateCcw, Download, Upload, Bell, Shield, Palette, Zap } from 'lucide-react';
import GlassCard from './GlassCard';

interface SettingsData {
  // Processing Settings
  defaultScale: number;
  defaultImageType: string;
  defaultOutputFormat: string;
  autoMaxDetail: boolean;
  processingQuality: 'fast' | 'balanced' | 'high';
  
  // UI Settings
  theme: 'dark' | 'light' | 'auto';
  animations: boolean;
  soundEffects: boolean;
  notifications: boolean;
  
  // Advanced Settings
  maxConcurrentJobs: number;
  autoSave: boolean;
  compressionLevel: number;
  watermark: boolean;
  watermarkText: string;
  
  // API Settings
  apiEndpoint: string;
  apiKey: string;
  timeout: number;
  retryAttempts: number;
}

interface AdvancedSettingsProps {
  settings: SettingsData;
  onSettingsChange: (settings: SettingsData) => void;
  onSave: () => void;
  onReset: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
}

export const AdvancedSettings: React.FC<AdvancedSettingsProps> = ({
  settings,
  onSettingsChange,
  onSave,
  onReset,
  onExport,
  onImport
}) => {
  const [activeTab, setActiveTab] = useState('processing');
  const [hasChanges, setHasChanges] = useState(false);

  const handleSettingChange = (key: keyof SettingsData, value: any) => {
    const newSettings = { ...settings, [key]: value };
    onSettingsChange(newSettings);
    setHasChanges(true);
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImport(file);
    }
  };

  const tabs = [
    { id: 'processing', label: 'Processing', icon: Zap },
    { id: 'ui', label: 'Interface', icon: Palette },
    { id: 'advanced', label: 'Advanced', icon: Settings },
    { id: 'api', label: 'API', icon: Shield }
  ];

  return (
    <div className="space-y-6">
      {/* Settings Header */}
      <GlassCard 
        title="Advanced Settings" 
        description="Configure your AI upscaler preferences"
        icon={<Settings className="w-5 h-5" />}
      >
        <div className="flex items-center justify-between">
          <div className="flex space-x-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-300 ${
                    activeTab === tab.id
                      ? 'bg-blue-600 text-white shadow-lg'
                      : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
          
          <div className="flex space-x-2">
            <button
              onClick={onSave}
              disabled={!hasChanges}
              className={`px-4 py-2 rounded-lg transition-all duration-300 ${
                hasChanges
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-gray-600 text-gray-400 cursor-not-allowed'
              }`}
            >
              <Save className="w-4 h-4" />
            </button>
            <button
              onClick={onReset}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all duration-300"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </GlassCard>

      {/* Processing Settings */}
      {activeTab === 'processing' && (
        <div className="space-y-6">
          <GlassCard title="Default Processing Settings" icon={<Zap className="w-5 h-5" />}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Default Scale Factor
                </label>
                <select
                  value={settings.defaultScale}
                  onChange={(e) => handleSettingChange('defaultScale', parseInt(e.target.value))}
                  className="w-full rounded-lg border border-gray-600 bg-gray-800/50 text-white py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={2}>2x</option>
                  <option value={4}>4x</option>
                  <option value={8}>8x</option>
                  <option value={16}>16x</option>
                  <option value={32}>32x</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Default Image Type
                </label>
                <select
                  value={settings.defaultImageType}
                  onChange={(e) => handleSettingChange('defaultImageType', e.target.value)}
                  className="w-full rounded-lg border border-gray-600 bg-gray-800/50 text-white py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="photo">Photos</option>
                  <option value="anime">Anime</option>
                  <option value="art">Art</option>
                  <option value="text">Text</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Default Output Format
                </label>
                <select
                  value={settings.defaultOutputFormat}
                  onChange={(e) => handleSettingChange('defaultOutputFormat', e.target.value)}
                  className="w-full rounded-lg border border-gray-600 bg-gray-800/50 text-white py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="original">Keep Original</option>
                  <option value="png">PNG</option>
                  <option value="jpg">JPEG</option>
                  <option value="webp">WebP</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Processing Quality
                </label>
                <select
                  value={settings.processingQuality}
                  onChange={(e) => handleSettingChange('processingQuality', e.target.value)}
                  className="w-full rounded-lg border border-gray-600 bg-gray-800/50 text-white py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="fast">Fast</option>
                  <option value="balanced">Balanced</option>
                  <option value="high">High Quality</option>
                </select>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={settings.autoMaxDetail}
                  onChange={(e) => handleSettingChange('autoMaxDetail', e.target.checked)}
                  className="h-4 w-4 text-blue-600 border-gray-600 rounded"
                />
                <span className="text-sm text-gray-300">Automatically enable Max Detail for 16x+ scales</span>
              </label>
            </div>
          </GlassCard>
        </div>
      )}

      {/* UI Settings */}
      {activeTab === 'ui' && (
        <div className="space-y-6">
          <GlassCard title="Interface Preferences" icon={<Palette className="w-5 h-5" />}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Theme
                </label>
                <select
                  value={settings.theme}
                  onChange={(e) => handleSettingChange('theme', e.target.value)}
                  className="w-full rounded-lg border border-gray-600 bg-gray-800/50 text-white py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                  <option value="auto">Auto</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Notifications
                </label>
                <div className="space-y-2">
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={settings.notifications}
                      onChange={(e) => handleSettingChange('notifications', e.target.checked)}
                      className="h-4 w-4 text-blue-600 border-gray-600 rounded"
                    />
                    <span className="text-sm text-gray-300">Enable notifications</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={settings.animations}
                  onChange={(e) => handleSettingChange('animations', e.target.checked)}
                  className="h-4 w-4 text-blue-600 border-gray-600 rounded"
                />
                <span className="text-sm text-gray-300">Enable animations</span>
              </label>

              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={settings.soundEffects}
                  onChange={(e) => handleSettingChange('soundEffects', e.target.checked)}
                  className="h-4 w-4 text-blue-600 border-gray-600 rounded"
                />
                <span className="text-sm text-gray-300">Enable sound effects</span>
              </label>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Advanced Settings */}
      {activeTab === 'advanced' && (
        <div className="space-y-6">
          <GlassCard title="Advanced Configuration" icon={<Settings className="w-5 h-5" />}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Max Concurrent Jobs
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={settings.maxConcurrentJobs}
                  onChange={(e) => handleSettingChange('maxConcurrentJobs', parseInt(e.target.value))}
                  className="w-full rounded-lg border border-gray-600 bg-gray-800/50 text-white py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Compression Level (1-100)
                </label>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={settings.compressionLevel}
                  onChange={(e) => handleSettingChange('compressionLevel', parseInt(e.target.value))}
                  className="w-full"
                />
                <div className="text-sm text-gray-400 mt-1">{settings.compressionLevel}%</div>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={settings.autoSave}
                  onChange={(e) => handleSettingChange('autoSave', e.target.checked)}
                  className="h-4 w-4 text-blue-600 border-gray-600 rounded"
                />
                <span className="text-sm text-gray-300">Auto-save processed images</span>
              </label>

              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={settings.watermark}
                  onChange={(e) => handleSettingChange('watermark', e.target.checked)}
                  className="h-4 w-4 text-blue-600 border-gray-600 rounded"
                />
                <span className="text-sm text-gray-300">Add watermark to processed images</span>
              </label>

              {settings.watermark && (
                <div className="ml-7">
                  <input
                    type="text"
                    value={settings.watermarkText}
                    onChange={(e) => handleSettingChange('watermarkText', e.target.value)}
                    placeholder="Watermark text"
                    className="w-full rounded-lg border border-gray-600 bg-gray-800/50 text-white py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>
          </GlassCard>
        </div>
      )}

      {/* API Settings */}
      {activeTab === 'api' && (
        <div className="space-y-6">
          <GlassCard title="API Configuration" icon={<Shield className="w-5 h-5" />}>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  API Endpoint
                </label>
                <input
                  type="url"
                  value={settings.apiEndpoint}
                  onChange={(e) => handleSettingChange('apiEndpoint', e.target.value)}
                  className="w-full rounded-lg border border-gray-600 bg-gray-800/50 text-white py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  API Key
                </label>
                <input
                  type="password"
                  value={settings.apiKey}
                  onChange={(e) => handleSettingChange('apiKey', e.target.value)}
                  className="w-full rounded-lg border border-gray-600 bg-gray-800/50 text-white py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Timeout (seconds)
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="300"
                    value={settings.timeout}
                    onChange={(e) => handleSettingChange('timeout', parseInt(e.target.value))}
                    className="w-full rounded-lg border border-gray-600 bg-gray-800/50 text-white py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Retry Attempts
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="5"
                    value={settings.retryAttempts}
                    onChange={(e) => handleSettingChange('retryAttempts', parseInt(e.target.value))}
                    className="w-full rounded-lg border border-gray-600 bg-gray-800/50 text-white py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Import/Export */}
      <GlassCard title="Settings Management" icon={<Download className="w-5 h-5" />}>
        <div className="flex space-x-4">
          <button
            onClick={onExport}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all duration-300"
          >
            <Download className="w-4 h-4" />
            <span>Export Settings</span>
          </button>

          <label className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-all duration-300 cursor-pointer">
            <Upload className="w-4 h-4" />
            <span>Import Settings</span>
            <input
              type="file"
              accept=".json"
              onChange={handleFileImport}
              className="hidden"
            />
          </label>
        </div>
      </GlassCard>
    </div>
  );
};

export default AdvancedSettings;

