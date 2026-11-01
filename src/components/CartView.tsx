import { useI18n } from '../i18n';
import { useBackHandler } from '../services/backButtonService';
import React, { useEffect, useState } from 'react';
import { ScreenId, CartItem, DeliveryAddress, OrderRecord } from '../types';
import { getGarmentColorImage } from '../utils/arTryOnColors';
import { analytics } from '../services/analyticsService';
import {
  createOrderSnapshot,
  fetchUserDeliveryAddress,
  formatDeliveryAddress,
  isGuestIdentity,
  saveUserDeliveryAddress,
  validateDeliveryAddress
} from '../services/addressService';

interface CartViewProps {
  onNavigate: (screen: ScreenId) => void;
  cartItems: CartItem[];
  onUpdateQuantity: (idx: number, dQ: number) => void;
  onRemoveItem: (idx: number) => void;
  onClearCart: () => void;
  isDarkMode?: boolean;
  userId?: string;
  userName?: string;
  userEmail?: string;
  userPhone?: string;
  userAddress?: string;
  userPinCode?: string;
  savedDeliveryAddress?: DeliveryAddress | null;
  savedAddresses?: DeliveryAddress[];
  isGuest?: boolean;
  onSaveAddress?: (address: DeliveryAddress, allAddresses: DeliveryAddress[]) => Promise<void> | void;
  onOrderPlaced?: (order: OrderRecord) => void;
}

export const CartView: React.FC<CartViewProps> = ({
  onNavigate,
  cartItems,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  isDarkMode = false,
  userId = 'guest',
  userName = '',
  userEmail = '',
  userPhone = '',
  userAddress = '',
  userPinCode = '',
  savedDeliveryAddress = null,
  savedAddresses = [],
  isGuest = false,
  onSaveAddress,
  onOrderPlaced
}) => {
  const { t } = useI18n();
  const effectiveIsGuest = isGuestIdentity(userId, isGuest);
  const [step, setStep] = useState<'cart' | 'address' | 'payment' | 'completed'>('cart');

  // Priority 2: Navigate back through checkout steps before exiting Cart
  useBackHandler('cart-steps', () => {
    if (step === 'completed') {
      setStep('cart');
      onNavigate('home');
      return true;
    }
    if (step === 'payment') {
      setStep('address');
      return true;
    }
    if (step === 'address') {
      setStep('cart');
      return true;
    }
    if (step === 'cart') {
      onNavigate('home');
      return true;
    }
    return false;
  }, 40, true);
  const [couponCode, setCouponCode] = useState('');
  const [discountApplied, setDiscountApplied] = useState(false);
  const [addressChoice, setAddressChoice] = useState<'home' | 'work'>('home');
  const [selectedSavedAddressId, setSelectedSavedAddressId] = useState(
    savedDeliveryAddress?.id || savedAddresses[0]?.id || ''
  );
  const [paymentChoice, setPaymentChoice] = useState<'upi' | 'card' | 'cod'>('upi');

  // Delivery address form fields (linked to authenticated user's saved address or empty when none exists)
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [flatNo, setFlatNo] = useState('');
  const [landmark, setLandmark] = useState('');
  const [city, setCity] = useState('');
  const [pinCode, setPinCode] = useState('');

  const [resolvedPrimaryAddress, setResolvedPrimaryAddress] = useState<DeliveryAddress | null>(
    effectiveIsGuest ? null : savedDeliveryAddress
  );
  const [userAddressList, setUserAddressList] = useState<DeliveryAddress[]>(
    effectiveIsGuest ? [] : savedAddresses
  );
  const [saveAddressToProfile, setSaveAddressToProfile] = useState<boolean>(false);
  const [addressLoading, setAddressLoading] = useState<boolean>(false);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [addressSavedMessage, setAddressSavedMessage] = useState<string | null>(null);
  const [isPlacingOrder, setIsPlacingOrder] = useState<boolean>(false);
  const [confirmedOrder, setConfirmedOrder] = useState<OrderRecord | null>(null);

  const applyAddressToForm = (addr: DeliveryAddress | null, defaultName = '', defaultPhone = '') => {
    if (addr && (addr.flatNo || addr.pinCode || addr.city)) {
      setFullName(addr.fullName || defaultName || '');
      setPhone(addr.phone || defaultPhone || '');
      setFlatNo(addr.flatNo || '');
      setLandmark(addr.landmark || '');
      setCity(addr.city || '');
      setPinCode(addr.pinCode || '');
    } else {
      setFullName(defaultName || '');
      setPhone(defaultPhone || '');
      setFlatNo('');
      setLandmark('');
      setCity('');
      setPinCode('');
    }
  };

  // Load the authenticated user's saved address when opening checkout or switching users
  useEffect(() => {
    let cancelled = false;
    setAddressError(null);
    setAddressSavedMessage(null);

    if (effectiveIsGuest) {
      setResolvedPrimaryAddress(null);
      setUserAddressList([]);
      setSaveAddressToProfile(false);
      applyAddressToForm(null, '', '');
      return;
    }

    setAddressLoading(true);
    fetchUserDeliveryAddress({
      uid: userId,
      email: userEmail,
      name: userName,
      phone: userPhone,
      isGuest: false,
      fallbackAddress: savedDeliveryAddress?.formattedAddress || userAddress,
      fallbackPinCode: savedDeliveryAddress?.pinCode || userPinCode
    })
      .then(({ primaryAddress, savedAddresses: fetchedList }) => {
        if (cancelled) return;
        const effectivePrimary = primaryAddress || savedDeliveryAddress || null;
        const effectiveList =
          fetchedList.length > 0
            ? fetchedList
            : savedAddresses.length > 0
            ? savedAddresses
            : effectivePrimary
            ? [effectivePrimary]
            : [];

        setResolvedPrimaryAddress(effectivePrimary);
        setUserAddressList(effectiveList);
        const selectedAddress = effectiveList.find((address) => address.id === selectedSavedAddressId)
          || effectivePrimary
          || effectiveList[0]
          || null;
        setSelectedSavedAddressId(selectedAddress?.id || '');
        if (selectedAddress?.label?.toLowerCase().includes('work') || selectedAddress?.label?.toLowerCase().includes('office')) {
          setAddressChoice('work');
        } else {
          setAddressChoice('home');
        }

        if (selectedAddress && (selectedAddress.flatNo || selectedAddress.pinCode)) {
          applyAddressToForm(selectedAddress, userName, userPhone);
          setSaveAddressToProfile(false);
        } else {
          // Registered user with no saved address: prefill name & phone, show empty address fields
          applyAddressToForm(null, userName, userPhone);
          setSaveAddressToProfile(true);
        }
      })
      .catch(() => {
        if (cancelled) return;
        if (savedDeliveryAddress && (savedDeliveryAddress.flatNo || savedDeliveryAddress.pinCode)) {
          setResolvedPrimaryAddress(savedDeliveryAddress);
          applyAddressToForm(savedDeliveryAddress, userName, userPhone);
          setSaveAddressToProfile(false);
        } else {
          applyAddressToForm(null, userName, userPhone);
          setSaveAddressToProfile(true);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setAddressLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [userId, userEmail, userName, userPhone, userAddress, userPinCode, effectiveIsGuest]);

  const handleSelectAddressPreset = (choice: 'home' | 'work') => {
    setAddressChoice(choice);
    setSelectedSavedAddressId('');
    setAddressError(null);
    if (effectiveIsGuest) return;
    applyAddressToForm(null, userName, userPhone);
  };

  const handleSelectSavedAddress = (address: DeliveryAddress) => {
    setSelectedSavedAddressId(address.id || '');
    setAddressError(null);
    setSaveAddressToProfile(false);
    applyAddressToForm(address, userName, userPhone);
  };

  // Cart financial summaries
  const subtotal = cartItems.reduce((acc, curr) => acc + curr.product.price * curr.quantity, 0);
  const taxes = Math.round(subtotal * 0.05); // 5% GST
  const discount = discountApplied ? Math.round(subtotal * 0.1) : 0; // 10% coupon
  const shipping = subtotal > 999 || subtotal === 0 ? 0 : 99;
  const grandTotal = subtotal + taxes + shipping - discount;

  const handleApplyCoupon = () => {
    if (couponCode.toUpperCase() === 'NOVA10') {
      setDiscountApplied(true);
      alert('Coupon Applied! You saved 10% on your entire order!');
    } else {
      alert('Invalid coupon. Try using "NOVA10" for 10% off!');
    }
  };

  const buildCurrentCheckoutAddress = (): DeliveryAddress => {
    const selectedSavedAddress = userAddressList.find((address) => address.id === selectedSavedAddressId);
    const label = selectedSavedAddress?.label || (addressChoice === 'work' ? 'Office' : 'Home');
    const current: DeliveryAddress = {
      id: selectedSavedAddress?.id || `addr_${Date.now()}`,
      label,
      fullName: fullName.trim() || (!effectiveIsGuest ? userName.trim() : ''),
      phone: phone.trim() || (!effectiveIsGuest ? userPhone.trim() : ''),
      flatNo: flatNo.trim(),
      landmark: landmark.trim(),
      city: city.trim(),
      pinCode: pinCode.trim(),
      country: 'India',
      isDefault: selectedSavedAddress?.isDefault ?? (userAddressList.length === 0),
      updatedAt: new Date().toISOString()
    };
    current.formattedAddress = formatDeliveryAddress(current);
    return current;
  };

  const handleProceedToAddress = () => {
    analytics.trackCheckoutStarted(cartItems, grandTotal, cartItems.reduce((acc, curr) => acc + curr.quantity, 0));
    setStep('address');
  };

  const handleProceedToPayment = async () => {
    setAddressError(null);
    setAddressSavedMessage(null);
    const currentAddress = buildCurrentCheckoutAddress();
    const validation = validateDeliveryAddress(currentAddress);

    if (!validation.valid) {
      setAddressError(validation.error || 'Please complete all required delivery address fields.');
      return;
    }

    if (!effectiveIsGuest && saveAddressToProfile) {
      try {
        const { primaryAddress, savedAddresses: updatedList } = await saveUserDeliveryAddress(
          {
            uid: userId,
            email: userEmail,
            name: currentAddress.fullName || userName,
            phone: currentAddress.phone || userPhone,
            isGuest: false
          },
          currentAddress,
          userAddressList
        );
        setResolvedPrimaryAddress(primaryAddress);
        setUserAddressList(updatedList);
        setSelectedSavedAddressId(primaryAddress.id || '');
        await onSaveAddress?.(primaryAddress, updatedList);
        setAddressSavedMessage('Saved to your profile for future checkouts.');
      } catch (err: any) {
        setAddressError(err?.message || 'Unable to save address to profile.');
        return;
      }
    }

    setStep('payment');
  };

  const handlePlaceOrder = async () => {
    if (isPlacingOrder) return;
    setAddressError(null);
    const currentAddress = buildCurrentCheckoutAddress();
    const validation = validateDeliveryAddress(currentAddress);

    if (!validation.valid) {
      setAddressError(validation.error || 'Please complete all required delivery address fields before placing your order.');
      setStep('address');
      return;
    }

    setIsPlacingOrder(true);
    try {
      if (!effectiveIsGuest && saveAddressToProfile) {
        const { primaryAddress, savedAddresses: updatedList } = await saveUserDeliveryAddress(
          {
            uid: userId,
            email: userEmail,
            name: currentAddress.fullName || userName,
            phone: currentAddress.phone || userPhone,
            isGuest: false
          },
          currentAddress,
          userAddressList
        );
        setResolvedPrimaryAddress(primaryAddress);
        setUserAddressList(updatedList);
        setSelectedSavedAddressId(primaryAddress.id || '');
        await onSaveAddress?.(primaryAddress, updatedList);
      }

      const order = await createOrderSnapshot({
        user: {
          uid: userId,
          email: userEmail,
          name: currentAddress.fullName || userName,
          phone: currentAddress.phone || userPhone,
          isGuest: effectiveIsGuest
        },
        items: cartItems,
        subtotal,
        taxes,
        discount,
        shipping,
        grandTotal,
        paymentMethod: paymentChoice,
        deliveryAddress: currentAddress
      });

      analytics.trackPurchaseCompleted(order);
      setConfirmedOrder(order);
      onOrderPlaced?.(order);
      setStep('completed');
      onClearCart();
    } catch (err: any) {
      setAddressError(err?.message || 'Unable to place order. Please check your delivery details.');
      setStep('address');
    } finally {
      setIsPlacingOrder(false);
    }
  };

  if (step === 'completed') {
    const orderDisplayAddr = confirmedOrder?.deliveryAddress || buildCurrentCheckoutAddress();
    return (
      <div className="py-12 px-4 text-center space-y-6 animate-scale-up">
        {/* Success celebration icon */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 bg-green-100 rounded-full blur-xl scale-125 animate-pulse"></div>
            <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center text-green-600 border-4 border-white shadow-lg relative z-10">
              <span className="material-symbols-outlined text-5xl font-extrabold leading-none">done_all</span>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-[#131426]'}`}>{t('cart.orderConfirmed')}</h2>
          <p className={`text-xs leading-normal max-w-xs mx-auto ${isDarkMode ? 'text-slate-400' : 'text-[#5E667A]'}`}>
            {t('cart.orderThanks')}
          </p>
        </div>

        {/* Order specs tracker details */}
        <div className={`border rounded-2xl p-4 max-w-sm mx-auto text-left space-y-3 shadow-sm ${
          isDarkMode
            ? 'bg-slate-800/30 border-slate-700/30'
            : 'bg-white border-[#E4DFF5]'
        }`}>
          <div className="flex justify-between text-xs font-bold font-mono">
            <span className={isDarkMode ? 'text-slate-500' : 'text-[#5E667A]'}>{t('cart.orderNo')}</span>
            <span className={isDarkMode ? 'text-slate-100' : 'text-[#131426]'}>{confirmedOrder?.orderId || `#NV-${1000 + Math.floor(Math.random() * 9000)}`}</span>
          </div>
          <div className={`h-px ${isDarkMode ? 'bg-slate-700/30' : 'bg-[#E4DFF5]'}`}></div>

          <div className="space-y-1">
            <p className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-[#5E667A]'}`}>
              {t('cart.deliveryTo')} ({orderDisplayAddr.label || 'Home'})
            </p>
            <p className={`text-xs font-bold ${isDarkMode ? 'text-slate-100' : 'text-[#131426]'}`}>
              {orderDisplayAddr.fullName} • {orderDisplayAddr.phone}
            </p>
            <p className={`text-[11px] leading-snug ${isDarkMode ? 'text-slate-300' : 'text-[#5E667A]'}`}>
              {orderDisplayAddr.formattedAddress || formatDeliveryAddress(orderDisplayAddr)} — {orderDisplayAddr.pinCode}
            </p>
          </div>

          <div className={`h-px ${isDarkMode ? 'bg-slate-700/30' : 'bg-[#E4DFF5]'}`}></div>
          
          <ul className={`text-xs space-y-1.5 font-bold font-sans ${isDarkMode ? 'text-slate-300' : 'text-[#131426]'}`}>
            <li className="flex items-center gap-2 text-[11px]"><span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> 10:35 AM — Order Created</li>
            <li className="flex items-center gap-2 text-[11px]"><span className="w-1.5 h-1.5 rounded-full bg-[#553BE2] animate-pulse"></span> 10:40 AM — Packing shipment</li>
            <li className="flex items-center gap-2 text-[11px] text-[#5E667A] font-medium"><span className="w-1.5 h-1.5 rounded-full bg-[#E4DFF5]"></span> Courier dispatched (standard 2-3 days)</li>
          </ul>
        </div>

        <div className="flex gap-3 pt-3 max-w-sm mx-auto">
          <button 
            onClick={() => onNavigate('home')}
            className="flex-1 py-3 text-xs font-bold text-[#5E667A] bg-white border border-[#E4DFF5] hover:bg-[#F2EEFF] hover:text-[#131426] transition-colors rounded-xl"
          >
            {t('cart.homeBtn')}
          </button>
          
          <button 
            onClick={() => { setStep('cart'); onNavigate('chat'); }}
            className="flex-1 py-3 text-xs font-bold text-white bg-[#553BE2] hover:opacity-95 transition-opacity rounded-xl shadow-md shadow-[#553BE2]/15"
          >
            {t('cart.stylistBtn')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stepper HUD progress */}
      <section className={`flex items-center justify-between px-2 pt-2 pb-3 border-b ${
        isDarkMode
          ? 'border-slate-700/30'
          : 'border-[#E4DFF5]'
      }`}>
        <div className="flex items-center gap-1">
          <div className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${step === 'cart' ? 'bg-[#553BE2] text-white shadow' : 'bg-green-100 text-green-700 font-extrabold'}`}>
            {step !== 'cart' ? '✓' : '1'}
          </div>
          <span className={`text-[10px] font-bold ${step === 'cart' ? 'text-[#553BE2]' : isDarkMode ? 'text-slate-500' : 'text-[#5E667A]'}`}>{t('cart.stepBag')}</span>
        </div>
        
        <div className={`flex-1 h-px mx-2 ${isDarkMode ? 'bg-slate-700/30' : 'bg-[#E4DFF5]'}`}></div>

        <div className="flex items-center gap-1">
          <div className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${
            step === 'address' ? 'bg-[#553BE2] text-white shadow' : step === 'payment' ? 'bg-green-100 text-green-700 font-extrabold' : 'bg-[#ECE7FF] text-[#5E667A]'
          }`}>
            {['payment', 'completed'].includes(step) ? '✓' : '2'}
          </div>
          <span className={`text-[10px] font-bold ${step === 'address' ? 'text-[#553BE2]' : isDarkMode ? 'text-slate-500' : 'text-[#5E667A]'}`}>{t('cart.stepAddress')}</span>
        </div>

        <div className={`flex-1 h-px mx-2 ${isDarkMode ? 'bg-slate-700/30' : 'bg-[#E4DFF5]'}`}></div>

        <div className="flex items-center gap-1">
          <div className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${step === 'payment' ? 'bg-[#553BE2] text-white shadow' : 'bg-[#ECE7FF] text-[#5E667A]'}`}>
            3
          </div>
          <span className={`text-[10px] font-bold ${step === 'payment' ? 'text-[#553BE2]' : isDarkMode ? 'text-slate-500' : 'text-[#5E667A]'}`}>{t('cart.stepPayment')}</span>
        </div>
      </section>

      {/* STEP 1: CART LIST SUMMARY */}
      {step === 'cart' && (
        <div className="space-y-6 animate-fade-in">
          {cartItems.length === 0 ? (
            <div className={`py-12 text-center space-y-4 ${
              isDarkMode ? 'text-slate-400' : 'text-[#5E667A]'
            }`}>
              <span className="material-symbols-outlined text-5xl opacity-40">shopping_bag</span>
              <p className="text-xs font-bold max-w-[180px] mx-auto">{t('cart.empty')}</p>
              <button 
                onClick={() => onNavigate('home')}
                className="py-2.5 px-6 rounded-full border border-[#553BE2] text-[#553BE2] text-xs font-bold leading-none hover:bg-[#F2EEFF]"
              >
                {t('cart.continueShopping')}
              </button>
            </div>
          ) : (
            <>
              {/* Active Cart items list */}
              <ul className="space-y-3">
                {cartItems.map((item, idx) => (
                  <li key={idx} className="glass-card rounded-2xl p-3 flex gap-4 pr-1 relative group">
                    <button 
                      onClick={() => onRemoveItem(idx)}
                      className="absolute top-2.5 right-2.5 text-[#8E96AA] hover:text-red-500 transition-colors p-1"
                    >
                      <span className="material-symbols-outlined text-base">close</span>
                    </button>
                    
                    {/* Item Thumbnail */}
                    <div className="w-16 h-20 rounded-xl bg-[#F2EEFF] overflow-hidden shrink-0 border border-[#E4DFF5]">
                      {getGarmentColorImage(item.product, item.color) ? (
                        <img
                          alt={`${item.product.name} in ${item.color}`}
                          className="h-full w-full object-cover"
                          src={getGarmentColorImage(item.product, item.color)}
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center px-1 text-center text-[9px] font-semibold text-slate-500">
                          {item.color} photo unavailable
                        </div>
                      )}
                    </div>

                    {/* Details content row */}
                    <div className="flex-grow min-w-0 pr-6 select-none leading-normal">
                      <p className={`text-xs font-bold truncate ${isDarkMode ? 'text-slate-100' : 'text-[#131426]'}`}>{item.product.name}</p>
                      
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={`text-[10px] font-extrabold uppercase ${isDarkMode ? 'text-slate-500' : 'text-[#5E667A]'}`}>{t('cart.color')}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md leading-none border ${
                          isDarkMode
                            ? 'text-slate-200 bg-slate-800/40 border-slate-700/30'
                            : 'text-[#131426] bg-[#F2EEFF] border-[#E4DFF5]'
                        }`}>{item.color}</span>
                        <span className={`text-[10px] font-extrabold uppercase ml-2 ${isDarkMode ? 'text-slate-500' : 'text-[#5E667A]'}`}>{t('cart.size')}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md leading-none border ${
                          isDarkMode
                            ? 'text-slate-200 bg-slate-800/40 border-slate-700/30'
                            : 'text-[#131426] bg-[#F2EEFF] border-[#E4DFF5]'
                        }`}>{item.size}</span>
                      </div>

                      <div className="flex justify-between items-center mt-3">
                        <span className="text-sm font-extrabold text-[#553BE2]">₹{item.product.price}</span>
                        
                        {/* Quantity controls counter */}
                        <div className="flex items-center gap-2 border border-[#E4DFF5] rounded-lg p-0.5 px-1.5 bg-[#F2EEFF]">
                          <button 
                            onClick={() => onUpdateQuantity(idx, -1)}
                            className="text-[#5E667A] hover:text-[#553BE2] px-1 text-sm font-extrabold active:scale-95 leading-none"
                          >
                            -
                          </button>
                          <span className="text-xs font-mono font-bold px-1 text-[#131426]">{item.quantity}</span>
                          <button 
                            onClick={() => onUpdateQuantity(idx, 1)}
                            className="text-[#5E667A] hover:text-[#553BE2] px-1 text-sm font-extrabold active:scale-95 leading-none"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              {/* Promo Coupon applying bar */}
              <div className="glass-card rounded-2xl p-3.5 flex gap-2">
                <input 
                  type="text" 
                  value={couponCode} 
                  onChange={(e) => setCouponCode(e.target.value)}
                  placeholder="Enter Promo Code (Try NOVA10)" 
                  className="flex-grow px-3 py-2.5 bg-[#F2EEFF] border border-[#E4DFF5] rounded-xl text-xs font-semibold uppercase tracking-wider text-[#131426] placeholder:text-[#5E667A] focus:outline-none focus:border-[#553BE2]"
                  disabled={discountApplied}
                />
                <button 
                  onClick={handleApplyCoupon}
                  className={`px-4 rounded-xl text-xs font-bold leading-none ${discountApplied ? 'bg-green-100 text-green-700' : 'bg-[#553BE2] text-white hover:opacity-95'} transition-all`}
                  disabled={discountApplied || !couponCode}
                >
                  {discountApplied ? 'Applied' : 'Apply'}
                </button>
              </div>

              {/* Order total receipt values block */}
              <div className="glass-card rounded-2xl p-4 space-y-2.5">
                <h3 className="text-xs font-bold text-[#5E667A] uppercase tracking-widest border-b border-[#E4DFF5] pb-1.5 leading-none">Bill Details</h3>
                
                <div className="flex justify-between text-xs text-[#5E667A] font-semibold">
                  <span>Bag Subtotal</span>
                  <span className="text-[#131426]">₹{subtotal.toLocaleString()}</span>
                </div>

                <div className="flex justify-between text-xs text-[#5E667A] font-semibold">
                  <span>Service Tax & GST (5%)</span>
                  <span className="text-[#131426]">+ ₹{taxes}</span>
                </div>

                {discountApplied && (
                  <div className="flex justify-between text-xs text-green-600 font-bold">
                    <span>Discount Coupon (10%)</span>
                    <span>- ₹{discount}</span>
                  </div>
                )}

                <div className="flex justify-between text-xs text-[#5E667A] font-semibold">
                  <span>Delivery Shipping Charge</span>
                  <span className={shipping === 0 ? 'text-green-600 font-bold' : 'text-[#131426]'}>
                    {shipping === 0 ? 'FREE' : `+ ₹${shipping}`}
                  </span>
                </div>

                <div className="h-px bg-[#E4DFF5] my-1"></div>

                <div className="flex justify-between text-base font-extrabold text-[#131426] pt-1">
                  <span>Grand Total</span>
                  <span className="text-[#553BE2]">₹{grandTotal.toLocaleString()}</span>
                </div>
              </div>

              <button 
                onClick={handleProceedToAddress}
                className="w-full py-4 bg-[#553BE2] text-white text-xs font-bold tracking-wide rounded-2xl flex items-center justify-center gap-1.5 shadow-lg shadow-[#553BE2]/20 active:opacity-95 hover:opacity-95"
              >
                Proceed to Shipping Address <span className="material-symbols-outlined text-base">arrow_forward</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* STEP 2: SHIPPING ADDRESS ENTRY */}
      {step === 'address' && (
        <div className="space-y-5 animate-fade-in">
          {!effectiveIsGuest && userAddressList.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" aria-label="Choose a saved delivery address">
              {userAddressList.map((address, index) => {
                const isSelected = selectedSavedAddressId === address.id;
                return (
                  <button
                    key={address.id || `saved-address-${index}`}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => handleSelectSavedAddress(address)}
                    className={`flex min-w-0 items-start gap-3 rounded-2xl border p-3.5 text-left transition-all ${
                      isSelected ? 'border-[#553BE2] bg-[#F2EEFF] shadow-sm' : 'border-[#E4DFF5] bg-white hover:border-[#B8A9F5]'
                    }`}
                  >
                    <span className={`material-symbols-outlined text-xl ${isSelected ? 'text-[#553BE2]' : 'text-[#8E96AA]'}`}>
                      {address.label?.toLowerCase().includes('work') || address.label?.toLowerCase().includes('office') ? 'domain' : 'home'}
                    </span>
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-bold text-[#131426]">{address.label || `Address ${index + 1}`}</span>
                        {isSelected && <span className="material-symbols-outlined text-base text-[#553BE2]">check_circle</span>}
                      </span>
                      <span className="mt-1 block line-clamp-2 text-[10px] text-[#5E667A]">
                        {[address.flatNo, address.landmark, address.city, address.pinCode].filter(Boolean).join(', ')}
                      </span>
                      <span className="mt-1 block truncate text-[10px] text-[#5E667A]">{address.fullName} · {address.phone}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {(['home', 'work'] as const).map((choice) => {
                const isHome = choice === 'home';
                const selected = addressChoice === choice;
                return (
                  <button
                    key={choice}
                    type="button"
                    onClick={() => handleSelectAddressPreset(choice)}
                    aria-pressed={selected}
                    className={`flex items-start gap-3 rounded-2xl border p-3.5 text-left transition-all ${
                      selected ? 'border-[#553BE2] bg-[#F2EEFF] shadow-sm' : 'border-[#E4DFF5] bg-white'
                    }`}
                  >
                    <span className={`material-symbols-outlined text-xl ${selected ? 'text-[#553BE2]' : 'text-[#8E96AA]'}`}>
                      {isHome ? 'home' : 'domain'}
                    </span>
                    <span className="min-w-0 leading-tight">
                      <span className="block text-xs font-bold text-[#131426]">Deliver to {isHome ? 'Home' : 'Office'}</span>
                      <span className="mt-1 block text-[10px] text-[#5E667A]">
                        {effectiveIsGuest ? 'Guest checkout — enter details below' : 'Enter delivery details below'}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Detailed field forms */}
          <div className="glass-card rounded-2xl p-4 space-y-3 text-left">
            <div className="flex items-center justify-between border-b border-[#E4DFF5] pb-2">
              <h3 className="text-xs font-bold text-[#5E667A] uppercase tracking-widest leading-none">Modify Details</h3>
              {addressLoading ? (
                <span className="text-[10px] font-bold text-[#553BE2]">Loading saved address...</span>
              ) : !effectiveIsGuest && resolvedPrimaryAddress && (resolvedPrimaryAddress.flatNo || resolvedPrimaryAddress.pinCode) ? (
                <span className="text-[10px] font-bold text-[#553BE2] bg-[#F2EEFF] px-2 py-0.5 rounded-full">
                  Linked from Profile
                </span>
              ) : effectiveIsGuest ? (
                <span className="text-[10px] font-bold text-[#5E667A] bg-[#F2EEFF] px-2 py-0.5 rounded-full">
                  Guest Checkout
                </span>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-[#5E667A] mb-1">FULL NAME *</label>
                <input 
                  type="text" 
                  placeholder="Recipient Full Name"
                  value={fullName} 
                  onChange={(e) => { setFullName(e.target.value); setAddressError(null); }}
                  className="w-full p-2.5 bg-[#F2EEFF] border border-[#E4DFF5] rounded-xl text-xs font-semibold text-[#131426] placeholder:text-[#8E96AA] focus:outline-none focus:border-[#553BE2]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#5E667A] mb-1">PHONE NUMBER *</label>
                <input 
                  type="tel" 
                  placeholder="10-digit mobile"
                  value={phone} 
                  onChange={(e) => { setPhone(e.target.value); setAddressError(null); }}
                  className="w-full p-2.5 bg-[#F2EEFF] border border-[#E4DFF5] rounded-xl text-xs font-semibold text-[#131426] placeholder:text-[#8E96AA] focus:outline-none focus:border-[#553BE2]"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-[10px] font-bold text-[#5E667A] mb-1">FLAT NO. / ROAD ADDRESS *</label>
              <input 
                type="text" 
                placeholder="House/Flat No., Building, Street"
                value={flatNo} 
                onChange={(e) => { setFlatNo(e.target.value); setAddressError(null); }}
                className="w-full p-2.5 bg-[#F2EEFF] border border-[#E4DFF5] rounded-xl text-xs font-semibold text-[#131426] placeholder:text-[#8E96AA] focus:outline-none focus:border-[#553BE2]"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-[#5E667A] mb-1">LANDMARK</label>
              <input 
                type="text" 
                placeholder="Area, Locality, or Nearby Landmark (optional)"
                value={landmark} 
                onChange={(e) => { setLandmark(e.target.value); setAddressError(null); }}
                className="w-full p-2.5 bg-[#F2EEFF] border border-[#E4DFF5] rounded-xl text-xs font-semibold text-[#131426] placeholder:text-[#8E96AA] focus:outline-none focus:border-[#553BE2]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-[#5E667A] mb-1">CITY / STATE *</label>
                <input 
                  type="text" 
                  placeholder="City, State"
                  value={city} 
                  onChange={(e) => { setCity(e.target.value); setAddressError(null); }}
                  className="w-full p-2.5 bg-[#F2EEFF] border border-[#E4DFF5] rounded-xl text-xs font-semibold text-[#131426] placeholder:text-[#8E96AA] focus:outline-none focus:border-[#553BE2]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#5E667A] mb-1">PINCODE *</label>
                <input 
                  type="text" 
                  placeholder="6-digit PIN"
                  maxLength={6}
                  value={pinCode} 
                  onChange={(e) => { setPinCode(e.target.value.replace(/\D/g, '')); setAddressError(null); }}
                  className="w-full p-2.5 bg-[#F2EEFF] border border-[#E4DFF5] rounded-xl text-xs font-semibold text-[#131426] placeholder:text-[#8E96AA] focus:outline-none focus:border-[#553BE2]"
                />
              </div>
            </div>

            {!effectiveIsGuest && (
              <label
                htmlFor="checkout-save-address"
                className="flex items-start gap-2.5 pt-2 border-t border-[#E4DFF5] cursor-pointer select-none"
              >
                <input
                  id="checkout-save-address"
                  type="checkbox"
                  checked={saveAddressToProfile}
                  onChange={(e) => setSaveAddressToProfile(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-[#D5CBF7] text-[#553BE2] accent-[#553BE2] cursor-pointer"
                />
                <div className="leading-snug">
                  <span className="text-xs font-bold text-[#131426] block">
                    Save address for future checkouts
                  </span>
                  <span className="text-[10px] text-[#5E667A] block mt-0.5">
                    {saveAddressToProfile
                      ? 'This delivery address will update your saved profile address.'
                      : 'Unchecked: any edits above will be used for this order only.'}
                  </span>
                </div>
              </label>
            )}

            {addressError && (
              <div
                role="alert"
                aria-live="assertive"
                className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-[11px] font-semibold"
              >
                {addressError}
              </div>
            )}

            {addressSavedMessage && (
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-semibold">
                {addressSavedMessage}
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button 
              onClick={() => setStep('cart')}
              className="flex-1 py-3.5 rounded-xl border border-[#E4DFF5] bg-white text-[#5E667A] font-bold text-xs hover:bg-[#F2EEFF] hover:text-[#131426] transition-colors"
            >
              Back
            </button>
            <button 
              onClick={handleProceedToPayment}
              className="flex-[2] py-3.5 rounded-xl bg-[#553BE2] hover:opacity-95 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-[#553BE2]/15"
            >
              Proceed to Payment <span className="material-symbols-outlined text-base">arrow_forward</span>
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: PAYMENT METHOD */}
      {step === 'payment' && (
        <div className="space-y-5 animate-fade-in">
          <div className="glass-card rounded-2xl p-3.5 text-left flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-[#5E667A] uppercase tracking-widest block">
                DELIVERING TO ({buildCurrentCheckoutAddress().label?.toUpperCase() || 'HOME'})
              </span>
              <p className="text-xs font-bold text-[#131426] mt-0.5 truncate">
                {fullName} • {phone}
              </p>
              <p className="text-[11px] text-[#5E667A] mt-0.5 leading-snug">
                {[flatNo, landmark, city].filter(Boolean).join(', ')} — {pinCode}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setStep('address')}
              className="text-[11px] font-bold text-[#553BE2] hover:underline shrink-0"
            >
              Change
            </button>
          </div>

          <div className="glass-panel rounded-2xl p-4 text-left">
            <h3 className="text-xs font-bold text-[#5E667A] uppercase tracking-widest mb-3 leading-none border-b border-[#E4DFF5] pb-2">Select Method</h3>
            
            <div className="space-y-2.5">
              <label className={`w-full flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${paymentChoice === 'upi' ? 'border-[#553BE2] bg-[#F2EEFF]' : 'border-[#E4DFF5] bg-white'}`}>
                <div className="flex items-center gap-3">
                  <input type="radio" checked={paymentChoice === 'upi'} onChange={() => setPaymentChoice('upi')} className="accent-[#553BE2]" />
                  <span className="material-symbols-outlined text-[#5E667A]">payments</span>
                  <div className="leading-none">
                    <span className="text-xs font-bold text-[#131426]">UPI (GPay / PhonePe / Paytm)</span>
                    <span className="text-[10px] text-[#5E667A] block mt-1">Instant confirmation, zero surcharge</span>
                  </div>
                </div>
              </label>

              <label className={`w-full flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${paymentChoice === 'card' ? 'border-[#553BE2] bg-[#F2EEFF]' : 'border-[#E4DFF5] bg-white'}`}>
                <div className="flex items-center gap-3">
                  <input type="radio" checked={paymentChoice === 'card'} onChange={() => setPaymentChoice('card')} className="accent-[#553BE2]" />
                  <span className="material-symbols-outlined text-[#5E667A]">credit_card</span>
                  <div className="leading-none">
                    <span className="text-xs font-bold text-[#131426]">Credit or Debit Card</span>
                    <span className="text-[10px] text-[#5E667A] block mt-1">Visa, MasterCard, RuPay accepted</span>
                  </div>
                </div>
              </label>

              <label className={`w-full flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${paymentChoice === 'cod' ? 'border-[#553BE2] bg-[#F2EEFF]' : 'border-[#E4DFF5] bg-white'}`}>
                <div className="flex items-center gap-3">
                  <input type="radio" checked={paymentChoice === 'cod'} onChange={() => setPaymentChoice('cod')} className="accent-[#553BE2]" />
                  <span className="material-symbols-outlined text-[#5E667A]">handshake</span>
                  <div className="leading-none">
                    <span className="text-xs font-bold text-[#131426]">Cash on Delivery (COD)</span>
                    <span className="text-[10px] text-[#5E667A] block mt-1">Pay with cash or UPI on delivery</span>
                  </div>
                </div>
              </label>
            </div>
          </div>

          <div className="glass-card rounded-2xl p-4 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-[#5E667A] uppercase tracking-widest leading-none block">DUE TOTAL PRICE</span>
              <span className="text-lg font-black text-[#553BE2] leading-none block mt-1">₹{grandTotal.toLocaleString()}</span>
            </div>
            
            {paymentChoice === 'cod' && (
              <span className="text-[10px] font-bold text-green-700 bg-green-50 px-2 py-1 rounded-md">COD Enabled</span>
            )}
          </div>

          <div className="flex gap-3">
            <button 
              onClick={() => setStep('address')}
              className="flex-1 py-3.5 rounded-xl border border-[#E4DFF5] bg-white text-[#5E667A] font-bold text-xs hover:bg-[#F2EEFF] hover:text-[#131426] transition-colors"
            >
              Back
            </button>
            <button 
              disabled={isPlacingOrder}
              onClick={handlePlaceOrder}
              className="flex-[2] py-3.5 rounded-xl bg-[#553BE2] hover:opacity-95 disabled:opacity-60 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-[#553BE2]/20"
            >
              <span className="material-symbols-outlined text-base">shopping_cart_checkout</span>{' '}
              {isPlacingOrder ? t('cart.placingOrder') : t('cart.placeOrder')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
