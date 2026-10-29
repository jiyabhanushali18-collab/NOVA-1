import React from 'react';
import { TutorialStep } from '../../data/tutorialDefinitions';

interface TutorialTooltipProps {
  step: TutorialStep;
  stepIndex: number;
  totalSteps: number;
  targetRect: DOMRect | null;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  onExit: () => void;
}

export const TutorialTooltip: React.FC<TutorialTooltipProps> = ({
  step,
  stepIndex,
  totalSteps,
  targetRect,
  onNext,
  onPrev,
  onSkip,
  onExit
}) => {
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === totalSteps - 1;

  // Compute position based on target rect and viewport
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 390;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 844;

  let tooltipStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex: 9999,
    width: 'calc(100vw - 32px)',
    maxWidth: '360px',
    left: '50%',
    transform: 'translateX(-50%)'
  };

  let arrowPlacement: 'top' | 'bottom' = 'top';

  if (targetRect) {
    const spaceAbove = targetRect.top;
    const spaceBelow = viewportHeight - targetRect.bottom;

    // Prefer bottom if space permits or if preferred position is bottom
    if (step.position === 'top' || (spaceAbove > 220 && spaceBelow < 200)) {
      // Place above target
      const bottomCoord = viewportHeight - targetRect.top + 12;
      tooltipStyle = {
        ...tooltipStyle,
        bottom: `${Math.max(16, bottomCoord)}px`
      };
      arrowPlacement = 'bottom';
    } else {
      // Place below target
      const topCoord = targetRect.bottom + 12;
      tooltipStyle = {
        ...tooltipStyle,
        top: `${Math.min(viewportHeight - 200, Math.max(16, topCoord))}px`
      };
      arrowPlacement = 'top';
    }
  } else {
    // Center if target not yet mounted
    tooltipStyle = {
      ...tooltipStyle,
      top: '50%',
      transform: 'translate(-50%, -50%)'
    };
  }

  return (
    <div
      style={tooltipStyle}
      className="bg-[#111322]/95 backdrop-blur-2xl border border-[#6D4AFF]/60 rounded-2xl p-4 shadow-[0_16px_40px_rgba(0,0,0,0.8)] text-white animate-in fade-in zoom-in-95 duration-200 pointer-events-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorial-step-title"
    >
      {/* Tooltip Directional Arrow */}
      {targetRect && (
        <div
          className={`absolute left-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-[#111322] border-[#6D4AFF]/60 rotate-45 ${
            arrowPlacement === 'top'
              ? '-top-2 border-t border-l'
              : '-bottom-2 border-b border-r'
          }`}
        />
      )}

      {/* Header: Step counter and exit button */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black tracking-wider uppercase px-2 py-0.5 rounded-full bg-[#553BE2]/30 text-[#C4B5FD] border border-[#553BE2]/50">
            Step {stepIndex + 1} of {totalSteps}
          </span>
          <div className="flex items-center gap-1">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === stepIndex
                    ? 'w-4 bg-[#8B6DFD]'
                    : i < stepIndex
                    ? 'w-1.5 bg-[#553BE2]'
                    : 'w-1.5 bg-slate-700'
                }`}
              />
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={onExit}
          className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          title="Exit tutorial"
          aria-label="Exit tutorial"
        >
          <span className="material-symbols-outlined text-base leading-none">close</span>
        </button>
      </div>

      {/* Step Title & Instruction */}
      <div className="space-y-1.5 mb-3.5">
        <h4 id="tutorial-step-title" className="text-sm font-bold text-white tracking-tight">
          {step.title}
        </h4>
        <p className="text-xs leading-relaxed text-slate-300 font-normal">
          {step.instruction}
        </p>
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-white/10">
        <div className="flex items-center gap-2">
          {!isFirst ? (
            <button
              type="button"
              onClick={onPrev}
              className="text-xs font-semibold text-slate-400 hover:text-white py-1 px-2 rounded-lg transition-colors cursor-pointer flex items-center gap-0.5"
            >
              <span className="material-symbols-outlined text-sm leading-none">chevron_left</span>
              Back
            </button>
          ) : (
            <button
              type="button"
              onClick={onExit}
              className="text-xs font-semibold text-slate-400 hover:text-white py-1 px-2 rounded-lg transition-colors cursor-pointer"
            >
              Exit
            </button>
          )}

          {!isLast && (
            <button
              type="button"
              onClick={onSkip}
              className="text-xs font-medium text-slate-500 hover:text-slate-300 py-1 px-1 transition-colors cursor-pointer"
            >
              Skip
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={onNext}
          className="bg-[#553BE2] hover:bg-[#6D4AFF] active:scale-95 text-white text-xs font-bold py-1.5 px-3.5 rounded-xl shadow-lg shadow-[#553BE2]/30 transition-all flex items-center gap-1 cursor-pointer"
        >
          <span>{step.actionLabel || (isLast ? 'Finish' : 'Next')}</span>
          <span className="material-symbols-outlined text-sm leading-none">
            {isLast ? 'check' : 'chevron_right'}
          </span>
        </button>
      </div>
    </div>
  );
};
