import React, { useState } from 'react';
import { ScreenId } from '../types';
import { swatchImages, swipeModels } from '../data';

interface TryOnResultViewProps {
  onNavigate: (screen: ScreenId) => void;
  selectedColor: string;
  setSelectedColor: (color: string) => void;
  onAddToCart: (prodId: string, color: string, size: string) => void;
  selectedProductId?: string;
  onSubmitReview?: (productId: string, rating: number, text: string, source?: 'product' | 'tryon') => void;
}

export const TryOnResultView: React.FC<TryOnResultViewProps> = ({
  onNavigate,
  selectedColor,
  setSelectedColor,
  onAddToCart,
  selectedProductId = 'lavender-hoodie',
  onSubmitReview
}) => {
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const swatches = [
    { name: 'Lavender', text: 'Lavender' },
    { name: 'Mint Green', text: 'Mint Green' },
    { name: 'Beige', text: 'Beige' },
    { name: 'Black', text: 'Black' },
    { name: 'Sky Blue', text: 'Sky Blue' }
  ];

  // Get matching model preview based on selected color or fallback to lavender
  const currentPreviewImg = swipeModels[selectedColor] || swipeModels['Lavender'];

  const handleShare = async () => {
    const shareData = {
      title: 'My NOVA AR Look',
      text: `Check out my custom Lavender Hoodie look in ${selectedColor} curated by NOVA Next-Gen Optical Vision Assistant!`,
      url: window.location.href
    };

    try {
      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
        setShareStatus('Look shared successfully!');
      } else {
        throw new Error('Device sharing unsupported');
      }
    } catch (err) {
      try {
        await navigator.clipboard.writeText(
          `My NOVA AR Look (${selectedColor}): Check out my custom curated style outfit! ${window.location.origin}`
        );
        setShareStatus('✓ Link copied to clipboard!');
      } catch (clipErr) {
        setShareStatus('✓ Outfit shared!');
      }
    }

    setTimeout(() => {
      setShareStatus(null);
    }, 2500);
  };

  const handleBuyNow = () => {
    onNavigate('product-details');
  };

  return (
    <div className="space-y-6 relative">
      {shareStatus && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 text-white px-4.5 py-2.5 rounded-full text-xs font-bold shadow-xl flex items-center gap-1.5 border border-slate-700/40 backdrop-blur-md animate-bounce max-w-[280px] text-center leading-none">
          <span className="material-symbols-outlined text-[14px] text-indigo-400">share</span>
          <span>{shareStatus}</span>
        </div>
      )}

      {/* Header & Match Score details */}
      <section className="flex justify-between items-start pt-2">
        <div className="max-w-[65%]">
          <h1 className="text-2xl font-bold text-slate-900 leading-tight">Try-On Result</h1>
          <p className="text-xs text-slate-500 mt-1">
            Here's how you look! You can change color swatches below, inspect material details, or save your curated outfit.
          </p>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 shadow-sm px-1 bg-white rounded">Score</span>
          <div className="relative w-14 h-14 rounded-full bg-conic flex items-center justify-center shadow-md border border-white" style={{
            background: 'conic-gradient(#4f55ae 92%, #e2e8f0 0)'
          }}>
            <div className="absolute inset-[3px] bg-white rounded-full flex flex-col items-center justify-center shadow-inner">
              <span className="text-base font-bold text-indigo-700 leading-none">92%</span>
            </div>
          </div>
          <span className="text-[10px] font-bold text-indigo-600 mt-1.5 flex items-center gap-0.5 leading-none">
            Ideal Fit! <span className="material-symbols-outlined text-[13px] leading-none">auto_awesome</span>
          </span>
        </div>
      </section>

      {/* Main Preview Model Frame Card */}
      <section className="relative w-full aspect-[4/5] rounded-3xl overflow-hidden shadow-lg border border-white/50 bg-slate-150">
        <img 
          alt="Lavender Hoodie tryon comparison preview" 
          className="w-full h-full object-cover transition-opacity duration-300"
          referrerPolicy="no-referrer"
          src={currentPreviewImg}
        />
        
        {/* Holographic scanner camera corners */}
        <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-white/80 rounded-tl"></div>
        <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-white/80 rounded-tr"></div>
        <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-white/80 rounded-bl"></div>
        <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-white/80 rounded-br"></div>

        {/* Side Floating Camera Tools */}
        <div className="absolute left-3 top-1/2 -translate-y-1/2 flex flex-col gap-3 bg-white/50 backdrop-blur-xl p-1.5 rounded-2xl border border-white/40 shadow-md">
          <button className="w-8 h-8 flex flex-col items-center justify-center text-slate-800 hover:text-indigo-600 transition-colors">
            <span className="material-symbols-outlined text-base">rotate_right</span>
            <span className="text-[7px] font-bold mt-0.5">Rotate</span>
          </button>
          <button className="w-8 h-8 flex flex-col items-center justify-center text-slate-800 hover:text-indigo-600 transition-colors">
            <span className="material-symbols-outlined text-base">zoom_in</span>
            <span className="text-[7px] font-bold mt-0.5">Zoom</span>
          </button>
          <button className="w-8 h-8 flex flex-col items-center justify-center text-slate-800 hover:text-indigo-600 transition-colors">
            <span className="material-symbols-outlined text-base">refresh</span>
            <span className="text-[7px] font-bold mt-0.5">Reset</span>
          </button>
        </div>

        {/* Background Toggle Banner */}
        <button className="absolute bottom-4 right-4 bg-white/60 backdrop-blur-xl px-3 py-1.5 rounded-full border border-white/55 flex items-center gap-1 hover:bg-white/80 transition-colors shadow-sm text-[10px] font-semibold text-slate-800">
          <span className="material-symbols-outlined text-sm leading-none">image</span>
          Background
        </button>
      </section>

      {/* Change Color Palette selection swatches row */}
      <section className="glass-card rounded-2xl p-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-indigo-600 text-base leading-none">palette</span>
            Change Color
          </h3>
          <button 
            onClick={() => onNavigate('product-details')}
            className="text-xs font-semibold text-indigo-600 hover:underline"
          >
            Details
          </button>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1 hide-scrollbar">
          {swatches.map((s) => {
            const isActive = selectedColor === s.name;
            const swatchImg = swatchImages[s.name] || swatchImages['Lavender'];

            return (
              <div key={s.name} className="flex flex-col items-center gap-1 shrink-0">
                <button 
                  onClick={() => setSelectedColor(s.name)}
                  className={`w-14 h-14 rounded-2xl border-2 p-0.5 relative overflow-hidden transition-all duration-200 active:scale-95 ${
                    isActive ? 'border-indigo-600 scale-105 shadow-md shadow-indigo-600/20' : 'border-slate-200 opacity-80'
                  }`}
                >
                  <img 
                    alt={`${s.name} color swatch swatch`} 
                    className="w-full h-full object-cover rounded-xl"
                    referrerPolicy="no-referrer"
                    src={swatchImg}
                  />
                  {isActive && (
                    <div className="absolute top-1 right-1 bg-white rounded-full p-0.5 shadow-sm">
                      <span className="material-symbols-outlined text-[10px] text-indigo-600 font-bold leading-none">check</span>
                    </div>
                  )}
                </button>
                <span className={`text-[10px] font-medium ${isActive ? 'text-indigo-600 font-bold' : 'text-slate-500'}`}>{s.text}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Mini Product Card details banner */}
      <section className="glass-card rounded-3xl p-4 flex gap-4 items-center">
        <div className="w-16 h-20 rounded-xl bg-slate-100 overflow-hidden shrink-0 border border-white/50 p-0.5">
          <img 
            alt="Lavender hoodie organic fleece thumbnail" 
            className="w-full h-full object-cover rounded-lg"
            referrerPolicy="no-referrer"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuCMoZyQ6gB17ndV4j-uYbFV_L4ip-VktpJmHPFNU0X6Avq5c7QDrjTiBmWdw2JzwBNVm6NKdhYcGpei7mfRO3u4qijtf1m1UvQAg-IYYiPthR2Tb-XsMcrxTl8yRn6k9epyqclwbvm1GP2-PeqkKHBvTyR6GdJARVxrvUCA7sR_RDgkXcFEV6JKCwgdNuCi6PtxZyBiOJ9dD-8d7zTP4dEkODC2O4C1KLmg5OyoOnWfgnH49MSvNkArF53siLur3AC9hmKZPuW4etG3"
          />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-bold text-slate-800 truncate">Lavender Hoodie</h4>
          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 inline-block mt-0.5">Streetwear Classic</span>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-sm font-extrabold text-indigo-600">₹1,499</span>
            <span className="text-[10px] text-slate-500 flex items-center font-semibold">
              <span className="material-symbols-outlined text-[11px] text-amber-500 mr-0.5 leading-none">star</span>
              4.6 (128)
            </span>
          </div>
        </div>
        <button 
          onClick={handleBuyNow}
          className="py-2.5 px-3 rounded-xl border border-indigo-600 text-indigo-600 text-xs font-bold flex items-center justify-center gap-1 hover:bg-indigo-50 transition-colors"
        >
          <span className="material-symbols-outlined text-sm leading-none">local_mall</span>
          Details
        </button>
      </section>

      <section className="rounded-3xl bg-white p-4 shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Rate your try-on</h3>
            <p className="text-[11px] text-slate-500">Add a star rating and quick review from your AR experience.</p>
          </div>
          <span className="text-xs font-semibold text-slate-400">{selectedColor}</span>
        </div>

        <div className="flex gap-2 mb-3">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setReviewRating(star)}
              className={`rounded-full w-10 h-10 border flex items-center justify-center transition ${
                reviewRating >= star ? 'bg-amber-500 text-white border-amber-500' : 'bg-slate-100 text-slate-500 border-slate-200'
              }`}
            >
              <span className="material-symbols-outlined">star</span>
            </button>
          ))}
        </div>

        <textarea
          value={reviewText}
          onChange={(e) => setReviewText(e.target.value)}
          className="w-full rounded-3xl border border-slate-200 px-4 py-3 text-sm text-slate-700 min-h-[110px]"
          placeholder="Write a quick note about fit, color, or comfort..."
        />

        <button
          type="button"
          onClick={() => {
            if (!onSubmitReview) return;
            if (reviewRating <= 0 || !reviewText.trim()) {
              setToastMessage('Select rating and write a review before submitting.');
              setTimeout(() => setToastMessage(null), 2500);
              return;
            }
            onSubmitReview(selectedProductId, reviewRating, reviewText, 'tryon');
            setReviewRating(0);
            setReviewText('');
            setToastMessage('Thanks! Your try-on review has been submitted.');
            setTimeout(() => setToastMessage(null), 2500);
          }}
          className="mt-4 w-full rounded-2xl bg-indigo-600 text-white py-3 text-sm font-semibold hover:bg-indigo-700 transition-colors"
        >
          Submit Try-On Review
        </button>
      </section>

      {/* Action Buttons footer bar */}
      <section className="flex gap-2.5 pt-2">
        <button 
          onClick={handleShare}
          className="flex-1 py-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-150/60 rounded-2xl font-bold flex items-center justify-center gap-1.5 text-xs transition-all shadow-sm active:scale-95 cursor-pointer"
        >
          <span className="material-symbols-outlined text-base">share</span>
          Share
        </button>
        <button className="flex-1 py-3 rounded-2xl border border-slate-200 text-slate-700 bg-white/70 hover:bg-white hover:shadow transition-all font-bold flex items-center justify-center gap-1.5 text-xs shadow-sm shadow-slate-100 active:scale-95">
          <span className="material-symbols-outlined text-base">bookmark_border</span>
          Save
        </button>
        <button 
          onClick={() => onNavigate('ar-tryon')}
          className="flex-[1.4] py-3 rounded-2xl bg-gradient-to-r from-indigo-500 to-indigo-700 text-white font-bold flex items-center justify-center gap-1.5 text-xs shadow-lg shadow-indigo-600/30 hover:opacity-95 transition-opacity active:scale-95 cursor-pointer"
        >
          <span className="material-symbols-outlined text-base">sync</span>
          Another
        </button>
      </section>
    </div>
  );
};
