import React, { useEffect, useState } from 'react';
import { ScreenId } from '../types';
import { swatchImages, swipeModels } from '../data';
import { getTryOnStyleScore, TryOnStyleScore } from '../services/tryOnScoreService';

interface TryOnResultViewProps {
  onNavigate: (screen: ScreenId) => void;
  selectedColor: string;
  setSelectedColor: (color: string) => void;
  onAddToCart: (prodId: string, color: string, size: string) => void;
  selectedProductId?: string;
  onSubmitReview?: (productId: string, rating: number, text: string, source?: 'product' | 'tryon') => Promise<void>;
  capturedImage?: string | null;
  garmentName?: string;
  isLiveTryOnImage?: boolean;
}

export const TryOnResultView: React.FC<TryOnResultViewProps> = ({
  onNavigate,
  selectedColor,
  setSelectedColor,
  onAddToCart,
  selectedProductId = 'lavender-hoodie',
  onSubmitReview,
  capturedImage,
  garmentName = '',
  isLiveTryOnImage = false
}) => {
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [styleScore, setStyleScore] = useState<TryOnStyleScore | null>(null);
  const [styleScoreError, setStyleScoreError] = useState<string | null>(null);
  const [scoreRequest, setScoreRequest] = useState(0);

  const swatches = [
    { name: 'Lavender', text: 'Lavender' },
    { name: 'Mint Green', text: 'Mint Green' },
    { name: 'Beige', text: 'Beige' },
    { name: 'Black', text: 'Black' },
    { name: 'Sky Blue', text: 'Sky Blue' }
  ];

  // Get matching model preview based on selected color or fallback to lavender
  const currentPreviewImg = capturedImage || swipeModels[selectedColor] || swipeModels['Lavender'];

  useEffect(() => {
    if (!isLiveTryOnImage || !capturedImage?.startsWith('data:image/')) {
      setStyleScore(null);
      setStyleScoreError(null);
      return;
    }

    const controller = new AbortController();
    setStyleScore(null);
    setStyleScoreError(null);
    getTryOnStyleScore(capturedImage, garmentName, controller.signal)
      .then(setStyleScore)
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setStyleScoreError(error instanceof Error ? error.message : 'AI style scoring is temporarily unavailable.');
        }
      });

    return () => controller.abort();
  }, [capturedImage, garmentName, isLiveTryOnImage, scoreRequest]);

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
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#131426]/95 text-white px-4.5 py-2.5 rounded-full text-xs font-bold shadow-xl flex items-center gap-1.5 border border-[#553BE2]/30 backdrop-blur-md animate-bounce max-w-[280px] text-center leading-none">
          <span className="material-symbols-outlined text-[14px] text-[#553BE2]">share</span>
          <span>{shareStatus}</span>
        </div>
      )}

      {/* Header */}
      <section className="pt-2">
        <div className="flex items-start justify-between gap-4">
          <div>
          <h1 className="text-2xl font-bold text-[#131426] leading-tight">Try-On Result</h1>
          <p className="text-xs text-[#5E667A] mt-1">
            Here's how you look! You can change color swatches below, inspect material details, or save your curated outfit.
          </p>
          </div>
          <div className="shrink-0 text-center" aria-live="polite">
            <span className="block text-[9px] font-bold text-[#5E667A] uppercase tracking-widest mb-1">AI style score</span>
            {styleScore ? (
              <>
                <div
                  className="relative w-14 h-14 rounded-full flex items-center justify-center shadow-md border border-[#E4DFF5]"
                  style={{ background: `conic-gradient(#553BE2 ${styleScore.score}%, #ECE7FF 0)` }}
                  aria-label={`AI style score ${styleScore.score} percent`}
                  title="AI estimate of outfit coordination and garment integration, not a body-fit measurement."
                >
                  <div className="absolute inset-[3px] bg-white rounded-full flex items-center justify-center shadow-inner">
                    <span className="text-base font-bold text-[#553BE2] leading-none">{styleScore.score}%</span>
                  </div>
                </div>
                <span className="block max-w-28 text-[9px] text-[#5E667A] mt-1">{styleScore.feedback}</span>
              </>
            ) : styleScoreError ? (
              <div className="w-28 text-[10px] text-rose-600">
                <span>{styleScoreError}</span>
                <button
                  type="button"
                  className="block mx-auto mt-1 font-bold text-[#553BE2] underline"
                  onClick={() => setScoreRequest((request) => request + 1)}
                >
                  Try again
                </button>
              </div>
            ) : isLiveTryOnImage && capturedImage?.startsWith('data:image/') ? (
              <div className="w-14 h-14 rounded-full border-2 border-[#E4DFF5] flex items-center justify-center text-[9px] text-[#5E667A]">
                Scoring...
              </div>
            ) : (
              <span className="block max-w-24 text-[10px] text-[#5E667A]">Connect live AI and capture a try-on to get a score.</span>
            )}
          </div>
        </div>
      </section>

      {/* Main Preview Model Frame Card */}
      <section className="relative w-full aspect-[4/5] rounded-3xl overflow-hidden shadow-lg border border-[#E4DFF5] bg-[#ECE7FF]">
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
        <div className="absolute left-3 top-1/2 -translate-y-1/2 flex flex-col gap-3 bg-white/85 backdrop-blur-xl p-1.5 rounded-2xl border border-[#E4DFF5] shadow-md">
          <button className="w-8 h-8 flex flex-col items-center justify-center text-[#131426] hover:text-[#553BE2] transition-colors">
            <span className="material-symbols-outlined text-base">rotate_right</span>
            <span className="text-[7px] font-bold mt-0.5">Rotate</span>
          </button>
          <button className="w-8 h-8 flex flex-col items-center justify-center text-[#131426] hover:text-[#553BE2] transition-colors">
            <span className="material-symbols-outlined text-base">zoom_in</span>
            <span className="text-[7px] font-bold mt-0.5">Zoom</span>
          </button>
          <button className="w-8 h-8 flex flex-col items-center justify-center text-[#131426] hover:text-[#553BE2] transition-colors">
            <span className="material-symbols-outlined text-base">refresh</span>
            <span className="text-[7px] font-bold mt-0.5">Reset</span>
          </button>
        </div>

        {/* Background Toggle Banner */}
        <button className="absolute bottom-4 right-4 bg-white/85 backdrop-blur-xl px-3 py-1.5 rounded-full border border-[#E4DFF5] flex items-center gap-1 hover:bg-white transition-colors shadow-sm text-[10px] font-semibold text-[#131426]">
          <span className="material-symbols-outlined text-sm leading-none">image</span>
          Background
        </button>
      </section>

      {/* Change Color Palette selection swatches row */}
      <section className="glass-card rounded-2xl p-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-bold text-[#131426] flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[#553BE2] text-base leading-none">palette</span>
            Change Color
          </h3>
          <button 
            onClick={() => onNavigate('product-details')}
            className="text-xs font-semibold text-[#553BE2] hover:underline"
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
                    isActive ? 'border-[#553BE2] scale-105 shadow-md shadow-[#553BE2]/20' : 'border-[#E4DFF5] opacity-80'
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
                      <span className="material-symbols-outlined text-[10px] text-[#553BE2] font-bold leading-none">check</span>
                    </div>
                  )}
                </button>
                <span className={`text-[10px] font-medium ${isActive ? 'text-[#553BE2] font-bold' : 'text-[#5E667A]'}`}>{s.text}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Mini Product Card details banner */}
      <section className="glass-card rounded-3xl p-4 flex gap-4 items-center">
        <div className="w-16 h-20 rounded-xl bg-[#F2EEFF] overflow-hidden shrink-0 border border-[#E4DFF5] p-0.5">
          <img 
            alt="Lavender hoodie organic fleece thumbnail" 
            className="w-full h-full object-cover rounded-lg"
            referrerPolicy="no-referrer"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuCMoZyQ6gB17ndV4j-uYbFV_L4ip-VktpJmHPFNU0X6Avq5c7QDrjTiBmWdw2JzwBNVm6NKdhYcGpei7mfRO3u4qijtf1m1UvQAg-IYYiPthR2Tb-XsMcrxTl8yRn6k9epyqclwbvm1GP2-PeqkKHBvTyR6GdJARVxrvUCA7sR_RDgkXcFEV6JKCwgdNuCi6PtxZyBiOJ9dD-8d7zTP4dEkODC2O4C1KLmg5OyoOnWfgnH49MSvNkArF53siLur3AC9hmKZPuW4etG3"
          />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-bold text-[#131426] truncate">Lavender Hoodie</h4>
          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#F2EEFF] text-[#553BE2] inline-block mt-0.5">Streetwear Classic</span>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-sm font-extrabold text-[#553BE2]">₹1,499</span>
            <span className="text-[10px] text-[#5E667A] flex items-center font-semibold">
              <span className="material-symbols-outlined text-[11px] text-amber-500 mr-0.5 leading-none">star</span>
              4.6 (128)
            </span>
          </div>
        </div>
        <button 
          onClick={handleBuyNow}
          className="py-2.5 px-3 rounded-xl border border-[#553BE2] text-[#553BE2] text-xs font-bold flex items-center justify-center gap-1 hover:bg-[#F2EEFF] transition-colors"
        >
          <span className="material-symbols-outlined text-sm leading-none">local_mall</span>
          Details
        </button>
      </section>

      <section className="rounded-3xl bg-white p-4 shadow-sm border border-[#E4DFF5]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-[#131426]">Rate your try-on</h3>
            <p className="text-[11px] text-[#5E667A]">Add a star rating and quick review from your AR experience.</p>
          </div>
          <span className="text-xs font-semibold text-[#5E667A]">{selectedColor}</span>
        </div>

        <div className="flex gap-2 mb-3">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setReviewRating(star)}
              className={`rounded-full w-10 h-10 border flex items-center justify-center transition ${
                reviewRating >= star ? 'bg-amber-500 text-white border-amber-500' : 'bg-[#F2EEFF] text-[#5E667A] border-[#E4DFF5]'
              }`}
            >
              <span className="material-symbols-outlined">star</span>
            </button>
          ))}
        </div>

        <textarea
          value={reviewText}
          onChange={(e) => setReviewText(e.target.value)}
          className="w-full rounded-3xl border border-[#E4DFF5] bg-[#F2EEFF] px-4 py-3 text-sm text-[#131426] placeholder:text-[#5E667A] min-h-[110px] focus:outline-none focus:border-[#553BE2]"
          placeholder="Write a quick note about fit, color, or comfort..."
        />

        <button
          type="button"
          onClick={async () => {
            if (!onSubmitReview || isSubmittingReview) return;
            if (reviewRating <= 0 || !reviewText.trim()) {
              setToastMessage('Select rating and write a review before submitting.');
              setTimeout(() => setToastMessage(null), 2500);
              return;
            }
            setIsSubmittingReview(true);
            try {
              await onSubmitReview(selectedProductId, reviewRating, reviewText, 'tryon');
              setReviewRating(0);
              setReviewText('');
              setToastMessage('Your try-on review was saved.');
            } catch (error) {
              setToastMessage(error instanceof Error ? error.message : 'Could not save your review.');
            } finally {
              setIsSubmittingReview(false);
              setTimeout(() => setToastMessage(null), 2500);
            }
          }}
          disabled={isSubmittingReview}
          className="mt-4 w-full rounded-2xl bg-[#553BE2] text-white py-3 text-sm font-semibold hover:opacity-95 transition-opacity"
        >
          {isSubmittingReview ? 'Saving Review...' : 'Submit Try-On Review'}
        </button>
      </section>

      {/* Action Buttons footer bar */}
      <section className="flex gap-2.5 pt-2">
        <button 
          onClick={handleShare}
          className="flex-1 py-3 bg-[#F2EEFF] hover:bg-[#ECE7FF] text-[#553BE2] border border-[#E4DFF5] rounded-2xl font-bold flex items-center justify-center gap-1.5 text-xs transition-all shadow-sm active:scale-95 cursor-pointer"
        >
          <span className="material-symbols-outlined text-base">share</span>
          Share
        </button>
        <button className="flex-1 py-3 rounded-2xl border border-[#E4DFF5] text-[#131426] bg-white hover:bg-[#F2EEFF] hover:shadow transition-all font-bold flex items-center justify-center gap-1.5 text-xs shadow-sm active:scale-95">
          <span className="material-symbols-outlined text-base">bookmark_border</span>
          Save
        </button>
        <button 
          onClick={() => onNavigate('ar-tryon')}
          className="flex-[1.4] py-3 rounded-2xl bg-[#553BE2] text-white font-bold flex items-center justify-center gap-1.5 text-xs shadow-lg shadow-[#553BE2]/25 hover:opacity-95 transition-opacity active:scale-95 cursor-pointer"
        >
          <span className="material-symbols-outlined text-base">sync</span>
          Another
        </button>
      </section>
    </div>
  );
};
