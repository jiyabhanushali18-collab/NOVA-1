import React from 'react';
import { Search, X } from 'lucide-react';

interface FAQSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  resultCount?: number;
  totalCount?: number;
  isDarkMode?: boolean;
}

export const FAQSearchBar: React.FC<FAQSearchBarProps> = ({
  value,
  onChange,
  resultCount,
  totalCount,
  isDarkMode = false
}) => {
  return (
    <div className="w-full relative">
      <div
        className={`relative flex items-center rounded-2xl border transition-all duration-200 shadow-sm ${
          isDarkMode
            ? 'bg-slate-900/90 border-slate-800 focus-within:border-[#553BE2] focus-within:ring-2 focus-within:ring-[#553BE2]/20'
            : 'bg-white border-[#E4DFF5] focus-within:border-[#553BE2] focus-within:ring-2 focus-within:ring-[#553BE2]/15 shadow-[0_2px_10px_rgba(85,59,226,0.04)]'
        }`}
      >
        <div className="pl-3.5 pr-2 flex items-center pointer-events-none text-[#553BE2]">
          <Search className="w-4 h-4 stroke-[2.2]" />
        </div>

        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search questions or keywords..."
          aria-label="Search questions or keywords"
          className={`w-full py-3 pr-10 text-xs font-medium bg-transparent focus:outline-none placeholder:text-slate-400 ${
            isDarkMode ? 'text-white' : 'text-[#131426]'
          }`}
        />

        {value ? (
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label="Clear search query"
            className={`absolute right-2.5 p-1 rounded-xl transition-colors ${
              isDarkMode
                ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                : 'text-[#5E667A] hover:text-[#131426] hover:bg-[#F2EEFF]'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        ) : null}
      </div>

      {value.trim() && typeof resultCount === 'number' ? (
        <div className="flex items-center justify-between px-1.5 pt-1.5 text-[11px]">
          <span className={isDarkMode ? 'text-slate-400' : 'text-[#5E667A]'}>
            Showing <strong className="text-[#553BE2]">{resultCount}</strong> of {totalCount} questions
          </span>
          <button
            type="button"
            onClick={() => onChange('')}
            className="text-[11px] font-bold text-[#553BE2] hover:underline"
          >
            Clear
          </button>
        </div>
      ) : null}
    </div>
  );
};
