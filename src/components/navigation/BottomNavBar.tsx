import React from 'react';
import { ScreenId } from '../../types';
import { useI18n } from '../../i18n';

interface BottomNavBarProps {
  currentScreen: ScreenId;
  onNavigate: (screen: ScreenId) => void;
  onOpenQuickHub: () => void;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  currentScreen,
  onNavigate,
  onOpenQuickHub
}) => {
  const { t } = useI18n();
  const isHomeActive = currentScreen === 'home';
  const isScanActive = currentScreen === 'scan-outfit' || currentScreen === 'camera-scan' || currentScreen === 'ar-tryon' || currentScreen === 'tryon-result';
  const isStylistActive = currentScreen === 'chat';
  const isProfileActive = currentScreen === 'profile' || currentScreen === 'terms' || currentScreen === 'privacy';

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 pointer-events-none pb-[env(safe-area-inset-bottom,0px)]">
      {/* Outer wrapper max-w-md centered */}
      <div className="w-full max-w-md mx-auto px-4 pb-3">
        {/* Navigation container: dark navy-blue #0D172B, border #26334B, fully rounded pill container */}
        <nav 
          aria-label={t('nav.bottomNavigation')}
          className="pointer-events-auto relative w-full h-[76px] rounded-full px-2 flex items-center justify-between bg-[#0D172B] border border-[#26334B] shadow-[0_16px_40px_rgba(0,0,0,0.65),0_4px_16px_rgba(96,69,255,0.2)] select-none"
        >
          {/* 1. Home */}
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className={`flex-1 flex flex-col items-center justify-center py-1 transition-all active:scale-95 cursor-pointer ${
              isHomeActive ? 'text-[#6045FF]' : 'text-[#94A3B8] hover:text-white'
            }`}
            title={t('nav.home')}
          >
            {/* Outline House Icon with open doorway */}
            <svg 
              viewBox="0 0 24 24" 
              width="24" 
              height="24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2.3" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              className="transition-transform duration-200"
            >
              <path d="M3 10.5L12 3l9 7.5v10a1.5 1.5 0 0 1-1.5 1.5H15.5v-6a1.5 1.5 0 0 0-1.5-1.5h-4a1.5 1.5 0 0 0-1.5 1.5v6H4.5A1.5 1.5 0 0 1 3 20.5z" />
            </svg>
            <span className={`text-[11.5px] mt-1 font-semibold tracking-tight transition-colors ${
              isHomeActive ? 'text-[#6045FF] font-bold' : 'text-[#94A3B8]'
            }`}>
              {t('nav.home')}
            </span>
          </button>

          {/* 2. Scan */}
          <button
            type="button"
            onClick={() => onNavigate('scan-outfit')}
            className={`flex-1 flex flex-col items-center justify-center py-1 transition-all active:scale-95 cursor-pointer ${
              isScanActive ? 'text-[#6045FF]' : 'text-[#94A3B8] hover:text-white'
            }`}
            title={t('nav.scan')}
          >
            {/* Camera Scanning / Focus Reticle Icon */}
            <svg 
              viewBox="0 0 24 24" 
              width="24" 
              height="24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2.3" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              className="transition-transform duration-200"
            >
              <path d="M4 8V5a1 1 0 0 1 1-1h3" />
              <path d="M16 4h3a1 1 0 0 1 1 1v3" />
              <path d="M20 16v3a1 1 0 0 1-1 1h-3" />
              <path d="M8 20H5a1 1 0 0 1-1-1v-3" />
              <circle cx="12" cy="12" r="3.2" />
            </svg>
            <span className={`text-[11.5px] mt-1 font-semibold tracking-tight transition-colors ${
              isScanActive ? 'text-[#6045FF] font-bold' : 'text-[#94A3B8]'
            }`}>
              {t('nav.scan')}
            </span>
          </button>

          {/* 3. Center NOVA Hub Button (Prominent elevated purple circle with 4 solid white squares) */}
          <div className="relative flex-none w-[68px] flex flex-col items-center justify-center">
            <button
              type="button"
              onClick={onOpenQuickHub}
              aria-label={t('nav.openHub')}
              className="absolute -top-[16px] w-[64px] h-[64px] rounded-full bg-gradient-to-b from-[#6545FF] to-[#4D32E8] text-white flex items-center justify-center border-[2.5px] border-white shadow-[0_0_26px_rgba(101,69,255,0.75),0_8px_20px_rgba(0,0,0,0.55)] transition-all active:scale-90 hover:scale-105 cursor-pointer group"
            >
              {/* Four solid rounded white squares (2x2 grid) */}
              <div className="grid grid-cols-2 gap-1.5 w-6 h-6 items-center justify-center group-hover:rotate-90 transition-transform duration-300">
                <div className="w-2.5 h-2.5 rounded-[3px] bg-white shadow-xs" />
                <div className="w-2.5 h-2.5 rounded-[3px] bg-white shadow-xs" />
                <div className="w-2.5 h-2.5 rounded-[3px] bg-white shadow-xs" />
                <div className="w-2.5 h-2.5 rounded-[3px] bg-white shadow-xs" />
              </div>
            </button>
          </div>

          {/* 4. Stylist */}
          <button
            type="button"
            onClick={() => onNavigate('chat')}
            className={`flex-1 flex flex-col items-center justify-center py-1 transition-all active:scale-95 cursor-pointer ${
              isStylistActive ? 'text-[#6045FF]' : 'text-[#94A3B8] hover:text-white'
            }`}
            title={t('nav.stylist')}
          >
            {/* Overlapping Chat Speech Bubbles Icon */}
            <svg 
              viewBox="0 0 24 24" 
              width="24" 
              height="24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2.3" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              className="transition-transform duration-200"
            >
              <path d="M7.5 14H4a1.5 1.5 0 0 1-1.5-1.5V5A1.5 1.5 0 0 1 4 3.5h10A1.5 1.5 0 0 1 15.5 5v2.5" />
              <path d="M8 8.5h11.5a1.5 1.5 0 0 1 1.5 1.5v6.5a1.5 1.5 0 0 1-1.5 1.5H15l-4 3.5v-3.5H8a1.5 1.5 0 0 1-1.5-1.5V10A1.5 1.5 0 0 1 8 8.5z" />
            </svg>
            <span className={`text-[11.5px] mt-1 font-semibold tracking-tight transition-colors ${
              isStylistActive ? 'text-[#6045FF] font-bold' : 'text-[#94A3B8]'
            }`}>
              {t('nav.stylist')}
            </span>
          </button>

          {/* 5. Profile */}
          <button
            type="button"
            onClick={() => onNavigate('profile')}
            className={`flex-1 flex flex-col items-center justify-center py-1 transition-all active:scale-95 cursor-pointer ${
              isProfileActive ? 'text-[#6045FF]' : 'text-[#94A3B8] hover:text-white'
            }`}
            title={t('nav.profile')}
          >
            {/* User Silhouette Icon */}
            <svg 
              viewBox="0 0 24 24" 
              width="24" 
              height="24" 
              fill="currentColor"
              className="transition-transform duration-200"
            >
              <circle cx="12" cy="7" r="4.2" />
              <path d="M4.5 19.5c0-4.14 3.36-7.5 7.5-7.5s7.5 3.36 7.5 7.5a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1z" />
            </svg>
            <span className={`text-[11.5px] mt-1 font-semibold tracking-tight transition-colors ${
              isProfileActive ? 'text-[#6045FF] font-bold' : 'text-[#94A3B8]'
            }`}>
              {t('nav.profile')}
            </span>
          </button>
        </nav>
      </div>
    </div>
  );
};
