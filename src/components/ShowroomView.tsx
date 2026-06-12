import React from 'react';
import { ScreenId, ProductItem } from '../types';

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
}

export const ShowroomView: React.FC<ShowroomViewProps> = ({ 
  products,
  loading = false,
  error = null,
  onNavigate,
  wishlist = [],
  onToggleWishlist,
  onSelectProduct,
  cartItemsCount = 0,
  isDarkMode = false
}) => {
  return (
    <div className="space-y-6">
      {/* Header Section */}
      <section className="mt-4 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className={`text-3xl font-bold tracking-tight flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              NOVA Showroom <span className="text-amber-400">✨</span>
            </h1>
            <p className={`mt-1 leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
              Discover our latest drops and curated collection
            </p>
          </div>
        </div>
      </section>

      {/* Featured Banner */}
      <section className={`rounded-2xl p-6 relative overflow-hidden group transition-colors duration-300 ${
        isDarkMode 
          ? 'glass-panel bg-gradient-to-r from-indigo-950/50 to-purple-950/50 border-indigo-800/20'
          : 'glass-panel bg-gradient-to-r from-indigo-50/80 to-purple-50/80 border border-indigo-100/40'
      }`}>
        <div className="absolute -right-10 -top-10 w-48 h-48 bg-indigo-200/30 rounded-full blur-3xl"></div>
        <div className="relative z-10">
          <span className={`text-xs font-black uppercase tracking-widest block mb-2 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-600'}`}>Featured</span>
          <h2 className={`text-2xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Spring Collection</h2>
          <p className={`text-sm mb-4 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>Explore our latest drops and exclusive pieces</p>
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
          <h2 className={`text-base font-semibold flex items-center ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            <span className="material-symbols-outlined text-indigo-600 mr-2 text-xl leading-none">local_mall</span>
            All Products
          </h2>
          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${isDarkMode ? 'text-indigo-300 bg-indigo-950/70 border-indigo-700/30' : 'text-indigo-700 bg-indigo-50/70 border-indigo-100/30'}`}>
            {products.length} Drops
          </span>
        </div>

        {loading ? (
          <div className={`rounded-2xl p-6 text-sm ${isDarkMode ? 'bg-slate-900 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
            Loading showroom items...
          </div>
        ) : error ? (
          <div className="rounded-2xl p-6 bg-rose-50 text-sm text-rose-700 border border-rose-200">
            {error}
          </div>
        ) : products.length === 0 ? (
          <div className={`rounded-2xl p-6 text-sm ${isDarkMode ? 'bg-slate-900 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
            No products available right now.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {products.map((product) => {
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
                  className={`glass-panel rounded-2xl p-3 flex flex-col hover:shadow-md cursor-pointer transition-all duration-300 group relative ${
                    isDarkMode
                      ? 'border-slate-700/30'
                      : 'border-white/30'
                  }`}
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
                        : isDarkMode
                          ? 'bg-slate-800/60 text-slate-400 hover:text-rose-500 hover:bg-slate-700'
                          : 'bg-white/85 text-slate-450 hover:text-rose-500 hover:bg-white'
                    }`}
                    title={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
                  >
                    <span className="material-symbols-outlined text-sm leading-none" style={{ fontVariationSettings: isWishlisted ? "'FILL' 1" : undefined }}>
                      {isWishlisted ? 'favorite' : 'favorite_border'}
                    </span>
                  </button>

                  <div className={`h-44 rounded-xl mb-2.5 overflow-hidden flex items-center justify-center relative border ${
                    isDarkMode 
                      ? 'bg-slate-800/30 border-slate-700/30'
                      : 'bg-slate-50/70 border-slate-100'
                  }`}>
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
                      <span className={`text-[8px] font-bold uppercase tracking-widest block mb-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`}>
                        {product.category}
                      </span>
                      <h4 className={`text-xs font-bold line-clamp-1 transition-colors ${
                        isDarkMode 
                          ? 'text-slate-100 group-hover:text-indigo-300'
                          : 'text-slate-800 group-hover:text-indigo-600'
                      }`}>
                        {product.name}
                      </h4>
                    </div>

                    <div className="flex justify-between items-center mt-2.5">
                      <span className={`text-xs font-black ${isDarkMode ? 'text-indigo-400' : 'text-indigo-700'}`}>₹{product.price.toLocaleString()}</span>
                      <span className={`text-[9px] font-bold flex items-center gap-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        <span className="material-symbols-outlined text-[10px] text-amber-500" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                        {product.rating}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
