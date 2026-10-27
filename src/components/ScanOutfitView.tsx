import React, { useState, useEffect } from 'react';
import { ScreenId, OutfitScanRecord } from '../types';
import { getScanHistory, deleteOutfitScan, clearAllScanHistory } from '../services/scanHistoryService';
import { useI18n } from '../i18n';

interface ScanOutfitViewProps {
  onNavigate: (screen: ScreenId, opts?: { productId?: string }) => void;
  isDarkMode?: boolean;
  userId?: string;
}

export const ScanOutfitView: React.FC<ScanOutfitViewProps> = ({ 
  onNavigate, 
  isDarkMode = false,
  userId
}) => {
  const { t } = useI18n();
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [flashMode, setFlashMode] = useState<'Auto' | 'On' | 'Off'>('Auto');
  const [isFlipped, setIsFlipped] = useState(false);
  const [scans, setScans] = useState<OutfitScanRecord[]>(() => getScanHistory(userId));
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedScan, setSelectedScan] = useState<OutfitScanRecord | null>(null);
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Synchronize dynamic scans and subscribe to real-time update events
  useEffect(() => {
    setScans(getScanHistory(userId));

    const handleUpdate = () => {
      setScans(getScanHistory(userId));
    };

    window.addEventListener('nova:scan_history_updated', handleUpdate);
    return () => window.removeEventListener('nova:scan_history_updated', handleUpdate);
  }, [userId]);

  const handleDeleteScan = (scanId: string) => {
    deleteOutfitScan(scanId, userId);
    if (selectedScan?.id === scanId) {
      setSelectedScan(null);
    }
    setToastMessage(t('scanOutfit.removed'));
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleClearHistory = () => {
    if (window.confirm(t('scanOutfit.confirmClear'))) {
      clearAllScanHistory(userId);
      setToastMessage(t('scanOutfit.cleared'));
      setTimeout(() => setToastMessage(null), 2500);
    }
  };

  const filteredScans = scans.filter((s) => {
    if (!historySearchQuery.trim()) return true;
    const q = historySearchQuery.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      (s.category && s.category.toLowerCase().includes(q))
    );
  });

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
    } catch {
      try {
        await navigator.clipboard.writeText(
          `NOVA Scan: Check out my smart styling analysis and alternatives found for free! ${window.location.origin}`
        );
        setShareStatus('✓ Scan Link copied to clipboard!');
      } catch {
        setShareStatus('✓ Scan shared!');
      }
    }

    setTimeout(() => {
      setShareStatus(null);
    }, 2500);
  };

  return (
    <div className="space-y-6 relative select-none">
      {/* Toast Feedback */}
      {(shareStatus || toastMessage) && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#131426]/95 text-white px-4.5 py-2.5 rounded-full text-xs font-bold shadow-xl flex items-center gap-1.5 border border-[#553BE2]/40 backdrop-blur-md animate-bounce max-w-[280px] text-center leading-none">
          <span className="material-symbols-outlined text-[15px] text-[#A594FD]">info</span>
          <span>{shareStatus || toastMessage}</span>
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
        
        {/* Dynamic Clickable Statistics panel */}
        <button
          type="button"
          onClick={() => setIsHistoryModalOpen(true)}
          title="Click to view all scan history"
          className={`rounded-2xl p-2.5 px-3 flex flex-col items-center justify-center text-center shadow-sm shrink-0 min-w-[80px] border transition-all cursor-pointer hover:border-[#553BE2] hover:shadow-lg active:scale-95 group ${
            isDarkMode
              ? 'bg-slate-900/90 border-slate-800 text-white hover:bg-slate-800/90' 
              : 'bg-white border-[#E4DFF5] text-[#131426] hover:bg-[#FAF9FF]'
          }`}
        >
          <span className={`text-[8px] font-bold uppercase tracking-wider flex items-center gap-0.5 mb-1 group-hover:text-[#553BE2] transition-colors ${
            isDarkMode ? 'text-slate-400' : 'text-[#5E667A]'
          }`}>
            <span className="material-symbols-outlined text-[11px] text-[#553BE2]">history</span> History
          </span>
          <span className="text-2xl font-black text-[#553BE2] leading-none group-hover:scale-105 transition-transform">
            {scans.length}
          </span>
          <span className={`text-[9px] font-bold mt-0.5 ${
            isDarkMode ? 'text-slate-400' : 'text-[#5E667A]'
          }`}>
            Scans total
          </span>
        </button>
      </section>

      {/* Mode selectors: AR Try-On, Live Scan, Wardrobe */}
      <section className={`p-1 rounded-full flex relative border shadow-sm transition-colors ${
        isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-[#ECE7FF] border-[#E4DFF5]'
      }`}>
        {/* Tab 1: AR Try-On */}
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

        {/* Tab 2: Live Scan (active) */}
        <button 
          onClick={() => onNavigate('camera-scan')}
          className="flex-1 py-2 text-xs font-bold rounded-full bg-[#553BE2] text-white shadow-md flex items-center justify-center gap-1.5 z-10 transition-all hover:bg-[#4830cb] active:scale-95 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[14px]">camera_alt</span> Live Scan
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

      {/* Full-width outfit viewfinder */}
      <section className="space-y-3">
        {/* Big live scanning camera viewfinder */}
        <div className="relative w-full aspect-[4/5] rounded-2xl overflow-hidden bg-slate-950 border border-[#E4DFF5]/40 shadow-lg group">
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

      </section>

      {/* Dynamic Recent Scans Section */}
      <section>
        <div className="flex justify-between items-center mb-3">
          <h2 className={`text-base font-bold flex items-center gap-2 ${
            isDarkMode ? 'text-white' : 'text-[#131426]'
          }`}>
            <span>{t('scanOutfit.title')}</span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#553BE2]/15 text-[#553BE2] border border-[#553BE2]/20">
              {scans.length}
            </span>
          </h2>
          {scans.length > 0 && (
            <button
              type="button"
              onClick={() => setIsHistoryModalOpen(true)}
              className="text-xs font-semibold text-[#553BE2] flex items-center hover:underline cursor-pointer group"
            >
              <span>{t('common.viewAll')}</span>
              <span className="material-symbols-outlined text-sm ml-0.5 leading-none group-hover:translate-x-0.5 transition-transform">chevron_right</span>
            </button>
          )}
        </div>

        {scans.length === 0 ? (
          <div className={`rounded-2xl p-6 text-center border space-y-2.5 ${
            isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white/80 border-[#E4DFF5]'
          }`}>
            <div className="w-10 h-10 rounded-full bg-[#553BE2]/10 text-[#553BE2] flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-xl">center_focus_strong</span>
            </div>
            <p className="text-xs font-bold">{t('scanOutfit.empty')}</p>
            <p className="text-[10px] text-slate-400 max-w-[220px] mx-auto">
              Scan any outfit with your camera to analyze styles, palettes, and matching pieces.
            </p>
            <button
              type="button"
              onClick={() => onNavigate('camera-scan')}
              className="bg-[#553BE2] hover:bg-[#4830cb] text-white text-xs font-bold px-4 py-2 rounded-xl cursor-pointer transition-colors"
            >
              Start First Scan
            </button>
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto hide-scrollbar -mx-4 px-4 pb-2">
            {scans.map((sc) => (
              <div 
                key={sc.id}
                onClick={() => setSelectedScan(sc)}
                className={`min-w-[124px] rounded-xl p-2 flex flex-col gap-2 cursor-pointer transition-all border hover:shadow-md hover:scale-[1.02] group ${
                  isDarkMode 
                    ? 'bg-slate-900/80 border-slate-800 hover:border-[#553BE2]/60' 
                    : 'bg-white border-[#E4DFF5] hover:border-[#553BE2]/60 shadow-sm'
                }`}
              >
                <div className="relative rounded-lg overflow-hidden h-32 bg-[#F2EEFF] border border-[#E4DFF5]/60">
                  <img 
                    alt={sc.name} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                    referrerPolicy="no-referrer"
                    src={sc.imageUrl}
                  />
                  {sc.score !== undefined && (
                    <div className="absolute top-1 right-1 bg-white/95 backdrop-blur-sm text-[#553BE2] text-[10px] font-extrabold px-1.5 py-0.5 rounded-md shadow-sm border border-[#E4DFF5] leading-none flex items-center gap-0.5">
                      <span className="material-symbols-outlined text-[10px] text-[#A594FD]">auto_awesome</span>
                      <span>{sc.score}</span>
                    </div>
                  )}
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
        )}
      </section>

      {/* Full Scan History Modal */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 bg-[#0B0C15]/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className={`w-full max-w-md rounded-[28px] p-6 border shadow-2xl space-y-4 max-h-[85vh] flex flex-col ${
            isDarkMode ? 'bg-[#111322] border-[#553BE2]/40 text-white' : 'bg-white border-[#E4DFF5] text-[#131426]'
          }`}>
            {/* Header */}
            <div className="flex justify-between items-center pb-3 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#553BE2]/15 text-[#A594FD] flex items-center justify-center border border-[#553BE2]/30">
                  <span className="material-symbols-outlined text-lg">history</span>
                </div>
                <div>
                  <h3 className="text-base font-bold">Scan History</h3>
                  <p className="text-[10px] text-slate-400">{scans.length} total outfit scan{scans.length === 1 ? '' : 's'}</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {scans.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearHistory}
                    className="text-[10px] font-bold text-rose-400 hover:text-rose-300 px-2 py-1 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer"
                  >
                    Clear All
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsHistoryModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer transition-colors"
                >
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              </div>
            </div>

            {/* Search Input */}
            {scans.length > 0 && (
              <div className="relative shrink-0">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                  search
                </span>
                <input
                  type="text"
                  value={historySearchQuery}
                  onChange={(e) => setHistorySearchQuery(e.target.value)}
                  placeholder={t('scanOutfit.search')}
                  className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl border outline-none transition-all ${
                    isDarkMode 
                      ? 'bg-slate-900 border-white/10 text-white placeholder-slate-500 focus:border-[#553BE2]' 
                      : 'bg-slate-50 border-[#E4DFF5] text-[#131426] placeholder-slate-400 focus:border-[#553BE2]'
                  }`}
                />
              </div>
            )}

            {/* Scans List / Grid */}
            <div className="overflow-y-auto space-y-2.5 pr-1 flex-1 min-h-[200px]">
              {filteredScans.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto text-slate-400">
                    <span className="material-symbols-outlined text-2xl">search_off</span>
                  </div>
                  <p className="text-xs font-bold">{t('scanOutfit.empty')}</p>
                  <p className="text-[10px] text-slate-400">
                    {historySearchQuery ? 'Try a different search keyword' : 'Start scanning outfits to curate your history.'}
                  </p>
                </div>
              ) : (
                filteredScans.map((scan) => (
                  <div
                    key={scan.id}
                    onClick={() => setSelectedScan(scan)}
                    className={`rounded-2xl p-2.5 flex items-center gap-3 border transition-all cursor-pointer hover:border-[#553BE2] group ${
                      isDarkMode 
                        ? 'bg-slate-900/70 border-white/10 hover:bg-slate-800/80' 
                        : 'bg-slate-50 border-[#E4DFF5] hover:bg-white'
                    }`}
                  >
                    {/* Thumbnail */}
                    <div className="w-14 h-18 rounded-xl overflow-hidden bg-black shrink-0 relative border border-white/10">
                      <img
                        alt={scan.name}
                        src={scan.imageUrl}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform"
                      />
                    </div>

                    {/* Meta */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold truncate">{scan.name}</span>
                      </div>
                      <p className="text-[10px] text-slate-400">{scan.category || 'Outfit'}</p>
                      
                      <div className="flex items-center gap-2 pt-0.5">
                        {scan.score !== undefined && (
                          <span className="px-1.5 py-0.5 rounded-md bg-[#553BE2]/20 text-[#A594FD] text-[9px] font-bold border border-[#553BE2]/30 flex items-center gap-0.5">
                            <span className="material-symbols-outlined text-[10px]">auto_awesome</span>
                            <span>{scan.score}</span>
                          </span>
                        )}
                        <span className="text-[9px] text-slate-400">{scan.time}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-1 items-end shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteScan(scan.id);
                        }}
                        title="Delete scan"
                        className="w-7 h-7 rounded-full bg-white/5 hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                      <span className="material-symbols-outlined text-xs text-slate-400 group-hover:text-[#553BE2] group-hover:translate-x-0.5 transition-all">
                        chevron_right
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Bottom New Scan Button */}
            <div className="pt-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsHistoryModalOpen(false);
                  onNavigate('camera-scan');
                }}
                className="w-full py-3 px-4 rounded-xl bg-[#553BE2] hover:bg-[#4830cb] active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#553BE2]/30 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">center_focus_strong</span>
                <span>{t('wardrobe.scanNew')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Selected Scan Details Lightbox Modal */}
      {selectedScan && (
        <div className="fixed inset-0 bg-[#0B0C15]/85 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className={`w-full max-w-sm rounded-[28px] p-6 border shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto ${
            isDarkMode ? 'bg-[#111322] border-[#553BE2]/40 text-white' : 'bg-white border-[#E4DFF5] text-[#131426]'
          }`}>
            {/* Header */}
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-base font-bold leading-tight">{selectedScan.name}</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">{selectedScan.time} • {selectedScan.category || 'Outfit'}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedScan(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer transition-colors"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            {/* Image Preview */}
            <div className="w-full aspect-[3/4] rounded-2xl overflow-hidden bg-black border border-white/15 relative shadow-inner">
              <img
                alt={selectedScan.name}
                src={selectedScan.imageUrl}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover object-top"
              />
              <div className="absolute top-2.5 right-2.5 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/20 text-white text-xs font-bold flex items-center gap-1 shadow-lg">
                <span className="material-symbols-outlined text-xs text-[#A594FD]">auto_awesome</span>
                <span>Score: {selectedScan.score}</span>
              </div>
            </div>

            {/* Detected Color Palette */}
            {selectedScan.colors && selectedScan.colors.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Detected Color Palette</span>
                <div className="flex items-center gap-2">
                  {selectedScan.colors.map((hex, idx) => (
                    <div key={idx} className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-full px-2 py-1">
                      <div className="w-3.5 h-3.5 rounded-full border border-white/30 shadow-sm" style={{ backgroundColor: hex }} />
                      <span className="text-[9px] font-mono text-slate-300">{hex}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedScan(null);
                  setIsHistoryModalOpen(false);
                  onNavigate('ar-tryon');
                }}
                className="w-full py-3 px-4 rounded-xl bg-[#553BE2] hover:bg-[#4830cb] active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#553BE2]/30 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">view_in_ar</span>
                <span>{t('productDetails.tryOn')}</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedScan(null);
                    setIsHistoryModalOpen(false);
                    onNavigate('camera-scan');
                  }}
                  className="py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-semibold text-xs border border-white/10 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">center_focus_strong</span>
                  <span>Scan Similar</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDeleteScan(selectedScan.id)}
                  className="py-2.5 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-semibold text-xs border border-rose-500/30 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">delete</span>
                  <span>{t('common.delete')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
