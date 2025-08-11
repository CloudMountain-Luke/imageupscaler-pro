import React from 'react';
import { X, Image, Clock, History, BarChart3, Sparkles, Menu, ChevronLeft, ChevronRight } from 'lucide-react';
import { useImageProcessing } from '../contexts/ImageProcessingContext';

type ActiveTab = 'upscaler' | 'queue' | 'history' | 'stats' | 'billing' | 'account';
type SidebarState = 'open' | 'collapsed' | 'hidden';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  sidebarState: SidebarState;
  setSidebarState: (state: SidebarState) => void;
}

export function Sidebar({ activeTab, setActiveTab, sidebarState, setSidebarState }: SidebarProps) {
  const menuItems = [
    { id: 'upscaler' as const, label: 'AI Upscaler', icon: Sparkles },
    { id: 'history' as const, label: 'History', icon: History },
    { id: 'stats' as const, label: 'Statistics', icon: BarChart3 },
  ];

  // Determine sidebar classes based on state
  const getSidebarClasses = () => {
    const baseClasses = "fixed top-20 bottom-0 left-0 z-40 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-r border-gray-200/50 dark:border-gray-700/50 transform transition-all duration-300 ease-in-out";
    
    if (sidebarState === 'hidden') {
      return `${baseClasses} w-64 -translate-x-full lg:-translate-x-full`;
    } else if (sidebarState === 'collapsed') {
      return `${baseClasses} w-20 translate-x-0 lg:translate-x-0`;
    } else {
      return `${baseClasses} w-64 translate-x-0 lg:translate-x-0`;
    }
  };

  return (
    <>
      {/* Mobile overlay */}
      {sidebarState !== 'hidden' && window.innerWidth < 768 && (
        <div 
          className="fixed inset-0 bg-black/20 z-30 lg:hidden"
          onClick={() => setSidebarState('hidden')}
        />
      )}
      
      <aside className={`${getSidebarClasses()} flex flex-col`}>
        {/* Sidebar Header with Controls */}
        <div className="flex items-center justify-between p-2 border-b border-gray-200/50 dark:border-gray-700/50">
          {sidebarState === 'open' && (
            <>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 lg:hidden">Menu</h2>
              <div className="flex items-center justify-end space-x-2 flex-1">
                {/* Collapse/Expand Button - Desktop Only */}
                <button 
                  onClick={() => setSidebarState(sidebarState === 'open' ? 'collapsed' : 'open')}
                  className="w-full p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex justify-end items-center"
                  title={sidebarState === 'open' ? 'Collapse sidebar' : 'Expand sidebar'}
                >
                  <ChevronLeft className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                </button>
                {/* Close Button - Mobile Only */}
                <button 
                  onClick={() => setSidebarState('hidden')} 
                  className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <X className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                </button>
              </div>
            </>
          )}
          
          {sidebarState === 'collapsed' && (
            <button 
              onClick={() => setSidebarState('open')}
              className="w-full flex justify-center p-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title="Expand sidebar"
            >
              <ChevronRight className="w-4 h-4 text-gray-700 dark:text-gray-300" />
            </button>
          )}
        </div>
        
        {/* Navigation - Top aligned with main container */}
        <nav className="p-4 pt-2 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  // On mobile, hide sidebar after selection
                  if (window.innerWidth < 1024) {
                    setSidebarState('hidden');
                  }
                }}
                className={`
                  w-full flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200
                  ${isActive 
                    ? 'bg-gradient-to-r from-[#0082ca] to-purple-600 text-white shadow-lg' 
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }
                  ${sidebarState === 'collapsed' ? 'justify-center' : 'justify-start space-x-3'}
                `}
                title={sidebarState === 'collapsed' ? item.label : undefined}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {sidebarState === 'open' && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>
        
        {/* Spacer to push bottom content down */}
        <div className="flex-1"></div>
        
      </aside>
    </>
  );
}