import React, { useState } from 'react';
import { ScreenId } from '../types';
import { products } from '../data';

interface ProductDetailsViewProps {
  onNavigate: (screen: ScreenId) => void;
  onAddToCart: (prodId: string, color: string, size: string) => void;
  selectedColor: string;
  setSelectedColor: (color: string) => void;
  wishlist?: string[];
  onToggleWishlist?: (productId: string) => void;
  selectedProductId?: string;
}

export const ProductDetailsView: React.FC<ProductDetailsViewProps> = ({
  onNavigate,
  onAddToCart,
  selectedColor,
  setSelectedColor,
  wishlist = [],
  onToggleWishlist,
  selectedProductId = 'lavender-hoodie'
}) => {
  const mainProduct = products[selectedProductId] || products['lavender-hoodie'];
  const [selectedSize, setSelectedSize] = useState('M');
  const [activeTab, setActiveTab] = useState<'details' | 'material' | 'reviews' | 'delivery'>('details');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleAddToCart = (prodId: string, color: string, size: string) => {
    onAddToCart(prodId, color, size);
    setToastMessage(`✓ Added 1x ${products[prodId].name} (${color}, Size ${size}) to Cart!`);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const completeLookItems = [
    { id: 'cargo-pants', name: 'Cargo Pants', price: '₹1,899', rating: '4.5' },
    { id: 'white-sneakers', name: 'White Sneakers', price: '₹2,299', rating: '4.8' },
    { id: 'crossbody-bag', name: 'Crossbody Bag', price: '₹999', rating: '4.4' }
  ];

  return (
    <div className="-mx-4 space-y-6">
      {/* Toast Alert floating block */}
      {toastMessage && (
        <div className="fixed top-20 inset-x-4 z-50 bg-indigo-900/95 backdrop-blur-md text-white text-xs font-bold text-center px-4 py-3 rounded-xl shadow-lg border border-indigo-400/30 animate-scale-up">
          {toastMessage}
        </div>
      )}

      {/* Large Product Hero Image display card */}
      <section className="relative w-full h-[380px] bg-slate-100 flex items-center justify-center overflow-hidden rounded-b-3xl border-b border-slate-200">
        <img 
          alt="Streetwear Lavender Hoodie model photography" 
          className="w-full h-full object-cover object-center absolute inset-0"
          referrerPolicy="no-referrer"
          src={mainProduct.imageUrl}
        />
        {/* badges inside hero */}
        <div className="absolute top-4 left-4 flex flex-col gap-2">
          <span className="bg-white/80 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-extrabold text-indigo-700 flex items-center gap-1 shadow-sm uppercase tracking-wider border border-white">
            <span className="material-symbols-outlined text-xs leading-none text-red-500">local_fire_department</span> Top Pick
          </span>
        </div>

        {/* 360 view indicator */}
        <div className="absolute top-4 right-4 flex flex-col gap-3">
          <button className="bg-white/80 backdrop-blur-md p-2 rounded-full text-indigo-600 hover:bg-white shadow-sm flex items-center justify-center border border-white">
            <span className="material-symbols-outlined text-base leading-none">360</span>
          </button>
        </div>

        {/* Pagination Dots indicator */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 bg-black/20 backdrop-blur px-2.5 py-1.5 rounded-full">
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-600"></div>
          <div className="w-1.5 h-1.5 rounded-full bg-white/50"></div>
          <div className="w-1.5 h-1.5 rounded-full bg-white/50"></div>
        </div>
      </section>

      {/* Product Information specs body */}
      <section className="px-4 relative z-10 -mt-8">
        <div className="glass-card rounded-3xl p-5 shadow-md">
          <div className="flex justify-between items-start gap-2 mb-2">
            <div>
              {/* Taxonomy Label */}
              <span className="inline-block bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded text-[9px] font-bold uppercase tracking-wider mb-2">
                {mainProduct.category}
              </span>
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight leading-tight">{mainProduct.name}</h1>
            </div>
            
            <button 
              onClick={() => {
                if (onToggleWishlist) {
                  onToggleWishlist(mainProduct.id);
                  const isSaved = wishlist.includes(mainProduct.id);
                  setToastMessage(isSaved ? `Removed ${mainProduct.name} from Saved Items` : `✓ Saved ${mainProduct.name} to Saved Items!`);
                  setTimeout(() => setToastMessage(null), 2500);
                }
              }}
              className={`p-2.5 rounded-2xl border transition-all active:scale-95 cursor-pointer ${
                wishlist.includes(mainProduct.id)
                  ? 'border-indigo-150 bg-indigo-50 text-indigo-600 shadow-sm'
                  : 'border-slate-150 bg-white text-slate-400 hover:text-slate-600 hover:border-slate-300'
              }`}
            >
              <span className="material-symbols-outlined leading-none text-lg" style={{ fontVariationSettings: wishlist.includes(mainProduct.id) ? "'FILL' 1" : undefined }}>
                {wishlist.includes(mainProduct.id) ? 'favorite' : 'favorite_border'}
              </span>
            </button>
          </div>
          
          {/* Star review ratings */}
          <div className="flex items-center gap-1 mt-2 mb-4 text-xs font-semibold text-slate-600">
            <span className="material-symbols-outlined text-amber-500 text-sm leading-none" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
            <span>{mainProduct.rating}</span>
            <span className="text-slate-400 font-medium">({mainProduct.reviewsCount} Reviews)</span>
          </div>

          {/* Pricing tag */}
          <div className="mb-5 leading-none">
            <div className="text-2xl font-extrabold text-indigo-600">₹{mainProduct.price}</div>
            <div className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider font-semibold">Inclusive of all taxes</div>
          </div>

          {/* Holographic Virtual try-on direct CTA banner */}
          <div 
            onClick={() => onNavigate('ar-tryon')}
            className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl p-3 flex items-center justify-between mb-5 shadow-sm hover:shadow-md cursor-pointer transition-all duration-300"
          >
            <div className="flex items-center gap-3">
              <div className="bg-indigo-600/10 p-2 rounded-xl text-indigo-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-lg leading-none">face</span>
              </div>
              <div className="leading-tight">
                <div className="text-xs font-extrabold text-indigo-700">Try it on virtually</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Use AR Try-On to see how it fits you in real-time.</div>
              </div>
            </div>
            <span className="material-symbols-outlined text-indigo-600 text-base">chevron_right</span>
          </div>

          {/* Color swatches selector */}
          <div className="mb-5">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Color: <span className="text-slate-800 font-semibold">{selectedColor}</span></div>
            <div className="flex gap-2.5">
              {(mainProduct.colors || ['Default']).map((colorName) => {
                const colorMap: Record<string, string> = {
                  'Lavender': 'bg-indigo-300',
                  'Mint Green': 'bg-teal-300',
                  'Beige': 'bg-amber-100',
                  'Black': 'bg-slate-800',
                  'Sky Blue': 'bg-sky-300',
                  'Olive': 'bg-emerald-800',
                  'White': 'bg-white border-slate-300',
                  'Off-White': 'bg-amber-50',
                  'Black Accents': 'bg-slate-700',
                  'Navy': 'bg-blue-900',
                  'Graphite': 'bg-slate-500',
                  'Classic Grey': 'bg-slate-400',
                  'Navy Blue': 'bg-indigo-900',
                  'Stonewash Blue': 'bg-sky-400',
                  'Classic Denim': 'bg-blue-800',
                  'Sand': 'bg-amber-200',
                  'Chambray': 'bg-sky-200',
                  'Default': 'bg-indigo-500'
                };
                const swClass = colorMap[colorName] || 'bg-slate-400';
                const isActive = selectedColor === colorName;
                return (
                  <button
                    key={colorName}
                    onClick={() => setSelectedColor(colorName)}
                    title={colorName}
                    className={`w-8 h-8 rounded-full ${swClass} border transition-all ${
                      isActive ? 'ring-2 ring-indigo-600 ring-offset-2 border-white' : 'border-slate-200 opacity-60'
                    }`}
                  />
                );
              })}
            </div>
          </div>

          {/* Size choices lists */}
          <div className="mb-5">
            <div className="flex justify-between items-center mb-1.5 text-xs font-bold text-slate-400">
              <span className="uppercase tracking-widest">Size</span>
              <button 
                onClick={() => alert('Refer to M chest specs: 98cm, sleeve: 62cm.')}
                className="text-indigo-600 font-semibold flex items-center gap-1 hover:underline"
              >
                <span className="material-symbols-outlined text-xs leading-none">straighten</span> Size Guide
              </button>
            </div>
            <div className="flex gap-2">
              {mainProduct.sizes.map((sz) => {
                const isActive = selectedSize === sz;
                return (
                  <button
                    key={sz}
                    onClick={() => setSelectedSize(sz)}
                    className={`w-10 h-10 rounded-xl border text-xs font-bold flex items-center justify-center transition-all ${
                      isActive 
                        ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700 font-extrabold' 
                        : 'border-slate-200 text-slate-600 hover:border-indigo-300'
                    }`}
                  >
                    {sz}
                  </button>
                );
              })}
            </div>
            <div className="flex justify-between mt-2.5 text-[10px] font-bold">
              <span className="text-green-600 flex items-center gap-0.5">
                <span className="material-symbols-outlined text-xs leading-none">check_circle</span> In Stock
              </span>
              <span className="text-amber-600">Only {mainProduct.stockLeft} left!</span>
            </div>
          </div>

          {/* Footer actions buttons block */}
          <div className="flex gap-2.5 pt-1">
            <button 
              onClick={() => onNavigate('ar-tryon')}
              className="flex-1 py-3 rounded-xl border border-indigo-600 text-indigo-600 font-bold flex items-center justify-center gap-1.5 text-xs bg-white hover:bg-slate-50 transition-colors"
            >
              <span className="material-symbols-outlined text-base">view_in_ar</span> Try Now (AR)
            </button>
            <button 
              onClick={() => handleAddToCart(mainProduct.id, selectedColor, selectedSize)}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-700 text-white font-bold flex items-center justify-center gap-1.5 text-xs shadow-md shadow-indigo-600/20 hover:opacity-95 transition-opacity"
            >
              <span className="material-symbols-outlined text-base">shopping_bag</span> Add to Cart
            </button>
          </div>
        </div>
      </section>

      {/* Tab components descriptions */}
      <section className="px-4">
        <div className="glass-card rounded-2xl p-1.5">
          <div className="flex overflow-x-auto hide-scrollbar border-b border-slate-100">
            {[
              { id: 'details', label: 'Details' },
              { id: 'material', label: 'Material & Care' },
              { id: 'reviews', label: 'Reviews (128)' },
              { id: 'delivery', label: 'Shipping' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 min-w-[80px] py-2 text-center text-xs font-bold border-b-2 leading-loose transition-all whitespace-nowrap px-2 ${
                  activeTab === tab.id 
                    ? 'border-indigo-600 text-indigo-600 font-extrabold' 
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab contents block switcher */}
          <div className="p-3 text-xs text-slate-600 leading-relaxed min-h-[140px]">
            {activeTab === 'details' && (
              <div className="space-y-3 animate-fade-in">
                <p>Stay modern, stylish and extremely snug with NOVA's trademark heavy cotton fleece hoodie. Engineered specifically for casual coordinate wear.</p>
                <ul className="grid grid-cols-2 gap-y-1.5 text-slate-700 font-semibold pl-1">
                  <li className="flex items-center gap-1.5"><span className="material-symbols-outlined text-indigo-600 text-sm">check_circle</span> Cotton Fleece blend</li>
                  <li className="flex items-center gap-1.5"><span className="material-symbols-outlined text-indigo-600 text-sm">check_circle</span> Relaxed smart silhouette</li>
                  <li className="flex items-center gap-1.5"><span className="material-symbols-outlined text-indigo-600 text-sm">check_circle</span> Braided drawstring hood</li>
                  <li className="flex items-center gap-1.5"><span className="material-symbols-outlined text-indigo-600 text-sm">check_circle</span> Kangaroo storage pocket</li>
                </ul>
              </div>
            )}
            {activeTab === 'material' && (
              <p className="space-y-1 animate-fade-in">
                <strong>Body:</strong> 85% Organic Peruvian Cotton, 15% Premium Lyocell.<br /><br />
                <strong>Washing:</strong> Machine wash cold, cycle inside-out. Avoid chlorine bleaching. Air dry flat, warm iron where necessary.
              </p>
            )}
            {activeTab === 'reviews' && (
              <div className="space-y-2.5 animate-fade-in">
                <div className="border-b border-slate-100 pb-2">
                  <div className="flex justify-between font-bold text-slate-800">
                    <span>Pranav S.</span>
                    <span className="text-amber-500">★★★★★</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">The lavender tone matches the web preview precisely! Very comfortable fleece inner overlay.</p>
                </div>
                <div>
                  <div className="flex justify-between font-bold text-slate-800">
                    <span>Aditya R.</span>
                    <span className="text-amber-500">★★★★☆</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">Warm, nice details. M size coordinates perfectly with cargo pants.</p>
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

      {/* Complete The Look accessories suggestions list */}
      <section className="px-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-base font-bold text-slate-800">Complete the Look</h2>
          <button 
            onClick={() => onNavigate('home')}
            className="text-xs font-semibold text-indigo-600 flex items-center hover:underline"
          >
            Explore All <span className="material-symbols-outlined text-sm ml-0.5">chevron_right</span>
          </button>
        </div>
        
        <div className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar">
          {completeLookItems.map((item) => (
            <div 
              key={item.id}
              onClick={() => handleAddToCart(item.id, 'Default', 'One Size')}
              className="min-w-[130px] glass-card rounded-2xl p-2.5 relative cursor-pointer border border-transparent hover:border-slate-200 transition-colors"
            >
              <button 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  if (onToggleWishlist) {
                    onToggleWishlist(item.id);
                    const isSaved = wishlist.includes(item.id);
                    setToastMessage(isSaved ? `Removed ${item.name} from Saved Items` : `✓ Saved ${item.name} to Saved Items!`);
                    setTimeout(() => setToastMessage(null), 2500);
                  }
                }}
                className={`absolute top-3.5 right-3.5 z-10 rounded-full p-1.5 shadow-md flex items-center justify-center transition-all cursor-pointer ${
                  wishlist.includes(item.id)
                    ? 'bg-red-50 text-red-600 border border-red-100'
                    : 'text-slate-500 bg-white/80 hover:bg-white hover:text-red-500'
                }`}
              >
                <span className="material-symbols-outlined text-xs leading-none" style={{ fontVariationSettings: wishlist.includes(item.id) ? "'FILL' 1" : undefined }}>
                  {wishlist.includes(item.id) ? 'favorite' : 'favorite_border'}
                </span>
              </button>
              <div className="h-32 rounded-xl bg-slate-100 mb-2 overflow-hidden flex items-center justify-center">
                <img 
                  alt={item.name} 
                  className="w-full h-full object-cover mix-blend-multiply" 
                  referrerPolicy="no-referrer"
                  src={products[item.id]?.imageUrl}
                />
              </div>
              <div className="text-[11px] font-bold text-slate-800 truncate">{item.name}</div>
              <div className="flex justify-between items-center mt-1">
                <span className="text-xs font-extrabold text-indigo-600">{item.price}</span>
                <span className="text-[9px] font-bold text-slate-400 flex items-center">
                  <span className="material-symbols-outlined text-[10px] text-amber-500 mr-0.5">star</span>
                  {item.rating}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
