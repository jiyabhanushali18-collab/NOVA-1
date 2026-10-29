import React, { useState, useMemo } from 'react';
import { ArrowLeft, Sparkles, HelpCircle, RefreshCw } from 'lucide-react';
import { ScreenId } from '../../types';
import { FAQ_CATEGORIES, FAQ_ITEMS, searchFAQs } from '../../data/faqData';
import { FAQSearchBar } from './FAQSearchBar';
import { FAQCategoryChips } from './FAQCategoryChips';
import { FAQAccordionItem } from './FAQAccordionItem';
import { FAQSupportCard } from './FAQSupportCard';

export interface FAQViewProps {
  onBack: () => void;
  onNavigate: (screen: ScreenId) => void;
  isDarkMode?: boolean;
}

export const FAQView: React.FC<FAQViewProps> = ({
  onBack,
  onNavigate,
  isDarkMode = false
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('all');
  const [openItemIds, setOpenItemIds] = useState<Set<string>>(() => new Set(['gs-1'])); // Expand first question by default

  // Filter questions based on search query and selected category
  const filteredItems = useMemo(() => {
    return searchFAQs(searchQuery, selectedCategoryId, FAQ_ITEMS);
  }, [searchQuery, selectedCategoryId]);

  // Calculate question count for each category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: FAQ_ITEMS.length
    };
    FAQ_ITEMS.forEach((item) => {
      counts[item.categoryId] = (counts[item.categoryId] || 0) + 1;
    });
    return counts;
  }, []);

  const toggleAccordion = (id: string) => {
    setOpenItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSelectedCategoryId('all');
  };

  return (
    <div
      className={`w-full min-h-screen pb-28 space-y-4 animate-fade-in ${
        isDarkMode ? 'text-slate-100' : 'text-[#131426]'
      }`}
    >
      {/* 1. Header Toolbar */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to Profile"
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold border transition-all active:scale-95 cursor-pointer ${
            isDarkMode
              ? 'bg-slate-900 border-slate-800 text-slate-200 hover:bg-slate-800'
              : 'bg-white border-[#E4DFF5] text-[#131426] hover:bg-[#F2EEFF] hover:text-[#553BE2] shadow-[0_2px_8px_rgba(19,20,38,0.04)]'
          }`}
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Profile</span>
        </button>

        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black bg-[#553BE2]/10 text-[#553BE2] border border-[#553BE2]/20">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Knowledge Hub</span>
        </div>
      </div>

      {/* 2. Hero Title Section */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h1
            className={`text-xl md:text-2xl font-black tracking-tight ${
              isDarkMode ? 'text-white' : 'text-[#131426]'
            }`}
          >
            Frequently Asked Questions
          </h1>
        </div>
        <p
          className={`text-xs leading-relaxed ${
            isDarkMode ? 'text-slate-400' : 'text-[#5E667A]'
          }`}
        >
          Everything you need to know about NOVA.
        </p>
      </div>

      {/* 3. Search Bar */}
      <FAQSearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        resultCount={filteredItems.length}
        totalCount={FAQ_ITEMS.length}
        isDarkMode={isDarkMode}
      />

      {/* 4. Horizontally Scrollable Category Chips */}
      <FAQCategoryChips
        categories={FAQ_CATEGORIES}
        selectedCategoryId={selectedCategoryId}
        onSelectCategory={setSelectedCategoryId}
        categoryCounts={categoryCounts}
        isDarkMode={isDarkMode}
      />

      {/* 5. Questions Accordion List / Empty State */}
      <div className="space-y-2.5 pt-1">
        {filteredItems.length > 0 ? (
          filteredItems.map((item) => (
            <FAQAccordionItem
              key={item.id}
              item={item}
              isOpen={openItemIds.has(item.id)}
              onToggle={() => toggleAccordion(item.id)}
              onNavigate={onNavigate}
              isDarkMode={isDarkMode}
            />
          ))
        ) : (
          <div
            className={`rounded-3xl p-8 border text-center space-y-3.5 my-2 ${
              isDarkMode
                ? 'bg-slate-900/60 border-slate-800 text-slate-300'
                : 'bg-white border-[#E4DFF5] text-[#5E667A] shadow-[0_2px_12px_rgba(85,59,226,0.04)]'
            }`}
          >
            <div className="w-12 h-12 rounded-2xl bg-[#553BE2]/10 text-[#553BE2] flex items-center justify-center mx-auto">
              <HelpCircle className="w-6 h-6 stroke-[2]" />
            </div>
            <div className="space-y-1">
              <h3
                className={`text-sm font-black ${
                  isDarkMode ? 'text-white' : 'text-[#131426]'
                }`}
              >
                No matching questions found
              </h3>
              <p className="text-xs leading-relaxed max-w-xs mx-auto">
                We couldn&apos;t find any questions matching &ldquo;{searchQuery}&rdquo; in this category.
              </p>
            </div>
            <div>
              <button
                type="button"
                onClick={handleClearSearch}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#553BE2] hover:bg-[#472FC9] text-white shadow-sm transition-all cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Clear Filters &amp; View All</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 6. Support Card at the Bottom */}
      <div className="pt-3">
        <FAQSupportCard onNavigate={onNavigate} isDarkMode={isDarkMode} />
      </div>
    </div>
  );
};
