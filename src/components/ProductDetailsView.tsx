import React, { useState } from 'react';
import { CartItem, ProductVariant, ScreenId, ProductItem, ProductReview } from '../types';
import { Minus, Plus } from 'lucide-react';
import { findColorImages } from '../utils/productVariants';
import { getRequiredColorHex, isDarkColor, isLightColor, normalizeColorKey } from '../utils/colors';
import { analytics } from '../services/analyticsService';
import { useI18n } from '../i18n';

const normalizeColor = normalizeColorKey;

const findColorImage = (colorImages: Record<string, string | string[]> | undefined, color?: string) => {
  if (!colorImages || !color) return undefined;
  const exact = colorImages[color];
  if (exact) return exact;

  const normalizedColor = normalizeColor(color);
  const directNormalized = colorImages[normalizedColor];
  if (directNormalized) return directNormalized;

  const matchedKey = Object.keys(colorImages).find((key) => normalizeColor(key) === normalizedColor);
  return matchedKey ? colorImages[matchedKey] : undefined;
};

const getProductColors = (product: ProductItem) => (
  product.variants && product.variants.length > 0
    ? product.variants.map((variant) => variant.colorName || variant.color).filter(Boolean)
    : product.colors || ['Default']
);

const getVariantLabel = (variant?: ProductVariant) => variant?.colorName || variant?.color || 'Default';

interface ProductDetailsViewProps {
  products: Record<string, ProductItem>;
  databaseProducts?: ProductItem[];
  onNavigate: (screen: ScreenId) => void;
  onTryOnProduct?: (product: ProductItem) => void;
  onSelectProduct?: (product: ProductItem) => void;
  onAddToCart: (prodId: string, color: string, size: string) => void;
  onUpdateCartQuantity?: (prodId: string, color: string, size: string, delta: number) => void;
  cartItems?: CartItem[];
  selectedColor: string;
  setSelectedColor: (color: string) => void;
  wishlist?: string[];
  onToggleWishlist?: (productId: string) => void;
  selectedProductId?: string;
  isDarkMode?: boolean;
  reviews?: ProductReview[];
  averageRating?: number;
  reviewsCount?: number;
  reviewListenerError?: string | null;
  isFirebaseAuthenticated?: boolean;
  onSubmitReview?: (productId: string, rating: number, comment: string) => Promise<void>;
  currentUserName?: string;
  currentReviewerName?: string;
  activeUid?: string;
}

export const ProductDetailsView: React.FC<ProductDetailsViewProps> = ({
  products,
  databaseProducts = [],
  onNavigate,
  onTryOnProduct,
  onSelectProduct,
  onAddToCart,
  onUpdateCartQuantity,
  cartItems = [],
  selectedColor,
  setSelectedColor,
  wishlist = [],
  onToggleWishlist,
  selectedProductId,
  isDarkMode = false,
  reviews = [],
  averageRating,
  reviewsCount,
  reviewListenerError,
  isFirebaseAuthenticated = false,
  onSubmitReview,
  currentUserName,
  currentReviewerName
}) => {
  const { t } = useI18n();
  const fallbackProduct = Object.values(products)[0] || products['lavender-hoodie'];
  const mainProduct = selectedProductId 
    ? (products[selectedProductId] || Object.values(products).find((p) => p.id === selectedProductId || p.productId === selectedProductId) || fallbackProduct)
    : fallbackProduct;
  const [selectedSize, setSelectedSize] = useState('M');
  const [activeTab, setActiveTab] = useState<'details' | 'material' | 'reviews' | 'delivery'>('details');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [galleryIndex, setGalleryIndex] = useState<number>(0);
  const [heroImageLoaded, setHeroImageLoaded] = useState(false);
  const [imageRetryCount, setImageRetryCount] = useState(0);
  const [failedImageUrl, setFailedImageUrl] = useState('');
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [reviewComment, setReviewComment] = useState<string>('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewFeedback, setReviewFeedback] = useState<{ message: string; isError: boolean } | null>(null);

  const reviewStars = averageRating && averageRating > 0 ? averageRating : (mainProduct?.rating || 0);
  const reviewCountLabel = typeof reviewsCount === 'number' && reviewsCount > 0 ? reviewsCount : (mainProduct?.reviewsCount || (reviews ? reviews.length : 0));
  const variantColors = mainProduct ? getProductColors(mainProduct) : [];
  // Never fall back to the first variant: doing so makes every color selection
  // keep showing that variant's photo when a color label does not match exactly.
  const selectedVariant = mainProduct?.variants?.find((variant) => normalizeColor(getVariantLabel(variant)) === normalizeColor(selectedColor));
  const selectedVariantStock = selectedVariant?.stock;
  const currentStock = selectedVariantStock ?? mainProduct?.stockLeft;
  const currentInStock = selectedVariant?.isAvailable ?? (currentStock !== undefined ? currentStock > 0 : (mainProduct?.inStock ?? true));
  const currentSku = selectedVariant?.sku;

  const formatReviewDate = (createdAt: any) => {
    if (!createdAt) return 'Unknown date';
    if (createdAt.toDate) return createdAt.toDate().toLocaleDateString();
    if (typeof createdAt === 'number') return new Date(createdAt).toLocaleDateString();
    if (typeof createdAt === 'object' && typeof createdAt.seconds === 'number') return new Date(createdAt.seconds * 1000).toLocaleDateString();
    return String(createdAt);
  };

  const handleReviewSubmit = async () => {
    if (!mainProduct || !onSubmitReview || isSubmittingReview) return;
    if (reviewRating < 1 || reviewRating > 5 || !reviewComment.trim()) {
      setReviewFeedback({ message: 'Please provide a rating and comment.', isError: true });
      return;
    }
    setIsSubmittingReview(true);
    setReviewFeedback(null);
    try {
      await onSubmitReview(mainProduct.id, reviewRating, reviewComment.trim());
      setReviewComment('');
      setReviewRating(5);
      setReviewFeedback({ message: 'Review saved and published.', isError: false });
    } catch (error) {
      setReviewFeedback({
        message: error instanceof Error ? error.message : 'Could not save your review.',
        isError: true
      });
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // Set default color to first color when product changes
  React.useEffect(() => {
    if (variantColors.length > 0) {
      if (!selectedColor || !variantColors.some((color) => normalizeColor(color) === normalizeColor(selectedColor))) {
        setSelectedColor(variantColors[0]);
      }
    }
    setGalleryIndex(0);
  }, [selectedProductId, variantColors.join('|')]);

  React.useEffect(() => {
    setGalleryIndex(0);
  }, [selectedColor]);

  React.useEffect(() => {
    setHeroImageLoaded(false);
  }, [selectedColor, galleryIndex]);

  // Track product view in analytics
  React.useEffect(() => {
    if (mainProduct && mainProduct.id) {
      analytics.trackProductView(mainProduct, 'product_details');
    }
  }, [mainProduct?.id]);

  // Get the correct image URL or gallery for the selected color
  const getSelectedColorImages = () => {
    if (!mainProduct) return [] as string[];

    // The normalized color map is the authoritative selected-color mapping.
    // Prefer it over a default/legacy variant object to avoid showing that
    // variant's photo for a different selected color.
    const mappedColorImages = findColorImages(mainProduct.colorImages, selectedColor);
    if (mappedColorImages.length > 0) return mappedColorImages;

    if (selectedVariant) {
      const variantImages = selectedVariant.images.filter(Boolean);
      if (variantImages.length > 0) return variantImages;
      if (selectedVariant.thumbnail) return [selectedVariant.thumbnail];
    }

    const colorImage = findColorImage(mainProduct.colorImages, selectedColor);
    if (colorImage) {
      return Array.isArray(colorImage) ? colorImage.filter(Boolean) : [colorImage].filter(Boolean);
    }

    return variantColors.length <= 1 && (mainProduct.mainImage || mainProduct.imageUrl)
      ? [mainProduct.mainImage || mainProduct.imageUrl]
      : [];
  };

  const candidateColorImages = getSelectedColorImages();
  const sharedVariantImages = new Set<string>();
  (mainProduct.variants || []).forEach((variant) => {
    if (normalizeColor(variant.colorName || variant.color) === normalizeColor(selectedColor)) return;
    (variant.images || []).forEach((image) => sharedVariantImages.add(image));
    if (variant.thumbnail) sharedVariantImages.add(variant.thumbnail);
  });
  // Some legacy records assign the same default photo to every color. Never
  // present that shared photo as if it were a verified color-specific image.
  const isDefaultVariant = Boolean(selectedVariant && mainProduct.defaultVariantId === selectedVariant.id);
  const selectedColorImages = isDefaultVariant
    ? candidateColorImages
    : candidateColorImages.filter((image) => !sharedVariantImages.has(image));
  const heroImageUrl = selectedColorImages[galleryIndex] || selectedColorImages[0] || '';

  React.useEffect(() => {
    setHeroImageLoaded(false);
    setImageRetryCount(0);
    setFailedImageUrl('');
  }, [heroImageUrl]);

  const handleLaunchAr = () => {
    if (mainProduct) {
      analytics.trackArTryOnStarted(mainProduct.id, mainProduct.name, 'product_details');
      if (onTryOnProduct) {
        onTryOnProduct(mainProduct);
        return;
      }
    }
    onNavigate('ar-tryon');
  };

  const handleAddToCart = (prodId: string, color: string, size: string) => {
    onAddToCart(prodId, color, size);
    const productName = products[prodId]?.name || mainProduct?.name || 'Product';
    setToastMessage(`✓ Added 1x ${productName} (${color}, Size ${size}) to Cart!`);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const matchingCartItem = cartItems.find((item) => {
    const itemProdId = item.product.id || item.product.productId;
    const targetProdId = mainProduct?.id || mainProduct?.productId || selectedProductId;
    const isSameProduct =
      itemProdId === targetProdId ||
      item.product.id === selectedProductId ||
      item.product.productId === selectedProductId;
    const isSameColor = normalizeColor(item.color) === normalizeColor(selectedColor);
    const isSameSize = item.size === selectedSize;
    return isSameProduct && isSameColor && isSameSize;
  });
  const currentCartQuantity = matchingCartItem ? matchingCartItem.quantity : 0;

  const handleIncrement = () => {
    if (currentStock !== undefined && currentCartQuantity >= currentStock) {
      setToastMessage(`Only ${currentStock} item(s) available in stock.`);
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }
    if (onUpdateCartQuantity) {
      onUpdateCartQuantity(mainProduct.id, selectedColor, selectedSize, 1);
    } else {
      onAddToCart(mainProduct.id, selectedColor, selectedSize);
    }
  };

  const handleDecrement = () => {
    if (onUpdateCartQuantity) {
      onUpdateCartQuantity(mainProduct.id, selectedColor, selectedSize, -1);
    }
  };

  const completeLookItems = React.useMemo(() => databaseProducts.filter((product) =>
    product.id !== mainProduct?.id &&
    product.imageUrl?.trim() &&
    product.name?.trim() &&
    Number(product.price) > 0
  ).slice(0, 8), [databaseProducts, mainProduct?.id]);

  // Track Complete the Look items impression
  React.useEffect(() => {
    completeLookItems.forEach((product) => {
      analytics.trackProductImpression(product, 'product_details_complete_look');
    });
  }, [completeLookItems, mainProduct?.id]);

  if (!mainProduct) {
    return (
      <div className={`p-8 text-center space-y-4 ${isDarkMode ? 'text-white' : 'text-[#131426]'}`}>
        <h2 className="text-xl font-bold">Product Not Found</h2>
        <p className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-[#5E667A]'}`}>The requested product could not be found or loaded.</p>
        <button
          onClick={() => onNavigate('showroom')}
          className="px-6 py-2.5 rounded-xl bg-[#553BE2] text-white text-xs font-bold shadow-md hover:bg-[#4830cb] transition-colors"
        >
          Back to Showroom
        </button>
      </div>
    );
  }

  return (
    <div className="-mx-4 space-y-6">
      {/* Toast Alert floating block */}
      {toastMessage && (
        <div className="fixed top-20 inset-x-4 z-50 bg-[#131426]/95 backdrop-blur-md text-white text-xs font-bold text-center px-4 py-3 rounded-xl shadow-lg border border-[#553BE2]/30 animate-scale-up">
          {toastMessage}
        </div>
      )}

      {/* Large Product Hero Image display card */}
      <section className={`relative w-full h-[380px] flex items-center justify-center overflow-hidden rounded-b-3xl border-b ${
        isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-[#ECE7FF] border-[#E4DFF5]'
      }`}>
        {!heroImageUrl || failedImageUrl === heroImageUrl ? (
          <div className={`absolute inset-0 flex flex-col items-center justify-center gap-3 ${isDarkMode ? 'bg-slate-900 text-slate-300' : 'bg-[#ECE7FF] text-[#5E667A]'}`}>
            <span className="h-14 w-14 rounded-full border-4 border-white shadow-lg" style={{ backgroundColor: getRequiredColorHex(selectedColor) }} />
            <span className="text-sm font-semibold">Photo unavailable for {selectedColor}</span>
          </div>
        ) : <img
          key={`${selectedProductId}-${selectedColor}-${galleryIndex}-${imageRetryCount}-${heroImageUrl}`}
          alt={`${mainProduct.name} in ${getVariantLabel(selectedVariant) || selectedColor}`}
          className={`w-full h-full object-cover object-center absolute inset-0 cursor-pointer transition-opacity duration-200 ${heroImageLoaded ? 'opacity-100' : 'opacity-0'}`}
          referrerPolicy="no-referrer"
          loading="eager"
          decoding="async"
          fetchPriority="high"
          src={heroImageUrl}
          onLoad={() => setHeroImageLoaded(true)}
          onError={(event) => {
            const nextGalleryIndex = selectedColorImages.findIndex((image, index) => index > galleryIndex && image !== heroImageUrl);
            if (nextGalleryIndex >= 0) {
              setGalleryIndex(nextGalleryIndex);
              return;
            }
            setHeroImageLoaded(false);
            if (imageRetryCount === 0) {
              setImageRetryCount(1);
            } else {
              setFailedImageUrl(heroImageUrl);
            }
          }}
          onClick={() => {
            if (selectedColorImages.length <= 1) return;
            setGalleryIndex((p) => (p + 1) % selectedColorImages.length);
          }}
        />}
        {/* badges inside hero */}
        <div className="absolute top-4 left-4 flex items-center gap-2 z-10">
          <button 
            type="button"
            onClick={() => onNavigate('showroom')}
            className="bg-white/90 backdrop-blur-md p-2 rounded-full text-[#131426] hover:bg-white shadow-sm flex items-center justify-center border border-[#E4DFF5] active:scale-95 transition-all cursor-pointer"
            title="Back to Showroom"
          >
            <span className="material-symbols-outlined text-base leading-none">arrow_back</span>
          </button>
          <span className="bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-extrabold text-[#553BE2] flex items-center gap-1 shadow-sm uppercase tracking-wider border border-[#E4DFF5]">
            <span className="material-symbols-outlined text-xs leading-none text-red-500">local_fire_department</span> Top Pick
          </span>
        </div>

        {/* 360 view indicator */}
        <div className="absolute top-4 right-4 flex flex-col gap-3">
          <button className="bg-white/90 backdrop-blur-md p-2 rounded-full text-[#553BE2] hover:bg-white shadow-sm flex items-center justify-center border border-[#E4DFF5]">
            <span className="material-symbols-outlined text-base leading-none">360</span>
          </button>
        </div>

        {/* Pagination Dots indicator */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 bg-black/20 backdrop-blur px-2.5 py-1.5 rounded-full">
          {selectedColorImages.length > 0 ? (
            selectedColorImages.map((_, i) => (
              <button
                key={i}
                onClick={() => setGalleryIndex(i)}
                className={`w-2.5 h-2.5 rounded-full transition-all ${galleryIndex === i ? 'bg-[#553BE2] scale-110' : 'bg-white/50'}`}
                aria-label={`Image ${i + 1}`}
              />
            ))
          ) : (
            <button
              className="w-2.5 h-2.5 rounded-full bg-white/50"
              aria-label="Image 1"
            />
          )}
        </div>
      </section>

      <section className="px-4 relative z-10 -mt-6">
        <div className={`rounded-3xl p-5 shadow-md ${isDarkMode ? 'bg-slate-900/95 border border-slate-800' : 'glass-card'}`}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="rounded-full bg-[#F2EEFF] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#553BE2]">
                  {mainProduct.category}
                </span>
                {mainProduct.vendorName && (
                  <span className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-[#5E667A]'}`}>
                    by <span className={`font-semibold ${isDarkMode ? 'text-slate-200' : 'text-[#131426]'}`}>{mainProduct.vendorName}</span>
                  </span>
                )}
              </div>
              <h1 className={`break-words text-xl font-bold leading-snug tracking-tight sm:text-2xl ${isDarkMode ? 'text-white' : 'text-[#131426]'}`}>
                {mainProduct.name}
              </h1>
              <div className={`mt-2 flex flex-wrap items-center gap-x-2 text-xs ${isDarkMode ? 'text-slate-300' : 'text-[#5E667A]'}`}>
                <span className="inline-flex items-center gap-1 font-semibold">
                  <span className="material-symbols-outlined text-sm leading-none text-amber-500" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                  {reviewStars}
                </span>
                <span aria-hidden="true" className="text-slate-400">·</span>
                <span>{reviewCountLabel} reviews</span>
              </div>
            </div>
            <button
              type="button"
              aria-label={wishlist.includes(mainProduct.id) ? 'Remove from saved items' : 'Add to saved items'}
              aria-pressed={wishlist.includes(mainProduct.id)}
              onClick={() => {
                if (onToggleWishlist) {
                  onToggleWishlist(mainProduct.id);
                  const isSaved = wishlist.includes(mainProduct.id);
                  setToastMessage(isSaved ? `Removed ${mainProduct.name} from Saved Items` : `✓ Saved ${mainProduct.name} to Saved Items!`);
                  setTimeout(() => setToastMessage(null), 2500);
                }
              }}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-all active:scale-95 ${
                wishlist.includes(mainProduct.id)
                  ? 'border-[#553BE2]/30 bg-[#F2EEFF] text-[#553BE2]'
                  : isDarkMode
                    ? 'border-slate-700 bg-slate-800 text-slate-300 hover:border-indigo-500'
                    : 'border-[#E4DFF5] bg-white text-[#8E96AA] hover:border-[#553BE2]/40 hover:text-[#553BE2]'
              }`}
            >
              <span className="material-symbols-outlined text-lg leading-none" style={{ fontVariationSettings: wishlist.includes(mainProduct.id) ? "'FILL' 1" : undefined }}>
                {wishlist.includes(mainProduct.id) ? 'favorite' : 'favorite_border'}
              </span>
            </button>
          </div>

          <div className={`my-4 flex items-end justify-between gap-3 border-y py-3 ${isDarkMode ? 'border-slate-800' : 'border-[#E4DFF5]'}`}>
            <div>
              <div className="text-2xl font-extrabold leading-none text-[#553BE2]">₹{mainProduct.price}</div>
              <div className={`mt-1.5 text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-[#5E667A]'}`}>Inclusive of all taxes</div>
            </div>
            <span className={`mb-0.5 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              currentInStock
                ? isDarkMode ? 'bg-emerald-950/60 text-emerald-300' : 'bg-emerald-50 text-emerald-700'
                : isDarkMode ? 'bg-rose-950/60 text-rose-300' : 'bg-rose-50 text-rose-700'
            }`}>
              <span className="material-symbols-outlined text-sm leading-none">{currentInStock ? 'check_circle' : 'cancel'}</span>
              {currentInStock ? t('productDetails.inStock') : t('productDetails.outOfStock')}
            </span>
          </div>

          <div className="space-y-5">
            <div>
              <div className={`mb-2 flex flex-wrap items-baseline gap-x-2 text-sm font-semibold ${isDarkMode ? 'text-slate-200' : 'text-[#131426]'}`}>
                <span>{t('productDetails.color')}</span>
                <span className={`text-xs font-normal ${isDarkMode ? 'text-slate-400' : 'text-[#5E667A]'}`}>
                  {selectedVariant ? getVariantLabel(selectedVariant) : selectedColor || 'Default'}
                </span>
              </div>
              <div className="flex flex-wrap gap-3">
                {(mainProduct.variants && mainProduct.variants.length > 0 ? mainProduct.variants : variantColors.map((colorName, index) => ({
                  id: colorName,
                  colorName,
                  colorHex: getRequiredColorHex(colorName),
                  images: [],
                  thumbnail: '',
                  isAvailable: true,
                  displayOrder: index,
                  color: colorName
                }))).map((variant) => {
                  const colorName = getVariantLabel(variant);
                  const isActive = normalizeColor(selectedColor) === normalizeColor(colorName);
                  const colorHex = variant.colorHex || getRequiredColorHex(colorName);
                  return (
                    <button
                      key={variant.id || colorName}
                      type="button"
                      onClick={() => setSelectedColor(colorName)}
                      title={colorName}
                      aria-label={`Color: ${colorName}`}
                      aria-pressed={isActive}
                      className={`h-8 w-8 rounded-full border transition-all ${
                        isActive ? 'ring-2 ring-[#553BE2] ring-offset-2 shadow-[0_0_14px_rgba(85,59,226,0.25)]' : 'opacity-75 hover:opacity-100'
                      } ${isDarkMode ? 'ring-offset-slate-900' : 'ring-offset-white'} ${isLightColor(colorHex) ? 'border-[#E4DFF5]' : 'border-white/40'} ${isDarkColor(colorHex) ? 'shadow-md shadow-slate-950/25' : ''}`}
                      style={{ backgroundColor: colorHex }}
                    />
                  );
                })}
              </div>
            </div>

            <div>
              <div className={`mb-2 flex items-center justify-between gap-3 text-sm font-semibold ${isDarkMode ? 'text-slate-200' : 'text-[#131426]'}`}>
                <span>{t('productDetails.chooseSize')}</span>
                <button
                  type="button"
                  onClick={() => alert(t('productDetails.sizeGuideAlert'))}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#553BE2] hover:underline"
                >
                  <span className="material-symbols-outlined text-sm leading-none">straighten</span>
                  {t('productDetails.sizeGuide')}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {mainProduct.sizes.map((sz) => {
                  const isActive = selectedSize === sz;
                  return (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => setSelectedSize(sz)}
                      aria-pressed={isActive}
                      className={`min-w-11 rounded-xl border px-3 py-2.5 text-xs font-semibold transition-all ${
                        isActive
                          ? isDarkMode
                            ? 'border-indigo-400 bg-indigo-950/50 text-indigo-300'
                            : 'border-[#553BE2] bg-[#F2EEFF] text-[#553BE2]'
                          : isDarkMode
                            ? 'border-slate-700 text-slate-300 hover:border-indigo-700'
                            : 'border-[#E4DFF5] text-[#5E667A] hover:border-[#553BE2]/50'
                      }`}
                    >
                      {sz}
                    </button>
                  );
                })}
              </div>
              <div className={`mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-[#5E667A]'}`}>
                {currentStock !== undefined && currentInStock && (
                  <span className="font-medium text-amber-600">{t('productDetails.onlyLeft', { count: currentStock })}</span>
                )}
                {currentSku && <span className="uppercase tracking-wide">{t('productDetails.sku', { sku: currentSku })}</span>}
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={handleLaunchAr}
              className={`flex min-w-0 h-12 items-center justify-center gap-1.5 rounded-2xl border text-xs font-bold transition-all active:scale-[0.98] cursor-pointer ${
                isDarkMode
                  ? 'border-indigo-500/60 bg-indigo-950/30 text-indigo-300 hover:bg-indigo-950/60'
                  : 'border-[#553BE2] bg-white text-[#553BE2] hover:bg-[#F2EEFF]'
              }`}
            >
              <span className="material-symbols-outlined text-base">view_in_ar</span>
              <span className="truncate">{t('productDetails.tryOn')}</span>
            </button>

            {currentCartQuantity > 0 ? (
              <div
                className="flex min-w-0 h-12 items-center justify-between rounded-2xl bg-[#553BE2] px-2 shadow-md shadow-[#553BE2]/25 transition-all"
                role="group"
                aria-label={t('productDetails.quantitySelector')}
              >
                <button
                  type="button"
                  onClick={handleDecrement}
                  aria-label={t('productDetails.decreaseQuantity')}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-black/20 text-white transition-all hover:bg-black/35 active:scale-95 cursor-pointer shrink-0"
                >
                  <Minus className="h-4 w-4 stroke-[2.5]" />
                </button>

                <span className="h-5 w-[1px] bg-white/20 shrink-0 mx-1" aria-hidden="true" />

                <span
                  className="flex-1 text-center text-sm font-black text-white tabular-nums select-none tracking-wide px-1"
                  aria-live="polite"
                >
                  {currentCartQuantity}
                </span>

                <span className="h-5 w-[1px] bg-white/20 shrink-0 mx-1" aria-hidden="true" />

                <button
                  type="button"
                  onClick={handleIncrement}
                  aria-label={t('productDetails.increaseQuantity')}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-black/20 text-white transition-all hover:bg-black/35 active:scale-95 cursor-pointer shrink-0"
                >
                  <Plus className="h-4 w-4 stroke-[2.5]" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => handleAddToCart(mainProduct.id, selectedColor, selectedSize)}
                disabled={!currentInStock}
                className={`flex min-w-0 h-12 items-center justify-center gap-1.5 rounded-2xl text-xs font-bold transition-all ${
                  !currentInStock
                    ? 'bg-slate-400/50 text-slate-200 cursor-not-allowed'
                    : 'bg-[#553BE2] text-white shadow-md shadow-[#553BE2]/20 hover:bg-[#462CC9] active:scale-[0.98] cursor-pointer'
                }`}
              >
                <span className="material-symbols-outlined text-base">shopping_bag</span>
                <span className="truncate">
                  {!currentInStock ? t('productDetails.outOfStock') : t('productDetails.addToCart')}
                </span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Tab components descriptions */}
      <section className="px-4">
        <div className={`rounded-2xl p-1.5 ${isDarkMode ? 'bg-slate-900/90 border border-slate-800' : 'glass-card'}`}>
          <div className={`flex overflow-x-auto hide-scrollbar border-b ${isDarkMode ? 'border-slate-800' : 'border-[#E4DFF5]'}`}>
            {[
              { id: 'details', label: 'Details' },
              { id: 'material', label: 'Material & Care' },
              { id: 'reviews', label: `Reviews (${reviewCountLabel})` },
              { id: 'delivery', label: 'Shipping' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 min-w-[80px] py-2 text-center text-xs font-bold border-b-2 leading-loose transition-all whitespace-nowrap px-2 ${
                  activeTab === tab.id 
                    ? 'border-[#553BE2] text-[#553BE2] font-extrabold' 
                    : 'border-transparent text-[#5E667A] hover:text-[#131426]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab contents block switcher */}
          <div className={`p-3 text-xs leading-relaxed min-h-[140px] ${isDarkMode ? 'text-slate-300' : 'text-[#5E667A]'}`}>
            {activeTab === 'details' && (
              <div className="space-y-3 animate-fade-in">
                <p>{mainProduct.description || t('productDetails.defaultDesc')}</p>
                {mainProduct.details && mainProduct.details.length > 0 ? (
                  <ul className={`grid grid-cols-2 gap-y-1.5 font-semibold pl-1 ${isDarkMode ? 'text-slate-200' : 'text-[#131426]'}`}>
                    {mainProduct.details.map((detail, idx) => (
                      <li key={idx} className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[#553BE2] text-sm">check_circle</span> {detail}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <ul className={`grid grid-cols-2 gap-y-1.5 font-semibold pl-1 ${isDarkMode ? 'text-slate-200' : 'text-[#131426]'}`}>
                    <li className="flex items-center gap-1.5"><span className="material-symbols-outlined text-[#553BE2] text-sm">check_circle</span> {t('productDetails.fabricBlend')}</li>
                    <li className="flex items-center gap-1.5"><span className="material-symbols-outlined text-[#553BE2] text-sm">check_circle</span> {t('productDetails.relaxedFit')}</li>
                    <li className="flex items-center gap-1.5"><span className="material-symbols-outlined text-[#553BE2] text-sm">check_circle</span> {t('productDetails.reinforcedStitching')}</li>
                    <li className="flex items-center gap-1.5"><span className="material-symbols-outlined text-[#553BE2] text-sm">check_circle</span> {t('productDetails.signatureHardware')}</li>
                  </ul>
                )}
              </div>
            )}
            {activeTab === 'material' && (
              <p className="space-y-1 animate-fade-in">
                <strong>Body:</strong> 85% Organic Peruvian Cotton, 15% Premium Lyocell.<br /><br />
                <strong>Washing:</strong> Machine wash cold, cycle inside-out. Avoid chlorine bleaching. Air dry flat, warm iron where necessary.
              </p>
            )}
            {activeTab === 'reviews' && (
              <div className="space-y-4 animate-fade-in">
                {reviewListenerError && (
                  <div className="rounded-xl p-3 text-sm text-red-700 bg-red-50 border border-red-100">
                    {reviewListenerError}
                  </div>
                )}
                <div className={`rounded-3xl border p-4 ${isDarkMode ? 'border-slate-800 bg-slate-800/50' : 'border-[#E4DFF5] bg-[#F2EEFF]'}`}>
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-[#131426]'}`}>{t('productDetails.reviewsTitle')}</div>
                        <div className="text-[11px] text-[#5E667A]">
                          {currentUserName ? t('productDetails.signedInAs', { name: currentUserName }) : t('productDetails.writeReviewPrompt')}
                        </div>
                      </div>
                      <div className="text-xs font-semibold text-[#5E667A]">{t('productDetails.reviewsCountRating', { count: reviewCountLabel, rating: reviewStars })}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, index) => {
                        const starValue = index + 1;
                        return (
                          <button
                            key={starValue}
                            type="button"
                            onClick={() => setReviewRating(starValue)}
                            className={`material-symbols-outlined text-lg ${reviewRating >= starValue ? 'text-amber-500' : 'text-[#8E96AA]'}`}
                          >
                            star
                          </button>
                        );
                      })}
                    </div>
                    <textarea
                      value={reviewComment}
                      onChange={(event) => setReviewComment(event.target.value)}
                      placeholder={t('productDetails.reviewPlaceholder')}
                      className={`w-full min-h-[100px] rounded-2xl border p-3 text-xs focus:border-[#553BE2] focus:outline-none focus:ring-2 focus:ring-[#F2EEFF] ${
                        isDarkMode ? 'border-slate-700 bg-slate-900 text-slate-200' : 'border-[#E4DFF5] bg-white text-[#131426]'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={handleReviewSubmit}
                      disabled={isSubmittingReview}
                      className="w-full rounded-2xl bg-[#553BE2] py-3 text-xs font-bold text-white hover:opacity-95 transition-opacity"
                    >
                      {isSubmittingReview ? t('productDetails.submittingReview') : t('productDetails.submitReview')}
                    </button>
                    {!isFirebaseAuthenticated && (
                      <p className="text-xs text-amber-700" role="status">
                        Secure sign-in is required to publish reviews. Sign out, then sign in again and verify your email.
                      </p>
                    )}
                    {reviewFeedback && (
                      <p
                        className={`text-xs ${reviewFeedback.isError ? 'text-red-600' : 'text-emerald-700'}`}
                        role={reviewFeedback.isError ? 'alert' : 'status'}
                      >
                        {reviewFeedback.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  {reviews && reviews.length > 0 ? (
                    reviews.map((review) => (
                      <div key={review.id} className={`rounded-3xl border p-4 shadow-sm ${isDarkMode ? 'border-slate-800 bg-slate-800/50' : 'border-[#E4DFF5] bg-white'}`}>
                        <div className="flex items-center justify-between gap-2">
                          <div className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-[#131426]'}`}>{review.userName || review.reviewer || 'Verified Buyer'}</div>
                          <div className="text-amber-500 text-sm">
                            {Array.from({ length: 5 }).map((_, index) => (
                              <span key={index}>{index < review.rating ? '★' : '☆'}</span>
                            ))}
                          </div>
                        </div>
                        <div className="text-[11px] text-[#5E667A] mb-2">{formatReviewDate(review.createdAt || review.date)}</div>
                        <p className={`text-[12px] leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-[#131426]'}`}>{review.comment || review.text}</p>
                      </div>
                    ))
                  ) : (
                    <div className={`rounded-3xl border p-6 text-center space-y-2 ${isDarkMode ? 'border-slate-800 bg-slate-800/50' : 'border-[#E4DFF5] bg-[#F2EEFF]'}`}>
                      <span className="material-symbols-outlined text-3xl text-[#553BE2]/60">rate_review</span>
                      <h4 className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-[#131426]'}`}>
                        {reviewCountLabel > 0 ? 'Written reviews unavailable' : 'No reviews yet'}
                      </h4>
                      <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-[#5E667A]'}`}>
                        {reviewCountLabel > 0
                          ? `${reviewCountLabel} ratings are recorded, but their written review details are not available.`
                          : t('productDetails.emptyReviews')}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
            {activeTab === 'delivery' && (
              <p className="animate-fade-in">
                ✓ Free standard cargo tracking delivery on all pre-paid carts above ₹999.<br /><br />
                ✓ Express shipping options available dynamically. Easy self-service claims and returns permitted within 7 business days from target delivery.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Complete The Look accessories suggestions list - only show if there are valid items */}
      <section className="px-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className={`text-base font-bold ${isDarkMode ? 'text-white' : 'text-[#131426]'}`}>Complete the Look</h2>
            <button 
              onClick={() => onNavigate('showroom')}
              className="text-xs font-semibold text-[#553BE2] flex items-center hover:underline"
            >
              Explore All <span className="material-symbols-outlined text-sm ml-0.5">chevron_right</span>
            </button>
          </div>
          
          {completeLookItems.length > 0 ? (
            <div className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar">
              {completeLookItems.map((product) => (
                <div
                  key={product.id}
                  onClick={() => onSelectProduct?.(product)}
                  className="min-w-[130px] glass-card rounded-2xl p-2.5 relative cursor-pointer border border-transparent hover:border-[#E4DFF5] transition-colors"
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onToggleWishlist) {
                        onToggleWishlist(product.id);
                        const isSaved = wishlist.includes(product.id);
                        setToastMessage(isSaved ? `Removed ${product.name} from Saved Items` : `✓ Saved ${product.name} to Saved Items!`);
                        setTimeout(() => setToastMessage(null), 2500);
                      }
                    }}
                    className={`absolute top-3.5 right-3.5 z-10 rounded-full p-1.5 shadow-md flex items-center justify-center transition-all cursor-pointer ${
                      wishlist.includes(product.id)
                        ? 'bg-red-50 text-red-600 border border-red-100'
                        : 'text-[#5E667A] bg-white/90 hover:bg-white hover:text-red-500'
                    }`}
                  >
                    <span className="material-symbols-outlined text-xs leading-none" style={{ fontVariationSettings: wishlist.includes(product.id) ? "'FILL' 1" : undefined }}>
                      {wishlist.includes(product.id) ? 'favorite' : 'favorite_border'}
                    </span>
                  </button>
                  <div className="h-32 rounded-xl bg-[#F2EEFF] mb-2 overflow-hidden flex items-center justify-center">
                    <img
                      alt={product.name}
                      className="w-full h-full object-cover mix-blend-multiply"
                      referrerPolicy="no-referrer"
                      src={product.imageUrl}
                    />
                  </div>
                  <div className="text-[11px] font-bold text-[#131426] truncate">{product.name}</div>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-xs font-extrabold text-[#553BE2]">₹{Number(product.price).toLocaleString('en-IN')}</span>
                    <span className="text-[9px] font-bold text-[#5E667A] flex items-center">
                      <span className="material-symbols-outlined text-[10px] text-amber-500 mr-0.5">star</span>
                      {Number(product.rating || 0).toFixed(1)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-[#5E667A]'}`}>
              No other database products are available right now.
            </p>
          )}
      </section>
    </div>
  );
};
