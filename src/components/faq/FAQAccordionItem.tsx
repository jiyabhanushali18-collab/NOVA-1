import React from 'react';
import { ChevronDown, ArrowRight, CheckCircle2 } from 'lucide-react';
import { FAQItem } from '../../data/faqData';
import { ScreenId } from '../../types';

interface FAQAccordionItemProps {
  item: FAQItem;
  isOpen: boolean;
  onToggle: () => void;
  onNavigate?: (screen: ScreenId) => void;
  isDarkMode?: boolean;
}

export const FAQAccordionItem: React.FC<FAQAccordionItemProps> = ({
  item,
  isOpen,
  onToggle,
  onNavigate,
  isDarkMode = false
}) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToggle();
    }
  };

  return (
    <div
      className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
        isOpen
          ? isDarkMode
            ? 'bg-slate-900/95 border-[#553BE2]/60 shadow-[0_4px_20px_rgba(85,59,226,0.15)] ring-1 ring-[#553BE2]/30'
            : 'bg-white border-[#553BE2]/40 shadow-[0_4px_20px_rgba(85,59,226,0.08)] ring-1 ring-[#553BE2]/20'
          : isDarkMode
          ? 'bg-slate-900/70 border-slate-800/80 hover:border-slate-700/80 hover:bg-slate-900/90'
          : 'bg-white border-[#E4DFF5] hover:border-[#D1C6F8] shadow-[0_2px_8px_rgba(19,20,38,0.03)]'
      }`}
    >
      {/* Header / Question row */}
      <button
        type="button"
        onClick={onToggle}
        onKeyDown={handleKeyDown}
        aria-expanded={isOpen}
        aria-controls={`faq-answer-${item.id}`}
        className="w-full p-4 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer select-none group"
      >
        <span
          className={`text-xs md:text-sm font-bold leading-snug transition-colors ${
            isOpen
              ? 'text-[#553BE2]'
              : isDarkMode
              ? 'text-slate-100 group-hover:text-indigo-300'
              : 'text-[#131426] group-hover:text-[#553BE2]'
          }`}
        >
          {item.question}
        </span>

        <span
          className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-transform duration-200 ${
            isOpen
              ? 'rotate-180 bg-[#553BE2] text-white shadow-sm'
              : isDarkMode
              ? 'bg-slate-800 text-slate-400 group-hover:text-slate-200'
              : 'bg-[#F2EEFF] text-[#553BE2] group-hover:bg-[#ECE7FF]'
          }`}
        >
          <ChevronDown className="w-4 h-4 stroke-[2.2]" />
        </span>
      </button>

      {/* Answer Body (Smooth Height Expansion) */}
      {isOpen && (
        <div
          id={`faq-answer-${item.id}`}
          className={`px-4 pb-4 pt-1 border-t space-y-3 animate-fade-in ${
            isDarkMode ? 'border-slate-800/80 text-slate-300' : 'border-[#E4DFF5]/60 text-[#5E667A]'
          }`}
        >
          <p className="text-xs leading-relaxed font-normal">{item.answer}</p>

          {/* Bullet points if present */}
          {item.points && item.points.length > 0 && (
            <ul className="space-y-1.5 pt-1">
              {item.points.map((pt, idx) => (
                <li key={idx} className="flex items-start gap-2 text-xs leading-relaxed">
                  <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-[#553BE2] shrink-0" />
                  <span>{pt}</span>
                </li>
              ))}
            </ul>
          )}

          {/* Numbered steps if present */}
          {item.steps && item.steps.length > 0 && (
            <ol className="space-y-2 pt-1">
              {item.steps.map((st, idx) => (
                <li key={idx} className="flex items-start gap-2.5 text-xs leading-relaxed">
                  <span className="w-4 h-4 rounded-full bg-[#553BE2]/10 text-[#553BE2] font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <span>{st}</span>
                </li>
              ))}
            </ol>
          )}

          {/* Action Link if configured */}
          {item.actionLink && onNavigate && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => onNavigate(item.actionLink!.screen)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#553BE2] hover:bg-[#472FC9] text-white shadow-sm transition-all active:scale-95 cursor-pointer"
              >
                <span>{item.actionLink.label}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
