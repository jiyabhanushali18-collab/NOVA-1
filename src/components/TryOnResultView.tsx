import React, { useEffect, useMemo, useState } from 'react';
import { ProductItem, ScreenId } from '../types';
import { products as defaultProducts, swipeModels } from '../data';
import { getTryOnStyleScore, TryOnStyleScore } from '../services/tryOnScoreService';
import { useI18n } from '../i18n';

interface TryOnResultViewProps {
  onNavigate: (screen: ScreenId, opts?: { productId?: string; product?: ProductItem }) => void;
  selectedColor: string;
  setSelectedColor: (color: string) => void;
  onAddToCart: (prodId: string, color: string, size: string) => void;
  selectedProductId?: string;
  onSubmitReview?: (productId: string, rating: number, text: string, source?: 'product' | 'tryon', color?: string) => Promise<void>;
  capturedImage?: string | null;
  garmentName?: string;
  isLiveTryOnImage?: boolean;
  products?: Record<string, ProductItem> | ProductItem[];
}

export const TryOnResultView: React.FC<TryOnResultViewProps> = ({
  onNavigate,
  selectedColor,
  setSelectedColor,
  onAddToCart,
  selectedProductId,
  onSubmitReview,
  capturedImage,
  garmentName = '',
  isLiveTryOnImage = false,
  products
}) => {
  const { t } = useI18n();
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [styleScore, setStyleScore] = useState<TryOnStyleScore | null>(null);
  const [styleScoreError, setStyleScoreError] = useState<string | null>(null);
  const [scoreRequest, setScoreRequest] = useState(0);

  // Camera tool features state: Rotate, Zoom, and Background
  const [rotation, setRotation] = useState<number>(0);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [bgIndex, setBgIndex] = useState<number>(0);

  const backgroundThemes = [
    { name: 'Studio', class: 'bg-[#ECE7FF]' },
    { name: 'Vibrant', class: 'bg-gradient-to-tr from-[#553BE2]/20 via-[#ECE7FF] to-pink-100' },
    { name: 'Minimal', class: 'bg-slate-100' },
    { name: 'Dark', class: 'bg-slate-900' }
  ];

  // Resolve active product dynamically to prevent defaulting to Lavender Hoodie
  const currentProduct: ProductItem = useMemo(() => {
    const list: ProductItem[] = Array.isArray(products)
      ? products
      : products
      ? Object.values(products)
      : Object.values(defaultProducts);

    if (selectedProductId) {
      const match = list.find((p) => p.id === selectedProductId || p.productId === selectedProductId);
      if (match) return match;
    }

    if (garmentName) {
      const match = list.find(
        (p) =>
          p.id === garmentName ||
          p.productId === garmentName ||
          p.name.toLowerCase() === garmentName.toLowerCase() ||
          garmentName.toLowerCase().includes(p.name.toLowerCase()) ||
          p.name.toLowerCase().includes(garmentName.toLowerCase())
      );
      if (match) return match;
    }

    return list[0] || defaultProducts['lavender-hoodie'];
  }, [products, selectedProductId, garmentName]);

  // Preview image: captured image, or matched model preview, or product image
  const currentPreviewImg =
    capturedImage ||
    swipeModels[selectedColor] ||
    swipeModels[currentProduct?.name || ''] ||
    currentProduct?.imageUrl ||
    swipeModels['Lavender'];

  useEffect(() => {
    const targetGarmentName = currentProduct?.name || garmentName;
    if (!isLiveTryOnImage || !capturedImage?.startsWith('data:image/')) {
      setStyleScore(null);
      setStyleScoreError(null);
      return;
    }

    const controller = new AbortController();
    setStyleScore(null);
    setStyleScoreError(null);
    getTryOnStyleScore(capturedImage, targetGarmentName, controller.signal)
      .then(setStyleScore)
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setStyleScoreError(error instanceof Error ? error.message : 'AI style scoring is temporarily unavailable.');
        }
      });

    return () => controller.abort();
  }, [capturedImage, garmentName, currentProduct?.name, isLiveTryOnImage, scoreRequest]);

  // Rotate camera tool handler
  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  // Zoom camera tool handler (cycles 1x -> 1.35x -> 1.7x -> 2.0x -> 1x)
  const handleZoom = () => {
    setZoomLevel((prev) => {
      if (prev === 1) return 1.35;
      if (prev === 1.35) return 1.7;
      if (prev === 1.7) return 2.0;
      return 1;
    });
  };

  // Reset camera tools handler
  const handleReset = () => {
    setRotation(0);
    setZoomLevel(1);
    setBgIndex(0);
  };

  const handleShare = async () => {
    const shareData = {
      title: `My NOVA AR Look - ${currentProduct.name}`,
      text: `Check out my custom ${currentProduct.name} look curated by NOVA Next-Gen Optical Vision Assistant!`,
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
          `My NOVA AR Look: Check out my custom ${currentProduct.name} look! ${window.location.origin}`
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
    if (currentProduct) {
      onNavigate('product-details', { productId: currentProduct.id, product: currentProduct });
    } else {
      onNavigate('product-details');
    }
  };

  const handleAddToCartClick = () => {
    const colorToAdd = selectedColor || currentProduct.colors?.[0] || 'Default';
    const sizeToAdd = currentProduct.sizes?.[0] || 'M';
    onAddToCart(currentProduct.id, colorToAdd, sizeToAdd);
    setToastMessage(`✓ Added 1x ${currentProduct.name} to Cart!`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <div className="space-y-6 relative">
      {shareStatus && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#131426]/95 text-white px-4.5 py-2.5 rounded-full text-xs font-bold shadow-xl flex items-center gap-1.5 border border-[#553BE2]/30 backdrop-blur-md animate-bounce max-w-[280px] text-center leading-none">
          <span className="material-symbols-outlined text-[14px] text-[#553BE2]">share</span>
          <span>{shareStatus}</span>
        </div>
      )}

      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#131426]/95 text-white px-4 py-2.5 rounded-full text-xs font-bold shadow-xl flex items-center gap-2 border border-emerald-500/30 backdrop-blur-md max-w-[320px] text-center">
          <span className="material-symbols-outlined text-sm text-emerald-400">check_circle</span>
          <span className="truncate">{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <section className="pt-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#131426] leading-tight">{t('tryOnResult.title')}</h1>
            <p className="text-xs text-[#5E667A] mt-1">
              {t('tryOnResult.description')}
            </p>
          </div>
          <div className="shrink-0 text-center" aria-live="polite">
            <span className="block text-[9px] font-bold text-[#5E667A] uppercase tracking-widest mb-1">{t('tryOnResult.scoreTitle')}</span>
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
                  {t('tryOnResult.retryScore')}
                </button>
              </div>
            ) : isLiveTryOnImage && capturedImage?.startsWith('data:image/') ? (
              <div className="w-14 h-14 rounded-full border-2 border-[#E4DFF5] flex items-center justify-center text-[9px] text-[#5E667A]">
                {t('tryOnResult.scoreAnalyzing')}
              </div>
            ) : (
              <span className="block max-w-24 text-[10px] text-[#5E667A]">Connect live AI and capture a try-on to get a score.</span>
            )}
          </div>
        </div>
      </section>

      {/* Main Preview Model Frame Card with working Rotate, Zoom, Reset, and Background */}
      <section className={`relative w-full aspect-[4/5] rounded-3xl overflow-hidden shadow-lg border border-[#E4DFF5] transition-colors duration-300 ${backgroundThemes[bgIndex].class}`}>
        <div className="w-full h-full flex items-center justify-center overflow-hidden">
          <img 
            alt={`${currentProduct.name} tryon comparison preview`} 
            className="w-full h-full object-cover select-none pointer-events-none"
            style={{
              transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
              transformOrigin: 'center center',
              transition: 'transform 0.3s ease-out'
            }}
            referrerPolicy="no-referrer"
            src={currentPreviewImg}
          />
        </div>
        
        {/* Holographic scanner camera corners */}
        <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-white/80 rounded-tl pointer-events-none"></div>
        <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-white/80 rounded-tr pointer-events-none"></div>
        <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-white/80 rounded-bl pointer-events-none"></div>
        <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-white/80 rounded-br pointer-events-none"></div>

        {/* Side Floating Camera Tools - fully functional Rotate, Zoom, Reset */}
        <div className="absolute left-3 top-1/2 -translate-y-1/2 flex flex-col gap-3 bg-white/90 backdrop-blur-xl p-1.5 rounded-2xl border border-[#E4DFF5] shadow-lg z-10">
          <button 
            type="button"
            onClick={handleRotate}
            title={`Rotate image (${rotation}°)`}
            aria-label="Rotate preview image"
            className={`w-9 h-9 flex flex-col items-center justify-center rounded-xl transition-all cursor-pointer ${
              rotation !== 0 ? 'bg-[#553BE2] text-white shadow-sm' : 'text-[#131426] hover:text-[#553BE2] hover:bg-[#F2EEFF]'
            }`}
          >
            <span className="material-symbols-outlined text-base">rotate_right</span>
            <span className="text-[7px] font-bold mt-0.5">{rotation !== 0 ? `${rotation}°` : 'Rotate'}</span>
          </button>
          <button 
            type="button"
            onClick={handleZoom}
            title={`Zoom image (${zoomLevel}x)`}
            aria-label="Zoom preview image"
            className={`w-9 h-9 flex flex-col items-center justify-center rounded-xl transition-all cursor-pointer ${
              zoomLevel !== 1 ? 'bg-[#553BE2] text-white shadow-sm' : 'text-[#131426] hover:text-[#553BE2] hover:bg-[#F2EEFF]'
            }`}
          >
            <span className="material-symbols-outlined text-base">zoom_in</span>
            <span className="text-[7px] font-bold mt-0.5">{zoomLevel !== 1 ? `${zoomLevel}x` : 'Zoom'}</span>
          </button>
          <button 
            type="button"
            onClick={handleReset}
            title="Reset rotation and zoom"
            aria-label="Reset adjustments"
            className="w-9 h-9 flex flex-col items-center justify-center rounded-xl text-[#131426] hover:text-[#553BE2] hover:bg-[#F2EEFF] transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">refresh</span>
            <span className="text-[7px] font-bold mt-0.5">Reset</span>
          </button>
        </div>

        {/* Background Toggle Banner */}
        <button 
          type="button"
          onClick={() => setBgIndex((prev) => (prev + 1) % backgroundThemes.length)}
          className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-xl px-3 py-1.5 rounded-full border border-[#E4DFF5] flex items-center gap-1 hover:bg-white transition-colors shadow-sm text-[10px] font-semibold text-[#131426] cursor-pointer z-10"
        >
          <span className="material-symbols-outlined text-sm leading-none">image</span>
          <span>{backgroundThemes[bgIndex].name}</span>
        </button>
      </section>

      {/* Mini Product Card details banner - Dynamic for the selected product */}
      <section className="glass-card rounded-3xl p-4 flex gap-4 items-center">
        <div className="w-16 h-20 rounded-xl bg-[#F2EEFF] overflow-hidden shrink-0 border border-[#E4DFF5] p-0.5">
          <img 
            alt={currentProduct.name} 
            className="w-full h-full object-cover rounded-lg"
            referrerPolicy="no-referrer"
            src={currentProduct.imageUrl || currentProduct.imageUrls?.[0] || 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500&h=600&q=80'}
          />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-bold text-[#131426] truncate">{currentProduct.name}</h4>
          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#F2EEFF] text-[#553BE2] inline-block mt-0.5 truncate max-w-full">
            {currentProduct.badge || currentProduct.category || 'Curated Style'}
          </span>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-sm font-extrabold text-[#553BE2]">
              ₹{Number(currentProduct.price || 0).toLocaleString('en-IN')}
            </span>
            <span className="text-[10px] text-[#5E667A] flex items-center font-semibold">
              <span className="material-symbols-outlined text-[11px] text-amber-500 mr-0.5 leading-none">star</span>
              {currentProduct.rating || 4.6} ({currentProduct.reviewsCount || 128})
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-1.5 shrink-0">
          <button 
            type="button"
            onClick={handleBuyNow}
            className="py-2 px-3 rounded-xl bg-[#553BE2] text-white text-xs font-bold flex items-center justify-center gap-1 hover:bg-[#4830cb] transition-colors shadow-sm cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm leading-none">shopping_cart</span>
            Buy Now
          </button>
          <button 
            type="button"
            onClick={handleAddToCartClick}
            className="py-1.5 px-3 rounded-xl border border-[#553BE2] text-[#553BE2] text-[11px] font-bold flex items-center justify-center gap-1 hover:bg-[#F2EEFF] transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-xs leading-none">add_shopping_cart</span>
            Add to Cart
          </button>
        </div>
      </section>

      {/* Review Section */}
      <section className="rounded-3xl bg-white p-4 shadow-sm border border-[#E4DFF5]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-[#131426]">{t('tryOnResult.reviewTitle')}</h3>
            <p className="text-[11px] text-[#5E667A]">{t('tryOnResult.reviewSubtitle')}</p>
          </div>
          <span className="text-xs font-semibold text-[#5E667A] truncate max-w-[120px]">{currentProduct.name}</span>
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
          maxLength={1000}
          className="w-full rounded-3xl border border-[#E4DFF5] bg-[#F2EEFF] px-4 py-3 text-sm text-[#131426] placeholder:text-[#5E667A] min-h-[110px] focus:outline-none focus:border-[#553BE2]"
          placeholder={t('tryOnResult.reviewPlaceholder')}
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
              await onSubmitReview(currentProduct.id, reviewRating, reviewText, 'tryon', selectedColor);
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
          className="mt-4 w-full rounded-2xl bg-[#553BE2] text-white py-3 text-sm font-semibold hover:opacity-95 transition-opacity cursor-pointer"
        >
          {isSubmittingReview ? t('tryOnResult.reviewSubmitting') : t('tryOnResult.reviewSubmit')}
        </button>
      </section>

      {/* Action Buttons footer bar */}
      <section className="flex gap-2.5 pt-2">
        <button 
          onClick={handleShare}
          className="flex-1 py-3 bg-[#F2EEFF] hover:bg-[#ECE7FF] text-[#553BE2] border border-[#E4DFF5] rounded-2xl font-bold flex items-center justify-center gap-1.5 text-xs transition-all shadow-sm active:scale-95 cursor-pointer"
        >
          <span className="material-symbols-outlined text-base">share</span>
          {t('tryOnResult.shareLook')}
        </button>
        <button 
          onClick={handleBuyNow}
          className="flex-1 py-3 rounded-2xl border border-[#E4DFF5] text-[#131426] bg-white hover:bg-[#F2EEFF] hover:shadow transition-all font-bold flex items-center justify-center gap-1.5 text-xs shadow-sm active:scale-95 cursor-pointer"
        >
          <span className="material-symbols-outlined text-base">info</span>
          Details
        </button>
        <button 
          onClick={() => onNavigate('ar-tryon')}
          className="flex-[1.4] py-3 rounded-2xl bg-[#553BE2] text-white font-bold flex items-center justify-center gap-1.5 text-xs shadow-lg shadow-[#553BE2]/25 hover:opacity-95 transition-opacity active:scale-95 cursor-pointer"
        >
          <span className="material-symbols-outlined text-base">sync</span>
          {t('tryOnResult.retake')}
        </button>
      </section>
    </div>
  );
};
