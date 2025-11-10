import React, { useState } from 'react';
import { BarChart3, Clock, Settings, Hammer, Zap } from 'lucide-react';

interface SidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeSection, onSectionChange }) => {
  const [hoveredSection, setHoveredSection] = useState<string | null>(null);
  
  const sections = [
    {
      id: 'upscaler',
      name: 'Upscaler',
      icon: Hammer,
      description: 'Upscale your images',
      glow: true
    }
  ];

  return (
    <div className="w-64 bg-white/5 backdrop-blur-xl border-r border-white/10 h-full flex flex-col">
      {/* Navigation - No header section */}
      <nav className="flex-1 p-4 space-y-2">
        {sections.map((section) => {
          const Icon = section.icon;
          const isActive = activeSection === section.id;
          const isHovered = hoveredSection === section.id;
          
          return (
            <button
              key={section.id}
              onClick={() => onSectionChange(section.id)}
              onMouseEnter={() => setHoveredSection(section.id)}
              onMouseLeave={() => setHoveredSection(null)}
              className={`
                w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-300
                ${isActive 
                  ? 'bg-gradient-to-r from-blue-600/30 to-purple-600/30 border border-blue-500/50 text-white shadow-lg shadow-blue-500/20' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5 hover:shadow-md'
                }
                ${isHovered && !isActive ? 'scale-[1.02]' : ''}
                ${isActive ? 'scale-[1.02] shadow-xl' : ''}
              `}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-all duration-300 ${isActive ? 'text-blue-400' : ''}`} />
              </div>
              <div className="flex-1 text-left">
                <div className="font-medium flex items-center space-x-2">
                  <span>{section.name}</span>
                  {isActive && (
                    <Zap className="w-3 h-3 text-blue-400" />
                  )}
                </div>
                <div className="text-xs opacity-75">{section.description}</div>
              </div>
              {isActive && (
                <div className="w-2 h-2 bg-blue-500 rounded-full" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-white/10">
        <div className="text-xs text-gray-400 text-center">
          Upscale Forge Pro
        </div>
      </div>
    </div>
  );
};

export default Sidebar;