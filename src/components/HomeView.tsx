import React, { useEffect, useMemo, useState } from 'react';
import { ScreenId, ProductItem } from '../types';
import { analytics } from '../services/analyticsService';

const ActivityCardImage: React.FC<{
  activity: any;
  matchedProduct?: ProductItem;
  isDarkMode?: boolean;
}> = ({ activity, matchedProduct, isDarkMode }) => {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  const candidateUrl = useMemo(() => {
    if (typeof activity.imageUrl === 'string' && activity.imageUrl.trim()) {
      return activity.imageUrl.trim();
    }
    if (matchedProduct?.imageUrl?.trim()) {
      return matchedProduct.imageUrl.trim();
    }
    return '';
  }, [activity.imageUrl, matchedProduct]);

  useEffect(() => {
    setImgLoaded(false);
    setImgError(false);
  }, [candidateUrl]);

  if (!candidateUrl || imgError) {
    const isScan = activity.badge === 'Camera Scan' || activity.badge === 'Scan' || activity.name?.toLowerCase().includes('scan');
    const isAR = activity.badge === 'AR Try-On' || activity.name?.toLowerCase().includes('try-on') || activity.name?.toLowerCase().includes('fitting');
    const isReward = activity.badge === 'NOVA Rewards' || activity.name?.toLowerCase().includes('reward') || activity.name?.toLowerCase().includes('points');
    const isWardrobe = activity.badge === 'Wardrobe' || activity.name?.toLowerCase().includes('wardrobe');

    if (isScan) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-gradient-to-br from-[#0D1527] via-[#16223D] to-[#0A101F] text-white relative select-none">
          <div className="absolute inset-3 pointer-events-none opacity-40">
            <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-indigo-400 rounded-tl-sm" />
            <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-indigo-400 rounded-tr-sm" />
            <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-indigo-400 rounded-bl-sm" />
            <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-indigo-400 rounded-br-sm" />
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[#553BE2]/30 border border-[#553BE2]/40 flex items-center justify-center text-indigo-300 mb-2 shadow-inner">
            <span className="material-symbols-outlined text-2xl">photo_camera</span>
          </div>
          <span className="text-[11px] font-bold text-slate-100 tracking-tight leading-tight">Camera Vision</span>
          <span className="text-[9px] text-indigo-300/80 font-semibold mt-0.5">Scanned Outfit</span>
        </div>
      );
    }

    if (isAR) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-gradient-to-br from-[#1E1045] via-[#2A165E] to-[#12082B] text-white relative select-none">
          <div className="w-12 h-12 rounded-2xl bg-purple-600/30 border border-purple-400/40 flex items-center justify-center text-purple-200 mb-2 shadow-inner">
            <span className="material-symbols-outlined text-2xl">view_in_ar</span>
          </div>
          <span className="text-[11px] font-bold text-slate-100 tracking-tight leading-tight">AR Fitting</span>
          <span className="text-[9px] text-purple-300/80 font-semibold mt-0.5">Virtual Try-On</span>
        </div>
      );
    }

    if (isReward) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-gradient-to-br from-[#451A03] via-[#78350F] to-[#291002] text-white relative select-none">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/30 border border-amber-400/40 flex items-center justify-center text-amber-300 mb-2 shadow-inner">
            <span className="material-symbols-outlined text-2xl">stars</span>
          </div>
          <span className="text-[11px] font-bold text-amber-100 tracking-tight leading-tight">NOVA Rewards</span>
          <span className="text-[9px] text-amber-300/90 font-semibold mt-0.5">+Points Earned</span>
        </div>
      );
    }

    if (isWardrobe) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0A0E1A] text-white relative select-none">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/30 border border-indigo-400/40 flex items-center justify-center text-indigo-300 mb-2 shadow-inner">
            <span className="material-symbols-outlined text-2xl">checkroom</span>
          </div>
          <span className="text-[11px] font-bold text-slate-100 tracking-tight leading-tight">Wardrobe</span>
          <span className="text-[9px] text-indigo-300/80 font-semibold mt-0.5">Closet Item</span>
        </div>
      );
    }

    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-gradient-to-br from-[#1E293B] via-[#0F172A] to-[#1E293B] text-white relative select-none">
        <div className="w-12 h-12 rounded-2xl bg-slate-700/50 border border-slate-600/40 flex items-center justify-center text-slate-300 mb-2 shadow-inner">
          <span className="material-symbols-outlined text-2xl">{activity.icon || 'apparel'}</span>
        </div>
        <span className="text-[11px] font-bold text-slate-200 tracking-tight leading-tight truncate max-w-full px-1">{activity.name || 'Activity'}</span>
        <span className="text-[9px] text-slate-400 font-semibold mt-0.5">{activity.badge || 'NOVA'}</span>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative bg-[#F2EEFF]/50 overflow-hidden">
      {!imgLoaded && (
        <div className={`absolute inset-0 z-0 flex items-center justify-center ${isDarkMode ? 'bg-slate-800' : 'bg-[#EAE4F8]'} animate-pulse`}>
          <div className="w-6 h-6 rounded-full border-2 border-indigo-400/30 border-t-[#553BE2] animate-spin" />
        </div>
      )}

      <img 
        alt={activity.name}
        className={`w-full h-full object-cover group-hover:scale-105 transition-all duration-500 ${imgLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
        referrerPolicy="no-referrer"
        src={candidateUrl}
        loading="lazy"
        decoding="async"
        onLoad={() => setImgLoaded(true)}
        onError={() => {
          setImgLoaded(true);
          setImgError(true);
        }}
      />
    </div>
  );
};

interface HomeViewProps {
  onNavigate: (screen: ScreenId) => void;
  userName: string;
  wishlist?: string[];
  recentActivity?: any[];
  onToggleWishlist?: (productId: string) => void;
  onSelectProduct?: (productId: string, product?: ProductItem) => void;
  isDarkMode?: boolean;
  products?: Record<string, ProductItem>;
}

export const HomeView: React.FC<HomeViewProps> = ({ 
  onNavigate, 
  userName,
  wishlist = [],
  recentActivity = [],
  onToggleWishlist,
  onSelectProduct,
  isDarkMode = false,
  products = {}
}) => {
  const activityList = recentActivity;

  useEffect(() => {
    (activityList || []).forEach((activity: any) => {
      const matched = Object.values(products).find((p: ProductItem) => p.name && activity.name && (p.name === activity.name || p.name.includes(activity.name) || activity.name.includes(p.name)));
      if (matched) {
        analytics.trackProductImpression(matched, 'home_recent_activity');
      }
    });
  }, [activityList, products]);
  return (
    <div className="space-y-6 pb-2">
      {/* Greeting Section */}
      <section className={`relative mt-4 overflow-hidden rounded-[28px] p-5 animate-fade-in border ${
        isDarkMode
          ? 'bg-slate-900/70 border-slate-800'
          : 'bg-[linear-gradient(135deg,#FFFFFF_0%,#F6F3FF_58%,#EBE4FF_100%)] border-[#DFD8F7] shadow-[0_12px_28px_-6px_rgba(85,59,226,0.08),0_2px_6px_-1px_rgba(19,20,38,0.04)]'
      }`}>
        <div className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full bg-[#ECE7FF]/85 blur-3xl" />
        <h1 className={`relative text-[27px] font-extrabold tracking-[-0.03em] flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-[#131426]'}`}>
          Hello, {userName}! <span className="text-[#553BE2]">✨</span>
        </h1>
        <p className={`relative mt-2 text-sm leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-[#5E667A]'}`}>
          Your AI + AR Fashion Assistant<br />is ready to help you.
        </p>
      </section>

      {/* Explore Splash / Onboarding demo shortcuts */}
      <div className={`nova-interactive rounded-[22px] p-4 flex items-center justify-between gap-2.5 border ${
        isDarkMode
          ? 'bg-indigo-950/40 border-indigo-800/30'
          : 'bg-[linear-gradient(135deg,#EDE7FF_0%,#F5F2FF_100%)] border-[#DDD4FA] shadow-[0_10px_24px_-6px_rgba(85,59,226,0.07),0_2px_5px_-1px_rgba(19,20,38,0.03)]'
      }`}>
        <div className="flex items-center gap-2.5">
          <div className={`w-10 h-10 rounded-[14px] flex items-center justify-center shadow-xs ${
            isDarkMode ? 'bg-indigo-900/60 text-indigo-300' : 'bg-[#F2EEFF] text-[#553BE2] border border-[#E2DBF8]'
          }`}>
            <span className="material-symbols-outlined text-xl">info</span>
          </div>
          <div className="leading-tight text-left">
            <h4 className={`text-xs font-black uppercase tracking-wide leading-none ${isDarkMode ? 'text-indigo-200' : 'text-[#553BE2]'}`}>NOVA Tour Guide</h4>
            <span className={`text-[10px] mt-1.5 block font-medium ${isDarkMode ? 'text-indigo-300' : 'text-[#5E667A]'}`}>Replay Splash demo or Onboarding tour at any time!</span>
          </div>
        </div>
        <div className="flex gap-1.5 shrink-0">
          <button 
            onClick={() => onNavigate('splash')}
            className={`nova-interactive text-[9px] py-2 px-3 rounded-xl font-black uppercase whitespace-nowrap cursor-pointer border ${
              isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-indigo-300 border-slate-700' : 'bg-white hover:bg-[#F2EEFF] text-[#553BE2] border-[#E4DFF5] shadow-xs'
            }`}
          >
            Splash
          </button>
          <button 
            onClick={() => onNavigate('onboarding')}
            className="nova-interactive bg-[#553BE2] hover:bg-[#462CC9] text-[9px] text-white py-2 px-3 rounded-xl font-black uppercase shadow-sm shadow-[#553BE2]/25 whitespace-nowrap cursor-pointer"
          >
            Tour
          </button>
        </div>
      </div>

      {/* NOVA Showroom CTA */}
      <section>
        <button
          onClick={() => onNavigate('showroom')}
          className={`nova-interactive w-full rounded-[26px] p-6 relative overflow-hidden group cursor-pointer border ${
            isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'nova-hero-surface'
          }`}
        >
          <div className="absolute -right-10 -top-10 w-48 h-48 bg-gradient-to-br from-[#E4DCFF]/95 via-[#F2EEFF]/80 to-[#ECE7FF]/95 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-500"></div>
          <div className="flex justify-between items-center relative z-10">
            <div className="max-w-[70%] text-left">
              <div className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full mb-3 border shadow-xs ${
                isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-[#F2EEFF] border-[#E2DBF8]'
              }`}>
                <span className="material-symbols-outlined text-[#553BE2] text-base leading-none">local_mall</span>
                <span className="text-xs font-bold text-[#553BE2] tracking-wide uppercase">Explore</span>
              </div>
              <h2 className={`text-2xl font-bold leading-tight mb-1 ${isDarkMode ? 'text-white' : 'text-[#131426]'}`}>NOVA Showroom</h2>
              <p className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-[#5E667A]'}`}>Browse all products and drops →</p>
            </div>
            <div className={`w-14 h-14 rounded-[20px] flex items-center justify-center border shadow-sm text-[#553BE2] group-hover:scale-105 transition-transform ${
              isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-[#D5CBF7] shadow-[0_6px_16px_rgba(85,59,226,0.08)]'
            }`}>
              <span className="material-symbols-outlined text-3xl leading-none">inventory_2</span>
            </div>
          </div>
        </button>
      </section>

      {/* Explore NOVA Grid */}
      <section>
        <div className="flex justify-between items-end mb-4">
          <h2 className={`text-base font-semibold flex items-center ${isDarkMode ? 'text-white' : 'text-[#131426]'}`}>
            <span className="material-symbols-outlined text-[#553BE2] mr-2 text-xl leading-none">explore</span>
            Explore NOVA
          </h2>
          <button 
            onClick={() => onNavigate('profile')}
            className="text-xs font-semibold text-[#553BE2] flex items-center hover:underline"
          >
            Shortcuts <span className="material-symbols-outlined text-sm ml-1 leading-none">edit</span>
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {/* Item 1: AI Assistant */}
          <div 
            onClick={() => onNavigate('chat')}
            className={`nova-interactive rounded-[22px] p-4 flex flex-col items-start cursor-pointer group border ${
              isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'nova-surface'
            }`}
          >
            <div className={`w-10 h-10 rounded-[14px] flex items-center justify-center mb-3 text-[#553BE2] border shadow-xs ${
              isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-[#F2EEFF] border-[#E2DBF8]'
            }`}>
              <span className="material-symbols-outlined leading-none">psychology</span>
            </div>
            <h3 className={`font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-[#131426]'}`}>AI Assistant</h3>
            <p className={`text-[11px] leading-normal mb-4 ${isDarkMode ? 'text-slate-300' : 'text-[#5E667A]'}`}>Get intelligent answers and style guidance.</p>
            <div className={`mt-auto w-6 h-6 rounded-full shadow-xs flex items-center justify-center text-[#553BE2] self-end group-hover:bg-[#553BE2] group-hover:text-white transition-colors duration-200 ${
              isDarkMode ? 'bg-slate-800' : 'bg-[#F2EEFF]'
            }`}>
              <span className="material-symbols-outlined text-xs leading-none">arrow_forward</span>
            </div>
          </div>

          {/* Item 3: AR Try-On */}
          <div 
            onClick={() => onNavigate('ar-tryon')}
            className={`nova-interactive rounded-[22px] p-4 flex flex-col items-start cursor-pointer group border ${
              isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'nova-surface'
            }`}
          >
            <div className={`w-10 h-10 rounded-[14px] flex items-center justify-center mb-3 text-[#553BE2] border shadow-xs ${
              isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-[#F2EEFF] border-[#E2DBF8]'
            }`}>
              <span className="material-symbols-outlined leading-none">view_in_ar</span>
            </div>
            <h3 className={`font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-[#131426]'}`}>AR Try-On</h3>
            <p className={`text-[11px] leading-normal mb-4 ${isDarkMode ? 'text-slate-300' : 'text-[#5E667A]'}`}>Try outfits virtually with AR.</p>
            <div className={`mt-auto w-6 h-6 rounded-full shadow-xs flex items-center justify-center text-[#553BE2] self-end group-hover:bg-[#553BE2] group-hover:text-white transition-colors duration-200 ${
              isDarkMode ? 'bg-slate-800' : 'bg-[#F2EEFF]'
            }`}>
              <span className="material-symbols-outlined text-xs leading-none">arrow_forward</span>
            </div>
          </div>

          {/* Item 4: Camera Scan */}
          <div 
            onClick={() => onNavigate('camera-scan')}
            className={`nova-interactive rounded-[22px] p-4 flex flex-col items-start cursor-pointer group border ${
              isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'nova-surface'
            }`}
          >
            <div className={`w-10 h-10 rounded-[14px] flex items-center justify-center mb-3 text-[#553BE2] border shadow-xs ${
              isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-[#F2EEFF] border-[#E2DBF8]'
            }`}>
              <span className="material-symbols-outlined leading-none">photo_camera</span>
            </div>
            <h3 className={`font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-[#131426]'}`}>Camera Scan</h3>
            <p className={`text-[11px] leading-normal mb-4 ${isDarkMode ? 'text-slate-300' : 'text-[#5E667A]'}`}>Scan outfits or items in real-time.</p>
            <div className={`mt-auto w-6 h-6 rounded-full shadow-xs flex items-center justify-center text-[#553BE2] self-end group-hover:bg-[#553BE2] group-hover:text-white transition-colors duration-200 ${
              isDarkMode ? 'bg-slate-800' : 'bg-[#F2EEFF]'
            }`}>
              <span className="material-symbols-outlined text-xs leading-none">arrow_forward</span>
            </div>
          </div>

          {/* Item 5: Virtual Wardrobe */}
          <div
            onClick={() => onNavigate('wardrobe')}
            className={`nova-interactive rounded-[22px] p-4 flex flex-col items-start cursor-pointer group border ${
              isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'nova-surface'
            }`}
          >
            <div className={`w-10 h-10 rounded-[14px] flex items-center justify-center mb-3 text-[#553BE2] border shadow-xs ${
              isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-[#F2EEFF] border-[#E2DBF8]'
            }`}>
              <span className="material-symbols-outlined leading-none">checkroom</span>
            </div>
            <h3 className={`font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-[#131426]'}`}>Virtual Wardrobe</h3>
            <p className={`text-[11px] leading-normal mb-4 ${isDarkMode ? 'text-slate-300' : 'text-[#5E667A]'}`}>Build AI garments from scans, prints, and textures.</p>
            <div className={`mt-auto w-6 h-6 rounded-full shadow-xs flex items-center justify-center text-[#553BE2] self-end group-hover:bg-[#553BE2] group-hover:text-white transition-colors duration-200 ${
              isDarkMode ? 'bg-slate-800' : 'bg-[#F2EEFF]'
            }`}>
              <span className="material-symbols-outlined text-xs leading-none">arrow_forward</span>
            </div>
          </div>
        </div>
      </section>

      {/* Ask NOVA CTA */}
      <section className="hidden">
        <button 
          onClick={() => onNavigate('chat')}
          className="w-full glass-panel rounded-2xl p-6 relative overflow-hidden group cursor-pointer hover:shadow-lg transition-all duration-300"
        >
          <div className="absolute -right-10 -top-10 w-48 h-48 bg-[#ECE7FF]/50 rounded-full blur-3xl group-hover:bg-[#ECE7FF]/70 transition-colors duration-500"></div>
          <div className="flex justify-between items-center relative z-10">
            <div className="max-w-[70%] text-left">
              <div className="inline-flex items-center space-x-1.5 bg-[#F2EEFF] px-3 py-1 rounded-full mb-3 border border-[#E2DBF8] shadow-xs">
                <span className="material-symbols-outlined text-[#553BE2] text-base leading-none">smart_toy</span>
                <span className="text-xs font-semibold text-[#553BE2] tracking-wide uppercase">AI Assistant Active</span>
              </div>
              <h2 className={`text-2xl font-bold leading-tight mb-1 ${isDarkMode ? 'text-white' : 'text-[#131426]'}`}>Ask Nova Anything</h2>
              <p className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-[#5E667A]'}`}>Get instant answers and style guidance →</p>
            </div>
            <div className="w-20 h-20 relative shrink-0">
              <div className="absolute inset-0 bg-[#553BE2]/20 rounded-full glowing-orb blur-xl"></div>
              <img
                alt="AI Orb Graphic"
                className="w-full h-full object-contain bg-white p-2 rounded-full relative z-10 border-2 border-white shadow-inner"
                referrerPolicy="no-referrer"
                src="/nova-logo.png"
              />
            </div>
          </div>
        </button>
      </section>

      {/* Recent Activity Section */}
      <section>
        <div className="flex justify-between items-end mb-4">
          <h2 className={`text-base font-semibold ${isDarkMode ? 'text-white' : 'text-[#131426]'}`}>Recent Activity</h2>
          <button 
            onClick={() => onNavigate('scan-outfit')}
            className="text-xs font-semibold text-[#553BE2] flex items-center hover:underline"
          >
            View All <span className="material-symbols-outlined text-sm ml-1 leading-none">chevron_right</span>
          </button>
        </div>
        <div className="flex space-x-4 overflow-x-auto hide-scrollbar pb-4 -mx-4 px-4">
          {activityList.map((activity) => {
            const matched = Object.values(products).find((p: ProductItem) => p.name && activity.name && (p.name === activity.name || p.name.includes(activity.name) || activity.name.includes(p.name)));
            const isSaved = matched ? wishlist.includes(matched.id) : false;
            return (
              <div 
                key={activity.id}
                onClick={() => {
                  if (activity.badge === 'AR Try-On') onNavigate('ar-tryon');
                  else if (activity.badge === 'Camera Scan') onNavigate('camera-scan');
                  else if (activity.badge === 'Viewed' && matched) onSelectProduct?.(matched.id);
                  else onNavigate('scan-outfit');
                }}
                className="flex-none w-36 group cursor-pointer"
              >
                <div className={`h-48 rounded-2xl overflow-hidden relative shadow-[0_8px_20px_-4px_rgba(85,59,226,0.07),0_2px_5px_-1px_rgba(19,20,38,0.03)] border border-[#E4DFF5] ${isDarkMode ? 'bg-slate-900' : 'bg-[#0D1527]'} mb-2`}>
                  <ActivityCardImage activity={activity} matchedProduct={matched} isDarkMode={isDarkMode} />
                  <div className={`absolute top-2.5 left-2.5 ${activity.color} backdrop-blur-md text-white text-[9px] font-bold px-2 py-1 rounded-full flex items-center shadow-sm`}> 
                    <span className="material-symbols-outlined text-[10px] mr-1 leading-none">{activity.icon}</span> 
                    {activity.badge}
                  </div>
                  {/* Wishlist heart overlay for quick save */}
                  {matched && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onToggleWishlist) {
                          onToggleWishlist(matched.id);
                        }
                      }}
                      title={isSaved ? 'Remove from Wishlist' : 'Save to Wishlist'}
                      className={`absolute top-2.5 right-2.5 z-10 w-8 h-8 rounded-full flex items-center justify-center shadow-sm select-none transition-all cursor-pointer ${isSaved ? 'bg-rose-50 text-rose-500 border border-rose-100' : 'bg-white/90 text-[#5E667A] hover:text-rose-500 hover:bg-white'}`}
                    >
                      <span className="material-symbols-outlined text-sm leading-none" style={{ fontVariationSettings: isSaved ? "'FILL' 1" : undefined }}>
                        {isSaved ? 'favorite' : 'favorite_border'}
                      </span>
                    </button>
                  )}
                </div>
                <h4 className={`text-sm font-semibold truncate ${isDarkMode ? 'text-white' : 'text-[#131426]'}`}>{activity.name}</h4>
                <p className={`text-[11px] truncate ${isDarkMode ? 'text-slate-400' : 'text-[#5E667A]'}`}>{activity.time}</p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
