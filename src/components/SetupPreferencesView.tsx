import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Measurement, Preference } from '../types';

interface SetupPreferencesViewProps {
  userName: string;
  onComplete: (preferences: Preference[], measurements: Measurement[]) => void;
}

type FitOptionName = 'Slim Fit' | 'Regular' | 'Oversized' | 'Relaxed';
type ColorOptionValue = 'Neutrals' | 'Brights' | 'Mix' | 'Monochrome';
type StyleKey = 'Formal' | 'Streetwear' | 'Minimalist' | 'Casual' | 'Gorpcore';

type StyleRecommendation = {
  fit: FitOptionName;
  alternativeFits: FitOptionName[];
  discouragedFits: FitOptionName[];
  colorRecommendations: ColorOptionValue[];
  alternativeColors: ColorOptionValue[];
  suggestionText: string;
  colorText: string;
  helperText: string;
};

const styleRecommendations: Record<StyleKey, StyleRecommendation> = {
  Formal: {
    fit: 'Regular',
    alternativeFits: ['Slim Fit'],
    discouragedFits: ['Oversized', 'Relaxed'],
    colorRecommendations: ['Monochrome', 'Neutrals'],
    alternativeColors: [],
    suggestionText: 'Based on your Formal style preference, NOVA recommends a Regular Fit for a polished and professional appearance.',
    colorText: 'Monochrome and neutral palettes complement formal attire by creating a sophisticated and professional appearance.',
    helperText: 'Oversized silhouettes may reduce the structured and refined look associated with formal wear.',
  },
  Streetwear: {
    fit: 'Oversized',
    alternativeFits: ['Relaxed'],
    discouragedFits: ['Slim Fit'],
    colorRecommendations: ['Brights', 'Mix'],
    alternativeColors: [],
    suggestionText: 'Based on your Streetwear style preference, NOVA recommends an Oversized Fit to achieve a modern urban aesthetic.',
    colorText: 'Bold colors and mixed palettes help express individuality and urban street culture.',
    helperText: 'Streetwear thrives on loose silhouettes, layered styling, and relaxed proportions.',
  },
  Minimalist: {
    fit: 'Regular',
    alternativeFits: ['Slim Fit'],
    discouragedFits: ['Oversized'],
    colorRecommendations: ['Monochrome', 'Neutrals'],
    alternativeColors: [],
    suggestionText: 'Based on your Minimalist style preference, NOVA recommends a Regular Fit to maintain clean lines and timeless simplicity.',
    colorText: 'Minimalist fashion embraces simplicity through clean monochromatic and muted color palettes.',
    helperText: 'Excessively loose fits may disrupt the clean and balanced look of minimalist fashion.',
  },
  Casual: {
    fit: 'Relaxed',
    alternativeFits: ['Regular'],
    discouragedFits: ['Slim Fit'],
    colorRecommendations: ['Mix', 'Neutrals'],
    alternativeColors: [],
    suggestionText: 'Based on your Casual style preference, NOVA recommends a Relaxed Fit for maximum everyday comfort and effortless styling.',
    colorText: 'Casual fashion allows versatile color combinations while maintaining comfort and everyday appeal.',
    helperText: 'Casual fashion focuses on comfort and ease rather than structured tailoring.',
  },
  Gorpcore: {
    fit: 'Relaxed',
    alternativeFits: ['Oversized'],
    discouragedFits: ['Slim Fit'],
    colorRecommendations: ['Neutrals'],
    alternativeColors: ['Monochrome'],
    suggestionText: 'Based on your Gorpcore style preference, NOVA recommends a Relaxed Fit for functional layering and outdoor-inspired versatility.',
    colorText: 'Earth-inspired tones naturally align with outdoor and utility-focused aesthetics.',
    helperText: 'Technical and outdoor garments perform best with room for movement and layering.',
  },
};

export const SetupPreferencesView: React.FC<SetupPreferencesViewProps> = ({ userName, onComplete }) => {
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1: Preferences Selection
  const [selectedStyle, setSelectedStyle] = useState<StyleKey>('Streetwear');
  const [selectedFit, setSelectedFit] = useState<FitOptionName>('Regular');
  const [selectedColors, setSelectedColors] = useState<ColorOptionValue>('Mix');
  const [selectedOccasion, setSelectedOccasion] = useState('Casual');
  const [disabledHint, setDisabledHint] = useState<string | null>(null);

  // Step 2: Measurements Selection
  const [height, setHeight] = useState(178); // cm
  const [weight, setWeight] = useState(68);  // kg
  const [chest, setChest] = useState(98);   // cm
  const [waist, setWaist] = useState(82);   // cm
  const [inseam, setInseam] = useState(78);  // cm

  // Style list configs
  const styleOptions: { name: StyleKey; icon: string; desc: string }[] = [
    { name: 'Streetwear', icon: 'style', desc: 'Graphic hoodies, cargos & fresh sneakers' },
    { name: 'Minimalist', icon: 'filter_b_and_w', desc: 'Monochrome solids & clean tailoring' },
    { name: 'Formal', icon: 'business_center', desc: 'Sharp blazers, dress shirts & oxfords' },
    { name: 'Casual', icon: 'tsunami', desc: 'Comfortable everyday wear & relaxed looks' },
    { name: 'Gorpcore', icon: 'hiking', desc: 'Weatherproof technical gear & outdoorsy outerwear' },
  ];

  const fitOptions: { name: FitOptionName; icon: string; desc: string }[] = [
    { name: 'Slim Fit', icon: 'compress', desc: 'Form-fitting & sharp contours' },
    { name: 'Regular', icon: 'fit_screen', desc: 'Classic silhouette structure' },
    { name: 'Oversized', icon: 'waves', desc: 'Dropping shoulders & cozy drapes' },
    { name: 'Relaxed', icon: 'weekend', desc: 'Laid-back comfort but smart' },
  ];

  const colorOptions: { name: string; value: ColorOptionValue; desc: string; bg: string }[] = [
    { name: 'Neutral & Earthy', value: 'Neutrals', desc: 'Beige, Browns, Cream, Sage', bg: 'bg-amber-100 text-amber-900 border-amber-200' },
    { name: 'Vibrant & Bold', value: 'Brights', desc: 'Reds, Cobalts, Oranges', bg: 'bg-rose-100 text-rose-950 border-rose-200' },
    { name: 'Mixed Palette', value: 'Mix', desc: 'Balanced blend of all color moods', bg: 'bg-indigo-50 text-indigo-950 border-indigo-200' },
    { name: 'Monochrome Slate', value: 'Monochrome', desc: 'Deep black, crisp white & greys', bg: 'bg-slate-100 text-slate-900 border-slate-200' },
  ];

  const recommendation: StyleRecommendation = styleRecommendations[selectedStyle];

  useEffect(() => {
    setSelectedFit(recommendation.fit);
    setSelectedColors(recommendation.colorRecommendations[0]);
    setDisabledHint(null);
  }, [recommendation]);

  const handleFitClick = (fitName: FitOptionName) => {
    if (recommendation.discouragedFits.includes(fitName)) {
      setDisabledHint(recommendation.helperText);
      return;
    }
    setSelectedFit(fitName);
    setDisabledHint(null);
  };

  const isDiscouragedFit = (fitName: FitOptionName) => recommendation.discouragedFits.includes(fitName);
  const isRecommendedFit = (fitName: FitOptionName) => recommendation.fit === fitName;
  const isAlternativeFit = (fitName: FitOptionName) => recommendation.alternativeFits.includes(fitName);
  const isRecommendedColor = (colorValue: ColorOptionValue) => recommendation.colorRecommendations.includes(colorValue);
  const isAlternativeColor = (colorValue: ColorOptionValue) => recommendation.alternativeColors.includes(colorValue);

  const handleNextStep = () => {
    setStep(2);
  };

  const handleFinish = () => {
    const preferencesData: Preference[] = [
      { label: 'Style', value: selectedStyle, iconName: 'style' },
      { label: 'Fit', value: selectedFit, iconName: 'fit_screen' },
      { label: 'Colors', value: selectedColors, iconName: 'palette' },
      { label: 'Occasion', value: selectedOccasion, iconName: 'event' }
    ];

    const measurementsData: Measurement[] = [
      { label: 'Height', value: `${height} cm`, iconName: 'height' },
      { label: 'Weight', value: `${weight} kg`, iconName: 'fitness_center' },
      { label: 'Chest', value: `${chest} cm`, iconName: 'checkroom' },
      { label: 'Waist', value: `${waist} cm`, iconName: 'straighten' },
      { label: 'Inseam', value: `${inseam} cm`, iconName: 'architecture' }
    ];

    onComplete(preferencesData, measurementsData);
  };

  return (
    <div className="min-h-[85vh] flex flex-col justify-center items-center px-4 py-8 relative">
      {/* Background aesthetics */}
      <div className="absolute top-[8%] right-[12%] w-40 h-40 rounded-full bg-indigo-500/10 blur-3xl"></div>
      <div className="absolute bottom-[10%] left-[8%] w-44 h-44 rounded-full bg-purple-500/10 blur-3xl"></div>

      <div className="w-full max-w-sm bg-white/95 backdrop-blur-3xl rounded-[32px] border border-indigo-100/65 shadow-2xl p-6 relative overflow-hidden flex flex-col" style={{ fontFamily: 'Poppins, sans-serif' }}>
        {/* Step Indicator Header */}
        <div className="flex justify-between items-center mb-6 px-1">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[20px] text-indigo-600 animate-pulse">sparkles</span>
            <span className="text-[10px] font-black tracking-widest text-indigo-600 uppercase">
              Profile Customization
            </span>
          </div>
          <span className="text-[10px] font-mono font-black text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-100/50">
            Step {step} of 2
          </span>
        </div>

        {/* Progress bar line representing cozy lavender to blue transition */}
        <div className="w-full h-1.5 bg-indigo-50/50 rounded-full mb-6 overflow-hidden">
          <motion.div 
            className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 rounded-full"
            animate={{ width: step === 1 ? '50%' : '100%' }}
            transition={{ duration: 0.35, ease: 'easeInOut' }}
          />
        </div>

        <AnimatePresence mode="wait">
          {step === 1 ? (
            /* ================== STEP 1: PREFERENCES ================== */
            <motion.div
              key="step-preferences"
              initial={{ opacity: 0, x: -15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 15 }}
              className="space-y-5 flex-grow"
            >
              <div className="text-left space-y-1">
                <h3 className="text-lg font-black text-slate-900 leading-tight">Define Your Style Signature</h3>
                <p className="text-xs text-slate-500 leading-normal">
                  Hey <span className="text-indigo-600 font-bold">{userName}</span>! Help NOVA customize style matchmaking coordinates just for you.
                </p>
              </div>

              {/* STYLE STYLE CHOICE */}
              <div className="space-y-3 text-left">
                <div className="flex items-end justify-between gap-3 flex-wrap">
                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">
                      1. Matchmaking Category Style
                    </span>
                    <p className="text-[11px] text-slate-500 ml-1 mt-1">
                      What’s your go-to style vibe?
                    </p>
                  </div>
                  <span className="text-[10px] font-semibold text-indigo-600 uppercase tracking-[0.2em] px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100">
                    Style-forward AI
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {styleOptions.map((opt) => (
                    <button
                      key={opt.name}
                      type="button"
                      onClick={() => setSelectedStyle(opt.name as StyleKey)}
                      className={`rounded-[24px] p-4 text-left transition-all duration-200 ease-in-out shadow-sm border ${
                        selectedStyle === opt.name
                          ? 'bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-600 text-white border-transparent shadow-indigo-500/20'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-200/30'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className={`flex h-9 w-9 items-center justify-center rounded-2xl ${selectedStyle === opt.name ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-600'}`}>
                          <span className="material-symbols-outlined text-lg">{opt.icon}</span>
                        </div>
                        {selectedStyle === opt.name ? (
                          <span className="rounded-full bg-white/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em]">
                            Selected
                          </span>
                        ) : null}
                      </div>
                      <div className="font-black text-sm leading-tight mb-2">{opt.name}</div>
                      <div className="text-[10px] leading-snug text-slate-400">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={selectedStyle}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -14 }}
                  transition={{ duration: 0.35, ease: 'easeInOut' }}
                  className="rounded-[30px] border border-violet-100/70 bg-gradient-to-r from-white/90 to-violet-50/80 backdrop-blur-xl p-4 shadow-2xl shadow-violet-200/30"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-3xl bg-violet-600/10 text-violet-700 shadow-lg shadow-violet-200/40">
                        <span className="material-symbols-outlined text-xl">auto_awesome</span>
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.35em] text-violet-500">AI Stylist</p>
                        <p className="text-sm font-semibold text-slate-800 leading-snug">
                          {recommendation.suggestionText}
                        </p>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-snug max-w-xl">
                      {recommendation.colorText}
                    </p>
                  </div>
                </motion.div>
              </AnimatePresence>

              {/* FIT PREFERENCE CHOICE */}
              <div className="space-y-2 text-left">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">
                  2. Desired Fit Profile
                </label>
                <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                  {fitOptions.map((opt) => {
                    const discouraged = isDiscouragedFit(opt.name);
                    const recommended = isRecommendedFit(opt.name);
                    const alternative = isAlternativeFit(opt.name);

                    return (
                      <button
                        key={opt.name}
                        type="button"
                        onClick={() => handleFitClick(opt.name)}
                        className={`h-full rounded-[28px] border p-5 text-left transition-all duration-200 ease-in-out ${
                          discouraged
                            ? 'bg-slate-100 border-slate-200 text-slate-400 opacity-80 cursor-not-allowed'
                            : selectedFit === opt.name
                              ? 'bg-indigo-50 border-indigo-500 text-indigo-900 shadow-sm shadow-indigo-200/30'
                              : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-200 hover:shadow-md hover:shadow-indigo-100/40'
                        }`}
                        aria-disabled={discouraged}
                      >
                        <div className="flex h-full flex-col justify-between gap-4">
                          <div className="space-y-3">
                            <div className="flex items-center gap-3">
                              <span className={`material-symbols-outlined text-lg ${selectedFit === opt.name ? 'text-indigo-600' : discouraged ? 'text-slate-400' : 'text-slate-500'}`}>
                                {discouraged ? 'lock' : opt.icon}
                              </span>
                              <div>
                                <p className="text-sm font-black leading-none">{opt.name}</p>
                                <p className="text-[10px] text-slate-500 leading-tight">{opt.desc}</p>
                              </div>
                            </div>
                          </div>
                          <div className="flex justify-between items-end">
                            {recommended ? (
                              <span className="text-[9px] rounded-full bg-indigo-600 text-white px-2 py-1 font-semibold">
                                Recommended
                              </span>
                            ) : alternative ? (
                              <span className="text-[9px] rounded-full bg-slate-100 text-slate-600 px-2 py-1 font-semibold">
                                Alternative
                              </span>
                            ) : discouraged ? (
                              <span className="text-[9px] rounded-full bg-slate-200 text-slate-500 px-2 py-1 font-semibold">
                                Discouraged
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <AnimatePresence>
                  {disabledHint ? (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      className="rounded-2xl border border-rose-100 bg-rose-50/80 p-3 text-[11px] text-rose-600"
                    >
                      {disabledHint}
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>

              {/* COLORS PALETTE PREFERENCE */}
              <div className="space-y-2 text-left">
                <div className="flex items-end justify-between gap-3 flex-wrap">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">
                      3. Color Sentiment Preference
                    </label>
                    <p className="text-[11px] text-slate-500 ml-1 mt-1">
                      Which colors best match your vibe?
                    </p>
                  </div>
                  <span className="text-[10px] px-3 py-1 rounded-full bg-slate-100 text-slate-600 uppercase tracking-[0.18em] font-semibold">
                    Mood-led palette
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {colorOptions.map((opt) => {
                    const recommendedColor = isRecommendedColor(opt.value);
                    const alternativeColor = isAlternativeColor(opt.value);

                    const swatches = opt.value === 'Neutrals'
                      ? ['#C8A27E', '#8B6B44', '#D8C8B2', '#9CA081']
                      : opt.value === 'Brights'
                        ? ['#F04438', '#2563EB', '#F97316', '#A855F7']
                        : opt.value === 'Mix'
                          ? ['#A78BFA', '#34D399', '#FDE68A', '#F472B6']
                          : ['#111827', '#6B7280', '#E5E7EB', '#F8FAFC'];

                    return (
                      <button
                        key={opt.name}
                        type="button"
                        onClick={() => setSelectedColors(opt.value as ColorOptionValue)}
                        className={`rounded-[30px] p-4 text-left border transition-all duration-200 ease-in-out focus:outline-none ${
                          selectedColors === opt.value
                            ? 'bg-indigo-50 border-indigo-300 shadow-lg shadow-indigo-200/40'
                            : 'bg-white border-slate-200 hover:border-indigo-200 hover:shadow-sm'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <span className="text-sm font-black uppercase tracking-[0.18em] text-slate-700">{opt.name}</span>
                          {recommendedColor ? (
                            <span className="text-[9px] px-2 py-1 rounded-full bg-indigo-600 text-white font-semibold">
                              Recommended
                            </span>
                          ) : alternativeColor ? (
                            <span className="text-[9px] px-2 py-1 rounded-full bg-slate-100 text-slate-600 font-semibold">
                              Alternative
                            </span>
                          ) : null}
                        </div>
                        <div className="mb-4 grid grid-cols-4 gap-2">
                          {swatches.map((color) => (
                            <span key={color} className="h-7 w-7 rounded-full border border-slate-200 shadow-sm" style={{ backgroundColor: color }} />
                          ))}
                        </div>
                        <p className="text-[10px] text-slate-500 leading-snug">{opt.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* CTA CONTINUE BUTTON */}
              <div className="pt-4 text-left">
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all outline-none cursor-pointer active:scale-95"
                >
                  Configure Body Measurements <span className="material-symbols-outlined text-base">arrow_forward</span>
                </button>
              </div>
            </motion.div>
          ) : (
            /* ================== STEP 2: BODY MEASUREMENTS ================== */
            <motion.div
              key="step-measurements"
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -15 }}
              className="space-y-6 flex-grow text-left"
            >
              <div className="space-y-1">
                <h3 className="text-lg font-black text-slate-900 leading-tight">Accurate Smart Fit Metrics</h3>
                <p className="text-xs text-slate-500 leading-normal">
                  Enter your physical traits so NOVA's Next-Gen vision model can map clothes and recommend correct sizes dynamically.
                </p>
              </div>

              {/* Interactive Sizing Sliders & Controls */}
              <div className="space-y-4">
                
                {/* HEIGHT CONTROL */}
                <div className="space-y-1 bg-slate-50 border border-slate-100 p-3 rounded-2xl relative">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                      <span className="material-symbols-outlined text-indigo-500 text-base">height</span> Height
                    </span>
                    <span className="text-slate-800 font-mono font-black text-xs bg-white px-2 py-0.5 rounded-md border border-slate-200">
                      {height} cm
                    </span>
                  </div>
                  <div className="flex items-center gap-3.5 mt-2">
                    <span className="text-[9px] font-extrabold text-slate-400 font-mono">140</span>
                    <input
                      type="range"
                      min={140}
                      max={210}
                      value={height}
                      onChange={(e) => setHeight(Number(e.target.value))}
                      className="flex-1 accent-indigo-600 h-1 bg-slate-200 rounded-lg cursor-pointer"
                    />
                    <span className="text-[9px] font-extrabold text-slate-400 font-mono">210</span>
                  </div>
                </div>

                {/* WEIGHT CONTROL */}
                <div className="space-y-1 bg-slate-50 border border-slate-100 p-3 rounded-2xl relative">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                      <span className="material-symbols-outlined text-indigo-500 text-base">fitness_center</span> Weight
                    </span>
                    <span className="text-slate-800 font-mono font-black text-xs bg-white px-2 py-0.5 rounded-md border border-slate-200">
                      {weight} kg
                    </span>
                  </div>
                  <div className="flex items-center gap-3.5 mt-2">
                    <span className="text-[9px] font-extrabold text-slate-400 font-mono">40</span>
                    <input
                      type="range"
                      min={40}
                      max={150}
                      value={weight}
                      onChange={(e) => setWeight(Number(e.target.value))}
                      className="flex-1 accent-indigo-600 h-1 bg-slate-200 rounded-lg cursor-pointer"
                    />
                    <span className="text-[9px] font-extrabold text-slate-400 font-mono">150</span>
                  </div>
                </div>

                {/* Chest / Waist / Inseam Interactive grid */}
                <div className="grid grid-cols-3 gap-2">
                  
                  {/* CHEST */}
                  <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-xl text-center space-y-1">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Chest (cm)</span>
                    <span className="text-xs font-black text-slate-800 block font-mono">{chest}</span>
                    <div className="flex items-center justify-center gap-1 pt-1.5 h-7">
                      <button 
                        type="button" 
                        onClick={() => setChest(prev => Math.max(70, prev - 1))}
                        className="w-5.5 h-5.5 bg-white border border-slate-200 text-slate-600 rounded-md flex items-center justify-center text-[10px] font-black select-none cursor-pointer hover:bg-slate-50 text-center leading-none"
                      >-</button>
                      <button 
                        type="button" 
                        onClick={() => setChest(prev => Math.min(130, prev + 1))}
                        className="w-5.5 h-5.5 bg-white border border-slate-200 text-slate-600 rounded-md flex items-center justify-center text-[10px] font-black select-none cursor-pointer hover:bg-slate-50 text-center leading-none"
                      >+</button>
                    </div>
                  </div>

                  {/* WAIST */}
                  <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-xl text-center space-y-1">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Waist (cm)</span>
                    <span className="text-xs font-black text-slate-800 block font-mono">{waist}</span>
                    <div className="flex items-center justify-center gap-1 pt-1.5 h-7">
                      <button 
                        type="button" 
                        onClick={() => setWaist(prev => Math.max(60, prev - 1))}
                        className="w-5.5 h-5.5 bg-white border border-slate-200 text-slate-600 rounded-md flex items-center justify-center text-[10px] font-black select-none cursor-pointer hover:bg-slate-50 text-center leading-none"
                      >-</button>
                      <button 
                        type="button" 
                        onClick={() => setWaist(prev => Math.min(120, prev + 1))}
                        className="w-5.5 h-5.5 bg-white border border-slate-200 text-slate-600 rounded-md flex items-center justify-center text-[10px] font-black select-none cursor-pointer hover:bg-slate-50 text-center leading-none"
                      >+</button>
                    </div>
                  </div>

                  {/* INSEAM */}
                  <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-xl text-center space-y-1">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Inseam (cm)</span>
                    <span className="text-xs font-black text-slate-800 block font-mono">{inseam}</span>
                    <div className="flex items-center justify-center gap-1 pt-1.5 h-7">
                      <button 
                        type="button" 
                        onClick={() => setInseam(prev => Math.max(60, prev - 1))}
                        className="w-5.5 h-5.5 bg-white border border-slate-200 text-slate-600 rounded-md flex items-center justify-center text-[10px] font-black select-none cursor-pointer hover:bg-slate-50 text-center leading-none"
                      >-</button>
                      <button 
                        type="button" 
                        onClick={() => setInseam(prev => Math.min(110, prev + 1))}
                        className="w-5.5 h-5.5 bg-white border border-slate-200 text-slate-600 rounded-md flex items-center justify-center text-[10px] font-black select-none cursor-pointer hover:bg-slate-50 text-center leading-none"
                      >+</button>
                    </div>
                  </div>

                </div>

              </div>

              {/* ACTION BACK OR FINISH BUTTONS */}
              <div className="flex gap-2.5 pt-4">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-grow py-3 px-3 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-all cursor-pointer text-center"
                >
                  Back
                </button>
                 <button
                  type="button"
                  onClick={handleFinish}
                  className="flex-[2] py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-1.5 transition-all outline-none cursor-pointer active:scale-95"
                >
                  <span className="material-symbols-outlined text-base">verified</span> Save & Enter NOVA
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
};
