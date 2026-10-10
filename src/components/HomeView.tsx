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
      <section className={`relative mt-4 overflow-hidden rounded-[28px] p-5 animate-fade-in border ${
        isDarkMode
          ? 'bg-slate-900/70 border-slate-800'
          : 'bg-gradient-to-br from-[#F4F1FF] via-[#F0EDFF] to-[#EAE5FF]/70 border-[#E8E5F0] shadow-[0_8px_24px_rgba(91,69,231,0.05)]'
      }`}>
        <div className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full bg-[#EAE5FF]/80 blur-3xl" />
        <h1 className={`relative text-[27px] font-extrabold tracking-[-0.03em] flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-[#17182B]'}`}>
          Hello, {userName}! <span className="text-[#5B45E7]">✨</span>
        </h1>
        <p className={`relative mt-2 text-sm leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-[#697386]'}`}>
          Your AI + AR Fashion Assistant<br />is ready to help you.
        </p>
      </section>

      {/* Explore Splash / Onboarding demo shortcuts */}
      <div className={`nova-interactive rounded-[22px] p-4 flex items-center justify-between gap-2.5 border ${
        isDarkMode
          ? 'bg-indigo-950/40 border-indigo-800/30'
          : 'bg-[#EAE5FF]/75 border-[#E8E5F0] shadow-[0_6px_20px_rgba(91,69,231,0.05)]'
      }`}>
        <div className="flex items-center gap-2.5">
          <div className={`w-10 h-10 rounded-[14px] flex items-center justify-center shadow-xs ${
            isDarkMode ? 'bg-indigo-900/60 text-indigo-300' : 'bg-[#F0EDFF] text-[#5B45E7] border border-[#E8E5F0]'
          }`}>
            <span className="material-symbols-outlined text-xl">info</span>
          </div>
          <div className="leading-tight text-left">
            <h4 className={`text-xs font-black uppercase tracking-wide leading-none ${isDarkMode ? 'text-indigo-200' : 'text-[#5B45E7]'}`}>NOVA Tour Guide</h4>
            <span className={`text-[10px] mt-1.5 block font-medium ${isDarkMode ? 'text-indigo-300' : 'text-[#697386]'}`}>Replay Splash demo or Onboarding tour at any time!</span>
          </div>
        </div>
        <div className="flex gap-1.5 shrink-0">
          <button 
            onClick={() => onNavigate('splash')}
            className={`nova-interactive text-[9px] py-2 px-3 rounded-xl font-black uppercase whitespace-nowrap cursor-pointer border ${
              isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-indigo-300 border-slate-700' : 'bg-white hover:bg-[#F0EDFF] text-[#5B45E7] border-[#E8E5F0] shadow-xs'
            }`}
          >
            Splash
          </button>
          <button 
            onClick={() => onNavigate('onboarding')}
            className="nova-interactive bg-[#5B45E7] hover:bg-[#4c37d1] text-[9px] text-white py-2 px-3 rounded-xl font-black uppercase shadow-sm shadow-[#5B45E7]/25 whitespace-nowrap cursor-pointer"
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
            isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'nova-surface'
          }`}
        >
          <div className="absolute -right-10 -top-10 w-48 h-48 bg-gradient-to-br from-[#EAE5FF]/90 via-[#F0EDFF]/70 to-[#EAE5FF]/90 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-500"></div>
          <div className="flex justify-between items-center relative z-10">
            <div className="max-w-[70%] text-left">
              <div className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full mb-3 border shadow-xs ${
                isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-[#F0EDFF] border-[#E8E5F0]'
              }`}>
                <span className="material-symbols-outlined text-[#5B45E7] text-base leading-none">local_mall</span>
                <span className="text-xs font-bold text-[#5B45E7] tracking-wide uppercase">Explore</span>
              </div>
              <h2 className={`text-2xl font-bold leading-tight mb-1 ${isDarkMode ? 'text-white' : 'text-[#17182B]'}`}>NOVA Showroom</h2>
              <p className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-[#697386]'}`}>Browse all products and drops →</p>
            </div>
            <div className={`w-14 h-14 rounded-[20px] flex items-center justify-center border shadow-sm text-[#5B45E7] group-hover:scale-105 transition-transform ${
              isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-[#E8E5F0]'
            }`}>
              <span className="material-symbols-outlined text-3xl leading-none">inventory_2</span>
            </div>
          </div>
        </button>
      </section>

      {/* Explore NOVA Grid */}
      <section>
        <div className="flex justify-between items-end mb-4">
          <h2 className={`text-base font-semibold flex items-center ${isDarkMode ? 'text-white' : 'text-[#17182B]'}`}>
            <span className="material-symbols-outlined text-[#5B45E7] mr-2 text-xl leading-none">explore</span>
            Explore NOVA
          </h2>
          <button 
            onClick={() => onNavigate('profile')}
            className="text-xs font-semibold text-[#5B45E7] flex items-center hover:underline"
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
            <div className={`w-10 h-10 rounded-[14px] flex items-center justify-center mb-3 text-[#5B45E7] border shadow-xs ${
              isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-[#F0EDFF] border-[#E8E5F0]'
            }`}>
              <span className="material-symbols-outlined leading-none">psychology</span>
            </div>
            <h3 className={`font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-[#17182B]'}`}>AI Assistant</h3>
            <p className={`text-[11px] leading-normal mb-4 ${isDarkMode ? 'text-slate-300' : 'text-[#697386]'}`}>Get intelligent answers and style guidance.</p>
            <div className={`mt-auto w-6 h-6 rounded-full shadow-xs flex items-center justify-center text-[#5B45E7] self-end group-hover:bg-[#5B45E7] group-hover:text-white transition-colors duration-200 ${
              isDarkMode ? 'bg-slate-800' : 'bg-[#F0EDFF]'
            }`}>
              <span className="material-symbols-outlined text-xs leading-none">arrow_forward</span>
            </div>
          </div>

          {/* Item 2: Smart Vision */}
          <div 
            onClick={() => onNavigate('scan-outfit')}
            className={`nova-interactive rounded-[22px] p-4 flex flex-col items-start cursor-pointer group border ${
              isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'nova-surface'
            }`}
          >
            <div className={`w-10 h-10 rounded-[14px] flex items-center justify-center mb-3 text-[#5B45E7] border shadow-xs ${
              isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-[#F0EDFF] border-[#E8E5F0]'
            }`}>
              <span className="material-symbols-outlined leading-none">visibility</span>
            </div>
            <h3 className={`font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-[#17182B]'}`}>Smart Vision</h3>
            <p className={`text-[11px] leading-normal mb-4 ${isDarkMode ? 'text-slate-300' : 'text-[#697386]'}`}>Analyze, detect and understand with AI.</p>
            <div className={`mt-auto w-6 h-6 rounded-full shadow-xs flex items-center justify-center text-[#5B45E7] self-end group-hover:bg-[#5B45E7] group-hover:text-white transition-colors duration-200 ${
              isDarkMode ? 'bg-slate-800' : 'bg-[#F0EDFF]'
            }`}>
              <span className="material-symbols-outlined text-xs leading-none">arrow_forward</span>
            </div>
          </div>

          {/* Item 3: Camera Scan */}
          <div 
            onClick={() => onNavigate('camera-scan')}
            className={`nova-interactive rounded-[22px] p-4 flex flex-col items-start cursor-pointer group border ${
              isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'nova-surface'
            }`}
          >
            <div className={`w-10 h-10 rounded-[14px] flex items-center justify-center mb-3 text-[#5B45E7] border shadow-xs ${
              isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-[#F0EDFF] border-[#E8E5F0]'
            }`}>
              <span className="material-symbols-outlined leading-none">photo_camera</span>
            </div>
            <h3 className={`font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-[#17182B]'}`}>Camera Scan</h3>
            <p className={`text-[11px] leading-normal mb-4 ${isDarkMode ? 'text-slate-300' : 'text-[#697386]'}`}>Scan outfits or items in real-time.</p>
            <div className={`mt-auto w-6 h-6 rounded-full shadow-xs flex items-center justify-center text-[#5B45E7] self-end group-hover:bg-[#5B45E7] group-hover:text-white transition-colors duration-200 ${
              isDarkMode ? 'bg-slate-800' : 'bg-[#F0EDFF]'
            }`}>
              <span className="material-symbols-outlined text-xs leading-none">arrow_forward</span>
            </div>
          </div>

          {/* Item 4: Virtual Wardrobe */}
          <div
            onClick={() => onNavigate('wardrobe')}
            className={`nova-interactive rounded-[22px] p-4 flex flex-col items-start cursor-pointer group border ${
              isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'nova-surface'
            }`}
          >
            <div className={`w-10 h-10 rounded-[14px] flex items-center justify-center mb-3 text-[#5B45E7] border shadow-xs ${
              isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-[#F0EDFF] border-[#E8E5F0]'
            }`}>
              <span className="material-symbols-outlined leading-none">checkroom</span>
            </div>
            <h3 className={`font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-[#17182B]'}`}>Virtual Wardrobe</h3>
            <p className={`text-[11px] leading-normal mb-4 ${isDarkMode ? 'text-slate-300' : 'text-[#697386]'}`}>Build AI garments from scans, prints, and textures.</p>
            <div className={`mt-auto w-6 h-6 rounded-full shadow-xs flex items-center justify-center text-[#5B45E7] self-end group-hover:bg-[#5B45E7] group-hover:text-white transition-colors duration-200 ${
              isDarkMode ? 'bg-slate-800' : 'bg-[#F0EDFF]'
            }`}>
              <span className="material-symbols-outlined text-xs leading-none">arrow_forward</span>
            </div>
          </div>

          {/* Item 5: AR Try-On */}
          <div 
            onClick={() => onNavigate('ar-tryon')}
            className={`nova-interactive rounded-[22px] p-4 flex flex-col items-start cursor-pointer group border ${
              isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'nova-surface'
            }`}
          >
            <div className={`w-10 h-10 rounded-[14px] flex items-center justify-center mb-3 text-[#5B45E7] border shadow-xs ${
              isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-[#F0EDFF] border-[#E8E5F0]'
            }`}>
              <span className="material-symbols-outlined leading-none">checkroom</span>
            </div>
            <h3 className={`font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-[#17182B]'}`}>AR Try-On</h3>
            <p className={`text-[11px] leading-normal mb-4 ${isDarkMode ? 'text-slate-300' : 'text-[#697386]'}`}>Try outfits virtually with AR.</p>
            <div className={`mt-auto w-6 h-6 rounded-full shadow-xs flex items-center justify-center text-[#5B45E7] self-end group-hover:bg-[#5B45E7] group-hover:text-white transition-colors duration-200 ${
              isDarkMode ? 'bg-slate-800' : 'bg-[#F0EDFF]'
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
          <div className="absolute -right-10 -top-10 w-48 h-48 bg-[#EAE5FF]/50 rounded-full blur-3xl group-hover:bg-[#EAE5FF]/70 transition-colors duration-500"></div>
          <div className="flex justify-between items-center relative z-10">
            <div className="max-w-[70%] text-left">
              <div className="inline-flex items-center space-x-1.5 bg-[#F0EDFF] px-3 py-1 rounded-full mb-3 border border-[#E8E5F0] shadow-xs">
                <span className="material-symbols-outlined text-[#5B45E7] text-base leading-none">smart_toy</span>
                <span className="text-xs font-semibold text-[#5B45E7] tracking-wide uppercase">AI Assistant Active</span>
              </div>
              <h2 className={`text-2xl font-bold leading-tight mb-1 ${isDarkMode ? 'text-white' : 'text-[#17182B]'}`}>Ask Nova Anything</h2>
              <p className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-[#697386]'}`}>Get instant answers and style guidance →</p>
            </div>
            <div className="w-20 h-20 relative shrink-0">
              <div className="absolute inset-0 bg-[#5B45E7]/20 rounded-full glowing-orb blur-xl"></div>
              <img
                alt="AI Orb Graphic"
                className="w-full h-full object-cover rounded-full relative z-10 border-2 border-white shadow-inner"
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
          <h2 className={`text-base font-semibold ${isDarkMode ? 'text-white' : 'text-[#17182B]'}`}>Recent Activity</h2>
          <button 
            onClick={() => onNavigate('scan-outfit')}
            className="text-xs font-semibold text-[#5B45E7] flex items-center hover:underline"
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
                <div className="h-48 rounded-2xl overflow-hidden relative shadow-xs border border-[#E8E5F0] bg-white mb-2">
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
                      className={`absolute top-2.5 right-2.5 z-10 w-8 h-8 rounded-full flex items-center justify-center shadow-sm select-none transition-all cursor-pointer ${isSaved ? 'bg-rose-50 text-rose-500 border border-rose-100' : 'bg-white/90 text-[#697386] hover:text-rose-500 hover:bg-white'}`}
                    >
                      <span className="material-symbols-outlined text-sm leading-none" style={{ fontVariationSettings: isSaved ? "'FILL' 1" : undefined }}>
                        {isSaved ? 'favorite' : 'favorite_border'}
                      </span>
                    </button>
                  )}
                </div>
                <h4 className={`text-sm font-semibold truncate ${isDarkMode ? 'text-white' : 'text-[#17182B]'}`}>{activity.name}</h4>
                <p className={`text-[11px] truncate ${isDarkMode ? 'text-slate-400' : 'text-[#697386]'}`}>{activity.time}</p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
