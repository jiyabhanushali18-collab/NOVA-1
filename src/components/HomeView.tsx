import React from 'react';
import { ScreenId, ProductItem } from '../types';

interface HomeViewProps {
  onNavigate: (screen: ScreenId) => void;
  userName: string;
  wishlist?: string[];
  recentActivity?: any[];
  onToggleWishlist?: (productId: string) => void;
  onSelectProduct?: (productId: string) => void;
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
  return (
    <div className="space-y-6 pb-2">
      {/* Greeting Section */}
      <section className="nova-surface nova-page-wash relative mt-4 overflow-hidden rounded-[28px] p-5 animate-fade-in">
        <div className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full bg-[#e8e9ff]/70 blur-3xl" />
        <h1 className={`relative text-[27px] font-extrabold tracking-[-0.03em] flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-[#17213A]'}`}>
          Hello, {userName}! <span className="text-amber-400">✨</span>
        </h1>
        <p className={`relative mt-2 text-sm leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-[#64708A]'}`}>
          Your AI + AR Fashion Assistant<br />is ready to help you.
        </p>
      </section>

      {/* Explore Splash / Onboarding demo shortcuts */}
      <div className={`nova-surface nova-interactive rounded-[22px] p-4 flex items-center justify-between gap-2.5 ${isDarkMode ? 'bg-indigo-950/40 border-indigo-800/30' : 'bg-gradient-to-br from-[#f7f5ff] to-[#eef4ff]'}`}>
        <div className="flex items-center gap-2.5">
          <div className={`w-10 h-10 rounded-[14px] flex items-center justify-center shadow-sm ${isDarkMode ? 'bg-indigo-900/60 text-indigo-300' : 'bg-white/80 text-[#5B4BFF] border border-white'}`}>
            <span className="material-symbols-outlined text-xl">info</span>
          </div>
          <div className="leading-tight text-left">
            <h4 className={`text-xs font-black uppercase tracking-wide leading-none ${isDarkMode ? 'text-indigo-200' : 'text-indigo-900'}`}>NOVA Tour Guide</h4>
            <span className={`text-[10px] mt-1.5 block font-medium ${isDarkMode ? 'text-indigo-300' : 'text-indigo-600'}`}>Replay Splash demo or Onboarding tour at any time!</span>
          </div>
        </div>
        <div className="flex gap-1.5 shrink-0">
          <button 
            onClick={() => onNavigate('splash')}
            className={`nova-interactive text-[9px] py-2 px-3 rounded-xl font-black uppercase whitespace-nowrap cursor-pointer border ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-indigo-300 border-slate-700' : 'bg-white/80 hover:bg-white text-[#5B4BFF] border-[#e0ddff]'}`}
          >
            Splash
          </button>
          <button 
            onClick={() => onNavigate('onboarding')}
            className="nova-interactive bg-gradient-to-r from-[#5B4BFF] to-[#7568ff] hover:brightness-105 text-[9px] text-white py-2 px-3 rounded-xl font-black uppercase shadow-sm shadow-indigo-600/20 whitespace-nowrap cursor-pointer"
          >
            Tour
          </button>
        </div>
      </div>

      {/* NOVA Showroom CTA */}
      <section>
        <button
          onClick={() => onNavigate('showroom')}
          className="nova-surface nova-interactive w-full rounded-[26px] p-6 relative overflow-hidden group cursor-pointer"
        >
          <div className="absolute -right-10 -top-10 w-48 h-48 bg-gradient-to-br from-[#e8e9ff]/80 via-[#ffeaf4]/50 to-[#eaf2ff]/80 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-500"></div>
          <div className="flex justify-between items-center relative z-10">
            <div className="max-w-[70%] text-left">
              <div className="inline-flex items-center space-x-1.5 bg-white/75 backdrop-blur-md px-3 py-1.5 rounded-full mb-3 border border-white shadow-sm">
                <span className="material-symbols-outlined text-[#5B4BFF] text-base leading-none">local_mall</span>
                <span className="text-xs font-bold text-[#5B4BFF] tracking-wide uppercase">Explore</span>
              </div>
              <h2 className={`text-2xl font-bold leading-tight mb-1 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>NOVA Showroom</h2>
              <p className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>Browse all products and drops →</p>
            </div>
            <div className="w-14 h-14 rounded-[20px] bg-white/75 backdrop-blur-md flex items-center justify-center border border-white shadow-md text-[#5B4BFF] group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-3xl leading-none">inventory_2</span>
            </div>
          </div>
        </button>
      </section>

      {/* Explore NOVA Grid */}
      <section>
        <div className="flex justify-between items-end mb-4">
          <h2 className={`text-base font-semibold flex items-center ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            <span className="material-symbols-outlined text-indigo-600 mr-2 text-xl leading-none">explore</span>
            Explore NOVA
          </h2>
          <button 
            onClick={() => onNavigate('profile')}
            className="text-xs font-semibold text-indigo-600 flex items-center hover:underline"
          >
            Shortcuts <span className="material-symbols-outlined text-sm ml-1 leading-none">edit</span>
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {/* Item 1: AI Assistant */}
          <div 
            onClick={() => onNavigate('chat')}
            className="nova-surface nova-interactive rounded-[22px] p-4 flex flex-col items-start cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-[14px] bg-gradient-to-br from-[#eee9ff] to-white flex items-center justify-center mb-3 text-[#5B4BFF] border border-white shadow-sm">
              <span className="material-symbols-outlined leading-none">psychology</span>
            </div>
            <h3 className={`font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>AI Assistant</h3>
            <p className={`text-[11px] leading-normal mb-4 ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`}>Get intelligent answers and style guidance.</p>
            <div className="mt-auto w-6 h-6 rounded-full bg-white/80 shadow-sm flex items-center justify-center text-indigo-600 self-end group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-200">
              <span className="material-symbols-outlined text-xs leading-none">arrow_forward</span>
            </div>
          </div>

          {/* Item 2: Smart Vision */}
          <div 
            onClick={() => onNavigate('scan-outfit')}
            className="nova-surface nova-interactive rounded-[22px] p-4 flex flex-col items-start cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-[14px] bg-gradient-to-br from-[#eaf2ff] to-white flex items-center justify-center mb-3 text-[#4169d8] border border-white shadow-sm">
              <span className="material-symbols-outlined leading-none">visibility</span>
            </div>
            <h3 className={`font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Smart Vision</h3>
            <p className={`text-[11px] leading-normal mb-4 ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`}>Analyze, detect and understand with AI.</p>
            <div className="mt-auto w-6 h-6 rounded-full bg-white/80 shadow-sm flex items-center justify-center text-indigo-600 self-end group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-200">
              <span className="material-symbols-outlined text-xs leading-none">arrow_forward</span>
            </div>
          </div>

          {/* Item 3: Camera Scan */}
          <div 
            onClick={() => onNavigate('camera-scan')}
            className="nova-surface nova-interactive rounded-[22px] p-4 flex flex-col items-start cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-[14px] bg-gradient-to-br from-[#eaf2ff] to-white flex items-center justify-center mb-3 text-[#3978d8] border border-white shadow-sm">
              <span className="material-symbols-outlined leading-none">photo_camera</span>
            </div>
            <h3 className={`font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Camera Scan</h3>
            <p className={`text-[11px] leading-normal mb-4 ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`}>Scan outfits or items in real-time.</p>
            <div className="mt-auto w-6 h-6 rounded-full bg-white/80 shadow-sm flex items-center justify-center text-indigo-600 self-end group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-200">
              <span className="material-symbols-outlined text-xs leading-none">arrow_forward</span>
            </div>
          </div>

          {/* Item 4: Virtual Wardrobe */}
          <div
            onClick={() => onNavigate('wardrobe')}
            className="nova-surface nova-interactive rounded-[22px] p-4 flex flex-col items-start cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-[14px] bg-gradient-to-br from-[#ffeaf4] to-[#f7f5ff] flex items-center justify-center mb-3 text-[#a348a4] border border-white shadow-sm">
              <span className="material-symbols-outlined leading-none">checkroom</span>
            </div>
            <h3 className={`font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Virtual Wardrobe</h3>
            <p className={`text-[11px] leading-normal mb-4 ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`}>Build AI garments from scans, prints, and textures.</p>
            <div className="mt-auto w-6 h-6 rounded-full bg-white/80 shadow-sm flex items-center justify-center text-indigo-600 self-end group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-200">
              <span className="material-symbols-outlined text-xs leading-none">arrow_forward</span>
            </div>
          </div>

          {/* Item 4: AR Try-On */}
          <div 
            onClick={() => onNavigate('ar-tryon')}
            className="nova-surface nova-interactive rounded-[22px] p-4 flex flex-col items-start cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-[14px] bg-gradient-to-br from-[#ffeaf4] to-white flex items-center justify-center mb-3 text-[#c64c86] border border-white shadow-sm">
              <span className="material-symbols-outlined leading-none">checkroom</span>
            </div>
            <h3 className={`font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>AR Try-On</h3>
            <p className={`text-[11px] leading-normal mb-4 ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`}>Try outfits virtually with AR.</p>
            <div className="mt-auto w-6 h-6 rounded-full bg-white/80 shadow-sm flex items-center justify-center text-indigo-600 self-end group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-200">
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
          <div className="absolute -right-10 -top-10 w-48 h-48 bg-indigo-200/30 rounded-full blur-3xl group-hover:bg-indigo-300/40 transition-colors duration-500"></div>
          <div className="flex justify-between items-center relative z-10">
            <div className="max-w-[70%] text-left">
              <div className="inline-flex items-center space-x-1.5 bg-white/60 backdrop-blur-md px-3 py-1 rounded-full mb-3 border border-white/80 shadow-sm">
                <span className="material-symbols-outlined text-indigo-600 text-base leading-none">smart_toy</span>
                <span className="text-xs font-semibold text-indigo-600 tracking-wide uppercase">AI Assistant Active</span>
              </div>
              <h2 className={`text-2xl font-bold leading-tight mb-1 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Ask Nova Anything</h2>
              <p className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>Get instant answers and style guidance →</p>
            </div>
            <div className="w-20 h-20 relative shrink-0">
              <div className="absolute inset-0 bg-indigo-500/20 rounded-full glowing-orb blur-xl"></div>
              <img
                alt="AI Orb Graphic"
                className="w-full h-full object-cover rounded-full relative z-10 border-2 border-white/50 shadow-inner"
                referrerPolicy="no-referrer"
                src={`/logoone.jpeg?t=${Date.now()}`}
              />
            </div>
          </div>
        </button>
      </section>

      {/* Recent Activity Section */}
      <section>
        <div className="flex justify-between items-end mb-4">
          <h2 className={`text-base font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Recent Activity</h2>
          <button 
            onClick={() => onNavigate('scan-outfit')}
            className="text-xs font-semibold text-indigo-600 flex items-center hover:underline"
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
                <div className="h-48 rounded-2xl overflow-hidden relative shadow-sm border border-white/40 mb-2">
                  <img 
                    alt={activity.name} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                    referrerPolicy="no-referrer"
                    src={activity.imageUrl}
                  />
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
                      className={`absolute top-2.5 right-2.5 z-10 w-8 h-8 rounded-full flex items-center justify-center shadow-sm select-none transition-all cursor-pointer ${isSaved ? 'bg-rose-50 text-rose-500 border border-rose-100' : 'bg-white/85 text-slate-500 hover:text-rose-500 hover:bg-white'}`}
                    >
                      <span className="material-symbols-outlined text-sm leading-none" style={{ fontVariationSettings: isSaved ? "'FILL' 1" : undefined }}>
                        {isSaved ? 'favorite' : 'favorite_border'}
                      </span>
                    </button>
                  )}
                </div>
                <h4 className={`text-sm font-semibold truncate ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{activity.name}</h4>
                <p className={`text-[11px] truncate ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{activity.time}</p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
