import React, { useState, useEffect } from 'react';
import { ScreenId } from '../types';

interface CameraScanViewProps {
  onNavigate: (screen: ScreenId) => void;
}

export const CameraScanView: React.FC<CameraScanViewProps> = ({ onNavigate }) => {
  const [scanning, setScanning] = useState(true);
  const [activeChip, setActiveChip] = useState<'clothing' | 'shoes' | 'accessories' | 'others'>('clothing');

  useEffect(() => {
    if (scanning) {
      const timer = setTimeout(() => {
        setScanning(false);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [scanning]);

  const handleScanAgain = () => {
    setScanning(true);
  };

  return (
    <div className="space-y-6">
      {/* Upper Title Row & orbital AI Head */}
      <section className="relative pt-2">
        <div className="flex justify-between items-start">
          <div className="max-w-[70%]">
            <h1 className="text-2xl font-bold text-slate-900 leading-tight">Camera Scan</h1>
            <p className="text-xs text-slate-500 mt-1">
              Point your camera at any outfit or fabric to get instant material specifications and pairings.
            </p>
          </div>
          
          {/* AI Floating Robot Head Sphere */}
          <div className="relative w-14 h-14 shrink-0 shadow-inner">
            <div className="absolute inset-0 bg-indigo-200/50 rounded-full blur-md animate-pulse"></div>
            <div className="relative w-full h-full rounded-full bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 border-2 border-indigo-400/40 flex items-center justify-center overflow-hidden">
              <div className="flex gap-1.5 z-10">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-300 shadow-[0_0_6px_#8e94f2]"></div>
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-300 shadow-[0_0_6px_#8e94f2]"></div>
              </div>
              <div className="absolute inset-0 border border-indigo-400/20 rounded-full scale-110 -rotate-12"></div>
              <div className="absolute inset-0 border border-purple-400/10 rounded-full scale-125 rotate-45"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Point instruction text */}
      <div className="text-center text-xs text-slate-500 leading-none">
        Point your camera at any clothing item
      </div>

      {/* Floating horizontal category picker tags */}
      <div className="flex overflow-x-auto gap-2 pb-2 hide-scrollbar -mx-4 px-4">
        {[
          { id: 'clothing', label: 'Clothing', icon: 'apparel' },
          { id: 'shoes', label: 'Shoes', icon: 'steps' },
          { id: 'accessories', label: 'Accessories', icon: 'shopping_bag' },
          { id: 'others', label: 'Others', icon: 'more_horiz' }
        ].map((chip) => {
          const isActive = activeChip === chip.id;
          return (
            <button
              key={chip.id}
              onClick={() => setActiveChip(chip.id as any)}
              className={`px-4 py-2 rounded-full flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap transition-all ${
                isActive 
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 border border-indigo-600' 
                  : 'bg-white/60 text-slate-600 border border-slate-200 hover:bg-white'
              }`}
            >
              <span className="material-symbols-outlined text-[15px] leading-none">{chip.icon}</span> 
              {chip.label}
            </button>
          );
        })}
      </div>

      {/* Camera scan framing viewfinder card */}
      <section className="relative w-full aspect-[4/5] rounded-3xl overflow-hidden shadow-lg border border-slate-300/40 bg-black">
        {/* Underlay canvas image: Lavender Hoodie on organic hanger */}
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuD2NUEgLOUwK_v7hE4JYUKaRzKcCl9wvuCnJyQG-_L_crquoeM_bAtJHefPqGCbycHP0_cmZcffL8KrQVFWbiAp30-xINbUbzGsMCCxozik23wF1uzSgJ1_sj_lcs4xB7MGprn_Hudn4j5yf2R6VY8O1WnwnbX7QY6jBoXHHAiIOIpQlZIER60anAU9qeH3ck0N-dMYjnzmxGYOdgP2BVUZQ_VOtpLnzw-yJNVWv1mt7fhXmSrt5JwTbECdwP7a2rKSECAZQi4bd0Mw')"
          }}
        />

        {/* Viewfinder ambient dark filter */}
        <div className="absolute inset-0 bg-black/25"></div>

        {/* Framing target elements */}
        <div className="absolute inset-4 rounded-2xl overflow-hidden border border-white/15">
          <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-white rounded-tl"></div>
          <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-white rounded-tr"></div>
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-white rounded-bl"></div>
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-white rounded-br"></div>

          {/* Quick HUD controls */}
          <div className="absolute top-3 left-3 right-3 flex justify-between">
            <button className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white border border-white/10 hover:bg-black/60">
              <span className="material-symbols-outlined text-base">bolt</span>
            </button>
            <button className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white border border-white/10 hover:bg-black/60">
              <span className="material-symbols-outlined text-base">photo_library</span>
            </button>
          </div>

          {/* Scanning line animation laser with pulse glow */}
          {scanning && (
            <div className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-indigo-400 to-transparent top-1/2 shadow-[0_0_12px_#bfc2ff] scan-line-animation" />
          )}

          {/* Lens focus factor */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
            <div className="px-3 py-1 rounded-full bg-black/60 backdrop-blur-md text-white text-xs font-bold border border-white/20">
              1x
            </div>
          </div>
        </div>
      </section>

      {/* Analysis Reports container panel */}
      <section className="glass-panel rounded-3xl p-4">
        {scanning ? (
          <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-10 h-10 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin"></div>
            <p className="text-xs font-bold text-indigo-700 tracking-wide">NOVA Smart Scanning active...</p>
            <p className="text-[10px] text-slate-500">Checking texture matrix and matching database</p>
          </div>
        ) : (
          <div className="animate-fade-in">
            <div className="flex gap-4">
              {/* Product Thumbnail */}
              <div className="w-20 h-20 rounded-2xl bg-white border border-slate-200 p-1 shrink-0">
                <div 
                  className="w-full h-full rounded-xl bg-cover bg-center"
                  style={{
                    backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuB7zott91VIznBqXdVLU967pWdEDXLed4sADuqBs55nt9H4suioqm3jQ2m8J-Y2MwcDMx3N-CldppS7Tt8y5zpfMNYjDwTQHehbIemVAMR9lCCgkrzjQGi05vWZNLXT4g1A1uPRpwCQ5TEhER7U4t56HtT5iqUcdm-2MUDiRM5PisjtjjuWjzIXbCZwFFijuJFjLjgK35fvFzRFndhNNTbigMKV-batZsfaj3P2Fd3WFJL9t-OBwf3tuNUdQRw9ia_1eLIwHTWeRQTC')"
                  }}
                />
              </div>

              {/* Data specifications */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                  <h3 className="text-base font-bold text-slate-900 leading-none">Hoodie</h3>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-100 text-indigo-700 uppercase tracking-wider">Top Wear</span>
                </div>
                <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[11px] text-slate-600">
                  <span className="text-slate-400 font-medium">Color</span>
                  <span className="text-slate-800 flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#bfc2ff] border border-white inline-block"></span>
                    Lavender
                  </span>
                  
                  <span className="text-slate-400 font-medium">Category</span>
                  <span className="text-slate-800">Casual Wear</span>

                  <span className="text-slate-400 font-medium">Material</span>
                  <span className="text-slate-800">Cotton Blend</span>

                  <span className="text-slate-400 font-medium font-bold">Match</span>
                  <span className="text-indigo-600 font-bold">92%</span>
                </div>
              </div>

              {/* Pairing list recommendation (micro-visual) */}
              <div className="w-20 pl-3 border-l border-slate-200 shrink-0 text-center flex flex-col items-center justify-center">
                <p className="text-[9px] text-slate-400 font-bold leading-none mb-1">Paired With</p>
                <div className="w-9 h-9 rounded-lg bg-slate-100 overflow-hidden border border-white/50 shadow-sm mb-1">
                  <div 
                    className="w-full h-full bg-cover bg-center"
                    style={{
                      backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuABd9U6uAi6diNk9_zmvjAknbQ4R_Xg_BpIUpHW12548vGoOE48-mCdcMrZod9meM-XorjORM53np1iJqk5K_AwI11wj_0-KKMCJNF9pgIsqVjJeZuwnxQO2peQ4SoFNlrFFR15Y7QmGsGEpNAdR87DMJmBBdCF7m4a8e47wNmebGMMeGwg1oYUII2iF6Y7fzsoEi1QmWlGbgL224l6AZCmXGJoIrgaek5Yt0dkux5yagz5Hm6gQ3aSolSVIv9xF9TNmbOk2Nv4BQ6k')"
                    }}
                  />
                </div>
                <span className="text-[8px] font-bold text-indigo-600 bg-indigo-50 px-1 rounded-full">+ 4 more</span>
              </div>
            </div>

            {/* Scanning details action buttons */}
            <div className="flex gap-3 mt-4">
              <button 
                onClick={handleScanAgain}
                className="flex-1 py-2.5 rounded-full border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 transition-colors font-bold flex items-center justify-center gap-1.5 text-xs shadow-sm shadow-slate-100"
              >
                <span className="material-symbols-outlined text-base">refresh</span>
                Scan Again
              </button>
              
              <button 
                onClick={() => onNavigate('product-details')}
                className="flex-1 py-2.5 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center gap-1 hover:bg-indigo-700 transition-colors text-xs shadow-md shadow-indigo-600/20"
              >
                View Details
                <span className="material-symbols-outlined text-base leading-none">chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
