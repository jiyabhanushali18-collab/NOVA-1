import React, { memo, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { collection, limit, onSnapshot, query, where } from 'firebase/firestore';
import { auth, db, firebaseProjectId, waitForFirebaseAuthReady } from '../firebase';
import { ProductItem, ProductReview, ScreenId, VendorItem } from '../types';
import { normalizeProductVariants } from '../utils/productVariants';

interface ShowroomViewProps {
  products: ProductItem[];
  loading?: boolean;
  error?: string | null;
  onNavigate: (screen: ScreenId) => void;
  wishlist?: string[];
  onToggleWishlist?: (productId: string) => void;
  onSelectProduct?: (productId: string) => void;
  cartItemsCount?: number;
  isDarkMode?: boolean;
  productReviews?: Record<string, ProductReview[]>;
}

type ProductCardVariant = 'carousel' | 'grid';

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

const normalizeProduct = (id: string, data: Record<string, any>, vendorsById: Record<string, VendorItem>): ProductItem => {
  const images = [
    ...asStringArray(data.images),
    ...asStringArray(data.imageUrls)
  ].filter((value, index, array) => value && array.indexOf(value) === index);
  const vendorId = data.vendorId ? String(data.vendorId) : undefined;
  const vendor = vendorId ? vendorsById[vendorId] : undefined;
  const stock = data.stock !== undefined ? Number(data.stock) : undefined;
  const colors = Array.isArray(data.colors) ? data.colors.map(String).filter(Boolean) : ['Standard'];
  const variants = normalizeProductVariants(data, colors);
  const allImages = [
    ...images,
    ...variants.flatMap((variant) => variant.images || [])
  ].filter((value, index, array) => value && array.indexOf(value) === index);
  const imageUrl = getStringValue(data.mainImage) || getStringValue(data.imageUrl) || getStringValue(data.image) || variants[0]?.images?.[0] || allImages[0] || fallbackImage;

  return {
    id,
    productId: String(data.productId || id),
    vendorId,
    vendorName: getStringValue(data.vendorName) || vendor?.vendorName || 'NOVA Vendor',
    vendorLogoUrl: getStringValue(data.vendorLogoUrl) || getStringValue(data.logoUrl) || vendor?.logoUrl,
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
  vendorName: String(data.vendorName || data.name || 'NOVA Vendor'),
  logoUrl: getStringValue(data.logoUrl) || getStringValue(data.logo) || '',
  bannerUrl: getStringValue(data.bannerUrl),
  description: data.description ? String(data.description) : undefined,
  followers: data.followers !== undefined ? Number(data.followers) : undefined,
  rating: data.rating !== undefined ? Number(data.rating) : undefined,
  isVerified: Boolean(data.isVerified),
  isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
  createdAt: data.createdAt,
  productCount: data.productCount !== undefined ? Number(data.productCount) : undefined
});

const VendorLogo: React.FC<{ vendor?: Pick<VendorItem, 'vendorName' | 'logoUrl' | 'isVerified'>; size?: 'sm' | 'md' | 'lg' }> = ({ vendor, size = 'md' }) => {
  const dimension = size === 'lg' ? 'h-20 w-20' : size === 'sm' ? 'h-7 w-7' : 'h-14 w-14';
  const name = vendor?.vendorName || 'NOVA';

  return (
    <div className={`${dimension} shrink-0 rounded-full border bg-white/95 p-0.5 ${vendor?.isVerified ? 'border-violet-300 shadow-[0_0_22px_rgba(167,139,250,0.55)]' : 'border-white/25'}`}>
      {vendor?.logoUrl ? (
        <img src={vendor.logoUrl} alt={name} loading="lazy" className="h-full w-full rounded-full object-cover" referrerPolicy="no-referrer" />
      ) : (
        <div className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-white to-violet-100 text-sm font-black text-slate-950">
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
  index = 0
}: {
  product: ProductItem;
  vendor?: VendorItem;
  isWishlisted: boolean;
  onToggleWishlist?: (productId: string) => void;
  onSelectProduct?: (productId: string) => void;
  variant?: ProductCardVariant;
  index?: number;
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
      onClick={() => onSelectProduct?.(product.id)}
      className={`group relative shrink-0 cursor-pointer overflow-hidden rounded-2xl border border-white/12 bg-white/[0.07] shadow-[0_18px_50px_rgba(0,0,0,0.28)] backdrop-blur-2xl transition-all duration-300 hover:-translate-y-1 hover:border-violet-300/50 hover:shadow-[0_18px_55px_rgba(139,92,246,0.22)] ${compact ? 'w-44 p-2.5' : 'p-3'}`}
    >
      <motion.button
        whileTap={{ scale: 0.78 }}
        animate={isWishlisted ? { scale: [1, 1.24, 1] } : { scale: 1 }}
        onClick={(event) => {
          event.stopPropagation();
          onToggleWishlist?.(product.id);
        }}
        className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-slate-950/55 text-white shadow-lg backdrop-blur-md transition-colors hover:text-rose-300"
        title={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
      >
        <span className="material-symbols-outlined text-[20px] leading-none" style={{ fontVariationSettings: isWishlisted ? "'FILL' 1" : undefined }}>
          {isWishlisted ? 'favorite' : 'favorite_border'}
        </span>
      </motion.button>

      <div className={`relative overflow-hidden rounded-xl border border-white/10 bg-slate-800/70 ${compact ? 'h-40' : 'aspect-[4/5]'}`}>
        <img
          src={product.imageUrl || fallbackImage}
          alt={product.name}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          referrerPolicy="no-referrer"
        />
        {product.badge && (
          <span className="absolute bottom-2 left-2 rounded-full bg-violet-600 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-white shadow-[0_0_18px_rgba(139,92,246,0.45)]">
            {product.badge}
          </span>
        )}
      </div>

      <div className="mt-3 space-y-2">
        <div className="flex items-center gap-2">
          <VendorLogo vendor={{ vendorName, logoUrl: vendorLogo, isVerified: vendor?.isVerified }} size="sm" />
          <span className="min-w-0 truncate text-[10px] font-semibold text-slate-300">{vendorName}</span>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{product.category}</p>
          <h3 className={`${compact ? 'text-sm' : 'text-[15px]'} line-clamp-1 font-bold text-white transition-colors group-hover:text-violet-200`}>
            {product.name}
          </h3>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-black text-violet-300">{formatPrice(product.price)}</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-[10px] font-semibold text-slate-100">
            <span className="text-amber-400">★</span>
            {Number(product.rating || 0).toFixed(1)}
            {!compact && product.reviewsCount > 0 ? <span className="text-slate-400">({product.reviewsCount})</span> : null}
          </span>
        </div>
      </div>
    </motion.article>
  );
});

const ShimmerCard = ({ compact = false }: { compact?: boolean }) => (
  <div className={`overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] p-3 ${compact ? 'h-64 w-44 shrink-0' : 'h-72'}`}>
    <div className="h-full animate-pulse space-y-3">
      <div className="h-40 rounded-xl bg-white/10" />
      <div className="h-3 w-2/3 rounded bg-white/10" />
      <div className="h-4 w-full rounded bg-white/10" />
      <div className="h-4 w-1/2 rounded bg-white/10" />
    </div>
  </div>
);

export const ShowroomView: React.FC<ShowroomViewProps> = ({
  products,
  loading = false,
  error = null,
  onNavigate,
  wishlist = [],
  onToggleWishlist,
  onSelectProduct,
  cartItemsCount = 0,
  productReviews = {}
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVendor, setSelectedVendor] = useState(() => localStorage.getItem(VENDOR_STORAGE_KEY) || ALL_VENDORS);
  const [vendors, setVendors] = useState<VendorItem[]>(() => cachedVendors || []);
  const [vendorsLoading, setVendorsLoading] = useState(!cachedVendors);
  const [vendorsError, setVendorsError] = useState<string | null>(null);
  const [topRatedProducts, setTopRatedProducts] = useState<ProductItem[]>([]);
  const [topRatedLoading, setTopRatedLoading] = useState(true);
  const [collectionProducts, setCollectionProducts] = useState<ProductItem[]>([]);
  const [collectionLoading, setCollectionLoading] = useState(true);
  const [collectionError, setCollectionError] = useState<string | null>(null);

  const derivedVendors = useMemo(() => {
    const map = new Map<string, VendorItem>();
    collectionProducts.concat(topRatedProducts, products).forEach((product) => {
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
  }, [collectionProducts, products, topRatedProducts]);

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
    collectionProducts.concat(topRatedProducts, products).forEach((product) => {
      if (!product.vendorId) return;
      counts[product.vendorId] = (counts[product.vendorId] || 0) + 1;
    });
    return counts;
  }, [collectionProducts, products, topRatedProducts]);

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
    const queryDescription = 'products limit 80 top-rated client filter rating >= 4.7';

    setTopRatedLoading(true);
    waitForFirebaseAuthReady().then(() => {
      if (cancelled) return;
      const topRatedQuery = query(collection(db, collectionName), limit(80));

      unsubscribe = onSnapshot(topRatedQuery, (snapshot) => {
        console.debug('Firebase products snapshot received:', {
          ...getFirebaseDebugContext(collectionName, queryDescription),
          documentsReceived: snapshot.size
        });
        try {
          const nextProducts = snapshot.docs
            .map((doc) => normalizeProduct(doc.id, doc.data(), firebaseVendorsById))
            .filter((product) => Number(product.rating || 0) >= 4.7)
            .sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0))
            .slice(0, 10);
          setTopRatedProducts(nextProducts);
        } catch (error) {
          logFirebaseProductFetchError(error, collectionName, queryDescription);
          setTopRatedProducts([]);
        } finally {
          setTopRatedLoading(false);
        }
      }, (firebaseError) => {
        logFirebaseProductFetchError(firebaseError, collectionName, queryDescription);
        setTopRatedProducts([]);
        setTopRatedLoading(false);
      });
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [firebaseVendorsById]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    const collectionName = 'products';
    const queryDescription = selectedVendor === ALL_VENDORS
      ? 'products limit 80'
      : `products where vendorId == ${selectedVendor} limit 20`;

    setCollectionLoading(true);
    setCollectionError(null);
    waitForFirebaseAuthReady().then(() => {
      if (cancelled) return;
      const baseCollection = collection(db, collectionName);
      const productsQuery = selectedVendor === ALL_VENDORS
        ? query(baseCollection, limit(80))
        : query(baseCollection, where('vendorId', '==', selectedVendor), limit(20));

      unsubscribe = onSnapshot(productsQuery, (snapshot) => {
        console.debug('Firebase products snapshot received:', {
          ...getFirebaseDebugContext(collectionName, queryDescription),
          documentsReceived: snapshot.size
        });
        try {
          const nextProducts = snapshot.docs
            .map((doc) => normalizeProduct(doc.id, doc.data(), firebaseVendorsById))
            .sort((a, b) => getTimestampMs(b.createdAt) - getTimestampMs(a.createdAt))
            .slice(0, 20);
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
  const displayTopRatedProducts = topRatedProducts.length > 0
    ? topRatedProducts
    : products
        .filter((product) => Number(product.rating || 0) >= 4.7 || product.isTopRated)
        .sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0))
        .slice(0, 10);
  const blockingCollectionError = collectionError && displayCollectionProducts.length === 0 ? collectionError : null;
  const blockingProductsError = error && displayCollectionProducts.length === 0 ? error : null;
  const visibleTopRated = useMemo(() => displayTopRatedProducts.filter(matchesSearch), [searchTerm, displayTopRatedProducts]);
  const visibleProducts = useMemo(() => displayCollectionProducts.filter(matchesSearch), [displayCollectionProducts, searchTerm]);
  const selectedCount = selectedVendorItem?.productCount ?? (selectedVendor === ALL_VENDORS ? displayCollectionProducts.length : productCountByVendor[selectedVendor] || displayCollectionProducts.length);
  const collectionTitle = selectedVendorItem ? `${selectedVendorItem.vendorName} Collection` : 'All Products';

  const handleSelectProduct = (id: string) => {
    onSelectProduct?.(id);
  };

  return (
    <div className="space-y-7 pb-6 text-white">
      <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="mt-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight text-white">
              NOVA Showroom <span className="text-amber-400">✨</span>
            </h1>
            <p className="mt-1 text-slate-300">Discover brands, vendor drops and curated collections</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-white backdrop-blur-xl" title="Notifications">
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <button onClick={() => onNavigate('cart')} className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-white backdrop-blur-xl" title="Cart">
              <span className="material-symbols-outlined">shopping_cart</span>
              {cartItemsCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-500 px-1 text-[10px] font-black text-white">
                  {cartItemsCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </motion.section>

      <section className="flex items-center gap-3">
        <label className="flex h-16 min-w-0 flex-1 items-center gap-3 rounded-2xl border border-white/12 bg-white/[0.07] px-5 shadow-[0_0_30px_rgba(139,92,246,0.09)] backdrop-blur-2xl">
          <span className="material-symbols-outlined text-3xl text-slate-300">search</span>
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search products, vendors..."
            className="h-full min-w-0 flex-1 bg-transparent text-sm font-medium text-white outline-none placeholder:text-slate-400 sm:text-base"
          />
        </label>
        <button className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/12 bg-white/[0.07] text-white backdrop-blur-2xl" title="Filters">
          <span className="material-symbols-outlined">tune</span>
        </button>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Our Vendors</h2>
          {vendorsError && <span className="text-xs font-semibold text-rose-300">{vendorsError}</span>}
        </div>
        <div className="hide-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2">
          <VendorButton
            selected={selectedVendor === ALL_VENDORS}
            label="All Vendors"
            onClick={() => setSelectedVendor(ALL_VENDORS)}
          />
          {vendorsLoading ? (
            Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex w-24 shrink-0 flex-col items-center gap-3">
                <div className="h-20 w-20 animate-pulse rounded-full bg-white/10" />
                <div className="h-3 w-20 animate-pulse rounded bg-white/10" />
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
                onClick={() => setSelectedVendor(vendor.vendorId)}
              />
            ))
          )}
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">⭐ Top Rated Products</h2>
          <span className="text-sm font-semibold text-violet-300">View all</span>
        </div>
        <div className="hide-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3">
          {topRatedLoading && visibleTopRated.length === 0 ? (
            Array.from({ length: 5 }).map((_, index) => <ShimmerCard key={index} compact />)
          ) : visibleTopRated.length > 0 ? (
            visibleTopRated.map((product, index) => (
              <ProductCard
                key={product.id}
                product={product}
                vendor={product.vendorId ? vendorsById[product.vendorId] : undefined}
                isWishlisted={wishlist.includes(product.id)}
                onToggleWishlist={onToggleWishlist}
                onSelectProduct={handleSelectProduct}
                variant="carousel"
                index={index}
              />
            ))
          ) : (
            <div className="w-full rounded-2xl border border-white/10 bg-white/[0.06] p-5 text-sm text-slate-300">
              No top rated products available yet.
            </div>
          )}
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-white">{collectionTitle}</h2>
            <p className="mt-1 text-sm font-semibold text-violet-300">{selectedCount} Products</p>
          </div>
          <span className="rounded-full border border-violet-400/20 bg-violet-500/15 px-3 py-1 text-xs font-black text-violet-200">
            {selectedVendorItem ? selectedVendorItem.vendorName : 'All Vendors'}
          </span>
        </div>

        {blockingCollectionError || blockingProductsError ? (
          <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-5 text-sm text-rose-200">
            {blockingCollectionError || blockingProductsError}
          </div>
        ) : (collectionLoading || loading) && visibleProducts.length === 0 ? (
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, index) => <ShimmerCard key={index} />)}
          </div>
        ) : visibleProducts.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-2xl border border-white/10 bg-white/[0.06] p-8 text-center shadow-[0_18px_50px_rgba(0,0,0,0.25)] backdrop-blur-2xl">
            <p className="text-base font-bold text-white">No products available from this vendor yet.</p>
            <p className="mt-2 text-sm text-slate-300">Explore another vendor.</p>
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
                />
              ))}
            </motion.div>
          </AnimatePresence>
        )}
      </section>

      <section className="grid grid-cols-3 gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-4 text-center backdrop-blur-2xl">
        {[
          ['redeem', 'Curated Collections', 'Handpicked quality'],
          ['star', 'Top Rated', 'Only the best'],
          ['verified_user', 'Trusted Vendors', 'Verified brands']
        ].map(([icon, title, subtitle]) => (
          <div key={title} className="space-y-2">
            <span className="material-symbols-outlined text-3xl text-violet-300">{icon}</span>
            <p className="text-xs font-bold text-white">{title}</p>
            <p className="text-[10px] text-slate-400">{subtitle}</p>
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
  onClick
}: {
  vendor?: VendorItem;
  selected: boolean;
  label: string;
  productCount?: number;
  onClick: () => void;
}) => (
  <motion.button
    type="button"
    onClick={onClick}
    whileTap={{ scale: 0.96 }}
    animate={{ scale: selected ? 1.04 : 1 }}
    transition={{ duration: 0.3 }}
    className={`snap-start rounded-2xl px-3 py-3 text-center transition-all duration-300 ${selected ? 'border border-violet-400 bg-violet-500/15 shadow-[0_0_26px_rgba(139,92,246,0.5)]' : 'border border-transparent bg-transparent hover:bg-white/[0.04]'}`}
  >
    <div className="flex w-24 flex-col items-center gap-2">
      {vendor ? (
        <VendorLogo vendor={vendor} size="lg" />
      ) : (
        <div className={`flex h-20 w-20 items-center justify-center rounded-full border ${selected ? 'border-violet-300 bg-violet-500/20 text-violet-100' : 'border-white/15 bg-white/[0.06] text-white'}`}>
          <span className="material-symbols-outlined text-4xl">grid_view</span>
        </div>
      )}
      <span className="line-clamp-2 min-h-9 text-xs font-bold uppercase leading-tight text-white">{label}</span>
      {productCount !== undefined && (
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-black text-violet-200">{productCount} Products</span>
      )}
    </div>
  </motion.button>
);
