import React, { useState } from 'react';
import { useTutorial } from './TutorialContext';
import { tutorialService } from '../../services/tutorialService';
import { ScreenId } from '../../types';

interface TryOnFeedbackModalProps {
  onNavigate: (screen: ScreenId) => void;
}

const FEEDBACK_TAGS = [
  'Easy to use',
  'Needed more guidance',
  'Camera/lighting',
  'Outfit alignment',
  'Other'
];

export const TryOnFeedbackModal: React.FC<TryOnFeedbackModalProps> = ({ onNavigate }) => {
  const { isFeedbackOpen, closeFeedback, openWelcome } = useTutorial();
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [selectedTags, setSelectedTags] = useState<string[]>(['Easy to use']);
  const [notes, setNotes] = useState<string>('');
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);

  if (!isFeedbackOpen) return null;

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = () => {
    tutorialService.saveTryOnFeedback({
      rating,
      tags: selectedTags,
      notes: notes.trim()
    });
    setIsSubmitted(true);
  };

  const handleSkip = () => {
    setIsSubmitted(true);
  };

  const handleExploreAnother = () => {
    closeFeedback();
    setIsSubmitted(false);
    openWelcome();
  };

  const handleGoHome = () => {
    closeFeedback();
    setIsSubmitted(false);
    onNavigate('home');
  };

  return (
    <div
      className="fixed inset-0 z-[9999] bg-[#07080F]/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-title"
    >
      <div className="w-full max-w-sm rounded-[28px] p-6 bg-[#111322] border border-[#553BE2]/40 shadow-2xl text-center space-y-4">
        {!isSubmitted ? (
          <>
            {/* Header Icon */}
            <div className="w-13 h-13 rounded-2xl bg-[#553BE2]/20 border border-[#553BE2]/40 text-[#A594FD] flex items-center justify-center mx-auto shadow-lg shadow-[#553BE2]/20">
              <span className="material-symbols-outlined text-2xl">rate_review</span>
            </div>

            {/* Title & Subtitle */}
            <div className="space-y-1">
              <h3 id="feedback-title" className="text-lg font-bold text-white tracking-tight">
                How was your AR Try-On?
              </h3>
              <p className="text-xs text-slate-300">
                Help us improve your virtual styling experience.
              </p>
            </div>

            {/* 5-Star Interactive Rating */}
            <div className="flex items-center justify-center gap-1.5 py-1">
              {[1, 2, 3, 4, 5].map((star) => {
                const filled = (hoverRating || rating) >= star;
                return (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="p-1 text-2xl cursor-pointer transition-transform hover:scale-120 active:scale-95"
                    aria-label={`${star} star`}
                  >
                    <span
                      className={`material-symbols-outlined ${
                        filled
                          ? 'text-[#FBBF24] fill-current drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]'
                          : 'text-slate-600'
                      }`}
                    >
                      star
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Tag Chips */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
              {FEEDBACK_TAGS.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#553BE2] border-[#8B6DFD] text-white shadow-sm shadow-[#553BE2]/30'
                        : 'bg-[#181928] border-white/10 text-slate-400 hover:text-white hover:border-white/20'
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>

            {/* Optional Notes Input */}
            <div className="text-left pt-1">
              <input
                type="text"
                placeholder="Any suggestions for NOVA? (Optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full text-xs px-3 py-2.5 rounded-xl bg-[#181928] border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-[#553BE2]"
              />
            </div>

            {/* Actions */}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={handleSubmit}
                className="w-full py-3 px-4 rounded-xl bg-[#553BE2] hover:bg-[#6D4AFF] active:scale-98 text-white font-bold text-xs shadow-lg shadow-[#553BE2]/30 transition-all cursor-pointer"
              >
                Submit Feedback
              </button>

              <button
                type="button"
                onClick={handleSkip}
                className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                Skip
              </button>
            </div>
          </>
        ) : (
          /* Completion Card */
          <div className="space-y-4 py-2 animate-in zoom-in-95 duration-200">
            {/* Celebration Icon */}
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
              <span className="material-symbols-outlined text-3xl">celebration</span>
            </div>

            {/* Title & Description */}
            <div className="space-y-1.5">
              <h3 className="text-xl font-extrabold text-white tracking-tight">
                Try-On Mastered! 🎉
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed px-2">
                You're now ready to explore NOVA's wardrobe and smart mirror features anytime.
              </p>
            </div>

            {/* Two Action Buttons */}
            <div className="space-y-2 pt-3">
              <button
                type="button"
                onClick={handleExploreAnother}
                className="w-full py-3 px-4 rounded-xl bg-[#553BE2] hover:bg-[#6D4AFF] active:scale-98 text-white font-bold text-xs shadow-lg shadow-[#553BE2]/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm leading-none">auto_awesome</span>
                <span>Explore Another Feature</span>
              </button>

              <button
                type="button"
                onClick={handleGoHome}
                className="w-full py-3 px-4 rounded-xl bg-[#181928] hover:bg-[#202236] border border-white/10 active:scale-98 text-slate-200 font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm leading-none">home</span>
                <span>Go to Home</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
