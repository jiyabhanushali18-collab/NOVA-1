import React, { memo } from 'react';
import { GarmentColorOption } from '../utils/arTryOnColors';
import { normalizeColorKey, isLightColor } from '../utils/colors';

interface MinimalColorSelectorProps {
  colors: GarmentColorOption[];
  selectedColorName: string;
  onSelectColor: (color: GarmentColorOption) => void;
  className?: string;
}

/**
 * MinimalGarmentColorSelector
 *
 * Compact, premium circular colour swatches designed for NOVA's AR Try-On experience.
 * Condition: Only renders when a garment has multiple colour variants.
 */
export const MinimalColorSelector = memo<MinimalColorSelectorProps>(({
  colors,
  selectedColorName,
  onSelectColor,
  className = '',
}) => {
  // STRICT CONDITIONAL DISPLAY:
  // If a garment has 1 or fewer colours, hide the selector entirely.
  if (!colors || colors.length <= 1) {
    return null;
  }

  const normalizedSelected = normalizeColorKey(selectedColorName);

  return (
    <div
      data-testid="ar-minimal-color-selector"
      className={`flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl bg-[#111322]/80 border border-white/10 backdrop-blur-md shadow-sm transition-all ${className}`}
    >
      {/* Selected Colour Label */}
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-[11px] font-medium text-slate-400 shrink-0">
          Choose colour:
        </span>
        <span className="text-[11px] font-bold text-white truncate capitalize">
          {selectedColorName || colors[0]?.name}
        </span>
      </div>

      {/* Circular Colour Swatches */}
      <div
        role="radiogroup"
        aria-label="Garment colour selection"
        className="flex items-center gap-2 overflow-x-auto hide-scrollbar py-0.5 px-1 shrink-0"
      >
        {colors.map((color) => {
          const isSelected = normalizeColorKey(color.name) === normalizedSelected;
          const isLight = isLightColor(color.hex);

          return (
            <button
              key={color.name}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={`Select ${color.name}`}
              onClick={() => onSelectColor(color)}
              title={color.name}
              className={`w-5 h-5 rounded-full transition-all duration-200 cursor-pointer relative shrink-0 ${
                isSelected
                  ? 'scale-115 ring-2 ring-[#A594FD] ring-offset-2 ring-offset-[#0B0C15] shadow-sm z-10'
                  : 'hover:scale-110 active:scale-95 opacity-85 hover:opacity-100'
              } ${isLight ? 'border border-black/25' : 'border border-white/20'}`}
              style={{ backgroundColor: color.hex }}
            />
          );
        })}
      </div>
    </div>
  );
});

MinimalColorSelector.displayName = 'MinimalColorSelector';
