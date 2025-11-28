import React from 'react';
import { Flame, Hammer, Zap, Layers } from 'lucide-react';

interface SchemePreviewProps {
  name: string;
  description: string;
  primary: string;
  secondary: string;
  accent: string;
  icon: React.ReactNode;
}

const SchemePreview: React.FC<SchemePreviewProps> = ({
  name,
  description,
  primary,
  secondary,
  accent,
  icon,
}) => {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6 shadow-lg">
      {/* Header */}
      <div className="flex items-center space-x-3 mb-4">
        <div
          className="p-2 rounded-lg"
          style={{ backgroundColor: primary, color: '#fff' }}
        >
          {icon}
        </div>
        <div>
          <h3 className="font-bold text-lg text-gray-900 dark:text-white">{name}</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">{description}</p>
        </div>
      </div>

      {/* Color Swatches */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="space-y-2">
          <div
            className="h-16 rounded-lg shadow-md"
            style={{ backgroundColor: primary }}
          />
          <p className="text-xs text-gray-600 dark:text-gray-400 text-center">Primary</p>
        </div>
        <div className="space-y-2">
          <div
            className="h-16 rounded-lg shadow-md"
            style={{ backgroundColor: secondary }}
          />
          <p className="text-xs text-gray-600 dark:text-gray-400 text-center">Secondary</p>
        </div>
        <div className="space-y-2">
          <div
            className="h-16 rounded-lg shadow-md"
            style={{ backgroundColor: accent }}
          />
          <p className="text-xs text-gray-600 dark:text-gray-400 text-center">Accent</p>
        </div>
      </div>

      {/* Example UI Elements */}
      <div className="space-y-3">
        <button
          className="w-full py-2 px-4 rounded-lg font-semibold text-white shadow-md hover:scale-105 transition-transform"
          style={{ backgroundColor: primary }}
        >
          Primary Action
        </button>
        <div
          className="w-full py-2 px-4 rounded-lg border-2 text-center font-medium"
          style={{ borderColor: secondary, color: secondary }}
        >
          Secondary Action
        </div>
        <div className="flex space-x-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: primary }}
          />
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: secondary }}
          />
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: accent }}
          />
        </div>
      </div>

      {/* Gradient Background Effect */}
      <div
        className="absolute -top-10 -right-10 w-40 h-40 rounded-full blur-3xl opacity-20"
        style={{
          background: `radial-gradient(circle, ${primary}, ${secondary})`,
        }}
      />
    </div>
  );
};

export const ColorSchemeShowcase: React.FC = () => {
  const schemes = [
    {
      name: 'Flame',
      description: 'Fire and Energy',
      primary: 'hsl(50, 85%, 55%)',
      secondary: 'hsl(330, 80%, 60%)',
      accent: 'hsl(30, 75%, 50%)',
      icon: <Flame className="w-5 h-5" />,
    },
    {
      name: 'Forge',
      description: 'Craftsmanship',
      primary: 'hsl(30, 85%, 55%)',
      secondary: 'hsl(45, 80%, 60%)',
      accent: 'hsl(195, 75%, 60%)',
      icon: <Hammer className="w-5 h-5" />,
    },
    {
      name: 'Cyber',
      description: 'Digital Future',
      primary: 'hsl(195, 85%, 60%)',
      secondary: 'hsl(220, 80%, 65%)',
      accent: 'hsl(50, 75%, 55%)',
      icon: <Zap className="w-5 h-5" />,
    },
    {
      name: 'Space',
      description: 'Purple Space',
      primary: 'hsl(275, 80%, 60%)',
      secondary: 'hsl(285, 80%, 65%)',
      accent: 'hsl(30, 75%, 55%)',
      icon: <Layers className="w-5 h-5" />,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center space-x-3 mb-4">
            <img
              src="/upscale-forge-logo.png"
              alt="Upscale Forge Logo"
              className="h-16 w-auto"
            />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-[hsl(50,100%,60%)] via-[hsl(330,100%,60%)] to-[hsl(30,100%,55%)] bg-clip-text text-transparent">
              Upscale Forge
            </h1>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Color Scheme Variations
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Four unique color schemes inspired by the Upscale Forge logo. Each scheme
            captures a different aspect of our brand identity while maintaining visual
            harmony.
          </p>
        </div>

        {/* Color Scheme Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {schemes.map((scheme) => (
            <SchemePreview key={scheme.name} {...scheme} />
          ))}
        </div>

        {/* Logo Colors Reference */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 shadow-lg">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 text-center">
            Logo Color Palette
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div
                className="h-24 rounded-xl shadow-lg mb-3 flex items-center justify-center text-white font-bold"
                style={{ backgroundColor: 'hsl(50, 100%, 60%)' }}
              >
                <Flame className="w-8 h-8" />
              </div>
              <p className="font-semibold text-gray-900 dark:text-white">Flame Yellow</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">hsl(50, 100%, 60%)</p>
            </div>
            <div className="text-center">
              <div
                className="h-24 rounded-xl shadow-lg mb-3 flex items-center justify-center text-white font-bold"
                style={{ backgroundColor: 'hsl(330, 100%, 60%)' }}
              >
                <Flame className="w-8 h-8" />
              </div>
              <p className="font-semibold text-gray-900 dark:text-white">Flame Magenta</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">hsl(330, 100%, 60%)</p>
            </div>
            <div className="text-center">
              <div
                className="h-24 rounded-xl shadow-lg mb-3 flex items-center justify-center text-white font-bold"
                style={{ backgroundColor: 'hsl(30, 100%, 55%)' }}
              >
                <Hammer className="w-8 h-8" />
              </div>
              <p className="font-semibold text-gray-900 dark:text-white">Forge Orange</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">hsl(30, 100%, 55%)</p>
            </div>
            <div className="text-center">
              <div
                className="h-24 rounded-xl shadow-lg mb-3 flex items-center justify-center text-gray-900 font-bold"
                style={{ backgroundColor: 'hsl(195, 100%, 65%)' }}
              >
                <Zap className="w-8 h-8" />
              </div>
              <p className="font-semibold text-gray-900 dark:text-white">Cyber Cyan</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">hsl(195, 100%, 65%)</p>
            </div>
          </div>
        </div>

        {/* Usage Info */}
        <div className="mt-12 text-center">
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Switch between color schemes using the <strong>Theme Lab</strong> controls
          </p>
          <div className="inline-flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-500">
            <span>Dark Mode</span>
            <div className="w-12 h-6 bg-gray-300 dark:bg-gray-700 rounded-full" />
            <span>Light Mode</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ColorSchemeShowcase;

