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
          <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-[#131426]'}`}>Order Confirmed!</h2>
          <p className={`text-xs leading-normal max-w-xs mx-auto ${isDarkMode ? 'text-slate-400' : 'text-[#5E667A]'}`}>
            Thank you for purchasing. Your styling coordinates have been saved, and your parcel is being packed by hand!
          </p>
        </div>

        {/* Order specs tracker details */}
        <div className={`border rounded-2xl p-4 max-w-sm mx-auto text-left space-y-3 shadow-sm ${
          isDarkMode
            ? 'bg-slate-800/30 border-slate-700/30'
            : 'bg-white border-[#E4DFF5]'
        }`}>
          <div className="flex justify-between text-xs font-bold font-mono">
            <span className={isDarkMode ? 'text-slate-500' : 'text-[#5E667A]'}>ORDER NO.</span>
            <span className={isDarkMode ? 'text-slate-100' : 'text-[#131426]'}>#NV-{(1000 + Math.floor(Math.random() * 9000))}</span>
          </div>
          <div className={isDarkMode ? 'bg-slate-700/30' : 'bg-[#E4DFF5]'}></div>
          
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
            Home
          </button>
          
          <button 
            onClick={() => { setStep('cart'); onNavigate('chat'); }}
            className="flex-1 py-3 text-xs font-bold text-white bg-[#553BE2] hover:opacity-95 transition-opacity rounded-xl shadow-md shadow-[#553BE2]/15"
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
          : 'border-[#E4DFF5]'
      }`}>
        <div className="flex items-center gap-1">
          <div className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${step === 'cart' ? 'bg-[#553BE2] text-white shadow' : 'bg-green-100 text-green-700 font-extrabold'}`}>
            {step !== 'cart' ? '✓' : '1'}
          </div>
          <span className={`text-[10px] font-bold ${step === 'cart' ? 'text-[#553BE2]' : isDarkMode ? 'text-slate-500' : 'text-[#5E667A]'}`}>Bag</span>
        </div>
        
        <div className={`flex-1 h-px mx-2 ${isDarkMode ? 'bg-slate-700/30' : 'bg-[#E4DFF5]'}`}></div>

        <div className="flex items-center gap-1">
          <div className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${
            step === 'address' ? 'bg-[#553BE2] text-white shadow' : step === 'payment' ? 'bg-green-100 text-green-700 font-extrabold' : 'bg-[#ECE7FF] text-[#5E667A]'
          }`}>
            {['payment', 'completed'].includes(step) ? '✓' : '2'}
          </div>
          <span className={`text-[10px] font-bold ${step === 'address' ? 'text-[#553BE2]' : isDarkMode ? 'text-slate-500' : 'text-[#5E667A]'}`}>Address</span>
        </div>

        <div className={`flex-1 h-px mx-2 ${isDarkMode ? 'bg-slate-700/30' : 'bg-[#E4DFF5]'}`}></div>

        <div className="flex items-center gap-1">
          <div className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${step === 'payment' ? 'bg-[#553BE2] text-white shadow' : 'bg-[#ECE7FF] text-[#5E667A]'}`}>
            3
          </div>
          <span className={`text-[10px] font-bold ${step === 'payment' ? 'text-[#553BE2]' : isDarkMode ? 'text-slate-500' : 'text-[#5E667A]'}`}>Payment</span>
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
              <p className="text-xs font-bold max-w-[180px] mx-auto">Your Shopping bag is empty.</p>
              <button 
                onClick={() => onNavigate('home')}
                className="py-2.5 px-6 rounded-full border border-[#553BE2] text-[#553BE2] text-xs font-bold leading-none hover:bg-[#F2EEFF]"
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
                      className="absolute top-2.5 right-2.5 text-[#8E96AA] hover:text-red-500 transition-colors p-1"
                    >
                      <span className="material-symbols-outlined text-base">close</span>
                    </button>
                    
                    {/* Item Thumbnail */}
                    <div className="w-16 h-20 rounded-xl bg-[#F2EEFF] overflow-hidden shrink-0 border border-[#E4DFF5]">
                      <img alt={item.product.name} className="w-full h-full object-cover" src={item.product.imageUrl} />
                    </div>

                    {/* Details content row */}
                    <div className="flex-grow min-w-0 pr-6 select-none leading-normal">
                      <p className={`text-xs font-bold truncate ${isDarkMode ? 'text-slate-100' : 'text-[#131426]'}`}>{item.product.name}</p>
                      
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={`text-[10px] font-extrabold uppercase ${isDarkMode ? 'text-slate-500' : 'text-[#5E667A]'}`}>Color:</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md leading-none border ${
                          isDarkMode
                            ? 'text-slate-200 bg-slate-800/40 border-slate-700/30'
                            : 'text-[#131426] bg-[#F2EEFF] border-[#E4DFF5]'
                        }`}>{item.color}</span>
                        <span className={`text-[10px] font-extrabold uppercase ml-2 ${isDarkMode ? 'text-slate-500' : 'text-[#5E667A]'}`}>Size:</span>
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
                onClick={() => setStep('address')}
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
          {/* Preset address choice pills */}
          <div className="grid grid-cols-2 gap-3">
            <div 
              onClick={() => setAddressChoice('home')}
              className={`p-3.5 rounded-2xl border flex items-start gap-3 cursor-pointer transition-all ${
                addressChoice === 'home' 
                  ? 'border-[#553BE2] bg-[#F2EEFF] shadow-sm' 
                  : 'border-[#E4DFF5] bg-white'
              }`}
            >
              <span className={`material-symbols-outlined text-xl ${addressChoice === 'home' ? 'text-[#553BE2]' : 'text-[#8E96AA]'}`}>home</span>
              <div className="leading-tight">
                <p className="text-xs font-bold text-[#131426]">Deliver to Home</p>
                <p className="text-[10px] text-[#5E667A] mt-1">Flat 402, Elite Indiranagar, Bangalore</p>
              </div>
            </div>

            <div 
              onClick={() => setAddressChoice('work')}
              className={`p-3.5 rounded-2xl border flex items-start gap-3 cursor-pointer transition-all ${
                addressChoice === 'work' 
                  ? 'border-[#553BE2] bg-[#F2EEFF] shadow-sm' 
                  : 'border-[#E4DFF5] bg-white'
              }`}
            >
              <span className={`material-symbols-outlined text-xl ${addressChoice === 'work' ? 'text-[#553BE2]' : 'text-[#8E96AA]'}`}>domain</span>
              <div className="leading-tight">
                <p className="text-xs font-bold text-[#131426]">Deliver to Office</p>
                <p className="text-[10px] text-[#5E667A] mt-1">Tech Park, Phase-II Prestige, Bellandur</p>
              </div>
            </div>
          </div>

          {/* Detailed field forms */}
          <div className="glass-card rounded-2xl p-4 space-y-3 text-left">
            <h3 className="text-xs font-bold text-[#5E667A] uppercase tracking-widest leading-none border-b border-[#E4DFF5] pb-2">Modify Details</h3>
            
            <div>
              <label className="block text-[10px] font-bold text-[#5E667A] mb-1">FLAT NO. / ROAD ADDRESS</label>
              <input 
                type="text" 
                value={flatNo} 
                onChange={(e) => setFlatNo(e.target.value)}
                className="w-full p-2.5 bg-[#F2EEFF] border border-[#E4DFF5] rounded-xl text-xs font-semibold text-[#131426] focus:outline-none focus:border-[#553BE2]"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-[#5E667A] mb-1">LANDMARK</label>
              <input 
                type="text" 
                value={landmark} 
                onChange={(e) => setLandmark(e.target.value)}
                className="w-full p-2.5 bg-[#F2EEFF] border border-[#E4DFF5] rounded-xl text-xs font-semibold text-[#131426] focus:outline-none focus:border-[#553BE2]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-[#5E667A] mb-1">CITY / STATE</label>
                <input 
                  type="text" 
                  value={city} 
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full p-2.5 bg-[#F2EEFF] border border-[#E4DFF5] rounded-xl text-xs font-semibold text-[#131426] focus:outline-none focus:border-[#553BE2]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#5E667A] mb-1">PINCODE</label>
                <input 
                  type="text" 
                  value={pinCode} 
                  onChange={(e) => setPinCode(e.target.value)}
                  className="w-full p-2.5 bg-[#F2EEFF] border border-[#E4DFF5] rounded-xl text-xs font-semibold text-[#131426] focus:outline-none focus:border-[#553BE2]"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button 
              onClick={() => setStep('cart')}
              className="flex-1 py-3.5 rounded-xl border border-[#E4DFF5] bg-white text-[#5E667A] font-bold text-xs hover:bg-[#F2EEFF] hover:text-[#131426] transition-colors"
            >
              Back
            </button>
            <button 
              onClick={() => setStep('payment')}
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
              onClick={handlePlaceOrder}
              className="flex-[2] py-3.5 rounded-xl bg-[#553BE2] hover:opacity-95 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-[#553BE2]/20"
            >
              <span className="material-symbols-outlined text-base">shopping_cart_checkout</span> Securely Place Order
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
