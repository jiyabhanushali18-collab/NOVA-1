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

  const handleToggleWishlist = (productId: string) => {
    setWishlist((prev) => {
      const updated = prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId];
      localStorage.setItem('wishlist', JSON.stringify(updated));
      return updated;
    });
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
            onNavigate={setScreen} 
            wishlist={wishlist}
            onToggleWishlist={handleToggleWishlist}
            onSelectProduct={(id) => {
              setSelectedProductId(id);
              const prod = products[id];
              if (prod && prod.colors && prod.colors.length > 0) {
                setSelectedColor(prod.colors[0]);
              }
              setScreen('product-details');
            }}
          />
        );
      case 'ar-tryon':
        return (
          <ArTryOnView 
            onNavigate={setScreen} 
            selectedGarment={selectedGarment}
            setSelectedGarment={setSelectedGarment}
          />
        );
      case 'tryon-result':
        return (
          <TryOnResultView 
            onNavigate={setScreen} 
            selectedColor={selectedColor}
            setSelectedColor={setSelectedColor}
            onAddToCart={handleAddToCart}
          />
        );
      case 'camera-scan':
        return <CameraScanView onNavigate={setScreen} />;
      case 'profile':
        return (
          <ProfileView 
            onNavigate={setScreen} 
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
            onNavigate={setScreen} 
            onAddToCart={handleAddToCart}
            selectedColor={selectedColor}
            setSelectedColor={setSelectedColor}
            wishlist={wishlist}
            onToggleWishlist={handleToggleWishlist}
            selectedProductId={selectedProductId}
          />
        );
      case 'scan-outfit':
        return <ScanOutfitView onNavigate={setScreen} />;
      case 'chat':
        return <ChatView userName={userName} onNavigate={setScreen} />;
      case 'cart':
        return (
          <CartView 
            onNavigate={setScreen} 
            cartItems={cartItems} 
            onUpdateQuantity={handleUpdateQuantity}
            onRemoveItem={handleRemoveItem}
            onClearCart={handleClearCart}
          />
        );
      default:
        return <HomeView userName={userName} onNavigate={setScreen} />;
    }
  };

  const handleSplashComplete = () => {
    // Go directly to onboarding so the user always sees both beautiful screens on reload
    setScreen('onboarding');
  };

  const handleOnboardingComplete = () => {
    localStorage.setItem('onboarding_completed', 'true');
    if (!isLoggedIn) {
      setScreen('login');
    } else {
      setScreen('home');
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
      setScreen('setup-preferences');
    } else {
      setScreen('home');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('isLoggedIn');
    setIsLoggedIn(false);
    setScreen('home');
  };

  // Navigation highlights checks
  const isTabActive = (tab: string) => {
    if (tab === 'home' && screen === 'home') return true;
    if (tab === 'scan' && (screen === 'scan-outfit' || screen === 'camera-scan')) return true;
    if (tab === 'ar' && (screen === 'ar-tryon' || screen === 'tryon-result')) return true;
    if (tab === 'chat' && screen === 'chat') return true;
    if (tab === 'profile' && screen === 'profile') return true;
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
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between max-w-md mx-auto relative bg-gradient-to-b from-indigo-50/40 via-white to-purple-50/40 shadow-2xl overflow-hidden font-sans border-x border-indigo-100">
      
      {/* 1. Header Toolbar (Hidden when immersive AR camera is loaded to mimic device viewport) */}
      {!isImmersiveAR && (
        <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-xl border-b border-indigo-100/40 px-6 py-4 flex items-center justify-between">
          <div 
            onClick={() => setScreen('home')}
            className="flex items-center space-x-2 cursor-pointer select-none group"
          >
            {/* Elegant futuristic brand logo icon incorporating vivid lavender/blue gradients */}
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-500 to-purple-500 flex items-center justify-center text-white font-extrabold shadow-md shadow-indigo-500/30 group-hover:scale-105 transition-transform">
              N
            </div>
            <div className="leading-none">
              <span className="text-base font-black tracking-tight text-slate-900 group-hover:text-indigo-600 transition-colors">NOVA</span>
              <span className="text-[8px] font-bold text-indigo-500 block mt-0.5 tracking-wider font-mono">VISION LABS</span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Quick Wishlist widget */}
            <button 
              onClick={() => {
                setScreen('profile');
              }}
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
              onClick={() => setScreen('cart')}
              className="w-10 h-10 rounded-full bg-indigo-50/40 flex items-center justify-center relative hover:bg-indigo-50 transition-colors border border-indigo-100/40"
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
              onClick={() => setScreen('profile')}
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
      <main className={`flex-grow relative ${isImmersiveAR ? '' : 'px-4 py-3 pb-24 bg-white/10'}`}>
        {renderActiveScreen()}
      </main>

      {/* 3. Bottom persistent device Navigation Tab-Bar (Hidden during immersive Tryon filtering) */}
      {!isImmersiveAR && (
        <nav className="fixed bottom-0 inset-x-0 max-w-md mx-auto bg-white/85 backdrop-blur-2xl border-t border-indigo-100/50 px-6 py-2 pb-5 flex items-center justify-between z-40 shadow-2xl shadow-indigo-950/15">
          <button 
            onClick={() => setScreen('home')}
            className={`flex flex-col items-center space-y-1 py-1.5 px-3 transition-colors ${isTabActive('home') ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: isTabActive('home') ? "'FILL' 1" : undefined }}>home</span>
            <span className="text-[10px] font-bold">Home</span>
          </button>

          <button 
            onClick={() => setScreen('scan-outfit')}
            className={`flex flex-col items-center space-y-1 py-1.5 px-3 transition-colors ${isTabActive('scan') ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: isTabActive('scan') ? "'FILL' 1" : undefined }}>center_focus_strong</span>
            <span className="text-[10px] font-bold">Scan</span>
          </button>

          <button 
            onClick={() => setScreen('ar-tryon')}
            className={`flex flex-col items-center space-y-1 py-1.5 px-3 transition-colors ${isTabActive('ar') ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: isTabActive('ar') ? "'FILL' 1" : undefined }}>view_in_ar</span>
            <span className="text-[10px] font-bold">AR Try-on</span>
          </button>

          <button 
            onClick={() => setScreen('chat')}
            className={`flex flex-col items-center space-y-1 py-1.5 px-3 transition-colors ${isTabActive('chat') ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: isTabActive('chat') ? "'FILL' 1" : undefined }}>forum</span>
            <span className="text-[10px] font-bold">Stylist AI</span>
          </button>

          <button 
            onClick={() => setScreen('profile')}
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
