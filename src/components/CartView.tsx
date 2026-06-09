import React, { useState } from 'react';
import { ScreenId, CartItem } from '../types';

interface CartViewProps {
  onNavigate: (screen: ScreenId) => void;
  cartItems: CartItem[];
  onUpdateQuantity: (idx: number, dQ: number) => void;
  onRemoveItem: (idx: number) => void;
  onClearCart: () => void;
  isDarkMode?: boolean;
}

export const CartView: React.FC<CartViewProps> = ({
  onNavigate,
  cartItems,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  isDarkMode = false
}) => {
  const [step, setStep] = useState<'cart' | 'address' | 'payment' | 'completed'>('cart');
  const [couponCode, setCouponCode] = useState('');
  const [discountApplied, setDiscountApplied] = useState(false);
  const [addressChoice, setAddressChoice] = useState<'home' | 'work'>('home');
  const [paymentChoice, setPaymentChoice] = useState<'upi' | 'card' | 'cod'>('upi');

  // Address form fields
  const [flatNo, setFlatNo] = useState('Flat 402, Elite Arcade');
  const [landmark, setLandmark] = useState('Near Metro Station, Indiranagar');
  const [city, setCity] = useState('Bangalore');
  const [pinCode, setPinCode] = useState('560038');

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

  const handlePlaceOrder = () => {
    setStep('completed');
    onClearCart();
  };

  if (step === 'completed') {
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
          <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Order Confirmed!</h2>
          <p className={`text-xs leading-normal max-w-xs mx-auto ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            Thank you for purchasing. Your styling coordinates have been saved, and your parcel is being packed by hand!
          </p>
        </div>

        {/* Order specs tracker details */}
        <div className={`border rounded-2xl p-4 max-w-sm mx-auto text-left space-y-3 shadow-inner ${
          isDarkMode
            ? 'bg-slate-800/30 border-slate-700/30'
            : 'bg-slate-50 border-slate-150'
        }`}>
          <div className="flex justify-between text-xs font-bold font-mono">
            <span className={isDarkMode ? 'text-slate-500' : 'text-slate-400'}>ORDER NO.</span>
            <span className={isDarkMode ? 'text-slate-100' : 'text-slate-800'}>#NV-{(1000 + Math.floor(Math.random() * 9000))}</span>
          </div>
          <div className={isDarkMode ? 'bg-slate-700/30' : 'bg-slate-200'}></div>
          
          <ul className={`text-xs space-y-1.5 font-bold font-sans ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
            <li className="flex items-center gap-2 text-[11px]"><span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> 10:35 AM — Order Created</li>
            <li className="flex items-center gap-2 text-[11px]"><span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span> 10:40 AM — Packing shipment</li>
            <li className="flex items-center gap-2 text-[11px] text-slate-400 font-medium"><span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span> Courier dispatched (standard 2-3 days)</li>
          </ul>
        </div>

        <div className="flex gap-3 pt-3 max-w-sm mx-auto">
          <button 
            onClick={() => onNavigate('home')}
            className="flex-1 py-3 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors rounded-xl"
          >
            Home
          </button>
          
          <button 
            onClick={() => { setStep('cart'); onNavigate('chat'); }}
            className="flex-1 py-3 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors rounded-xl shadow-md shadow-indigo-600/10"
          >
            Style Consultancy
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
          : 'border-slate-100'
      }`}>
        <div className="flex items-center gap-1">
          <div className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${step === 'cart' ? 'bg-indigo-600 text-white shadow' : 'bg-green-100 text-green-700 font-extrabold'}`}>
            {step !== 'cart' ? '✓' : '1'}
          </div>
          <span className={`text-[10px] font-bold ${step === 'cart' ? 'text-indigo-600' : isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Bag</span>
        </div>
        
        <div className={`flex-1 h-px mx-2 ${isDarkMode ? 'bg-slate-700/30' : 'bg-slate-200'}`}></div>

        <div className="flex items-center gap-1">
          <div className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${
            step === 'address' ? 'bg-indigo-600 text-white shadow' : step === 'payment' ? 'bg-green-100 text-green-700 font-extrabold' : 'bg-slate-200 text-slate-500'
          }`}>
            {step === 'completed' || step === 'payment' ? '✓' : '2'}
          </div>
          <span className={`text-[10px] font-bold ${step === 'address' ? 'text-indigo-600' : isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Address</span>
        </div>

        <div className={`flex-1 h-px mx-2 ${isDarkMode ? 'bg-slate-700/30' : 'bg-slate-200'}`}></div>

        <div className="flex items-center gap-1">
          <div className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${step === 'payment' ? 'bg-indigo-600 text-white shadow' : 'bg-slate-200 text-slate-500'}`}>
            3
          </div>
          <span className={`text-[10px] font-bold ${step === 'payment' ? 'text-indigo-600' : isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Payment</span>
        </div>
      </section>

      {/* STEP 1: CART LIST SUMMARY */}
      {step === 'cart' && (
        <div className="space-y-6 animate-fade-in">
          {cartItems.length === 0 ? (
            <div className={`py-12 text-center space-y-4 ${
              isDarkMode ? 'text-slate-400' : 'text-slate-500'
            }`}>
              <span className="material-symbols-outlined text-5xl opacity-40">shopping_bag</span>
              <p className="text-xs font-bold max-w-[180px] mx-auto">Your Shopping bag is empty.</p>
              <button 
                onClick={() => onNavigate('home')}
                className="py-2.5 px-6 rounded-full border border-indigo-600 text-indigo-600 text-xs font-bold leading-none hover:bg-indigo-50"
              >
                Continue Shopping
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
                      className="absolute top-2.5 right-2.5 text-slate-400 hover:text-red-500 transition-colors p-1"
                    >
                      <span className="material-symbols-outlined text-base">close</span>
                    </button>
                    
                    {/* Item Thumbnail */}
                    <div className="w-16 h-20 rounded-xl bg-slate-100 overflow-hidden shrink-0 border border-slate-150">
                      <img alt={item.product.name} className="w-full h-full object-cover" src={item.product.imageUrl} />
                    </div>

                    {/* Details content row */}
                    <div className="flex-grow min-w-0 pr-6 select-none leading-normal">
                      <p className={`text-xs font-bold truncate ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>{item.product.name}</p>
                      
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={`text-[10px] font-extrabold uppercase ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Color:</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md leading-none border ${
                          isDarkMode
                            ? 'text-slate-200 bg-slate-800/40 border-slate-700/30'
                            : 'text-slate-700 bg-slate-50 border-slate-200'
                        }`}>{item.color}</span>
                        <span className={`text-[10px] font-extrabold uppercase ml-2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Size:</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md leading-none border ${
                          isDarkMode
                            ? 'text-slate-200 bg-slate-800/40 border-slate-700/30'
                            : 'text-slate-700 bg-slate-50 border-slate-200'
                        }`}>{item.size}</span>
                      </div>

                      <div className="flex justify-between items-center mt-3">
                        <span className="text-sm font-extrabold text-indigo-600">₹{item.product.price}</span>
                        
                        {/* Quantity controls counter */}
                        <div className="flex items-center gap-2 border border-slate-200 rounded-lg p-0.5 px-1.5 bg-slate-50/50">
                          <button 
                            onClick={() => onUpdateQuantity(idx, -1)}
                            className="text-slate-500 hover:text-indigo-600 px-1 text-sm font-extrabold active:scale-95 leading-none"
                          >
                            -
                          </button>
                          <span className="text-xs font-mono font-bold px-1 text-slate-800">{item.quantity}</span>
                          <button 
                            onClick={() => onUpdateQuantity(idx, 1)}
                            className="text-slate-500 hover:text-indigo-600 px-1 text-sm font-extrabold active:scale-95 leading-none"
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
                  className="flex-grow px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold uppercase tracking-wider focus:outline-none focus:border-indigo-600"
                  disabled={discountApplied}
                />
                <button 
                  onClick={handleApplyCoupon}
                  className={`px-4 rounded-xl text-xs font-bold leading-none ${discountApplied ? 'bg-green-100 text-green-700' : 'bg-slate-800 text-white hover:bg-slate-900'} transition-all`}
                  disabled={discountApplied || !couponCode}
                >
                  {discountApplied ? 'Applied' : 'Apply'}
                </button>
              </div>

              {/* Order total receipt values block */}
              <div className="glass-card rounded-2xl p-4 space-y-2.5">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1.5 leading-none">Bill Details</h3>
                
                <div className="flex justify-between text-xs text-slate-600 font-semibold">
                  <span>Bag Subtotal</span>
                  <span className="text-slate-800">₹{subtotal.toLocaleString()}</span>
                </div>

                <div className="flex justify-between text-xs text-slate-600 font-semibold">
                  <span>Service Tax & GST (5%)</span>
                  <span className="text-slate-800">+ ₹{taxes}</span>
                </div>

                {discountApplied && (
                  <div className="flex justify-between text-xs text-green-600 font-bold">
                    <span>Discount Coupon (10%)</span>
                    <span>- ₹{discount}</span>
                  </div>
                )}

                <div className="flex justify-between text-xs text-slate-600 font-semibold">
                  <span>Delivery Shipping Charge</span>
                  <span className={shipping === 0 ? 'text-green-600 font-bold' : 'text-slate-800'}>
                    {shipping === 0 ? 'FREE' : `+ ₹${shipping}`}
                  </span>
                </div>

                <div className="h-px bg-slate-150 my-1"></div>

                <div className="flex justify-between text-base font-extrabold text-slate-900 pt-1">
                  <span>Grand Total</span>
                  <span className="text-indigo-600">₹{grandTotal.toLocaleString()}</span>
                </div>
              </div>

              <button 
                onClick={() => setStep('address')}
                className="w-full py-4 bg-gradient-to-r from-indigo-500 to-indigo-700 text-white text-xs font-bold tracking-wide rounded-2xl flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/20 active:opacity-95 hover:opacity-95"
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
          {/* Preset address choice pills */}
          <div className="grid grid-cols-2 gap-3">
            <div 
              onClick={() => setAddressChoice('home')}
              className={`p-3.5 rounded-2xl border flex items-start gap-3 cursor-pointer transition-all ${
                addressChoice === 'home' 
                  ? 'border-indigo-600 bg-indigo-50/20 shadow-sm' 
                  : 'border-slate-200 bg-white'
              }`}
            >
              <span className={`material-symbols-outlined text-xl ${addressChoice === 'home' ? 'text-indigo-600' : 'text-slate-400'}`}>home</span>
              <div className="leading-tight">
                <p className="text-xs font-bold text-slate-800">Deliver to Home</p>
                <p className="text-[10px] text-slate-500 mt-1">Flat 402, Elite Indiranagar, Bangalore</p>
              </div>
            </div>

            <div 
              onClick={() => setAddressChoice('work')}
              className={`p-3.5 rounded-2xl border flex items-start gap-3 cursor-pointer transition-all ${
                addressChoice === 'work' 
                  ? 'border-indigo-600 bg-indigo-50/20 shadow-sm' 
                  : 'border-slate-200 bg-white'
              }`}
            >
              <span className={`material-symbols-outlined text-xl ${addressChoice === 'work' ? 'text-indigo-600' : 'text-slate-400'}`}>domain</span>
              <div className="leading-tight">
                <p className="text-xs font-bold text-slate-800">Deliver to Office</p>
                <p className="text-[10px] text-slate-500 mt-1">Tech Park, Phase-II Prestige, Bellandur</p>
              </div>
            </div>
          </div>

          {/* Detailed field forms */}
          <div className="glass-card rounded-2xl p-4 space-y-3 text-left">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none border-b border-slate-100 pb-2">Modify Details</h3>
            
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1">FLAT NO. / ROAD ADDRESS</label>
              <input 
                type="text" 
                value={flatNo} 
                onChange={(e) => setFlatNo(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-600"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1">LANDMARK</label>
              <input 
                type="text" 
                value={landmark} 
                onChange={(e) => setLandmark(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-600"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">CITY / STATE</label>
                <input 
                  type="text" 
                  value={city} 
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-600"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">PINCODE</label>
                <input 
                  type="text" 
                  value={pinCode} 
                  onChange={(e) => setPinCode(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-600"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button 
              onClick={() => setStep('cart')}
              className="flex-1 py-3.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-colors"
            >
              Back
            </button>
            <button 
              onClick={() => setStep('payment')}
              className="flex-[2] py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/10"
            >
              Proceed to Payment <span className="material-symbols-outlined text-base">arrow_forward</span>
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: PAYMENT METHOD */}
      {step === 'payment' && (
        <div className="space-y-5 animate-fade-in">
          <div className="glass-panel rounded-2xl p-4 text-left">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 leading-none border-b border-slate-100 pb-2">Select Method</h3>
            
            <div className="space-y-2.5">
              <label className={`w-full flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${paymentChoice === 'upi' ? 'border-indigo-600 bg-indigo-50/20' : 'border-slate-150 bg-white'}`}>
                <div className="flex items-center gap-3">
                  <input type="radio" checked={paymentChoice === 'upi'} onChange={() => setPaymentChoice('upi')} className="text-indigo-600" />
                  <span className="material-symbols-outlined text-slate-400">payments</span>
                  <div className="leading-none">
                    <span className="text-xs font-bold text-slate-800">UPI (GPay / PhonePe / Paytm)</span>
                    <span className="text-[10px] text-slate-500 block mt-1">Instant confirmation, zero surcharge</span>
                  </div>
                </div>
              </label>

              <label className={`w-full flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${paymentChoice === 'card' ? 'border-indigo-600 bg-indigo-50/20' : 'border-slate-150 bg-white'}`}>
                <div className="flex items-center gap-3">
                  <input type="radio" checked={paymentChoice === 'card'} onChange={() => setPaymentChoice('card')} className="text-indigo-600" />
                  <span className="material-symbols-outlined text-slate-400">credit_card</span>
                  <div className="leading-none">
                    <span className="text-xs font-bold text-slate-800">Credit or Debit Card</span>
                    <span className="text-[10px] text-slate-500 block mt-1">Visa, MasterCard, RuPay accepted</span>
                  </div>
                </div>
              </label>

              <label className={`w-full flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${paymentChoice === 'cod' ? 'border-indigo-600 bg-indigo-50/20' : 'border-slate-150 bg-white'}`}>
                <div className="flex items-center gap-3">
                  <input type="radio" checked={paymentChoice === 'cod'} onChange={() => setPaymentChoice('cod')} className="text-indigo-600" />
                  <span className="material-symbols-outlined text-slate-400">handshake</span>
                  <div className="leading-none">
                    <span className="text-xs font-bold text-slate-800">Cash on Delivery (COD)</span>
                    <span className="text-[10px] text-slate-500 block mt-1">Pay with cash or UPI on delivery</span>
                  </div>
                </div>
              </label>
            </div>
          </div>

          <div className="glass-card rounded-2xl p-4 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none block">DUE TOTAL PRICE</span>
              <span className="text-lg font-black text-indigo-700 leading-none block mt-1">₹{grandTotal.toLocaleString()}</span>
            </div>
            
            {paymentChoice === 'cod' && (
              <span className="text-[10px] font-bold text-green-700 bg-green-50 px-2 py-1 rounded-md">COD Enabled</span>
            )}
          </div>

          <div className="flex gap-3">
            <button 
              onClick={() => setStep('address')}
              className="flex-1 py-3.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-colors"
            >
              Back
            </button>
            <button 
              onClick={handlePlaceOrder}
              className="flex-[2] py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/30"
            >
              <span className="material-symbols-outlined text-base">shopping_cart_checkout</span> Securely Place Order
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
