import React, { useEffect, useState } from 'react';
import { collection, getDocs, QuerySnapshot, DocumentData } from 'firebase/firestore';
import { ScreenId, CartItem, Measurement, Preference, ProductItem } from './types';
import { products } from './data';
import { db } from './firebase';

// Modular View Imports
import { HomeView } from './components/HomeView';
import { ArTryOnView } from './components/ArTryOnView';
import { TryOnResultView } from './components/TryOnResultView';
import { CameraScanView } from './components/CameraScanView';
import { ProfileView } from './components/ProfileView';
import { ProductDetailsView } from './components/ProductDetailsView';
import { ScanOutfitView } from './components/ScanOutfitView';
import { ChatView } from './components/ChatView';
import { CartView } from './components/CartView';
import { ShowroomView } from './components/ShowroomView';
import { AuthView } from './components/AuthView';
import { SplashView } from './components/SplashView';
import { OnboardingView } from './components/OnboardingView';
import { SetupPreferencesView } from './components/SetupPreferencesView';
import { VirtualWardrobeView } from './components/VirtualWardrobeView';

const getStringValue = (value: unknown): string | undefined => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const candidate = record.imageUrl || record.url || record.src || record.image;
  if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  return undefined;
};

const getColorValue = (value: unknown): string | undefined => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const candidate = record.color || record.name || record.label;
  if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  return undefined;
};

const normalizeColor = (value: unknown) => {
  return typeof value === 'string'
    ? value.toLowerCase().trim().replace(/[^a-z0-9]/g, '')
    : '';
};

const asStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : typeof item === 'number' ? String(item).trim() : ''))
      .filter((item) => item.length > 0);
  }

  if (typeof value === 'string' && value.trim()) {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  return [];
};

const addColorImage = (result: Record<string, string[]>, color: unknown, imageUrl: unknown) => {
  const imageUrlString = getStringValue(imageUrl);
  const colorString = getColorValue(color) || (typeof color === 'string' ? color.trim() : '');
  const normalized = normalizeColor(colorString);

  if (normalized && imageUrlString) {
    result[normalized] = result[normalized] || [];
    if (!result[normalized].includes(imageUrlString)) result[normalized].push(imageUrlString);

    if (colorString) {
      result[colorString] = result[colorString] || [];
      if (!result[colorString].includes(imageUrlString)) result[colorString].push(imageUrlString);
    }
  }
};

const processColorImageSource = (result: Record<string, string[]>, source: unknown) => {
  if (!source) return;
  if (Array.isArray(source)) {
    source.forEach((entry) => {
      if (!entry || typeof entry !== 'object') return;
      addColorImage(result, (entry as any).color || (entry as any).name || (entry as any).label, (entry as any).imageUrl || (entry as any).image || (entry as any).url || (entry as any).src);
    });
    return;
  }
  if (typeof source === 'object') {
    Object.entries(source).forEach(([key, value]) => {
      addColorImage(result, key, value);
    });
  }
};

const buildColorImages = (data: Record<string, any>, colors: string[]) => {
  const tmp: Record<string, string[]> = {};
  const mapSources = [data.colorImages, data.imagesByColor, data.colorImageUrls, data.imageUrls];

  mapSources.forEach((source) => processColorImageSource(tmp, source));

  const variantSources = [data.variants, data.colorVariants, data.colorsData];
  variantSources.forEach((source) => {
    if (!Array.isArray(source)) return;
    source.forEach((variant) => {
      if (!variant || typeof variant !== 'object') return;
      addColorImage(tmp, (variant as any).color || (variant as any).name || (variant as any).label, (variant as any).imageUrl || (variant as any).image || (variant as any).url || (variant as any).src);
    });
  });

  // Enhanced: scan all fields for color-based image naming (e.g., redImage, pinkImage, yellowImage)
  Object.entries(data).forEach(([fieldName, value]) => {
    const lowerField = fieldName.toLowerCase();
    const imageUrl = getStringValue(value);
    
    if (!imageUrl) return;

    // Check if any word from the color name appears in the field name
    colors.forEach((color) => {
      const colorWords = color.toLowerCase().split(/\s+/);
      const matchesAnyWord = colorWords.some((word) => lowerField.includes(word));
      
      if (matchesAnyWord) {
        addColorImage(tmp, color, value);
      }
    });
  });

  // convert tmp (arrays) into result where values are single string or array
  const result: Record<string, string | string[]> = {};
  Object.entries(tmp).forEach(([k, arr]) => {
    if (!arr || arr.length === 0) return;
    result[k] = arr.length === 1 ? arr[0] : arr.slice();
  });

  // If some colors have mappings but others don't, try to use numbered/global image fields
  if (Object.keys(result).length > 0) {
    const mappedColors = Object.keys(result).map((k) => normalizeColor(k));
    const missing = colors.filter((c) => !mappedColors.includes(normalizeColor(c)));
    if (missing.length > 0) {
      // collect numbered/global images (imageUrl, imageUrl2, image2...)
      let numbered: string[] = [];
      const base = getStringValue(data.imageUrl) || getStringValue(data.image) || getStringValue(data.image1) || getStringValue(data.img1);
      if (base) numbered.push(base);
      for (let i = 2; i <= 8; i += 1) {
        const candidates = [
          `imageUrl${i}`,
          `image${i}`,
          `img${i}`,
          `image_url${i}`,
          `url${i}`
        ];
        for (const key of candidates) {
          const val = getStringValue((data as any)[key]);
          if (val && !numbered.includes(val)) {
            numbered.push(val);
            break;
          }
        }
      }

      if (numbered.length > 0) {
        if (missing.length === 1) {
          const colorKey = missing[0];
          const norm = normalizeColor(colorKey);
          result[colorKey] = numbered.length === 1 ? numbered[0] : numbered.slice();
          if (!(norm in result)) result[norm] = result[colorKey];
        } else {
          // distribute images across missing colors in order
          for (let i = 0; i < Math.min(missing.length, numbered.length); i += 1) {
            const colorKey = missing[i];
            const norm = normalizeColor(colorKey);
            result[colorKey] = numbered[i];
            if (!(norm in result)) result[norm] = numbered[i];
          }
        }
      }
    }

    return result;
  }

  // Try common list field first
  let imageUrlsArray = asStringArray(data.imageUrls);
  // If not present, also collect numbered image fields like imageUrl2, image2, image_2, img2, etc.
  if (imageUrlsArray.length === 0) {
    const numbered: string[] = [];
    // include base imageUrl if present
    const base = getStringValue(data.imageUrl) || getStringValue(data.image) || getStringValue(data.image1) || getStringValue(data.img1);
    if (base) numbered.push(base);
    for (let i = 2; i <= 8; i += 1) {
      const candidates = [
        `imageUrl${i}`,
        `image${i}`,
        `img${i}`,
        `image_url${i}`,
        `url${i}`
      ];
      for (const key of candidates) {
        const val = getStringValue((data as any)[key]);
        if (val && !numbered.includes(val)) {
          numbered.push(val);
          break;
        }
      }
    }
    imageUrlsArray = numbered;
  }
  if (imageUrlsArray.length > 0 && colors.length > 0) {
    const count = Math.min(colors.length, imageUrlsArray.length);
    for (let idx = 0; idx < count; idx += 1) {
      const key = normalizeColor(colors[idx]);
      if (key && imageUrlsArray[idx]) {
        result[key] = imageUrlsArray[idx];
      }
    }
  }

  if (Object.keys(result).length > 0) return result;

  const imageUrl = getStringValue(data.imageUrl) || getStringValue(data.image) || '';
  if (imageUrl && colors.length > 0) {
    colors.forEach((color) => {
      const key = normalizeColor(color);
      if (key) {
        result[key] = imageUrl;
      }
    });
    return result;
  }

  return undefined;
};

export default function App() {
  // Session authorization states loaded from localStorage
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => localStorage.getItem('isLoggedIn') === 'true');
  const [screen, setScreen] = useState<ScreenId>('splash');
  const [userName, setUserName] = useState<string>(() => localStorage.getItem('userName') || 'Arjun Mehta');
  const [userEmail, setUserEmail] = useState<string>(() => localStorage.getItem('userEmail') || 'arjun.mehta@email.com');
  const [userPhone, setUserPhone] = useState<string>(() => localStorage.getItem('userPhone') || '+91 98765 43210');

  // Persistent measurements state
  const [measurements, setMeasurements] = useState<Measurement[]>(() => {
    try {
      const saved = localStorage.getItem('measurements');
      return saved ? JSON.parse(saved) : [
        { label: 'Height', value: '178 cm', iconName: 'height' },
        { label: 'Weight', value: '68 kg', iconName: 'fitness_center' },
        { label: 'Chest', value: '98 cm', iconName: 'checkroom' },
        { label: 'Waist', value: '82 cm', iconName: 'straighten' },
        { label: 'Inseam', value: '78 cm', iconName: 'architecture' }
      ];
    } catch (e) {
      return [
        { label: 'Height', value: '178 cm', iconName: 'height' },
        { label: 'Weight', value: '68 kg', iconName: 'fitness_center' },
        { label: 'Chest', value: '98 cm', iconName: 'checkroom' },
        { label: 'Waist', value: '82 cm', iconName: 'straighten' },
        { label: 'Inseam', value: '78 cm', iconName: 'architecture' }
      ];
    }
  });

  // Persistent preferences state
  const [preferences, setPreferences] = useState<Preference[]>(() => {
    try {
      const saved = localStorage.getItem('preferences');
      return saved ? JSON.parse(saved) : [
        { label: 'Style', value: 'Streetwear', iconName: 'style' },
        { label: 'Fit', value: 'Regular', iconName: 'fit_screen' },
        { label: 'Colors', value: 'Mix', iconName: 'palette' },
        { label: 'Occasion', value: 'Casual', iconName: 'event' }
      ];
    } catch (e) {
      return [
        { label: 'Style', value: 'Streetwear', iconName: 'style' },
        { label: 'Fit', value: 'Regular', iconName: 'fit_screen' },
        { label: 'Colors', value: 'Mix', iconName: 'palette' },
        { label: 'Occasion', value: 'Casual', iconName: 'event' }
      ];
    }
  });

  const handleUpdateMeasurements = (newMeasurements: Measurement[]) => {
    setMeasurements(newMeasurements);
    localStorage.setItem('measurements', JSON.stringify(newMeasurements));
  };

  const handleUpdatePreferences = (newPreferences: Preference[]) => {
    setPreferences(newPreferences);
    localStorage.setItem('preferences', JSON.stringify(newPreferences));
  };

  const [novaPoints, setNovaPoints] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('nova_points');
      const parsed = saved ? Number(saved) : NaN;
      return Number.isFinite(parsed) && parsed >= 100 ? parsed : 100;
    } catch {
      return 100;
    }
  });

  const levelThresholds = [100, 300, 600, 1000, 1500, 2200];
  const getNovaLevel = (points: number) => {
    if (points < 300) return 1;
    if (points < 600) return 2;
    if (points < 1000) return 3;
    if (points < 1500) return 4;
    return 5;
  };

  const getNextLevelThreshold = (points: number) => {
    return levelThresholds.find((threshold) => threshold > Math.max(points, 100)) ?? levelThresholds[levelThresholds.length - 1];
  };

  const awardNovaPoints = (amount: number, description: string) => {
    if (amount <= 0) return;
    setNovaPoints((prevPoints) => {
      const nextPoints = Math.max(100, prevPoints + amount);
      localStorage.setItem('nova_points', String(nextPoints));
      addRecentActivity({
        id: Date.now().toString(),
        name: `${description}`,
        time: new Date().toLocaleTimeString(),
        badge: 'NOVA Rewards',
        icon: 'stars',
        color: 'bg-amber-500/80',
        imageUrl: ''
      });
      return nextPoints;
    });
  };

  const novaLevel = getNovaLevel(novaPoints);
  const nextLevelThreshold = getNextLevelThreshold(novaPoints);
  const currentLevelFloor = novaLevel === 1 ? 100 : levelThresholds[novaLevel - 1];
  const pointsToNextLevel = Math.max(0, nextLevelThreshold - novaPoints);
  const levelProgress = Math.min(
    100,
    Math.round(((novaPoints - currentLevelFloor) / Math.max(1, nextLevelThreshold - currentLevelFloor)) * 100)
  );

  const [productsData, setProductsData] = useState<Record<string, ProductItem>>(() => products);
  const [productsLoading, setProductsLoading] = useState<boolean>(true);
  const [productsError, setProductsError] = useState<string | null>(null);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        setProductsLoading(true);
        const snapshot = await getDocs(collection(db, 'products'));
        const fetchedProducts: Record<string, ProductItem> = {};

        snapshot.forEach((doc: any) => {
          const data = doc.data() as any;
          const id = doc.id;
          const colors = Array.isArray(data.colors)
            ? data.colors
                .map((value: unknown) => String(value))
                .map((value: string) => value.trim())
                .filter((value: string) => value.length > 0)
            : ['Standard'];
          const imageUrl = getStringValue(data.imageUrl) || getStringValue(data.image) || '';
          const imageUrls = asStringArray(data.imageUrls);

          fetchedProducts[id] = {
            id,
            name: String(data.name || 'Unnamed Product'),
            category: String(data.category || 'Uncategorized'),
            price: Number(data.price || 0),
            originalPrice: data.originalPrice !== undefined ? Number(data.originalPrice) : undefined,
            rating: Number(data.rating || 0),
            reviewsCount: Number(data.reviewsCount || 0),
            imageUrl,
            imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
            colorImages: buildColorImages({ ...data, imageUrl }, colors),
            colors,
            sizes: Array.isArray(data.sizes)
              ? data.sizes
                  .map((value: unknown) => String(value))
                  .map((value: string) => value.trim())
                  .filter((value: string) => value.length > 0)
              : ['One Size'],
            inStock: data.inStock !== undefined ? Boolean(data.inStock) : true,
            stockLeft: data.stockLeft !== undefined ? Number(data.stockLeft) : undefined,
            badge: data.badge ? String(data.badge) : undefined,
            details: Array.isArray(data.details) ? data.details.map(String) : []
          };
        });

        if (Object.keys(fetchedProducts).length > 0) {
          setProductsData((prev) => ({ ...prev, ...fetchedProducts }));
        } else {
          console.warn('Firestore returned no products; falling back to local sample data.');
          setProductsData((prev) => ({ ...prev, ...products }));
          setProductsError('Firestore did not return any products; using local sample data.');
        }
      } catch (error) {
        console.error('Error loading Firebase products:', error);
        setProductsData((prev) => ({ ...prev, ...products }));
        setProductsError('Unable to load showroom items from Firestore. Showing local sample data instead.');
      } finally {
        setProductsLoading(false);
      }
    };

    loadProducts();
  }, []);

  // Persistent wishlist/favorites state
  const [wishlist, setWishlist] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('wishlist');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // Local modal to quickly view wishlist without navigating away
  const [isWishlistOpen, setIsWishlistOpen] = useState<boolean>(false);

  const handleToggleWishlist = (productId: string) => {
    setWishlist((prev) => {
      const isAdding = !prev.includes(productId);
      const updated = isAdding ? [...prev, productId] : prev.filter((id) => id !== productId);
      localStorage.setItem('wishlist', JSON.stringify(updated));
      if (isAdding) {
        awardNovaPoints(15, 'Saved item to Wishlist');
      }
      return updated;
    });
  };

  // Dark mode state (persisted)
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('isDarkMode');
      return saved ? JSON.parse(saved) : true;
    } catch (e) {
      return true;
    }
  });

  // Recent activity state (persisted) - starts empty, populated only by real user interactions
  const [recentActivityState, setRecentActivityState] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('recent_activity');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const addRecentActivity = (entry: any) => {
    setRecentActivityState((prev: any[]) => {
      const updated = [entry, ...prev.filter((p) => p.name !== entry.name)];
      if (updated.length > 12) updated.splice(12);
      try { localStorage.setItem('recent_activity', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  // Navigation wrapper that logs activity for relevant screens
  const navigate = (to: ScreenId, opts?: { productId?: string }) => {
    const time = new Date().toLocaleString();
    if (to === 'ar-tryon') {
      const prod = productsData[opts?.productId || selectedProductId];
      addRecentActivity({ id: Date.now().toString(), name: prod?.name || 'AR Try-On', time, badge: 'AR Try-On', icon: 'checkroom', color: 'bg-primary/80', imageUrl: prod?.imageUrl || '' });
      awardNovaPoints(25, 'Engaged in AR Try-On');
    } else if (to === 'camera-scan') {
      const prod = productsData[opts?.productId || selectedProductId];
      addRecentActivity({ id: Date.now().toLocaleString(), name: prod?.name || 'Camera Scan', time, badge: 'Camera Scan', icon: 'photo_camera', color: 'bg-secondary/80', imageUrl: prod?.imageUrl || '' });
    } else if (to === 'product-details') {
      const id = opts?.productId || selectedProductId;
      const prod = productsData[id];
      if (prod) addRecentActivity({ id: Date.now().toString(), name: prod.name, time, badge: 'Viewed', icon: 'checkroom', color: 'bg-primary/80', imageUrl: prod.imageUrl });
    } else if (to === 'scan-outfit') {
      addRecentActivity({ id: Date.now().toString(), name: 'Scan Outfit', time, badge: 'Scan', icon: 'center_focus_strong', color: 'bg-teal-600/80', imageUrl: '' });
    } else if (to === 'wardrobe') {
      addRecentActivity({ id: Date.now().toString(), name: 'Virtual Wardrobe', time, badge: 'Wardrobe', icon: 'checkroom', color: 'bg-indigo-600/80', imageUrl: '' });
    }
    setScreen(to);
  };

  // Initialize with one default item for convenient out-of-the-box checkout previews!
  const [cartItems, setCartItems] = useState<CartItem[]>([
    {
      product: productsData['lavender-hoodie'] || products['lavender-hoodie'],
      quantity: 1,
      color: 'Lavender',
      size: 'M'
    }
  ]);

  const [selectedColor, setSelectedColor] = useState<string>('Lavender');
  const [selectedGarment, setSelectedGarment] = useState<string>('Lavender');
  const [selectedProductId, setSelectedProductId] = useState<string>('lavender-hoodie');

  // Interactive Cart Handlers
  const handleAddToCart = (prodId: string, color: string, size: string) => {
    const isPresentIndex = cartItems.findIndex(
      (item) => item.product.id === prodId && item.color === color && item.size === size
    );

    if (isPresentIndex > -1) {
      const updated = [...cartItems];
      updated[isPresentIndex].quantity += 1;
      setCartItems(updated);
    } else {
      const p = productsData[prodId] || products[prodId];
      if (p) {
        setCartItems([
          ...cartItems,
          {
            product: p,
            quantity: 1,
            color,
            size
          }
        ]);
      }
    }
  };

  const handleUpdateQuantity = (idx: number, dQ: number) => {
    const updated = [...cartItems];
    const newQty = updated[idx].quantity + dQ;
    if (newQty <= 0) {
      updated.splice(idx, 1);
    } else {
      updated[idx].quantity = newQty;
    }
    setCartItems(updated);
  };

  const handleRemoveItem = (idx: number) => {
    const updated = [...cartItems];
    updated.splice(idx, 1);
    setCartItems(updated);
  };

  const handleClearCart = () => {
    setCartItems([]);
  };

  const countCartTotalItems = () => {
    return cartItems.reduce((acc, curr) => acc + curr.quantity, 0);
  };

  // Safe router render switcher
  const renderActiveScreen = () => {
    switch (screen) {
      case 'home':
        return (
          <HomeView 
            userName={userName} 
            onNavigate={navigate} 
            wishlist={wishlist}
            recentActivity={recentActivityState}
            onToggleWishlist={handleToggleWishlist}
            isDarkMode={isDarkMode}
            onSelectProduct={(id) => {
              setSelectedProductId(id);
              const prod = productsData[id] || products[id];
              if (prod && prod.colors && prod.colors.length > 0) {
                setSelectedColor(prod.colors[0]);
              }
              navigate('product-details', { productId: id });
            }}
          />
        );
      case 'ar-tryon':
        return (
          <ArTryOnView 
            onNavigate={navigate} 
            selectedGarment={selectedGarment}
            setSelectedGarment={setSelectedGarment}
          />
        );
      case 'tryon-result':
        return (
          <TryOnResultView 
            onNavigate={navigate} 
            selectedColor={selectedColor}
            setSelectedColor={setSelectedColor}
            onAddToCart={handleAddToCart}
          />
        );
      case 'camera-scan':
        return <CameraScanView onNavigate={navigate} />;
      case 'profile':
        return (
          <ProfileView 
            onNavigate={navigate} 
            userName={userName} 
            setUserName={setUserName} 
            userEmail={userEmail}
            userPhone={userPhone}
            onLogout={handleLogout}
            wishlist={wishlist}
            onToggleWishlist={handleToggleWishlist}
            onAddToCart={handleAddToCart}
            measurements={measurements}
            onUpdateMeasurements={handleUpdateMeasurements}
            preferences={preferences}
            onUpdatePreferences={handleUpdatePreferences}
            isDarkMode={isDarkMode}
            setIsDarkMode={setIsDarkMode}
            novaPoints={novaPoints}
            novaLevel={novaLevel}
            pointsToNextLevel={pointsToNextLevel}
            levelProgress={levelProgress}
          />
        );
      case 'setup-preferences':
        return (
          <SetupPreferencesView 
            userName={userName}
            onComplete={(newPrefs, newMeasures) => {
              handleUpdatePreferences(newPrefs);
              handleUpdateMeasurements(newMeasures);
              setScreen('home');
            }}
          />
        );
      case 'product-details':
        return (
          <ProductDetailsView 
            products={productsData}
            onNavigate={navigate} 
            onAddToCart={handleAddToCart}
            selectedColor={selectedColor}
            setSelectedColor={setSelectedColor}
            wishlist={wishlist}
            onToggleWishlist={handleToggleWishlist}
            selectedProductId={selectedProductId}
            isDarkMode={isDarkMode}
          />
        );
      case 'showroom':
        return (
          <ShowroomView 
            products={Object.values(productsData)}
            loading={productsLoading}
            error={productsError}
            onNavigate={navigate}
            wishlist={wishlist}
            onToggleWishlist={handleToggleWishlist}
            isDarkMode={isDarkMode}
            onSelectProduct={(id) => {
              setSelectedProductId(id);
              const prod = productsData[id] || products[id];
              if (prod && prod.colors && prod.colors.length > 0) {
                setSelectedColor(prod.colors[0]);
              }
              navigate('product-details', { productId: id });
            }}
            cartItemsCount={countCartTotalItems()}
          />
        );
      case 'scan-outfit':
        return <ScanOutfitView onNavigate={navigate} />;
      case 'wardrobe':
        return <VirtualWardrobeView onNavigate={navigate} userEmail={userEmail} isDarkMode={isDarkMode} />;
      case 'chat':
        return <ChatView userName={userName} onNavigate={navigate} />;
      case 'cart':
        return (
          <CartView 
            onNavigate={navigate} 
            cartItems={cartItems} 
            onUpdateQuantity={handleUpdateQuantity}
            onRemoveItem={handleRemoveItem}
            onClearCart={handleClearCart}
            isDarkMode={isDarkMode}
          />
        );
      default:
        return <HomeView userName={userName} onNavigate={navigate} recentActivity={recentActivityState} isDarkMode={isDarkMode} />;
    }
  };

  const handleSplashComplete = () => {
    setScreen('onboarding');
  };

  const handleOnboardingComplete = () => {
    localStorage.setItem('onboarding_completed', 'true');
    if (!isLoggedIn) {
      navigate('login');
    } else {
      navigate('home');
    }
  };

  const handleLoginSuccess = (name: string, email: string, phone: string, isSignUp?: boolean) => {
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('userName', name);
    localStorage.setItem('userEmail', email);
    localStorage.setItem('userPhone', phone);
    setUserName(name);
    setUserEmail(email);
    setUserPhone(phone);
    setIsLoggedIn(true);
    if (isSignUp) {
      navigate('setup-preferences');
    } else {
      navigate('home');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('isLoggedIn');
    setIsLoggedIn(false);
    navigate('home');
  };

  // Navigation highlights checks
  const isTabActive = (tab: string) => {
    if (tab === 'home' && screen === 'home') return true;
    if (tab === 'scan' && (screen === 'scan-outfit' || screen === 'camera-scan')) return true;
    if (tab === 'wardrobe' && screen === 'wardrobe') return true;
    if (tab === 'ar' && (screen === 'ar-tryon' || screen === 'tryon-result')) return true;
    if (tab === 'chat' && screen === 'chat') return true;
    if (tab === 'profile' && screen === 'profile') return true;
    if (tab === 'showroom' && (screen === 'showroom' || screen === 'cart')) return true;
    return false;
  };

  // Determine if full-screen preview camera active (no standard header/nav shown on live tryon to emulate immersive filter experience!)
  const isImmersiveAR = screen === 'ar-tryon' || screen === 'setup-preferences';

  // Splash Screen Guard
  if (screen === 'splash') {
    return <SplashView onComplete={handleSplashComplete} />;
  }

  // Onboarding Slides Guard
  if (screen === 'onboarding') {
    return <OnboardingView onComplete={handleOnboardingComplete} />;
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center max-w-md mx-auto relative bg-gradient-to-b from-indigo-50/50 via-white to-purple-50/50 shadow-2xl overflow-hidden font-sans border-x border-indigo-100">
        <main className="flex-grow relative px-4 py-3 bg-white/20 flex flex-col justify-center">
          <AuthView onLoginSuccess={handleLoginSuccess} />
        </main>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col justify-between max-w-md mx-auto relative shadow-2xl overflow-hidden font-sans transition-colors duration-300 ${
      isDarkMode 
        ? 'bg-slate-950 border-x border-slate-800 text-white' 
        : 'bg-slate-50 border-x border-indigo-100 bg-gradient-to-b from-indigo-50/40 via-white to-purple-50/40'
    }`}>
      
      {/* 1. Header Toolbar (Hidden when immersive AR camera is loaded to mimic device viewport) */}
      {!isImmersiveAR && (
        <header className={`sticky top-0 z-40 backdrop-blur-xl px-6 py-4 flex items-center justify-between transition-colors duration-300 ${
          isDarkMode
            ? 'bg-slate-900/85 border-b border-slate-800/40'
            : 'bg-white/85 border-b border-indigo-100/40'
        }`}>
          <div 
                    onClick={() => navigate('home')}
            className="flex items-center space-x-2 cursor-pointer select-none group"
          >
            {/* Elegant futuristic brand logo icon incorporating vivid lavender/blue gradients */}
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-500 to-purple-500 flex items-center justify-center text-white font-extrabold shadow-md shadow-indigo-500/30 group-hover:scale-105 transition-transform">
              N
            </div>
            <div className="leading-none">
              <span className={`text-base font-black tracking-tight group-hover:text-indigo-600 transition-colors ${
                isDarkMode ? 'text-white' : 'text-slate-900'
              }`}>NOVA</span>
              <span className={`text-[8px] font-bold block mt-0.5 tracking-wider font-mono ${
                isDarkMode ? 'text-indigo-400' : 'text-indigo-500'
              }`}>VISION LABS</span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Quick Wishlist widget (opens modal) */}
            <button 
              onClick={() => setIsWishlistOpen(true)}
              className="w-10 h-10 rounded-full bg-rose-50/40 hover:bg-rose-50 flex items-center justify-center relative transition-colors border border-rose-100/40"
              title="View Wishlist"
            >
              <span className="material-symbols-outlined text-rose-500 text-[20px]" style={{ fontVariationSettings: wishlist.length > 0 ? "'FILL' 1" : undefined }}>favorite</span>
              {wishlist.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-r from-pink-500 to-rose-600 text-white text-[10px] font-black flex items-center justify-center shadow border border-white">
                  {wishlist.length}
                </span>
              )}
            </button>

            {/* Quick Shopping Cart widget */}
            <button 
              onClick={() => navigate('cart')}
              className="w-10 h-10 rounded-full bg-indigo-50/40 flex items-center justify-center relative hover:bg-indigo-50 transition-colors border border-indigo-100/40"
              title="View Cart"
            >
              <span className="material-symbols-outlined text-indigo-600 text-[20px]">local_mall</span>
              {countCartTotalItems() > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-[10px] font-black flex items-center justify-center shadow border border-white animate-pulse">
                  {countCartTotalItems()}
                </span>
              )}
            </button>

            {/* Quick profile thumbnail widget */}
            <button 
              onClick={() => navigate('profile')}
              className="w-9 h-9 rounded-full overflow-hidden border-2 border-indigo-100 hover:border-indigo-350 transition-all shadow"
            >
              <img 
                alt="Account profile" 
                className="w-full h-full object-cover" 
                referrerPolicy="no-referrer"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCmbdmCX9HTnsu3re-LKTwZeIzdxiZpbS33EX-8SJnYFnfuUKDEV1s_Hw7EGDD1SVWZHfYR4kRFIsuBmjqTEV7Brdv3HHvCLCeIj4Oo97NE4d_W91RCG_MoaGi64JI-_PNj1ZMPL4tHcbNr6gTkbXBvCYURW7LmoMLBQWAOkByDufT4T0kIjneJFVxvxc9UQNrgze1LxB7o9r3KStxC6uXasen_3YXM3SWX81zs9lFiyEA2Dt1jHIaBbOIq5DpPENqF0yZVneBSZiXD"
              />
            </button>
          </div>
        </header>
      )}

      {/* 2. Primary Page Contents Body (with comfortable padding, except AR which covers background fully) */}
      <main className={`flex-grow relative transition-colors duration-300 ${isImmersiveAR ? '' : `px-4 py-3 pb-24 ${isDarkMode ? 'bg-slate-950/10' : 'bg-white/10'}`}`}>
        {renderActiveScreen()}
      </main>

      {/* Wishlist Modal (quick view) */}
      {isWishlistOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setIsWishlistOpen(false)} />
          <div className={`relative w-full max-w-md rounded-3xl shadow-xl p-4 overflow-y-auto max-h-[70vh] transition-colors duration-300 ${
            isDarkMode ? 'bg-slate-900' : 'bg-white'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Saved Items ({wishlist.length})</h3>
              <button onClick={() => setIsWishlistOpen(false)} className={`${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-800'}`}>Close</button>
            </div>
            {wishlist.length === 0 ? (
              <div className={`p-6 text-center ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                No saved items yet — tap the heart on products to save them.
              </div>
            ) : (
              <div className="space-y-3">
                {wishlist.map((productId) => {
                  const prod = productsData[productId] || products[productId];
                  if (!prod) return null;
                  const defaultColor = prod.colors && prod.colors.length > 0 ? prod.colors[0] : 'Default';
                  const defaultSize = prod.sizes && prod.sizes.length > 0 ? prod.sizes[0] : 'One Size';
                  return (
                    <div key={productId} className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50">
                      <div className="w-14 h-14 rounded-lg overflow-hidden bg-slate-100 border">
                        <img alt={prod.name} src={prod.imageUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-slate-700 truncate">{prod.name}</div>
                        <div className="text-[11px] text-slate-500">₹{prod.price}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            handleAddToCart(productId, defaultColor, defaultSize);
                          }}
                          className="py-2 px-3 bg-indigo-600 text-white rounded-xl text-xs font-bold"
                        >Add</button>
                        <button
                          onClick={() => {
                            handleToggleWishlist(productId);
                          }}
                          className="py-2 px-3 bg-red-50 text-red-600 rounded-xl text-xs font-bold border border-red-100"
                        >Remove</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
      {/* 3. Bottom persistent device Navigation Tab-Bar (Hidden during immersive Tryon filtering) */}
      {!isImmersiveAR && (
        <nav className={`fixed bottom-0 inset-x-0 max-w-md mx-auto backdrop-blur-2xl px-6 py-2 pb-5 flex items-center justify-between z-40 shadow-2xl transition-colors duration-300 ${
          isDarkMode
            ? 'bg-slate-900/85 border-t border-slate-800/50 shadow-slate-950/50'
            : 'bg-white/85 border-t border-indigo-100/50 shadow-indigo-950/15'
        }`}>
          <button 
            onClick={() => navigate('home')}
            className={`flex flex-col items-center space-y-1 py-1.5 px-3 transition-colors ${isTabActive('home') ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: isTabActive('home') ? "'FILL' 1" : undefined }}>home</span>
            <span className="text-[10px] font-bold">Home</span>
          </button>

          <button 
            onClick={() => navigate('scan-outfit')}
            className={`flex flex-col items-center space-y-1 py-1.5 px-3 transition-colors ${isTabActive('scan') ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: isTabActive('scan') ? "'FILL' 1" : undefined }}>center_focus_strong</span>
            <span className="text-[10px] font-bold">Scan</span>
          </button>

          <button 
            onClick={() => navigate('wardrobe')}
            className={`flex flex-col items-center space-y-1 py-1.5 px-3 transition-colors ${isTabActive('wardrobe') ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: isTabActive('wardrobe') ? "'FILL' 1" : undefined }}>checkroom</span>
            <span className="text-[10px] font-bold">Wardrobe</span>
          </button>

          <button 
            onClick={() => navigate('chat')}
            className={`flex flex-col items-center space-y-1 py-1.5 px-3 transition-colors ${isTabActive('chat') ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: isTabActive('chat') ? "'FILL' 1" : undefined }}>forum</span>
            <span className="text-[10px] font-bold">Stylist AI</span>
          </button>

          <button 
            onClick={() => navigate('profile')}
            className={`flex flex-col items-center space-y-1 py-1.5 px-3 transition-colors ${isTabActive('profile') ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: isTabActive('profile') ? "'FILL' 1" : undefined }}>person</span>
            <span className="text-[10px] font-bold">Profile</span>
          </button>
        </nav>
      )}
    </div>
  );
}
