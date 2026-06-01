import React from 'react';
import { ScreenId } from '../types';
import { products } from '../data';

interface ShowroomViewProps {
  onNavigate: (screen: ScreenId) => void;
  wishlist?: string[];
  onToggleWishlist?: (productId: string) => void;
  onSelectProduct?: (productId: string) => void;
  cartItemsCount?: number;
}

export const ShowroomView: React.FC<ShowroomViewProps> = ({ 
  onNavigate,
  wishlist = [],
  onToggleWishlist,
  onSelectProduct,
  cartItemsCount = 0
}) => {
  return (
    <div className="space-y-6">
      {/* Header Section */}
      <section className="mt-4 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              NOVA Showroom <span className="text-amber-400">✨</span>
            </h1>
            <p className="text-slate-600 mt-1 leading-relaxed">
              Discover our latest drops and curated collection
            </p>
          </div>
        </div>
      </section>

      {/* Featured Banner */}
      <section className="glass-panel rounded-2xl p-6 relative overflow-hidden group bg-gradient-to-r from-indigo-50/80 to-purple-50/80 border border-indigo-100/40">
        <div className="absolute -right-10 -top-10 w-48 h-48 bg-indigo-200/30 rounded-full blur-3xl"></div>
        <div className="relative z-10">
          <span className="text-xs font-black text-indigo-600 uppercase tracking-widest block mb-2">Featured</span>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Spring Collection</h2>
          <p className="text-sm text-slate-600 mb-4">Explore our latest drops and exclusive pieces</p>
          {cartItemsCount > 0 && (
            <div className="inline-flex items-center space-x-2 bg-white/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/80 shadow-sm">
              <span className="material-symbols-outlined text-indigo-600 text-base leading-none">shopping_bag</span>
              <span className="text-sm font-semibold text-indigo-600">{cartItemsCount} item{cartItemsCount > 1 ? 's' : ''} in cart</span>
            </div>
          )}
        </div>
      </section>

      {/* Products Grid */}
      <section>
        <div className="flex justify-between items-end mb-4">
          <h2 className="text-base font-semibold text-slate-900 flex items-center">
            <span className="material-symbols-outlined text-indigo-600 mr-2 text-xl leading-none">local_mall</span>
            All Products
          </h2>
          <span className="text-[10px] text-indigo-700 font-extrabold bg-indigo-50/70 px-2 py-0.5 rounded-full border border-indigo-100/30">
            {Object.keys(products).length} Drops
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {Object.values(products).map((product) => {
            const isWishlisted = wishlist.includes(product.id);
            return (
              <div 
                key={product.id}
                onClick={() => {
                  if (onSelectProduct) {
                    onSelectProduct(product.id);
                  } else {
                    onNavigate('product-details');
                  }
                }}
                className="glass-panel rounded-2xl p-3 flex flex-col hover:shadow-md cursor-pointer transition-all duration-300 group relative border border-white/30"
              >
                {/* Wishlist Heart Icon overlay */}
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onToggleWishlist) {
                      onToggleWishlist(product.id);
                    }
                  }}
                  className={`absolute top-2.5 right-2.5 z-10 w-8 h-8 rounded-full flex items-center justify-center shadow-sm select-none transition-all cursor-pointer ${
                    isWishlisted 
                      ? 'bg-rose-50 text-rose-500 border border-rose-100' 
                      : 'bg-white/85 text-slate-450 hover:text-rose-500 hover:bg-white'
                  }`}
                  title={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
                >
                  <span className="material-symbols-outlined text-sm leading-none" style={{ fontVariationSettings: isWishlisted ? "'FILL' 1" : undefined }}>
                    {isWishlisted ? 'favorite' : 'favorite_border'}
                  </span>
                </button>

                <div className="h-44 rounded-xl bg-slate-50/70 mb-2.5 overflow-hidden flex items-center justify-center relative border border-slate-100">
                  <img 
                    src={product.imageUrl} 
                    alt={product.name} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                  />
                  {product.badge && (
                    <span className="absolute bottom-2 left-2 bg-indigo-600 text-white text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
                      {product.badge}
                    </span>
                  )}
                </div>

                <div className="leading-tight flex-grow flex flex-col justify-between">
                  <div>
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">
                      {product.category}
                    </span>
                    <h4 className="text-xs font-bold text-slate-800 line-clamp-1 group-hover:text-indigo-600 transition-colors">
                      {product.name}
                    </h4>
                  </div>

                  <div className="flex justify-between items-center mt-2.5">
                    <span className="text-xs font-black text-indigo-700">₹{product.price.toLocaleString()}</span>
                    <span className="text-[9px] font-bold text-slate-500 flex items-center gap-0.5">
                      <span className="material-symbols-outlined text-[10px] text-amber-500" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                      {product.rating}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Actions Footer */}
      <section className="pb-4">
        <button 
          onClick={() => onNavigate('home')}
          className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-colors shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-lg leading-none">home</span>
          Back to Home
        </button>
      </section>
    </div>
  );
};
