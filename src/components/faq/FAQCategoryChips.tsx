import React, { useRef } from 'react';
import { FAQCategory } from '../../data/faqData';

interface FAQCategoryChipsProps {
  categories: FAQCategory[];
  selectedCategoryId: string;
  onSelectCategory: (id: string) => void;
  categoryCounts?: Record<string, number>;
  isDarkMode?: boolean;
}

export const FAQCategoryChips: React.FC<FAQCategoryChipsProps> = ({
  categories,
  selectedCategoryId,
  onSelectCategory,
  categoryCounts = {},
  isDarkMode = false
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div className="w-full relative">
      <div
        ref={containerRef}
        role="tablist"
        aria-label="FAQ Categories"
        className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth py-1 px-0.5"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {categories.map((cat) => {
          const isSelected = selectedCategoryId === cat.id;
          const count = categoryCounts[cat.id];

          return (
            <button
              key={cat.id}
              role="tab"
              aria-selected={isSelected}
              type="button"
              onClick={() => onSelectCategory(cat.id)}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold transition-all duration-200 select-none cursor-pointer active:scale-95 ${
                isSelected
                  ? 'bg-[#553BE2] text-white shadow-[0_4px_14px_rgba(85,59,226,0.35)] ring-1 ring-[#553BE2]'
                  : isDarkMode
                  ? 'bg-slate-900/80 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 hover:border-slate-700'
                  : 'bg-white border border-[#E4DFF5] text-[#5E667A] hover:text-[#131426] hover:bg-[#F2EEFF] hover:border-[#D1C6F8] shadow-[0_1px_4px_rgba(19,20,38,0.03)]'
              }`}
            >
              <span className="material-symbols-outlined text-[16px] leading-none">
                {cat.icon}
              </span>
              <span>{cat.label}</span>
              {typeof count === 'number' && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                    isSelected
                      ? 'bg-white/20 text-white'
                      : isDarkMode
                      ? 'bg-slate-800 text-slate-400'
                      : 'bg-[#F2EEFF] text-[#553BE2]'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
