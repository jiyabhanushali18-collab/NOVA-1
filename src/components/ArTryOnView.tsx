import React, { useState } from 'react';
import { ScreenId } from '../types';

interface ArTryOnViewProps {
  onNavigate: (screen: ScreenId) => void;
  selectedGarment: string;
  setSelectedGarment: (garment: string) => void;
}

export const ArTryOnView: React.FC<ArTryOnViewProps> = ({ 
  onNavigate, 
  selectedGarment,
  setSelectedGarment 
}) => {
  const [activeCategory, setActiveCategory] = useState<'outfit' | 'tops' | 'bottoms' | 'shoes'>('outfit');
  const [flash, setFlash] = useState(false);

  const handleCapture = () => {
    setFlash(true);
    setTimeout(() => {
      setFlash(false);
      onNavigate('tryon-result');
    }, 400);
  };

  const garments = [
    {
      id: 'Lavender',
      name: 'Lavender Hoodie',
      category: 'Casual wear',
      img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBMp28DuWLs2Hm0Z3zGkTUIi6O48XUey1zmodtJKkRl70I0XfGpE1v-cHgQSCcRAEXXA30-T9jDUU10DbA2QclLLAv19DyeRL36-IYaX2okG7Z_zUk8U_va2M1TwkRW9tMlN4quItx2zRxaQ5dEJthM7JLXMPsAlgqS-JIJu7u2hZ_o3Nq3qvPx8BDuTBo4uXzlGX81y63js3DVwtM9mbWne5HP4WjrKURgWfd6Q6KnNCPn-t5n70a6PrwIhP2bMz2QmTYI4T0RVWZ3'
    },
    {
      id: 'Mint Green',
      name: 'Denim Jacket',
      category: 'Streetwear',
      img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD3miyWP_zl2aHEDCK9sXkVPXLOVzbOKRTWLRnX3e1NdsACMR0aFCxqKWwxGOku-R7IVBVcGNxAGDCSsezqGsnTF7cqeG872VC8viDCcyRRLri-LaZt0AFnVHR8qBBUVRdn08W7n2HIrAANh45Vqx8AM8z545uKlXiCl37ZD09VgvKuW-UT_tJ_Hu-q0eACs3i5zaveMZ2knMU0jakTV_1kfq0fTC2D77YrK1HiGdBRCkXLhFXQB3PpELPFKIva2UW0XKhoytfhVIvr'
    },
    {
      id: 'Beige',
      name: 'Beige Shirt',
      category: 'Smart Casual',
      img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA8wT-YJ9h1opUpZm1ItgTo6FkdK0wAOpAMniH2HQkI_Y_-haB8_cWFNy4aa-yIVFZG703nvN2a3Y4UAGNPWgmnExTMtTtm89k2S85clx5XlQDhAKyQMPq-umw2uRdUFAYWhSyj0w0tdyH-XojlBbLvD0Cp2Ov_btKdpwnd3zD4Y3OLI2x4ye_cr3pb-DcDAsarau1uSjQE9OSBuxXa6E4fWpGztGMkFi7APN02qcIMBnN6Zneuc-Qv6FY3XY2d7SMswIqHBoJ4QDMV'
    }
  ];

  // Base background model photo corresponding to current selection
  const modelImages: Record<string, string> = {
    'Lavender': 'https://lh3.googleusercontent.com/aida-public/AB6AXuAa7j2Q08nuchJnXnqIUa06NxmNavLWJ_vAvDJkkGqHlxbJMtqjGde7Pi06VWtt5pS_EQrG4QLhpYgomTop5MZ3Cv1rxDd_GgOfa9slQd5mMqPaFbVVUIuxs1jjH6mFIr96oP8gn8wUwKI8BJ5wW7IK9zjSqPZM2_HHyBm5lZ1mAjwhxqP8YUS2Y8aWM9TANQEmijEuZDn7zU75iYiqmmjJfpUWf7Go2wjs5ZJx1U8xPzTIRPalkmcbncx0m6S7EBGf6QW3IERapFVU',
    'Mint Green': 'https://lh3.googleusercontent.com/aida-public/AB6AXuAcUEi_nsnHa9pctxOSr137Q2sxBgQPnR3WIYrJ8VpULouZNaqwAoi16leulhEqOZIH4KS2c-2PDZvMbnVzXqXPmsGv1_SBECvpTF1PuUVzaCIhiYCu3Z5v_gC7HHgn8wvYep7u9o2B45oRIbcIouw8avkr2p0oKOl_-dZvwrBxUTKEL6FetzkJa5qIag7J1zPbASlQzqaccV06-hQlT0WYxPsbpc6Q6LZ69ziMJ2v4Z8gZb06qVAIjQazcot-Npm3tN1ygJrj7bg6R',
    'Beige': 'https://lh3.googleusercontent.com/aida-public/AB6AXuDCFSGDiIXtLBJAiPRem1rT1u1vy9hiZ4dJL2uSzgH-cYy9IzFBpw7sL1djGxdfSuV2Ny2sN3hNzOf68Bqa3E3lCWOyZ_MHpZ_TTdCQ0dFqvXp2IV4a2uETvozx8lKcpD9Z0KGksZG5bqEZkdaR08UbDKwK47U5Y4f0PF96GMriZJRDT8-TwfIrO7v0ddLDbE0aejwuxbldnzx77Z4Ac1E2rlZ1XAPq0owb6ekuuni7odR-ttYb42AjrjFk_pMQIFmkiKxSITBW3ShE'
  };

  const activeModelBg = modelImages[selectedGarment] || modelImages['Lavender'];

  return (
    <div className="absolute inset-0 z-0 h-full overflow-hidden bg-slate-900 rounded-3xl">
      {/* simulated camera flash component */}
      {flash && (
        <div className="absolute inset-0 bg-white z-50 animate-ping opacity-100 pointer-events-none" />
      )}

      {/* Main AR model render background */}
      <div className="absolute inset-0">
        <img 
          alt="AR Try-On Portrait Model" 
          className="w-full h-full object-cover object-center transition-all duration-500"
          referrerPolicy="no-referrer"
          src={activeModelBg}
        />
        
        {/* AR holographic target framing overlay */}
        <div className="absolute inset-x-8 top-20 bottom-32 border border-white/20 rounded-[32px] pointer-events-none">
          <div className="absolute top-0 left-0 w-10 h-10 border-t-2 border-l-2 border-white rounded-tl-[32px] shadow-[0_0_10px_rgba(255,255,255,0.4)]"></div>
          <div className="absolute top-0 right-0 w-10 h-10 border-t-2 border-r-2 border-white rounded-tr-[32px] shadow-[0_0_10px_rgba(255,255,255,0.4)]"></div>
          <div className="absolute bottom-0 left-0 w-10 h-10 border-b-2 border-l-2 border-white rounded-bl-[32px] shadow-[0_0_10px_rgba(255,255,255,0.4)]"></div>
          <div className="absolute bottom-0 right-0 w-10 h-10 border-b-2 border-r-2 border-white rounded-br-[32px] shadow-[0_0_10px_rgba(255,255,255,0.4)]"></div>
        </div>
      </div>

      {/* Floating Match score circle */}
      <div className="absolute top-24 right-5 z-20">
        <div className="bg-slate-950/40 backdrop-blur-md rounded-full w-16 h-16 flex flex-col items-center justify-center shadow-lg border border-indigo-400/30 relative">
          <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" fill="none" r="43" stroke="rgba(255,255,255,0.2)" strokeWidth="4"></circle>
            <circle cx="50" cy="50" fill="none" r="43" stroke="#8e94f2" strokeDasharray="270" strokeDashoffset="21" strokeLinecap="round" strokeWidth="4"></circle>
          </svg>
          <span className="text-white font-bold text-base relative z-10 leading-none">92%</span>
          <span className="text-slate-300 font-medium text-[9px] uppercase tracking-wider relative z-10 mt-0.5">Match</span>
        </div>
      </div>

      {/* Left side category selectors (floating bar) */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2 z-20">
        <div className="bg-slate-950/40 backdrop-blur-lg rounded-full py-4 px-2 flex flex-col space-y-5 shadow-xl border border-white/10 text-slate-300">
          <button 
            onClick={() => setActiveCategory('outfit')}
            className={`flex flex-col items-center space-y-0.5 w-10 transition-colors ${activeCategory === 'outfit' ? 'text-indigo-400' : 'hover:text-white'}`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${activeCategory === 'outfit' ? 'bg-indigo-600 text-white shadow-md' : ''}`}>
              <span className="material-symbols-outlined text-[18px]">checkroom</span>
            </div>
            <span className="text-[9px] font-medium font-sans">Outfits</span>
          </button>
          
          <button 
            onClick={() => setActiveCategory('tops')}
            className={`flex flex-col items-center space-y-0.5 w-10 transition-colors ${activeCategory === 'tops' ? 'text-indigo-400' : 'hover:text-white'}`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${activeCategory === 'tops' ? 'bg-indigo-600 text-white shadow-md' : ''}`}>
              <span className="material-symbols-outlined text-[18px]">apparel</span>
            </div>
            <span className="text-[9px] font-medium font-sans">Tops</span>
          </button>

          <button 
            onClick={() => setActiveCategory('bottoms')}
            className={`flex flex-col items-center space-y-0.5 w-10 transition-colors ${activeCategory === 'bottoms' ? 'text-indigo-400' : 'hover:text-white'}`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${activeCategory === 'bottoms' ? 'bg-indigo-600 text-white shadow-md' : ''}`}>
              <span className="material-symbols-outlined text-[18px]">styler</span>
            </div>
            <span className="text-[9px] font-medium font-sans">Bottoms</span>
          </button>

          <button 
            onClick={() => setActiveCategory('shoes')}
            className={`flex flex-col items-center space-y-0.5 w-10 transition-colors ${activeCategory === 'shoes' ? 'text-indigo-400' : 'hover:text-white'}`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${activeCategory === 'shoes' ? 'bg-indigo-600 text-white shadow-md' : ''}`}>
              <span className="material-symbols-outlined text-[18px]">directions_walk</span>
            </div>
            <span className="text-[9px] font-medium font-sans">Shoes</span>
          </button>
        </div>
      </div>

      {/* Right side options: Flip, light, Fit (floating bar) */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 z-20">
        <div className="bg-slate-950/40 backdrop-blur-lg rounded-full py-4 px-2 flex flex-col space-y-5 shadow-xl border border-white/10 text-slate-300">
          <button className="flex flex-col items-center space-y-0.5 w-10 hover:text-white transition-colors">
            <span className="material-symbols-outlined text-lg">flip_camera_ios</span>
            <span className="text-[9px]">Flip</span>
          </button>
          <button className="flex flex-col items-center space-y-0.5 w-10 hover:text-white transition-colors">
            <span className="material-symbols-outlined text-lg">light_mode</span>
            <span className="text-[9px]">Light</span>
          </button>
          <button className="flex flex-col items-center space-y-0.5 w-10 hover:text-white transition-colors">
            <span className="material-symbols-outlined text-lg">man</span>
            <span className="text-[9px]">Fit</span>
          </button>
        </div>
      </div>

      {/* Dynamic bottom garment carousel & capture container */}
      <div className="absolute bottom-4 inset-x-0 z-30 px-4 flex flex-col items-center space-y-4">
        
        {/* Swipe selection list */}
        <div className="w-full flex space-x-3 overflow-x-auto hide-scrollbar snap-x px-2">
          {garments.map((g) => (
            <div 
              key={g.id}
              onClick={() => setSelectedGarment(g.id)}
              className={`snap-center shrink-0 w-24 rounded-2xl p-2 flex flex-col items-center border transition-all duration-300 cursor-pointer ${
                selectedGarment === g.id 
                  ? 'bg-white/30 backdrop-blur-md border-indigo-400 font-bold scale-105 shadow-md shadow-indigo-500/20' 
                  : 'bg-slate-950/30 backdrop-blur-sm border-white/10 opacity-70'
              }`}
            >
              <div className="w-full aspect-square rounded-xl bg-slate-100/10 mb-1.5 overflow-hidden flex items-center justify-center relative">
                <img 
                  alt={g.name} 
                  className="w-full h-full object-cover" 
                  referrerPolicy="no-referrer"
                  src={g.img}
                />
                {selectedGarment === g.id && (
                  <div className="absolute top-1 right-1 w-4.5 h-4.5 rounded-full bg-indigo-600 text-white flex items-center justify-center border border-white">
                    <span className="material-symbols-outlined text-[10px] font-bold leading-none">check</span>
                  </div>
                )}
              </div>
              <span className="text-white text-[9px] font-sans text-center leading-tight truncate w-full">{g.name}</span>
            </div>
          ))}
        </div>

        {/* Shutter capture bar */}
        <div className="bg-slate-950/40 backdrop-blur-xl rounded-full w-full max-w-sm flex items-center justify-between px-6 py-3 border border-white/20 shadow-xl">
          <button 
            onClick={() => onNavigate('home')}
            className="flex items-center space-x-1 text-slate-300 hover:text-white"
          >
            <span className="material-symbols-outlined text-base">home</span>
            <span className="text-xs font-semibold">Exit</span>
          </button>

          {/* Shutter center button */}
          <button 
            onClick={handleCapture}
            className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center shadow-[0_0_20px_rgba(79,85,174,0.6)] border-2 border-white -mt-6 hover:scale-105 transition-transform duration-300"
          >
            <span className="material-symbols-outlined text-white text-2xl leading-none">photo_camera</span>
          </button>

          <button 
            onClick={() => onNavigate('chat')} 
            className="flex items-center space-x-1 text-slate-300 hover:text-white"
          >
            <span className="material-symbols-outlined text-base">chat</span>
            <span className="text-xs font-semibold">Consult</span>
          </button>
        </div>
      </div>
    </div>
  );
};
