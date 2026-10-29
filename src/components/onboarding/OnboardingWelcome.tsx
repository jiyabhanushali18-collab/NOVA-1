import React, { useState } from 'react';
import { useTutorial } from './TutorialContext';
import { TUTORIAL_CARD_ITEMS, TutorialFeatureId } from '../../data/tutorialDefinitions';
import { tutorialService } from '../../services/tutorialService';

interface OnboardingWelcomeProps {
  onDismiss?: () => void;
  onStartTour?: (featureId: TutorialFeatureId) => void;
  fullscreen?: boolean;
}

export const OnboardingWelcome: React.FC<OnboardingWelcomeProps> = ({
  onDismiss,
  onStartTour,
  fullscreen = false
}) => {
  const { isWelcomeOpen, closeWelcome, startTutorial } = useTutorial();
  const [selectedFeature, setSelectedFeature] = useState<TutorialFeatureId>('ar-tryon');

  if (!fullscreen && !isWelcomeOpen) return null;

  const handleStartTour = () => {
    tutorialService.setOnboardingWelcomeCompleted(true);
    closeWelcome();
    if (onStartTour) {
      onStartTour(selectedFeature);
    } else {
      startTutorial(selectedFeature);
    }
  };

  const handleSkip = () => {
    tutorialService.setOnboardingWelcomeCompleted(true);
    closeWelcome();
    if (onDismiss) {
      onDismiss();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9998] bg-[#07080F]/95 backdrop-blur-md flex flex-col justify-between items-center p-4 md:p-6 overflow-y-auto animate-in fade-in duration-300"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-heading"
    >
      <div className="w-full max-w-md mx-auto flex flex-col justify-between min-h-full py-4">
        {/* Header */}
        <div className="text-center space-y-2 mb-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#553BE2]/20 border border-[#553BE2]/40 text-[#C4B5FD] text-[11px] font-bold tracking-wider uppercase">
            <span className="material-symbols-outlined text-sm leading-none">auto_awesome</span>
            Interactive Guide
          </div>
          <h1
            id="welcome-heading"
            className="text-2xl md:text-3xl font-extrabold text-white tracking-tight leading-tight"
          >
            What would you like to explore first?
          </h1>
          <p className="text-xs md:text-sm text-slate-300 leading-relaxed max-w-sm mx-auto">
            Choose a feature and NOVA will guide you through it, step by step.
          </p>
        </div>

        {/* Feature Cards Grid (6 selectable cards) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 my-auto py-2">
          {TUTORIAL_CARD_ITEMS.map((item) => {
            const isSelected = selectedFeature === item.id;
            const isCompleted = tutorialService.isFeatureTutorialCompleted(item.id);

            return (
              <div
                key={item.id}
                onClick={() => setSelectedFeature(item.id)}
                className={`group relative rounded-2xl p-3.5 border transition-all duration-200 cursor-pointer text-left flex flex-col justify-between ${
                  isSelected
                    ? 'bg-[#181630] border-[#8B6DFD] shadow-[0_0_20px_rgba(139,109,253,0.35)] ring-1 ring-[#8B6DFD]'
                    : 'bg-[#111322]/80 hover:bg-[#15172A] border-white/10'
                }`}
              >
                {/* Top Row: Icon + Badge + Selection Check */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 ${
                      isSelected
                        ? 'bg-[#553BE2] text-white shadow-md shadow-[#553BE2]/40'
                        : 'bg-white/10 text-slate-300'
                    }`}
                  >
                    <span className="material-symbols-outlined text-xl leading-none">
                      {item.icon}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {isCompleted ? (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-[10px] leading-none">check</span>
                        Done
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-white/10 text-slate-400">
                        {item.badge}
                      </span>
                    )}

                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center border transition-colors ${
                        isSelected
                          ? 'border-[#8B6DFD] bg-[#8B6DFD] text-white'
                          : 'border-slate-600 bg-transparent text-transparent'
                      }`}
                    >
                      <span className="material-symbols-outlined text-xs font-black">check</span>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div>
                  <h3
                    className={`text-sm font-bold tracking-tight mb-1 transition-colors ${
                      isSelected ? 'text-white' : 'text-slate-200'
                    }`}
                  >
                    {item.title}
                  </h3>
                  <p className="text-[11px] text-slate-400 leading-snug line-clamp-2">
                    {item.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="space-y-2 mt-4 pt-2">
          <button
            type="button"
            onClick={handleStartTour}
            className="w-full py-3.5 px-4 rounded-2xl bg-[#553BE2] hover:bg-[#6D4AFF] active:scale-98 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-xl shadow-[#553BE2]/30 transition-all cursor-pointer"
          >
            <span>Start Guided Tour</span>
            <span className="material-symbols-outlined text-base leading-none">arrow_forward</span>
          </button>

          <div className="text-center">
            <button
              type="button"
              onClick={handleSkip}
              className="text-xs font-semibold text-slate-400 hover:text-white py-2 px-4 transition-colors cursor-pointer"
            >
              Skip for Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
