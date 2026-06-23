import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, BriefcaseBusiness, Check, Info, Lock, ShieldCheck, Shirt, Sparkles, Waves } from 'lucide-react';
import { Measurement, Preference } from '../types';

interface SetupPreferencesViewProps {
  userName: string;
  onComplete: (preferences: Preference[], measurements: Measurement[]) => void;
}

type IconName = 'briefcase' | 'shoe' | 'minimal' | 'shirt' | 'backpack' | 'compress' | 'target' | 'waves' | 'sofa';

const iconClass = 'h-8 w-8 stroke-[1.9]';

const OptionIcon = ({ name, selected, muted = false }: { name: IconName; selected?: boolean; muted?: boolean }) => {
  const className = `${iconClass} ${selected ? 'text-white' : muted ? 'text-slate-300' : 'text-slate-700'}`;

  if (name === 'briefcase') return <BriefcaseBusiness className={className} />;
  if (name === 'shoe') return <span className={`material-symbols-outlined text-[36px] leading-none ${selected ? 'text-white' : 'text-slate-700'}`}>footprint</span>;
  if (name === 'minimal') return <span className={`material-symbols-outlined text-[38px] leading-none ${selected ? 'text-white' : 'text-slate-700'}`}>contrast</span>;
  if (name === 'shirt') return <Shirt className={className} />;
  if (name === 'backpack') return <span className={`material-symbols-outlined text-[38px] leading-none ${selected ? 'text-white' : 'text-slate-700'}`}>backpack</span>;
  if (name === 'compress') return <span className={`material-symbols-outlined text-[38px] leading-none ${muted ? 'text-slate-300' : 'text-slate-700'}`}>compress</span>;
  if (name === 'target') return <span className={`material-symbols-outlined text-[38px] leading-none ${selected ? 'text-indigo-600' : 'text-slate-700'}`}>select_check_box</span>;
  if (name === 'waves') return <Waves className={className} />;
  return <span className={`material-symbols-outlined text-[38px] leading-none ${selected ? 'text-indigo-600' : 'text-slate-700'}`}>weekend</span>;
};

const styleOptions = [
  { name: 'Formal', icon: 'briefcase' as IconName, desc: 'Sharp. Polished. Professional.' },
  { name: 'Streetwear', icon: 'shoe' as IconName, desc: 'Trendy. Urban. Expressive.' },
  { name: 'Minimalist', icon: 'minimal' as IconName, desc: 'Clean. Simple. Timeless.' },
  { name: 'Casual', icon: 'shirt' as IconName, desc: 'Easygoing. Everyday. Relaxed.' },
  { name: 'Gorpcore', icon: 'backpack' as IconName, desc: 'Functional. Outdoor. Utility.' },
];

const fitOptions = [
  { name: 'Slim Fit', icon: 'compress' as IconName, desc: 'Tailored look with sharp contours' },
  { name: 'Regular', icon: 'target' as IconName, desc: 'Classic fit for comfort and structure', recommended: true },
  { name: 'Oversized', icon: 'waves' as IconName, desc: 'Relaxed fit with room to move', locked: true },
  { name: 'Relaxed', icon: 'sofa' as IconName, desc: 'Laid-back fit with all-day ease' },
];

const colorOptions = [
  { name: 'Neutral & Earthy', value: 'Neutrals', desc: 'Beige, Browns, Cream, Sage', swatches: ['#d4a373', '#b87935', '#7b7650', '#f3eadc'] },
  { name: 'Vibrant & Bold', value: 'Brights', desc: 'Reds, Cobalts, Oranges', swatches: ['#fb2828', '#2563eb', '#ff8616', '#8b5cf6'] },
  { name: 'Mixed Palette', value: 'Mix', desc: 'Balanced blend of all color moods', swatches: ['#a78bfa', '#72d5c7', '#f6d978', '#f2b88f'] },
  { name: 'Monochrome Slate', value: 'Monochrome', desc: 'Deep black, crisp white & greys', swatches: ['#171717', '#4b5563', '#9ca3af', '#d1d5db'] },
];

export const SetupPreferencesView: React.FC<SetupPreferencesViewProps> = ({ userName, onComplete }) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedStyle, setSelectedStyle] = useState('Formal');
  const [selectedFit, setSelectedFit] = useState('Regular');
  const [selectedColors, setSelectedColors] = useState('Mix');
  const [selectedOccasion] = useState('Casual');
  const [height, setHeight] = useState(178);
  const [weight, setWeight] = useState(68);
  const [chest, setChest] = useState(98);
  const [waist, setWaist] = useState(82);
  const [inseam, setInseam] = useState(78);

  const displayName = userName?.trim() || 'hardikpandya';

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
    <div className="min-h-screen bg-[#f5f3ff] px-3 py-3 text-slate-900">
      <div className="mx-auto flex min-h-[calc(100vh-24px)] w-full max-w-[860px] flex-col overflow-hidden rounded-[22px] border border-white bg-white px-5 py-5 shadow-[0_24px_70px_rgba(74,58,130,0.14)] sm:px-8 sm:py-8">
        <header className="mb-7">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Sparkles className="h-10 w-10 fill-violet-500 text-violet-500" />
              <span className="text-[34px] font-black leading-none tracking-[0.03em] text-violet-600 sm:text-[42px]">NOVA</span>
            </div>
            <h1 className="hidden text-lg font-extrabold text-slate-950 sm:block">Profile Customization</h1>
            <span className="shrink-0 rounded-2xl border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-extrabold text-violet-700 shadow-sm">
              Step {step} of 2
            </span>
          </div>
          <h1 className="mt-5 text-center text-base font-extrabold text-slate-950 sm:hidden">Profile Customization</h1>
          <div className="mt-8 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-500 shadow-[0_2px_10px_rgba(124,58,237,0.45)]"
              animate={{ width: step === 1 ? '42%' : '100%' }}
              transition={{ duration: 0.35, ease: 'easeInOut' }}
            />
          </div>
        </header>

        <AnimatePresence mode="wait">
          {step === 1 ? (
            <motion.div
              key="preferences"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              className="flex flex-1 flex-col"
            >
              <section className="mb-7">
                <h2 className="text-[27px] font-black leading-tight tracking-[-0.01em] text-slate-950 sm:text-[34px]">
                  Let's Define Your Style Signature <span aria-hidden="true">👋</span>
                </h2>
                <p className="mt-3 max-w-[520px] text-[17px] font-medium leading-8 text-slate-500 sm:text-[20px]">
                  Hey <span className="font-black text-indigo-600">{displayName}</span>! Help NOVA customize style matchmaking coordinates just for you.
                </p>
              </section>

              <section className="space-y-4">
                <SectionTitle number="1" title="Matchmaking Category Style" subtitle="What's your go-to style vibe?" />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-6">
                  {styleOptions.map((option, index) => {
                    const selected = selectedStyle === option.name;
                    return (
                      <button
                        key={option.name}
                        type="button"
                        onClick={() => setSelectedStyle(option.name)}
                        className={`relative flex min-h-[118px] items-center gap-5 rounded-[16px] border p-5 text-left transition-all sm:col-span-2 ${index > 2 ? 'sm:col-span-3' : ''} ${
                          selected
                            ? 'border-transparent bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 text-white shadow-[0_16px_30px_rgba(99,65,238,0.24)]'
                            : 'border-slate-200 bg-white text-slate-950 shadow-sm hover:border-violet-200 hover:shadow-md'
                        }`}
                      >
                        <OptionIcon name={option.icon} selected={selected} />
                        <span className="min-w-0">
                          <span className={`block text-lg font-black ${selected ? 'text-white' : 'text-slate-950'}`}>{option.name}</span>
                          <span className={`mt-2 block text-[13px] font-semibold leading-5 ${selected ? 'text-violet-100' : 'text-slate-500'}`}>{option.desc}</span>
                        </span>
                        {selected && (
                          <span className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full bg-white text-violet-600">
                            <Check className="h-5 w-5 stroke-[3]" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <Notice>
                  <Sparkles className="h-5 w-5 shrink-0 text-violet-600" />
                  <span><b>Suggestion for you:</b> Based on {selectedStyle}, we recommend a <b>Regular</b> fit for the best look.</span>
                </Notice>
              </section>

              <section className="mt-10 space-y-4">
                <SectionTitle number="2" title="Desired Fit Profile" subtitle="How would you like your clothes to fit?" info />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {fitOptions.slice(0, 3).map((option) => (
                    <FitCard
                      key={option.name}
                      option={option}
                      selected={selectedFit === option.name}
                      onClick={() => !option.locked && setSelectedFit(option.name)}
                    />
                  ))}
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Notice className="min-h-[108px]">
                    <ShieldCheck className="h-8 w-8 shrink-0 text-violet-400" />
                    <span><b>Oversized isn't ideal for {selectedStyle} styles. Regular fit</b> gives you the best balance of comfort and a polished look.</span>
                  </Notice>
                  <FitCard
                    option={fitOptions[3]}
                    selected={selectedFit === 'Relaxed'}
                    onClick={() => setSelectedFit('Relaxed')}
                  />
                </div>
              </section>

              <section className="mt-10 space-y-4">
                <SectionTitle number="3" title="Color Sentiment Preference" subtitle="Which colors best match your vibe?" />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {colorOptions.map((option) => {
                    const selected = selectedColors === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setSelectedColors(option.value)}
                        className={`relative flex min-h-[88px] items-center justify-between gap-4 rounded-[14px] border p-5 text-left transition-all ${
                          selected
                            ? 'border-violet-600 bg-violet-50/40 shadow-[0_10px_24px_rgba(109,40,217,0.10)]'
                            : 'border-slate-200 bg-white shadow-sm hover:border-violet-200'
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="mb-3 flex items-center gap-2">
                            {option.swatches.map((color) => (
                              <span key={color} className="h-6 w-6 rounded-full border border-white shadow-sm" style={{ backgroundColor: color }} />
                            ))}
                          </span>
                          <span className="block text-sm font-black text-slate-950">{option.name}</span>
                          <span className="mt-2 block text-[13px] font-semibold text-slate-500">{option.desc}</span>
                        </span>
                        {selected && (
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-violet-600 text-white">
                            <Check className="h-5 w-5 stroke-[3]" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>

              <footer className="mt-7">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="flex h-14 w-full items-center justify-center gap-4 rounded-[12px] bg-gradient-to-r from-indigo-600 to-violet-700 text-base font-black text-white shadow-[0_18px_30px_rgba(99,65,238,0.24)] transition-transform active:scale-[0.99]"
                >
                  Continue to Body Measurements
                  <ArrowRight className="h-7 w-7" />
                </button>
                <p className="mt-5 flex items-center justify-center gap-2 text-center text-xs font-semibold text-slate-400">
                  <ShieldCheck className="h-5 w-5" />
                  Your data is private and secure. Only used to personalize your experience.
                </p>
              </footer>
            </motion.div>
          ) : (
            <motion.div
              key="measurements"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              className="flex flex-1 flex-col"
            >
              <section className="mb-8">
                <h2 className="text-[28px] font-black leading-tight text-slate-950 sm:text-[34px]">Set Your Smart Fit Metrics</h2>
                <p className="mt-3 max-w-[560px] text-[17px] font-medium leading-8 text-slate-500">
                  Add your measurements so NOVA can tune size and drape recommendations with better precision.
                </p>
              </section>

              <div className="grid gap-4">
                <RangeControl label="Height" icon="height" value={height} min={140} max={210} unit="cm" onChange={setHeight} />
                <RangeControl label="Weight" icon="fitness_center" value={weight} min={40} max={150} unit="kg" onChange={setWeight} />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <Stepper label="Chest" value={chest} min={70} max={130} unit="cm" onChange={setChest} />
                  <Stepper label="Waist" value={waist} min={60} max={120} unit="cm" onChange={setWaist} />
                  <Stepper label="Inseam" value={inseam} min={60} max={110} unit="cm" onChange={setInseam} />
                </div>
              </div>

              <footer className="mt-auto pt-8">
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="h-14 flex-1 rounded-[12px] border border-slate-200 bg-white text-sm font-black text-slate-600 shadow-sm"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleFinish}
                    className="flex h-14 flex-[2] items-center justify-center gap-3 rounded-[12px] bg-gradient-to-r from-indigo-600 to-violet-700 text-sm font-black text-white shadow-[0_18px_30px_rgba(99,65,238,0.24)]"
                  >
                    Save & Enter NOVA
                    <ArrowRight className="h-6 w-6" />
                  </button>
                </div>
                <p className="mt-5 flex items-center justify-center gap-2 text-center text-xs font-semibold text-slate-400">
                  <ShieldCheck className="h-5 w-5" />
                  Your data is private and secure. Only used to personalize your experience.
                </p>
              </footer>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

const SectionTitle = ({ number, title, subtitle, info }: { number: string; title: string; subtitle: string; info?: boolean }) => (
  <div className="flex items-start gap-4">
    <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-700 text-sm font-black text-white shadow-[0_8px_16px_rgba(99,65,238,0.24)]">
      {number}
    </span>
    <span>
      <span className="block text-base font-black uppercase tracking-[0.02em] text-slate-950">{title}</span>
      <span className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-500">
        {subtitle}
        {info && <Info className="h-4 w-4" />}
      </span>
    </span>
  </div>
);

const Notice = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`flex items-center gap-4 rounded-[14px] border border-violet-100 bg-violet-50/70 px-5 py-4 text-sm font-semibold leading-6 text-slate-500 ${className}`}>
    {children}
  </div>
);

const FitCard = ({
  option,
  selected,
  onClick,
}: {
  option: { name: string; icon: IconName; desc: string; recommended?: boolean; locked?: boolean };
  selected: boolean;
  onClick: () => void;
}) => {
  const muted = option.locked;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={option.locked}
      className={`relative flex min-h-[136px] items-center gap-5 rounded-[14px] border p-5 text-left transition-all ${
        selected
          ? 'border-violet-600 bg-white shadow-[0_10px_24px_rgba(109,40,217,0.12)]'
          : muted
            ? 'border-slate-200 bg-white opacity-60'
            : 'border-slate-200 bg-white shadow-sm hover:border-violet-200'
      }`}
    >
      <OptionIcon name={option.icon} selected={selected} muted={muted} />
      <span className="min-w-0">
        {option.recommended && <span className="mb-1 inline-flex rounded-full border border-violet-200 px-2 py-0.5 text-[10px] font-black text-violet-600">Recommended</span>}
        <span className={`block text-lg font-black ${muted ? 'text-slate-400' : selected ? 'text-violet-700' : 'text-slate-950'}`}>{option.name}</span>
        <span className={`mt-2 block text-sm font-semibold leading-6 ${muted ? 'text-slate-400' : 'text-slate-500'}`}>{option.desc}</span>
      </span>
      {selected && (
        <span className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full bg-violet-600 text-white">
          <Check className="h-5 w-5 stroke-[3]" />
        </span>
      )}
      {option.locked && (
        <span className="absolute right-5 top-5 text-slate-500">
          <Lock className="h-5 w-5" />
        </span>
      )}
    </button>
  );
};

const RangeControl = ({
  label,
  icon,
  value,
  min,
  max,
  unit,
  onChange,
}: {
  label: string;
  icon: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  onChange: (value: number) => void;
}) => (
  <div className="rounded-[16px] border border-slate-200 bg-white p-5 shadow-sm">
    <div className="mb-4 flex items-center justify-between">
      <span className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.06em] text-slate-500">
        <span className="material-symbols-outlined text-violet-600">{icon}</span>
        {label}
      </span>
      <span className="rounded-full bg-violet-50 px-4 py-2 text-sm font-black text-violet-700">{value} {unit}</span>
    </div>
    <div className="flex items-center gap-4">
      <span className="text-xs font-black text-slate-400">{min}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-2 flex-1 accent-violet-600"
      />
      <span className="text-xs font-black text-slate-400">{max}</span>
    </div>
  </div>
);

const Stepper = ({
  label,
  value,
  min,
  max,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  onChange: (value: number) => void;
}) => (
  <div className="rounded-[16px] border border-slate-200 bg-white p-5 text-center shadow-sm">
    <span className="block text-xs font-black uppercase tracking-[0.08em] text-slate-400">{label}</span>
    <span className="mt-2 block text-2xl font-black text-slate-950">{value} <span className="text-sm text-slate-400">{unit}</span></span>
    <div className="mt-4 flex justify-center gap-3">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-slate-50 text-lg font-black text-slate-600"
      >
        -
      </button>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        className="grid h-10 w-10 place-items-center rounded-full bg-violet-600 text-lg font-black text-white"
      >
        +
      </button>
    </div>
  </div>
);
