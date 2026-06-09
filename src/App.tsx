import React, { useState } from 'react';
import { ScreenId, CartItem, Measurement, Preference } from './types';
import { products } from './data';

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
      const updated = prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId];
      localStorage.setItem('wishlist', JSON.stringify(updated));
      return updated;
    });
  };

  // Dark mode state (persisted)
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('isDarkMode');
      return saved ? JSON.parse(saved) : false;
    } catch (e) {
      return false;
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
      const prod = products[opts?.productId || selectedProductId];
      addRecentActivity({ id: Date.now().toString(), name: prod?.name || 'AR Try-On', time, badge: 'AR Try-On', icon: 'checkroom', color: 'bg-primary/80', imageUrl: prod?.imageUrl || '' });
    } else if (to === 'camera-scan') {
      const prod = products[opts?.productId || selectedProductId];
      addRecentActivity({ id: Date.now().toString(), name: prod?.name || 'Camera Scan', time, badge: 'Camera Scan', icon: 'photo_camera', color: 'bg-secondary/80', imageUrl: prod?.imageUrl || '' });
    } else if (to === 'product-details') {
      const id = opts?.productId || selectedProductId;
      const prod = products[id];
      if (prod) addRecentActivity({ id: Date.now().toString(), name: prod.name, time, badge: 'Viewed', icon: 'checkroom', color: 'bg-primary/80', imageUrl: prod.imageUrl });
    } else if (to === 'scan-outfit') {
      addRecentActivity({ id: Date.now().toString(), name: 'Scan Outfit', time, badge: 'Scan', icon: 'center_focus_strong', color: 'bg-teal-600/80', imageUrl: '' });
    }
    setScreen(to);
  };

  // Initialize with one default item for convenient out-of-the-box checkout previews!
  const [cartItems, setCartItems] = useState<CartItem[]>([
    {
      product: products['lavender-hoodie'],
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
      const p = products[prodId];
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
            onSelectProduct={(id) => {
              setSelectedProductId(id);
              const prod = products[id];
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
            onNavigate={navigate} 
            onAddToCart={handleAddToCart}
            selectedColor={selectedColor}
            setSelectedColor={setSelectedColor}
            wishlist={wishlist}
            onToggleWishlist={handleToggleWishlist}
            selectedProductId={selectedProductId}
          />
        );
      case 'showroom':
        return (
          <ShowroomView 
            onNavigate={navigate}
            wishlist={wishlist}
            onToggleWishlist={handleToggleWishlist}
            onSelectProduct={(id) => {
              setSelectedProductId(id);
              const prod = products[id];
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
          />
        );
      default:
        return <HomeView userName={userName} onNavigate={navigate} recentActivity={recentActivityState} />;
    }
  };

  const handleSplashComplete = () => {
    // Go directly to onboarding so the user always sees both beautiful screens on reload
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
                  const prod = products[productId];
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
            onClick={() => navigate('ar-tryon')}
            className={`flex flex-col items-center space-y-1 py-1.5 px-3 transition-colors ${isTabActive('ar') ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: isTabActive('ar') ? "'FILL' 1" : undefined }}>view_in_ar</span>
            <span className="text-[10px] font-bold">AR Try-on</span>
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
