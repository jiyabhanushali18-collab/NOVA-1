import React, { memo, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { collection, limit, onSnapshot, query, where } from 'firebase/firestore';
import { auth, db, firebaseProjectId, waitForFirebaseAuthReady } from '../firebase';
import { ProductItem, ProductReview, ScreenId, VendorItem } from '../types';
import { normalizeProductVariants } from '../utils/productVariants';
import { analytics } from '../services/analyticsService';
import { useI18n } from '../i18n';

interface ShowroomViewProps {
  products: ProductItem[];
  databaseProducts?: ProductItem[];
  loading?: boolean;
  error?: string | null;
  onNavigate: (screen: ScreenId) => void;
  wishlist?: string[];
  onToggleWishlist?: (productId: string) => void;
  onSelectProduct?: (productId: string, product?: ProductItem) => void;
  cartItemsCount?: number;
  isDarkMode?: boolean;
  productReviews?: Record<string, ProductReview[]>;
}

type ProductCardVariant = 'carousel' | 'grid';
type ProductSortOption = 'recommended' | 'price-low-high' | 'price-high-low' | 'rating';

const ALL_VENDORS = 'all';
const VENDOR_STORAGE_KEY = 'nova_showroom_selected_vendor';
let cachedVendors: VendorItem[] | null = null;

const fallbackImage = 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80';

const getFirebaseErrorCode = (error: unknown) => error && typeof error === 'object' && 'code' in error ? String((error as { code?: unknown }).code) : undefined;
const getFirebaseErrorMessage = (error: unknown) => error && typeof error === 'object' && 'message' in error ? String((error as { message?: unknown }).message) : undefined;

const getFirebaseDebugContext = (collectionName: string, queryDescription: string) => ({
  collectionName,
  query: queryDescription,
  firebaseProjectId,
  currentUser: auth.currentUser ? {
    uid: auth.currentUser.uid,
    isAnonymous: auth.currentUser.isAnonymous
  } : null
});

const logFirebaseProductFetchError = (error: unknown, collectionName: string, queryDescription: string) => {
  console.error(
    'Firebase Product Fetch Error:',
    error,
    getFirebaseErrorCode(error),
    getFirebaseErrorMessage(error),
    getFirebaseDebugContext(collectionName, queryDescription)
  );
};

const asStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }
  if (typeof value === 'string' && value.trim()) {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [];
};

const getStringValue = (value: unknown): string | undefined => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const candidate = record.imageUrl || record.url || record.src || record.image;
  return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : undefined;
};

const getInitials = (name: string) => {
  const words = name.trim().split(/\s+/).slice(0, 2);
  return words.map((word) => word[0]?.toUpperCase()).join('') || 'NV';
};

const formatPrice = (price: number) => `₹${Number(price || 0).toLocaleString('en-IN')}`;

const getTimestampMs = (value: any) => {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return new Date(value).getTime() || 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  return 0;
};

const getProductImageVersion = (data: Record<string, any>) => (
  getTimestampMs(data.imageUpdatedAt)
  || getTimestampMs(data.updatedAt)
  || getTimestampMs(data.modifiedAt)
  || getTimestampMs(data.createdAt)
  || Number(data.version || 0)
);

const withImageVersion = (url: string, version: number) => {
  if (!url || !version || url.startsWith('data:') || url.startsWith('blob:')) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${encodeURIComponent(String(version))}`;
};

const isValidProduct = (product: ProductItem): boolean => {
  // Filter out products without proper names
  if (!product.name || product.name === 'Unnamed Product' || product.name.trim() === '') {
    return false;
  }
  // Filter out products without proper prices
  if (!product.price || Number(product.price) === 0) {
    return false;
  }
  // Filter out products using only fallback image
  if (product.imageUrl === fallbackImage) {
    return false;
  }
  return true;
};

const normalizeProduct = (id: string, data: Record<string, any>, vendorsById: Record<string, VendorItem>): ProductItem => {
  const imageVersion = getProductImageVersion(data);
  const images = [
    ...asStringArray(data.images),
    ...asStringArray(data.imageUrls)
  ]
    .map((value) => withImageVersion(value, imageVersion))
    .filter((value, index, array) => value && array.indexOf(value) === index);
  const vendorId = data.vendorId ? String(data.vendorId) : undefined;
  const vendor = vendorId ? vendorsById[vendorId] : undefined;
  const stock = data.stock !== undefined ? Number(data.stock) : undefined;
  const colors = Array.isArray(data.colors) ? data.colors.map(String).filter(Boolean) : ['Standard'];
  const variants = normalizeProductVariants(data, colors).map((variant) => ({
    ...variant,
    images: variant.images.map((image) => withImageVersion(image, imageVersion)),
    thumbnail: withImageVersion(variant.thumbnail, imageVersion)
  }));
  const allImages = [
    ...images,
    ...variants.flatMap((variant) => variant.images || [])
  ].filter((value, index, array) => value && array.indexOf(value) === index);
  const imageUrl = withImageVersion(getStringValue(data.mainImage) || getStringValue(data.imageUrl) || getStringValue(data.image) || variants[0]?.images?.[0] || allImages[0] || fallbackImage, imageVersion);

  return {
    id,
    productId: String(data.productId || id),
    vendorId,
    vendorName: getStringValue(data.vendorName) || getStringValue(data.companyName) || getStringValue(data.storeName) || vendor?.vendorName || 'NOVA Vendor',
    vendorLogoUrl: getStringValue(data.vendorLogoUrl) || getStringValue(data.logoUrl) || getStringValue(data.logo) || getStringValue(data.imageUrl) || vendor?.logoUrl,
    name: String(data.name || data.productName || 'Unnamed Product'),
    category: String(data.category || 'Curated'),
    description: data.description ? String(data.description) : undefined,
    price: Number(data.discountPrice || data.price || 0),
    originalPrice: data.originalPrice !== undefined ? Number(data.originalPrice) : data.discountPrice !== undefined ? Number(data.price || 0) : undefined,
    discountPrice: data.discountPrice !== undefined ? Number(data.discountPrice) : undefined,
    rating: Number(data.rating || 0),
    reviewsCount: Number(data.reviewsCount || data.reviewCount || 0),
    imageUrl,
    mainImage: imageUrl,
    images: allImages.length > 0 ? allImages : [imageUrl],
    imageUrls: allImages.length > 0 ? allImages : [imageUrl],
    variants: variants.length > 0 ? variants : undefined,
    defaultVariantId: variants[0]?.id,
    colors: variants.length > 0 ? variants.map((variant) => variant.colorName) : colors,
    sizes: Array.isArray(data.sizes) ? data.sizes.map(String) : ['One Size'],
    inStock: data.inStock !== undefined ? Boolean(data.inStock) : stock !== undefined ? stock > 0 : true,
    stockLeft: data.stockLeft !== undefined ? Number(data.stockLeft) : stock,
    isTopRated: Boolean(data.isTopRated) || Number(data.rating || 0) >= 4.7,
    isFeatured: Boolean(data.isFeatured),
    badge: data.badge ? String(data.badge) : Boolean(data.isTopRated) || Number(data.rating || 0) >= 4.7 ? 'Top Pick' : undefined,
    details: Array.isArray(data.details) ? data.details.map(String) : data.description ? [String(data.description)] : [],
    createdAt: data.createdAt
  };
};

const normalizeVendor = (id: string, data: Record<string, any>): VendorItem => ({
  id,
  vendorId: String(data.vendorId || id),
  vendorName: String(getStringValue(data.vendorName) || getStringValue(data.name) || getStringValue(data.companyName) || getStringValue(data.storeName) || 'NOVA Vendor'),
  logoUrl: getStringValue(data.logoUrl) || getStringValue(data.vendorLogoUrl) || getStringValue(data.logo) || getStringValue(data.imageUrl) || getStringValue(data.avatarUrl) || '',
  bannerUrl: getStringValue(data.bannerUrl),
  description: data.description ? String(data.description) : undefined,
  followers: data.followers !== undefined ? Number(data.followers) : undefined,
  rating: data.rating !== undefined ? Number(data.rating) : undefined,
  isVerified: Boolean(data.isVerified),
  isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
  createdAt: data.createdAt,
  productCount: data.productCount !== undefined ? Number(data.productCount) : undefined
});

const VendorLogo: React.FC<{ vendor?: Pick<VendorItem, 'vendorName' | 'logoUrl' | 'isVerified'>; size?: 'sm' | 'md' | 'lg'; isDarkMode?: boolean }> = ({ vendor, size = 'md', isDarkMode = false }) => {
  const [hasImageError, setHasImageError] = useState(false);
  const dimension = size === 'lg' ? 'h-20 w-20' : size === 'sm' ? 'h-7 w-7' : 'h-14 w-14';
  const name = vendor?.vendorName || 'NOVA';
  const logoUrl = vendor?.logoUrl;
  const showImage = Boolean(logoUrl && !hasImageError);

  return (
    <div className={`${dimension} shrink-0 rounded-full border bg-white p-0.5 ${
      vendor?.isVerified
        ? isDarkMode
          ? 'border-violet-300 shadow-[0_0_22px_rgba(167,139,250,0.55)]'
          : 'border-[#553BE2] shadow-sm'
        : isDarkMode
          ? 'border-white/25'
          : 'border-[#E4DFF5]'
    }`}>
      {showImage ? (
        <img
          src={logoUrl as string}
          alt={name}
          loading="lazy"
          className="h-full w-full rounded-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setHasImageError(true)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center rounded-full bg-[#F2EEFF] text-sm font-black text-[#553BE2]">
          {getInitials(name)}
        </div>
      )}
    </div>
  );
};

const ProductCard = memo(({
  product,
  vendor,
  isWishlisted,
  onToggleWishlist,
  onSelectProduct,
  variant = 'grid',
  index = 0,
  isDarkMode = false
}: {
  product: ProductItem;
  vendor?: VendorItem;
  isWishlisted: boolean;
  onToggleWishlist?: (productId: string) => void;
  onSelectProduct?: (productId: string, product?: ProductItem) => void;
  variant?: ProductCardVariant;
  index?: number;
  isDarkMode?: boolean;
}) => {
  const compact = variant === 'carousel';
  const vendorName = product.vendorName || vendor?.vendorName || 'NOVA Vendor';
  const vendorLogo = product.vendorLogoUrl || vendor?.logoUrl || '';

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 14 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.035, 0.2) }}
      onClick={() => onSelectProduct?.(product.id, product)}
      className={`group relative shrink-0 cursor-pointer overflow-hidden rounded-2xl border transition-all duration-300 hover:-translate-y-1 ${
        isDarkMode
          ? 'border-white/12 bg-white/[0.07] shadow-[0_18px_50px_rgba(0,0,0,0.28)] backdrop-blur-2xl hover:border-violet-300/50 hover:shadow-[0_18px_55px_rgba(139,92,246,0.22)]'
          : 'border-[#E4DFF5] bg-white shadow-[0_6px_20px_rgba(23,24,43,0.05)] hover:border-[#553BE2]/40 hover:shadow-[0_14px_32px_rgba(85, 59, 226,0.12)]'
      } ${compact ? 'w-44 p-2.5' : 'p-3'}`}
    >
      <motion.button
        whileTap={{ scale: 0.78 }}
        animate={isWishlisted ? { scale: [1, 1.24, 1] } : { scale: 1 }}
        onClick={(event) => {
          event.stopPropagation();
          onToggleWishlist?.(product.id);
        }}
        className={`absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border shadow-sm backdrop-blur-md transition-colors ${
          isDarkMode
            ? 'border-white/15 bg-slate-950/55 text-white hover:text-rose-300'
            : 'border-[#E4DFF5] bg-white/90 text-[#131426] hover:text-rose-500'
        }`}
        title={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
      >
        <span className={`material-symbols-outlined text-[20px] leading-none ${isWishlisted ? 'text-rose-500' : ''}`} style={{ fontVariationSettings: isWishlisted ? "'FILL' 1" : undefined }}>
          {isWishlisted ? 'favorite' : 'favorite_border'}
        </span>
      </motion.button>

      <div 
        onClick={(e) => {
          e.stopPropagation();
          onSelectProduct?.(product.id, product);
        }}
        className={`relative overflow-hidden rounded-xl border cursor-pointer ${
          isDarkMode ? 'border-white/10 bg-slate-800/70' : 'border-[#E4DFF5] bg-[#F2EEFF]'
        } ${compact ? 'h-40' : 'aspect-[4/5]'}`}
      >
        <img
          src={product.imageUrl || fallbackImage}
          alt={product.name}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          referrerPolicy="no-referrer"
        />
        {product.badge && (
          <span className="absolute bottom-2 left-2 rounded-full bg-[#553BE2] px-2 py-1 text-[9px] font-black uppercase tracking-wide text-white shadow-sm">
            {product.badge}
          </span>
        )}
      </div>

      <div className="mt-3 space-y-2">
        <div className="flex items-center gap-2">
          <VendorLogo vendor={{ vendorName, logoUrl: vendorLogo, isVerified: vendor?.isVerified }} size="sm" isDarkMode={isDarkMode} />
          <span className={`min-w-0 truncate text-[10px] font-semibold ${isDarkMode ? 'text-slate-300' : 'text-[#5E667A]'}`}>{vendorName}</span>
        </div>
        <div 
          onClick={(e) => {
            e.stopPropagation();
            onSelectProduct?.(product.id, product);
          }}
          className="cursor-pointer"
        >
          <p className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-[#5E667A]'}`}>{product.category}</p>
          <h3 className={`${compact ? 'text-sm' : 'text-[15px]'} line-clamp-1 font-bold transition-colors ${
            isDarkMode ? 'text-white group-hover:text-violet-200' : 'text-[#131426] group-hover:text-[#553BE2]'
          }`}>
            {product.name}
          </h3>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={`text-sm font-black ${isDarkMode ? 'text-violet-300' : 'text-[#553BE2]'}`}>{formatPrice(product.price)}</span>
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold ${
            isDarkMode ? 'bg-white/10 text-slate-100' : 'bg-[#F2EEFF] text-[#131426]'
          }`}>
            <span className="text-amber-400">★</span>
            {Number(product.rating || 0).toFixed(1)}
            {product.reviewsCount > 0 ? <span className={isDarkMode ? 'text-slate-400' : 'text-[#5E667A]'}>({product.reviewsCount})</span> : null}
          </span>
        </div>
      </div>
    </motion.article>
  );
});

const ShimmerCard = ({ compact = false, isDarkMode = false }: { compact?: boolean; isDarkMode?: boolean }) => (
  <div className={`overflow-hidden rounded-2xl border p-3 ${
    isDarkMode ? 'border-white/10 bg-white/[0.06]' : 'border-[#E4DFF5] bg-white shadow-sm'
  } ${compact ? 'h-64 w-44 shrink-0' : 'h-72'}`}>
    <div className="h-full animate-pulse space-y-3">
      <div className={`h-40 rounded-xl ${isDarkMode ? 'bg-white/10' : 'bg-[#F2EEFF]'}`} />
      <div className={`h-3 w-2/3 rounded ${isDarkMode ? 'bg-white/10' : 'bg-[#F2EEFF]'}`} />
      <div className={`h-4 w-full rounded ${isDarkMode ? 'bg-white/10' : 'bg-[#F2EEFF]'}`} />
      <div className={`h-4 w-1/2 rounded ${isDarkMode ? 'bg-white/10' : 'bg-[#F2EEFF]'}`} />
    </div>
  </div>
);

export const ShowroomView: React.FC<ShowroomViewProps> = ({
  products,
  databaseProducts = [],
  loading = false,
  error = null,
  onNavigate,
  wishlist = [],
  onToggleWishlist,
  onSelectProduct,
  cartItemsCount = 0,
  isDarkMode = false,
  productReviews = {}
}) => {
  const { t } = useI18n();
  const [searchTerm, setSearchTerm] = useState('');
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortOption, setSortOption] = useState<ProductSortOption>('recommended');
  const [selectedVendor, setSelectedVendor] = useState(() => localStorage.getItem(VENDOR_STORAGE_KEY) || ALL_VENDORS);
  const [vendors, setVendors] = useState<VendorItem[]>(() => cachedVendors || []);
  const [vendorsLoading, setVendorsLoading] = useState(!cachedVendors);
  const [vendorsError, setVendorsError] = useState<string | null>(null);
  const [collectionProducts, setCollectionProducts] = useState<ProductItem[]>([]);
  const [collectionLoading, setCollectionLoading] = useState(true);
  const [collectionError, setCollectionError] = useState<string | null>(null);

  const derivedVendors = useMemo(() => {
    const map = new Map<string, VendorItem>();
    collectionProducts.concat(products).forEach((product) => {
      if (!product.vendorId || map.has(product.vendorId)) return;
      map.set(product.vendorId, {
        id: product.vendorId,
        vendorId: product.vendorId,
        vendorName: product.vendorName || product.vendorId,
        logoUrl: product.vendorLogoUrl || '',
        isActive: true,
        isVerified: false
      });
    });
    return Array.from(map.values()).sort((a, b) => a.vendorName.localeCompare(b.vendorName));
  }, [collectionProducts, products]);

  const marketplaceVendors = useMemo(() => {
    const map = new Map<string, VendorItem>();
    vendors.forEach((vendor) => map.set(vendor.vendorId, vendor));
    derivedVendors.forEach((vendor) => {
      if (!map.has(vendor.vendorId)) map.set(vendor.vendorId, vendor);
    });
    return Array.from(map.values()).sort((a, b) => a.vendorName.localeCompare(b.vendorName));
  }, [derivedVendors, vendors]);

  const firebaseVendorsById = useMemo(() => {
    return vendors.reduce<Record<string, VendorItem>>((acc, vendor) => {
      acc[vendor.vendorId] = vendor;
      acc[vendor.id] = vendor;
      return acc;
    }, {});
  }, [vendors]);

  const vendorsById = useMemo(() => {
    return marketplaceVendors.reduce<Record<string, VendorItem>>((acc, vendor) => {
      acc[vendor.vendorId] = vendor;
      acc[vendor.id] = vendor;
      return acc;
    }, {});
  }, [marketplaceVendors]);

  const productCountByVendor = useMemo(() => {
    const counts: Record<string, number> = {};
    collectionProducts.concat(products).forEach((product) => {
      if (!product.vendorId) return;
      counts[product.vendorId] = (counts[product.vendorId] || 0) + 1;
    });
    return counts;
  }, [collectionProducts, products]);

  const selectedVendorItem = selectedVendor === ALL_VENDORS ? undefined : vendorsById[selectedVendor];

  useEffect(() => {
    localStorage.setItem(VENDOR_STORAGE_KEY, selectedVendor);
  }, [selectedVendor]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    const collectionName = 'vendors';
    const queryDescription = 'vendors';

    setVendorsLoading(!cachedVendors);
    waitForFirebaseAuthReady().then(() => {
      if (cancelled) return;
      const vendorsQuery = query(collection(db, collectionName));
      unsubscribe = onSnapshot(vendorsQuery, (snapshot) => {
        console.debug('Firebase vendors snapshot received:', {
          ...getFirebaseDebugContext(collectionName, queryDescription),
          documentsReceived: snapshot.size
        });
        const nextVendors = snapshot.docs
          .map((doc) => normalizeVendor(doc.id, doc.data()))
          .filter((vendor) => vendor.isActive !== false)
          .sort((a, b) => a.vendorName.localeCompare(b.vendorName));
        cachedVendors = nextVendors;
        setVendors(nextVendors);
        setVendorsLoading(false);
        setVendorsError(null);
      }, (firebaseError) => {
        console.error('Firebase Vendor Fetch Error:', firebaseError, getFirebaseErrorCode(firebaseError), getFirebaseErrorMessage(firebaseError), getFirebaseDebugContext(collectionName, queryDescription));
        setVendorsError(null);
        setVendorsLoading(false);
      });
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    const collectionName = 'products';
    const queryDescription = selectedVendor === ALL_VENDORS
      ? 'products limit 1000'
      : `products where vendorId == ${selectedVendor} limit 500`;

    setCollectionLoading(true);
    setCollectionError(null);
    waitForFirebaseAuthReady().then(() => {
      if (cancelled) return;
      const baseCollection = collection(db, collectionName);
      const productsQuery = selectedVendor === ALL_VENDORS
        ? query(baseCollection, limit(1000))
        : query(baseCollection, where('vendorId', '==', selectedVendor), limit(500));

      unsubscribe = onSnapshot(productsQuery, (snapshot) => {
        console.debug('Firebase products snapshot received:', {
          ...getFirebaseDebugContext(collectionName, queryDescription),
          documentsReceived: snapshot.size,
          fromCache: snapshot.metadata.fromCache,
          changedDocumentIds: snapshot.docChanges().map((change) => `${change.type}:${change.doc.id}`)
        });
        try {
          const nextProducts = snapshot.docs
            .map((doc) => normalizeProduct(doc.id, doc.data(), firebaseVendorsById))
            .filter((product) => isValidProduct(product))
            .sort((a, b) => getTimestampMs(b.createdAt) - getTimestampMs(a.createdAt))
            .slice(0, 500);
          setCollectionProducts(nextProducts);
          setCollectionError(null);
        } catch (error) {
          logFirebaseProductFetchError(error, collectionName, queryDescription);
          setCollectionError('Unable to load products from Firebase. Check the console for Firebase Product Fetch Error details.');
        } finally {
          setCollectionLoading(false);
        }
      }, (firebaseError) => {
        logFirebaseProductFetchError(firebaseError, collectionName, queryDescription);
        setCollectionError('Unable to load products from Firebase. Check the console for Firebase Product Fetch Error details.');
        setCollectionLoading(false);
      });
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [firebaseVendorsById, selectedVendor]);

  useEffect(() => {
    if (selectedVendor === ALL_VENDORS) return;
    if (marketplaceVendors.length > 0 && !vendorsById[selectedVendor]) {
      setSelectedVendor(ALL_VENDORS);
    }
  }, [selectedVendor, marketplaceVendors.length, vendorsById]);

  const matchesSearch = (product: ProductItem) => {
    const queryText = searchTerm.trim().toLowerCase();
    if (!queryText) return true;
    return [product.name, product.category, product.vendorName, product.vendorId]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(queryText));
  };

  const filteredVendors = useMemo(() => {
    const queryText = searchTerm.trim().toLowerCase();
    if (!queryText) return marketplaceVendors;
    return marketplaceVendors.filter((vendor) => [vendor.vendorName, vendor.description].filter(Boolean).some((value) => String(value).toLowerCase().includes(queryText)));
  }, [marketplaceVendors, searchTerm]);

  const fallbackCollectionProducts = useMemo(() => {
    if (selectedVendor === ALL_VENDORS) return products;
    return products.filter((product) => product.vendorId === selectedVendor);
  }, [products, selectedVendor]);
  const displayCollectionProducts = collectionProducts.length > 0 ? collectionProducts : fallbackCollectionProducts;
  const blockingCollectionError = collectionError && displayCollectionProducts.length === 0 ? collectionError : null;
  const blockingProductsError = error && displayCollectionProducts.length === 0 ? error : null;
  const productCategories = useMemo(() => Array.from(new Set(
    displayCollectionProducts.map((product) => product.category.trim()).filter(Boolean)
  )).sort((a, b) => a.localeCompare(b)), [displayCollectionProducts]);
  const visibleProducts = useMemo(() => {
    const filtered = displayCollectionProducts.filter((product) => (
      matchesSearch(product) &&
      (selectedCategory === 'all' || product.category === selectedCategory)
    ));

    switch (sortOption) {
      case 'price-low-high':
        return filtered.sort((a, b) => a.price - b.price);
      case 'price-high-low':
        return filtered.sort((a, b) => b.price - a.price);
      case 'rating':
        return filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      default:
        return filtered;
    }
  }, [displayCollectionProducts, searchTerm, selectedCategory, sortOption]);
  const activeFilterCount = Number(selectedCategory !== 'all') +
    Number(sortOption !== 'recommended');
  const topReviewedProducts = useMemo(() => databaseProducts
    .map((product) => {
      const reviews = productReviews[product.id] || (product.productId ? productReviews[product.productId] : undefined) || [];
      const reviewCount = Math.max(product.reviewsCount || 0, reviews.length);
      const averageRating = reviews.length > 0
        ? reviews.reduce((total, review) => total + Number(review.rating || 0), 0) / reviews.length
        : Number(product.rating || 0);

      return {
        ...product,
        reviewsCount: reviewCount,
        rating: averageRating
      };
    })
    .filter((product) => isValidProduct(product) && (product.reviewsCount || 0) > 0)
    .sort((a, b) => (b.reviewsCount || 0) - (a.reviewsCount || 0) || (b.rating || 0) - (a.rating || 0))
    .slice(0, 8), [databaseProducts, productReviews]);
  const selectedCount = selectedVendorItem?.productCount ?? (selectedVendor === ALL_VENDORS ? displayCollectionProducts.length : productCountByVendor[selectedVendor] || displayCollectionProducts.length);
  const collectionTitle = selectedVendorItem ? `${selectedVendorItem.vendorName} Collection` : t('showroom.allProducts');

  const handleSelectVendor = (vendorId: string, vendorName?: string) => {
    setSelectedVendor(vendorId);
    analytics.trackFilterApplied('vendor', vendorId, 'showroom', { vendorName: vendorName || (vendorId === ALL_VENDORS ? 'All Vendors' : vendorId) });
  };

  const handleSelectProduct = (id: string, product?: ProductItem) => {
    const p = product || visibleProducts.find((item) => item.id === id);
    if (searchTerm.trim() && p) {
      analytics.trackSearchClick(p, searchTerm.trim(), 'showroom');
    }
    onSelectProduct?.(id, p);
  };

  // Track debounced search queries
  useEffect(() => {
    const trimmed = searchTerm.trim();
    if (!trimmed || trimmed.length < 2) return;

    const timer = setTimeout(() => {
      analytics.trackSearch(trimmed, visibleProducts.length, 'showroom');
    }, 600);

    return () => clearTimeout(timer);
  }, [searchTerm, visibleProducts.length]);

  useEffect(() => {
    visibleProducts.slice(0, 20).forEach((product) => {
      analytics.trackProductImpression(product, 'showroom_collection');
    });
  }, [visibleProducts]);

  return (
    <div className={`space-y-7 pb-6 ${isDarkMode ? 'text-white' : 'text-[#131426]'}`}>
      <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="mt-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className={`flex items-center gap-2 text-3xl font-bold tracking-tight ${isDarkMode ? 'text-white' : 'text-[#131426]'}`}>
              {t('showroom.title')} <span className="text-amber-400">✨</span>
            </h1>
            <p className={`mt-1 ${isDarkMode ? 'text-slate-300' : 'text-[#5E667A]'}`}>{t('showroom.subtitle')}</p>
          </div>
          <div className="flex items-center gap-3">
            <button className={`relative flex h-11 w-11 items-center justify-center rounded-2xl border ${
              isDarkMode ? 'border-white/10 bg-white/[0.06] text-white backdrop-blur-xl' : 'border-[#E4DFF5] bg-white text-[#131426] shadow-sm'
            }`} title={t('showroom.notifications')}>
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <button onClick={() => onNavigate('cart')} className={`relative flex h-11 w-11 items-center justify-center rounded-2xl border ${
              isDarkMode ? 'border-white/10 bg-white/[0.06] text-white backdrop-blur-xl' : 'border-[#E4DFF5] bg-white text-[#131426] shadow-sm'
            }`} title={t('showroom.cart')}>
              <span className="material-symbols-outlined">shopping_cart</span>
              {cartItemsCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#553BE2] px-1 text-[10px] font-black text-white">
                  {cartItemsCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </motion.section>

      <section className="flex items-center gap-3">
        <label className={`flex h-16 min-w-0 flex-1 items-center gap-3 rounded-2xl border px-5 ${
          isDarkMode
            ? 'border-white/12 bg-white/[0.07] shadow-[0_0_30px_rgba(139,92,246,0.09)] backdrop-blur-2xl'
            : 'border-[#E4DFF5] bg-white shadow-sm'
        }`}>
          <span className={`material-symbols-outlined text-3xl ${isDarkMode ? 'text-slate-300' : 'text-[#5E667A]'}`}>search</span>
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder={t('showroom.search')}
            className={`h-full min-w-0 flex-1 bg-transparent text-sm font-medium outline-none sm:text-base ${
              isDarkMode ? 'text-white placeholder:text-slate-400' : 'text-[#131426] placeholder:text-[#8E96AA]'
            }`}
          />
        </label>
        <button
          type="button"
          onClick={() => setIsFilterPanelOpen((open) => !open)}
          aria-label={t('showroom.filters')}
          aria-expanded={isFilterPanelOpen}
          className={`relative flex h-16 w-16 items-center justify-center rounded-2xl border transition-colors ${
            isDarkMode
              ? 'border-white/12 bg-white/[0.07] text-white backdrop-blur-2xl hover:bg-white/[0.12]'
              : 'border-[#E4DFF5] bg-white text-[#131426] shadow-sm hover:bg-[#F8F6FF]'
          }`}
          title={t('showroom.filters')}
        >
          <span className="material-symbols-outlined">tune</span>
          {activeFilterCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#553BE2] px-1 text-[10px] font-bold text-white">
              {activeFilterCount}
            </span>
          )}
        </button>
      </section>

      {isFilterPanelOpen && (
        <section className={`rounded-2xl border p-4 shadow-sm ${
          isDarkMode ? 'border-white/10 bg-slate-900/95' : 'border-[#E4DFF5] bg-white'
        }`} aria-label={t('showroom.productFilters')}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-[#131426]'}`}>{t('showroom.filterProducts')}</h2>
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('all');
                setSortOption('recommended');
              }}
              className="text-xs font-semibold text-[#553BE2] hover:underline"
            >
              {t('showroom.clearFilters')}
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className={`space-y-1.5 text-xs font-semibold ${isDarkMode ? 'text-slate-300' : 'text-[#5E667A]'}`}>
              <span>{t('showroom.category')}</span>
              <select
                value={selectedCategory}
                onChange={(event) => setSelectedCategory(event.target.value)}
                className={`h-11 w-full rounded-xl border px-3 text-sm outline-none focus:border-[#553BE2] ${
                  isDarkMode ? 'border-slate-700 bg-slate-800 text-white' : 'border-[#E4DFF5] bg-white text-[#131426]'
                }`}
              >
                <option value="all">{t('showroom.allCategories')}</option>
                {productCategories.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </label>
            <label className={`space-y-1.5 text-xs font-semibold ${isDarkMode ? 'text-slate-300' : 'text-[#5E667A]'}`}>
              <span>{t('showroom.sortBy')}</span>
              <select
                value={sortOption}
                onChange={(event) => setSortOption(event.target.value as ProductSortOption)}
                className={`h-11 w-full rounded-xl border px-3 text-sm outline-none focus:border-[#553BE2] ${
                  isDarkMode ? 'border-slate-700 bg-slate-800 text-white' : 'border-[#E4DFF5] bg-white text-[#131426]'
                }`}
              >
                <option value="recommended">{t('showroom.recommended')}</option>
                <option value="price-low-high">{t('showroom.priceLowHigh')}</option>
                <option value="price-high-low">{t('showroom.priceHighLow')}</option>
                <option value="rating">{t('showroom.highestRated')}</option>
              </select>
            </label>
          </div>
        </section>
      )}

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-[#131426]'}`}>{t('showroom.vendors')}</h2>
          {vendorsError && <span className="text-xs font-semibold text-rose-500">{vendorsError}</span>}
        </div>
        <div className="hide-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2">
          <VendorButton
            selected={selectedVendor === ALL_VENDORS}
            label={t('showroom.allVendors')}
            onClick={() => handleSelectVendor(ALL_VENDORS, t('showroom.allVendors'))}
            isDarkMode={isDarkMode}
          />
          {vendorsLoading ? (
            Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex w-24 shrink-0 flex-col items-center gap-3">
                <div className={`h-20 w-20 animate-pulse rounded-full ${isDarkMode ? 'bg-white/10' : 'bg-white border border-[#E4DFF5]'}`} />
                <div className={`h-3 w-20 animate-pulse rounded ${isDarkMode ? 'bg-white/10' : 'bg-white border border-[#E4DFF5]'}`} />
              </div>
            ))
          ) : (
            filteredVendors.map((vendor) => (
              <VendorButton
                key={vendor.id}
                vendor={vendor}
                selected={selectedVendor === vendor.vendorId}
                label={vendor.vendorName}
                productCount={vendor.productCount ?? productCountByVendor[vendor.vendorId]}
                onClick={() => handleSelectVendor(vendor.vendorId, vendor.vendorName)}
                isDarkMode={isDarkMode}
              />
            ))
          )}
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-[#131426]'}`}>{t('showroom.topReviewed')}</h2>
            <p className={`mt-1 text-sm ${isDarkMode ? 'text-slate-300' : 'text-[#5E667A]'}`}>
              {t('showroom.reviewedSubtitle')}
            </p>
          </div>
        </div>
        {topReviewedProducts.length > 0 ? (
          <div className="hide-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2">
            {topReviewedProducts.map((product, index) => (
              <ProductCard
                key={product.id}
                product={product}
                vendor={product.vendorId ? vendorsById[product.vendorId] : undefined}
                isWishlisted={wishlist.includes(product.id)}
                onToggleWishlist={onToggleWishlist}
                onSelectProduct={handleSelectProduct}
                variant="carousel"
                index={index}
                isDarkMode={isDarkMode}
              />
            ))}
          </div>
        ) : (
          <div className={`rounded-2xl border p-5 text-sm ${
            isDarkMode ? 'border-white/10 bg-white/[0.06] text-slate-300' : 'border-[#E4DFF5] bg-white text-[#5E667A]'
          }`}>
            {t('showroom.noReviews')}
          </div>
        )}
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-[#131426]'}`}>{collectionTitle}</h2>
            <p className={`mt-1 text-sm font-semibold ${isDarkMode ? 'text-violet-300' : 'text-[#553BE2]'}`}>{selectedCount} Products</p>
          </div>
          <span className={`rounded-full border px-3 py-1 text-xs font-black ${
            isDarkMode ? 'border-violet-400/20 bg-violet-500/15 text-violet-200' : 'border-[#E4DFF5] bg-[#F2EEFF] text-[#553BE2]'
          }`}>
            {selectedVendorItem ? selectedVendorItem.vendorName : 'All Vendors'}
          </span>
        </div>

        {blockingCollectionError || blockingProductsError ? (
          <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-5 text-sm text-rose-500">
            {blockingCollectionError || blockingProductsError}
          </div>
        ) : (collectionLoading || loading) && visibleProducts.length === 0 ? (
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, index) => <ShimmerCard key={index} isDarkMode={isDarkMode} />)}
          </div>
        ) : visibleProducts.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`rounded-2xl border p-8 text-center ${
            isDarkMode
              ? 'border-white/10 bg-white/[0.06] shadow-[0_18px_50px_rgba(0,0,0,0.25)] backdrop-blur-2xl'
              : 'border-[#E4DFF5] bg-white shadow-sm'
          }`}>
            <p className={`text-base font-bold ${isDarkMode ? 'text-white' : 'text-[#131426]'}`}>{t('showroom.noProducts')}</p>
            <p className={`mt-2 text-sm ${isDarkMode ? 'text-slate-300' : 'text-[#5E667A]'}`}>{t('showroom.exploreVendor')}</p>
          </motion.div>
        ) : (
          <AnimatePresence mode="popLayout">
            <motion.div layout className="grid grid-cols-2 gap-4">
              {visibleProducts.map((product, index) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  vendor={product.vendorId ? vendorsById[product.vendorId] : undefined}
                  isWishlisted={wishlist.includes(product.id)}
                  onToggleWishlist={onToggleWishlist}
                  onSelectProduct={handleSelectProduct}
                  index={index}
                  isDarkMode={isDarkMode}
                />
              ))}
            </motion.div>
          </AnimatePresence>
        )}
      </section>

      <section className={`grid grid-cols-3 gap-3 rounded-2xl border p-4 text-center ${
        isDarkMode ? 'border-white/10 bg-white/[0.06] backdrop-blur-2xl' : 'border-[#E4DFF5] bg-white shadow-sm'
      }`}>
        {[
          ['redeem', 'Curated Collections', 'Handpicked quality'],
          ['star', 'Top Rated', 'Only the best'],
          ['verified_user', 'Trusted Vendors', 'Verified brands']
        ].map(([icon, title, subtitle]) => (
          <div key={title} className="space-y-2">
            <span className={`material-symbols-outlined text-3xl ${isDarkMode ? 'text-violet-300' : 'text-[#553BE2]'}`}>{icon}</span>
            <p className={`text-xs font-bold ${isDarkMode ? 'text-white' : 'text-[#131426]'}`}>{title}</p>
            <p className={`text-[10px] ${isDarkMode ? 'text-slate-400' : 'text-[#5E667A]'}`}>{subtitle}</p>
          </div>
        ))}
      </section>
    </div>
  );
};

const VendorButton = ({
  vendor,
  selected,
  label,
  productCount,
  onClick,
  isDarkMode = false
}: {
  vendor?: VendorItem;
  selected: boolean;
  label: string;
  productCount?: number;
  onClick: () => void;
  isDarkMode?: boolean;
}) => (
  <motion.button
    type="button"
    onClick={onClick}
    whileTap={{ scale: 0.96 }}
    animate={{ scale: selected ? 1.04 : 1 }}
    transition={{ duration: 0.3 }}
    className={`snap-start rounded-2xl px-3 py-3 text-center transition-all duration-300 ${
      selected
        ? isDarkMode
          ? 'border border-violet-400 bg-violet-500/15 shadow-[0_0_26px_rgba(139,92,246,0.5)]'
          : 'border border-[#553BE2] bg-white shadow-sm'
        : isDarkMode
          ? 'border border-transparent bg-transparent hover:bg-white/[0.04]'
          : 'border border-transparent bg-transparent hover:bg-white/60'
    }`}
  >
    <div className="flex w-24 flex-col items-center gap-2">
      {vendor ? (
        <VendorLogo vendor={vendor} size="lg" isDarkMode={isDarkMode} />
      ) : (
        <div className={`flex h-20 w-20 items-center justify-center rounded-full border ${
          selected
            ? isDarkMode
              ? 'border-violet-300 bg-violet-500/20 text-violet-100'
              : 'border-[#553BE2] bg-[#F2EEFF] text-[#553BE2]'
            : isDarkMode
              ? 'border-white/15 bg-white/[0.06] text-white'
              : 'border-[#E4DFF5] bg-white text-[#131426]'
        }`}>
          <span className="material-symbols-outlined text-4xl">grid_view</span>
        </div>
      )}
      <span className={`line-clamp-2 min-h-9 text-xs font-bold uppercase leading-tight ${isDarkMode ? 'text-white' : 'text-[#131426]'}`}>{label}</span>
      {productCount !== undefined && (
        <span className={`rounded-full px-2 py-0.5 text-[9px] font-black ${
          isDarkMode ? 'bg-white/10 text-violet-200' : 'bg-[#F2EEFF] text-[#553BE2]'
        }`}>{productCount} Products</span>
      )}
    </div>
  </motion.button>
);
