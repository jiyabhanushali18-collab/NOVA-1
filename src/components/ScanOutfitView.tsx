import React, { useState } from 'react';
import { ScreenId } from '../types';
import { recentScans as staticRecentScans } from '../data';

interface RecentScanItem {
  id: string;
  name: string;
  time: string;
  imageUrl?: string;
  score?: number | string;
}

interface ScanOutfitViewProps {
  onNavigate: (screen: ScreenId) => void;
  scanCount?: number;
  recentScans?: RecentScanItem[];
  isDarkMode?: boolean;
}

export const ScanOutfitView: React.FC<ScanOutfitViewProps> = ({ 
  onNavigate, 
  scanCount, 
  recentScans,
  isDarkMode = false
}) => {
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [flashMode, setFlashMode] = useState<'Auto' | 'On' | 'Off'>('Auto');
  const [isFlipped, setIsFlipped] = useState(false);

  const toggleFlash = () => {
    setFlashMode((prev) => {
      if (prev === 'Auto') return 'On';
      if (prev === 'On') return 'Off';
      return 'Auto';
    });
  };

  const handleShare = async () => {
    const shareData = {
      title: 'NOVA Outfit Scan Result',
      text: 'Check out this awesome outfit color palette & material composition analyzed by NOVA Smart Vision Assistant!',
      url: window.location.href
    };

    try {
      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
        setShareStatus('OOTD Scan shared successfully!');
      } else {
        throw new Error('Device sharing unsupported');
      }
    } catch (err) {
      try {
        await navigator.clipboard.writeText(
          `NOVA Scan: Check out my smart styling analysis and alternatives found for free! ${window.location.origin}`
        );
        setShareStatus('✓ Scan Link copied to clipboard!');
      } catch (clipErr) {
        setShareStatus('✓ Scan shared!');
      }
    }

    setTimeout(() => {
      setShareStatus(null);
    }, 2500);
  };

  return (
    <div className="space-y-6 relative">
      {shareStatus && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#131426]/95 text-white px-4.5 py-2.5 rounded-full text-xs font-bold shadow-xl flex items-center gap-1.5 border border-[#553BE2]/30 backdrop-blur-md animate-bounce max-w-[280px] text-center leading-none">
          <span className="material-symbols-outlined text-[14px] text-[#553BE2]">share</span>
          <span>{shareStatus}</span>
        </div>
      )}

      {/* Upper branding and scan statistics */}
      <section className="flex justify-between items-start pt-2">
        <div className="max-w-[70%]">
          <h1 className={`text-2xl font-bold leading-tight flex items-center gap-1.5 ${
            isDarkMode ? 'text-white' : 'text-[#131426]'
          }`}>
            Scan Your Outfit <span className="material-symbols-outlined text-[#553BE2] text-2xl">center_focus_strong</span>
          </h1>
          <p className={`text-xs mt-1 leading-relaxed ${
            isDarkMode ? 'text-slate-400' : 'text-[#5E667A]'
          }`}>
            Scan any full body outfit to analyze color palettes, isolate layers, and find direct purchase links or alternatives.
          </p>
        </div>
        
        {/* Statistics panel */}
        <div className={`rounded-xl p-2.5 px-3 flex flex-col items-center justify-center text-center shadow-sm shrink-0 min-w-[75px] border ${
          isDarkMode 
            ? 'bg-slate-900/90 border-slate-800 text-white' 
            : 'bg-white border-[#E4DFF5] text-[#131426]'
        }`}>
          <span className={`text-[8px] font-bold uppercase tracking-wider flex items-center gap-0.5 mb-1 ${
            isDarkMode ? 'text-slate-400' : 'text-[#5E667A]'
          }`}>
            <span className="material-symbols-outlined text-[10px]">history</span> History
          </span>
          <span className="text-2xl font-extrabold text-[#553BE2] leading-none">
            {scanCount ?? recentScans?.length ?? staticRecentScans.length}
          </span>
          <span className={`text-[9px] font-bold mt-0.5 ${
            isDarkMode ? 'text-slate-400' : 'text-[#5E667A]'
          }`}>
            Scans total
          </span>
        </div>
      </section>

      {/* Mode selectors: Live Scan, AR Try-On, Wardrobe */}
      <section className={`p-1 rounded-full flex relative border shadow-sm transition-colors ${
        isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-[#ECE7FF] border-[#E4DFF5]'
      }`}>
        {/* Tab 1: Live Scan (active) */}
        <button 
          onClick={() => onNavigate('camera-scan')}
          className="flex-1 py-2 text-xs font-bold rounded-full bg-[#553BE2] text-white shadow-md flex items-center justify-center gap-1.5 z-10 transition-all hover:bg-[#4830cb] active:scale-95 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[14px]">camera_alt</span> Live Scan
        </button>

        {/* Tab 2: AR Try-On (replaces Photo Scan) */}
        <button 
          onClick={() => onNavigate('ar-tryon')}
          title="Try on outfits virtually with real-time AR"
          className={`flex-1 py-2 text-xs font-semibold rounded-full flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
            isDarkMode 
              ? 'text-slate-300 hover:text-white hover:bg-slate-800/80' 
              : 'text-[#5E667A] hover:text-[#131426] hover:bg-white/70'
          }`}
        >
          <span className="material-symbols-outlined text-[15px] text-[#553BE2]">view_in_ar</span> AR Try-On
        </button>

        {/* Tab 3: Wardrobe */}
        <button 
          onClick={() => onNavigate('wardrobe')}
          className={`flex-1 py-2 text-xs font-semibold rounded-full flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
            isDarkMode 
              ? 'text-slate-300 hover:text-white hover:bg-slate-800/80' 
              : 'text-[#5E667A] hover:text-[#131426] hover:bg-white/70'
          }`}
        >
          <span className="material-symbols-outlined text-[14px]">checkroom</span> Wardrobe
        </button>
      </section>

      {/* Viewfinder block and Right column advice panel */}
      <section className="flex gap-4">
        {/* Big live scanning camera viewfinder */}
        <div className="flex-1 relative aspect-[3/4] rounded-2xl overflow-hidden bg-slate-950 border border-[#E4DFF5]/40 shadow-lg group">
          <img 
            alt="Live view finder showing model modeling purple hoodie" 
            className={`w-full h-full object-cover opacity-90 transition-transform duration-500 ${
              isFlipped ? '-scale-x-100' : 'scale-x-100'
            }`}
            referrerPolicy="no-referrer"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuAdia_HqXhRPPWJ8XMJTw7O1jf11mbJ98clkO0jnPOZLTfr5BYOwcLpxOGUw5gPBtnkBZ_SZ1tV_BPrAo6IrHyOKOOUQ-yvImAuRcO-8P2ur6gf0qWRuG4QGqdqSP8Ce15oBmXPWbtEDUknshLX9HjybIOaM738IIOjn3GfeKaFLH0mt4C54sAFXmL7mdrYUYrEUS-wPeYwDe2ZOM9fXE4VOqm_7Jsan6Jhf2ZDGFzThhoj8vC2Sg9pcJmaoSZFKyF9TXNBXfDUc0K4"
          />
          {/* Brackets overlays */}
          <div className="absolute inset-4 rounded-xl border border-white/10 pointer-events-none">
            <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-white rounded-tl"></div>
            <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-white rounded-tr"></div>
            <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-white rounded-bl"></div>
            <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-white rounded-br"></div>
          </div>

          <div className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#553BE2] to-transparent top-1/2 scan-line-animation" />

          {/* Quick Capture control dials inside the viewfinder */}
          <button 
            type="button"
            onClick={toggleFlash}
            className="absolute top-3 left-3 bg-black/40 hover:bg-black/60 backdrop-blur-md text-[10px] font-bold text-white px-2.5 py-1 rounded-md border border-white/10 flex items-center gap-1.5 leading-none shadow transition-all active:scale-95 cursor-pointer z-20"
          >
            <span className={`material-symbols-outlined text-[13px] leading-none ${
              flashMode === 'Off' ? 'text-slate-400' : 'text-amber-400'
            }`}>
              {flashMode === 'Off' ? 'flash_off' : 'bolt'}
            </span> 
            {flashMode === 'Auto' ? 'Auto Flash' : flashMode === 'On' ? 'Flash On' : 'Flash Off'}
          </button>

          <button 
            type="button"
            onClick={handleShare}
            className="absolute top-3 right-3 bg-black/40 hover:bg-black/60 backdrop-blur-md text-[10px] font-bold text-white px-2.5 py-1 rounded-md border border-white/10 flex items-center gap-1.5 leading-none shadow transition-all hover:scale-105 active:scale-95 cursor-pointer z-20"
          >
            <span className="material-symbols-outlined text-[13.5px] text-[#ECE7FF] leading-none">share</span> Share
          </button>

          <div className="absolute bottom-4 inset-x-0 w-full flex justify-center items-center gap-5 z-20 px-3">
            <button 
              type="button"
              onClick={() => onNavigate('camera-scan')}
              title="Upload photo from gallery"
              className="w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white transition-all active:scale-95 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">image</span>
            </button>
            <button 
              type="button"
              onClick={() => onNavigate('camera-scan')}
              title="Capture outfit scan"
              className="w-12 h-12 rounded-full border-4 border-white flex items-center justify-center bg-white/20 hover:scale-105 transition-transform active:scale-95 cursor-pointer shadow-lg"
            >
              <div className="w-8 h-8 bg-white rounded-full shadow-inner"></div>
            </button>
            <button 
              type="button"
              onClick={() => setIsFlipped(!isFlipped)}
              title="Flip camera"
              className="w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white transition-all active:scale-95 cursor-pointer"
            >
              <span className={`material-symbols-outlined text-sm transition-transform duration-300 ${
                isFlipped ? 'rotate-180' : ''
              }`}>cameraswitch</span>
            </button>
          </div>
        </div>

        {/* Right column guide cards */}
        <div className="w-[130px] flex flex-col gap-3 shrink-0">
          
          {/* Scan Tips */}
          <div className={`rounded-xl p-2.5 border shadow-sm ${
            isDarkMode 
              ? 'bg-slate-900/80 border-slate-800' 
              : 'bg-white/80 border-[#E4DFF5] backdrop-blur-sm'
          }`}>
            <h3 className="text-[10px] font-bold text-[#553BE2] uppercase tracking-widest mb-1.5 flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">lightbulb</span> Tips
            </h3>
            <ul className={`text-[9px] space-y-1.5 font-sans leading-tight ${
              isDarkMode ? 'text-slate-300' : 'text-[#5E667A]'
            }`}>
              <li className="flex items-start gap-1"><span className="material-symbols-outlined text-[11px] mt-0.5 text-[#553BE2]">check_circle</span> Good lighting</li>
              <li className="flex items-start gap-1"><span className="material-symbols-outlined text-[11px] mt-0.5 text-[#553BE2]">check_circle</span> Full face/body</li>
              <li className="flex items-start gap-1"><span className="material-symbols-outlined text-[11px] mt-0.5 text-[#553BE2]">check_circle</span> Clean setting</li>
            </ul>
          </div>

          {/* Analysis outcomes */}
          <div className={`rounded-xl p-2.5 flex-1 border shadow-sm ${
            isDarkMode 
              ? 'bg-slate-900/80 border-slate-800' 
              : 'bg-white/80 border-[#E4DFF5] backdrop-blur-sm'
          }`}>
            <h3 className={`text-[10px] font-bold uppercase tracking-widest mb-2 leading-none ${
              isDarkMode ? 'text-slate-200' : 'text-[#131426]'
            }`}>Outputs</h3>
            <ul className={`text-[10px] space-y-3 font-sans font-semibold leading-none ${
              isDarkMode ? 'text-slate-300' : 'text-[#5E667A]'
            }`}>
              <li 
                onClick={() => onNavigate('camera-scan')}
                className="flex items-center gap-1.5 cursor-pointer hover:text-[#553BE2] transition-colors"
              >
                <div className={`p-1 rounded text-[#553BE2] ${isDarkMode ? 'bg-slate-800' : 'bg-[#F2EEFF]'}`}>
                  <span className="material-symbols-outlined text-xs">analytics</span>
                </div>
                Insights
              </li>
              <li 
                onClick={() => onNavigate('camera-scan')}
                className="flex items-center gap-1.5 cursor-pointer hover:text-[#553BE2] transition-colors"
              >
                <div className={`p-1 rounded text-[#553BE2] ${isDarkMode ? 'bg-slate-800' : 'bg-[#F2EEFF]'}`}>
                  <span className="material-symbols-outlined text-xs">interests</span>
                </div>
                Similar
              </li>
              <li 
                onClick={() => onNavigate('showroom')}
                className="flex items-center gap-1.5 cursor-pointer hover:text-[#553BE2] transition-colors"
              >
                <div className={`p-1 rounded text-[#553BE2] ${isDarkMode ? 'bg-slate-800' : 'bg-[#F2EEFF]'}`}>
                  <span className="material-symbols-outlined text-xs">shopping_bag</span>
                </div>
                Shop
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Recent Scans slide */}
      <section>
        <div className="flex justify-between items-center mb-3">
          <h2 className={`text-base font-bold ${
            isDarkMode ? 'text-white' : 'text-[#131426]'
          }`}>
            Recent Scans
          </h2>
          <button 
            type="button"
            onClick={() => onNavigate('camera-scan')}
            className="text-xs font-semibold text-[#553BE2] flex items-center hover:underline cursor-pointer"
          >
            View All <span className="material-symbols-outlined text-sm ml-0.5 leading-none">chevron_right</span>
          </button>
        </div>

        <div className="flex gap-3 overflow-x-auto hide-scrollbar -mx-4 px-4 pb-2">
          {(recentScans?.length ? recentScans : staticRecentScans).map((sc) => (
            <div 
              key={sc.id}
              onClick={() => onNavigate('tryon-result')}
              className={`min-w-[124px] rounded-xl p-2 flex flex-col gap-2 cursor-pointer transition-all border hover:shadow-md hover:scale-[1.02] ${
                isDarkMode 
                  ? 'bg-slate-900/80 border-slate-800 hover:border-[#553BE2]/60' 
                  : 'bg-white border-[#E4DFF5] hover:border-[#553BE2]/60 shadow-sm'
              }`}
            >
              <div className="relative rounded-lg overflow-hidden h-32 bg-[#F2EEFF] border border-[#E4DFF5]/60">
                <img 
                  alt={sc.name} 
                  className="w-full h-full object-cover" 
                  referrerPolicy="no-referrer"
                  src={sc.imageUrl}
                />
                <div className="absolute top-1 right-1 bg-white/95 backdrop-blur-sm text-[#553BE2] text-[10px] font-extrabold px-1.5 py-0.5 rounded-md shadow-sm border border-[#E4DFF5] leading-none">
                  {sc.score}
                </div>
              </div>
              <div className="leading-tight px-1">
                <p className={`text-xs font-bold truncate ${
                  isDarkMode ? 'text-white' : 'text-[#131426]'
                }`}>
                  {sc.name}
                </p>
                <p className={`text-[9px] mt-0.5 font-sans ${
                  isDarkMode ? 'text-slate-400' : 'text-[#5E667A]'
                }`}>
                  {sc.time}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
