import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, Camera, Images, RefreshCw, Sparkles, Upload, WandSparkles } from 'lucide-react';
import { NovaAnalysisProfile, NovaStyleAnalysisResult } from '../types';
import { analyzeSelfie } from '../services/analysisService';

interface ProfileAnalysisViewProps {
  userName: string;
  userId: string;
  onComplete: (profile: NovaAnalysisProfile) => void;
}

type AnalysisStep = 'upload' | 'scanning' | 'results';

const scanItems = [
  'Detecting Skin Tone',
  'Detecting Face Shape',
  'Detecting Hair Type',
  'Detecting Eye Color',
  'Detecting Body Structure',
  'Detecting Fashion Preferences',
  'Generating Personalized Recommendations'
];

const fallbackSelfie =
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=900&q=80';

const titleCase = (value: string) => {
  if (!value || value === 'unknown') return 'Unknown';
  return value
    .split(/[\s-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const buildAnalysisProfile = (selfieUrl?: string, result?: NovaStyleAnalysisResult): NovaAnalysisProfile => {
  const analysis = result?.analysis;
  const skinTone = analysis?.skinTone.value || 'unknown';
  const faceShape = analysis?.faceShape.value || 'unknown';
  const hairType = analysis?.hairType.value || 'unknown';
  const hairColor = analysis?.hairColor.value || 'unknown';
  const outfitStyle = analysis?.outfitStyle.value || 'unknown';

  return {
    skinTone: skinTone === 'unknown' ? 'Unknown Skin Tone' : `${titleCase(skinTone)} Skin Tone`,
    undertone: 'unknown',
    faceShape: faceShape === 'unknown' ? 'Unknown Face Shape' : `${titleCase(faceShape)} Face Shape`,
    hairType: hairType === 'unknown' ? 'Unknown Hair Type' : `${titleCase(hairType)} Hair`,
    eyeColor: 'unknown',
    bodyType: 'unknown',
    heightEstimate: 'unknown',
    recommendedFit: result?.recommendedFit || 'unknown',
    recommendedColors: result?.recommendedColors || [],
    eyewearSuggestions: result?.eyewearSuggestions || [],
    stylePreference: outfitStyle === 'unknown' ? 'Unknown Style Preference' : `${titleCase(outfitStyle)} Style Preference`,
    confidence: {
      skinToneDetection: analysis?.skinTone.confidence || 0,
      faceShapeDetection: analysis?.faceShape.confidence || 0,
      stylePreferenceDetection: analysis?.outfitStyle.confidence || 0,
      bodyAnalysis: 0
    },
    selfieUrl,
    imageHash: result?.imageHash,
    rawAnalysis: result,
    cached: result?.cached,
    analyzedAt: result?.analyzedAt || new Date().toISOString()
  };
};

const fileToCompressedDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const maxSize = 720;
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');

        if (!context) {
          reject(new Error('Could not process selfie image.'));
          return;
        }

        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      image.onerror = () => reject(new Error('Could not load selfie image.'));
      image.src = String(reader.result || '');
    };

    reader.onerror = () => reject(new Error('Could not read selfie image.'));
    reader.readAsDataURL(file);
  });
};

const recommendationCards = [
  {
    title: 'Fashion',
    icon: 'checkroom',
    text: 'Regular fit shirts will complement your frame.'
  },
  {
    title: 'Colors',
    icon: 'palette',
    text: 'Olive green, navy blue and beige suit your skin tone.'
  },
  {
    title: 'Eyewear',
    icon: 'visibility',
    text: 'Rectangular frames will balance your face shape.'
  },
  {
    title: 'AR Try-On',
    icon: 'view_in_ar',
    text: 'Recommended products ready for virtual try-on.'
  }
];

export const ProfileAnalysisView: React.FC<ProfileAnalysisViewProps> = ({ userName, userId, onComplete }) => {
  const [step, setStep] = useState<AnalysisStep>('upload');
  const [imagePreview, setImagePreview] = useState<string>('');
  const [progress, setProgress] = useState(0);
  const [profile, setProfile] = useState<NovaAnalysisProfile | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const displayName = userName?.trim() || 'NOVA member';

  const particles = useMemo(
    () =>
      Array.from({ length: 30 }, (_, index) => ({
        id: index,
        left: `${8 + ((index * 19) % 84)}%`,
        top: `${6 + ((index * 31) % 88)}%`,
        size: 3 + (index % 5),
        delay: (index % 9) * 0.24,
        duration: 3.2 + (index % 7) * 0.35
      })),
    []
  );

  useEffect(() => {
    if (step !== 'scanning') return;

    setProgress(0);
    const progressTimer = window.setInterval(() => {
      setProgress((current) => Math.min(92, current + 4));
    }, 190);

    let cancelled = false;

    const runAnalysis = async () => {
      const result = await analyzeSelfie({
        imageDataUrl: imagePreview || fallbackSelfie,
        userId,
        forceRefresh: true
      });
      if (cancelled) return;
      const analysis = buildAnalysisProfile(imagePreview || fallbackSelfie, result);
      setProfile(analysis);
      setProgress(100);
      setStep('results');
      window.clearInterval(progressTimer);
    };

    runAnalysis();

    return () => {
      cancelled = true;
      window.clearInterval(progressTimer);
    };
  }, [imagePreview, step, userId]);

  const activeScanIndex = Math.min(scanItems.length - 1, Math.floor((progress / 100) * scanItems.length));

  const handleFile = async (file?: File) => {
    if (!file) return;
    try {
      const previewUrl = await fileToCompressedDataUrl(file);
      setImagePreview(previewUrl);
      setStep('scanning');
    } catch {
      const fallbackPreview = URL.createObjectURL(file);
      setImagePreview(fallbackPreview);
      setStep('scanning');
    }
  };

  const handleRetake = () => {
    setStep('upload');
    setProgress(0);
    setProfile(null);
    setImagePreview('');
  };

  const resultProfile = profile || buildAnalysisProfile(imagePreview || fallbackSelfie);
  const analysisError = resultProfile.rawAnalysis?.error;
  const floatingTags = [
    resultProfile.skinTone,
    resultProfile.faceShape,
    resultProfile.eyeColor,
    resultProfile.hairType,
    resultProfile.stylePreference,
    resultProfile.recommendedColors.length > 0 ? `Recommended Colors: ${resultProfile.recommendedColors.join(' . ')}` : 'Recommended Colors: unknown',
    resultProfile.bodyType,
    `Recommended Fit: ${resultProfile.recommendedFit}`,
    `Hair Color: ${titleCase(resultProfile.rawAnalysis?.analysis.hairColor.value || 'unknown')}`,
    resultProfile.eyewearSuggestions.length > 0 ? `Recommended Eyewear: ${resultProfile.eyewearSuggestions.join(' . ')}` : 'Recommended Eyewear: unknown'
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_18%_14%,rgba(196,181,253,0.45),transparent_28%),radial-gradient(circle_at_84%_20%,rgba(216,180,254,0.32),transparent_30%),linear-gradient(180deg,#ffffff_0%,#f8f5ff_48%,#efe9ff_100%)] px-4 py-5 text-slate-950 [font-family:Poppins,ui-sans-serif,system-ui,sans-serif]">
      <NeuralField particles={particles} />

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-40px)] w-full max-w-[880px] flex-col">
        <header className="mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-[14px] bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-500 text-lg font-black text-white shadow-[0_14px_34px_rgba(124,58,237,0.28)]">
              N
            </div>
            <div>
              <p className="text-lg font-black leading-none tracking-[0.08em] text-violet-700">NOVA</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">Optical Vision Assistant</p>
            </div>
          </div>
          <div className="rounded-full border border-white/70 bg-white/55 px-4 py-2 text-xs font-bold text-violet-700 shadow-[0_12px_32px_rgba(109,40,217,0.12)] backdrop-blur-2xl">
            AI Profile Lab
          </div>
        </header>

        <AnimatePresence mode="wait">
          {step === 'upload' && (
            <motion.section
              key="upload"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -18 }}
              className="flex flex-1 flex-col items-center justify-center text-center"
            >
              <div className="mb-8 max-w-[560px]">
                <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-100 bg-white/55 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-violet-700 shadow-sm backdrop-blur-2xl">
                  <Sparkles className="h-4 w-4 fill-violet-500 text-violet-500" />
                  Personalized AI Analysis
                </p>
                <h1 className="text-[34px] font-black leading-tight text-slate-950 sm:text-[48px]">Upload a Selfie for AI Analysis</h1>
                <p className="mx-auto mt-4 max-w-[500px] text-base font-medium leading-7 text-slate-500">
                  {displayName}, let NOVA understand your features and personalize your experience.
                </p>
              </div>

              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className="group relative grid h-[232px] w-[232px] place-items-center rounded-full border border-white/75 bg-white/50 shadow-[0_30px_90px_rgba(124,58,237,0.22)] backdrop-blur-3xl transition-transform active:scale-[0.98] sm:h-[280px] sm:w-[280px]"
                aria-label="Upload selfie"
              >
                <span className="absolute inset-[-13px] rounded-full border border-violet-200/50 bg-[conic-gradient(from_120deg,rgba(124,58,237,0.0),rgba(167,139,250,0.85),rgba(236,72,153,0.36),rgba(124,58,237,0.0))] opacity-70 blur-[1px] transition-opacity group-hover:opacity-100" />
                <span className="absolute inset-4 rounded-full bg-white/80 shadow-inner" />
                <span className="relative grid h-28 w-28 place-items-center rounded-full bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-500 text-white shadow-[0_18px_42px_rgba(124,58,237,0.35)]">
                  <Upload className="h-12 w-12" />
                </span>
              </button>

              <div className="mt-9 grid w-full max-w-[440px] grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex h-14 items-center justify-center gap-2 rounded-[14px] border border-violet-100 bg-white/70 text-sm font-black text-slate-800 shadow-[0_12px_34px_rgba(109,40,217,0.11)] backdrop-blur-2xl"
                >
                  <Camera className="h-5 w-5 text-violet-600" />
                  Camera
                </button>
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="flex h-14 items-center justify-center gap-2 rounded-[14px] bg-gradient-to-r from-indigo-600 to-violet-700 text-sm font-black text-white shadow-[0_16px_36px_rgba(99,65,238,0.25)]"
                >
                  <Images className="h-5 w-5" />
                  Gallery
                </button>
              </div>

              <HiddenInputs cameraRef={cameraInputRef} galleryRef={galleryInputRef} onFile={handleFile} />
            </motion.section>
          )}

          {step === 'scanning' && (
            <motion.section
              key="scanning"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="flex flex-1 flex-col items-center justify-center text-center"
            >
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-violet-100 bg-white/70 px-5 py-3 text-sm font-black text-violet-700 shadow-[0_16px_42px_rgba(109,40,217,0.14)] backdrop-blur-2xl">
                <WandSparkles className="h-5 w-5 fill-violet-500 text-violet-600" />
                Analyzing Your Features
              </div>

              <div className="relative mb-8 h-[252px] w-[252px] sm:h-[300px] sm:w-[300px]">
                <motion.div
                  className="absolute inset-[-12px] rounded-full bg-[conic-gradient(from_0deg,rgba(99,102,241,0),rgba(124,58,237,0.95),rgba(236,72,153,0.55),rgba(99,102,241,0))]"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
                />
                <div className="absolute inset-0 overflow-hidden rounded-full border border-white/80 bg-white/65 p-3 shadow-[0_30px_70px_rgba(109,40,217,0.22)] backdrop-blur-3xl">
                  <img src={imagePreview || fallbackSelfie} alt="Selfie being analyzed" className="h-full w-full rounded-full object-cover" />
                  <motion.span
                    className="absolute left-7 right-7 h-[3px] rounded-full bg-white shadow-[0_0_26px_rgba(124,58,237,0.95)]"
                    animate={{ top: ['18%', '82%', '18%'] }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                  />
                </div>
              </div>

              <div className="w-full max-w-[560px] rounded-[18px] border border-white/75 bg-white/58 p-5 text-left shadow-[0_24px_70px_rgba(109,40,217,0.14)] backdrop-blur-3xl">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Estimated time: 5-10 seconds</span>
                  <span className="text-sm font-black text-violet-700">{progress}%</span>
                </div>
                <div className="mb-5 h-2 overflow-hidden rounded-full bg-violet-100">
                  <motion.div className="h-full rounded-full bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-500" animate={{ width: `${progress}%` }} />
                </div>
                <div className="grid gap-2">
                  {scanItems.map((item, index) => (
                    <div key={item} className={`flex items-center gap-3 rounded-[12px] px-3 py-2 text-sm font-bold transition-colors ${index <= activeScanIndex ? 'bg-violet-50 text-violet-800' : 'text-slate-400'}`}>
                      <span className={`grid h-6 w-6 place-items-center rounded-full ${index <= activeScanIndex ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-300'}`}>
                        {index < activeScanIndex ? '✓' : index === activeScanIndex ? '•' : ''}
                      </span>
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </motion.section>
          )}

          {step === 'results' && (
            <motion.section
              key="results"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -18 }}
              className="pb-6"
            >
              <div className="mb-7 text-center">
                <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-100 bg-white/62 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-violet-700 shadow-sm backdrop-blur-2xl">
                  <Sparkles className="h-4 w-4 fill-violet-500 text-violet-500" />
                  NOVA Analysis Complete
                </p>
                <h1 className="text-[30px] font-black leading-tight text-slate-950 sm:text-[44px]">Here is what NOVA got from your selfie</h1>
              </div>

              <div className="relative mx-auto mb-7 min-h-[410px] max-w-[720px]">
                <div className="absolute left-1/2 top-1/2 h-[250px] w-[250px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/80 bg-white/55 p-3 shadow-[0_30px_80px_rgba(109,40,217,0.2)] backdrop-blur-3xl sm:h-[290px] sm:w-[290px]">
                  <img src={resultProfile.selfieUrl || fallbackSelfie} alt="Analyzed profile" className="h-full w-full rounded-full object-cover" />
                </div>
                {floatingTags.map((tag, index) => (
                  <motion.div
                    key={tag}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.04 * index }}
                    className={`absolute rounded-full border border-white/70 bg-white/68 px-4 py-3 text-xs font-black text-violet-800 shadow-[0_14px_36px_rgba(109,40,217,0.15)] backdrop-blur-2xl ${tagPosition(index)}`}
                  >
                    <span className="mr-2 inline-block h-2 w-2 rounded-full bg-violet-600 shadow-[0_0_12px_rgba(124,58,237,0.8)]" />
                    {tag}
                  </motion.div>
                ))}
              </div>

              <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                <div className="rounded-[18px] border border-white/75 bg-white/62 p-5 shadow-[0_22px_60px_rgba(109,40,217,0.12)] backdrop-blur-3xl">
                  <h2 className="mb-4 text-lg font-black text-slate-950">AI Confidence Score</h2>
                  {analysisError && (
                    <div className="mb-4 rounded-[14px] border border-rose-100 bg-rose-50/80 p-3 text-xs font-bold leading-5 text-rose-700">
                      {analysisError}
                    </div>
                  )}
                  <ConfidenceRow label="Skin Tone Detection" value={resultProfile.confidence.skinToneDetection} />
                  <ConfidenceRow label="Face Shape Detection" value={resultProfile.confidence.faceShapeDetection} />
                  <ConfidenceRow label="Style Preference Detection" value={resultProfile.confidence.stylePreferenceDetection} />
                  <ConfidenceRow label="Body Analysis" value={resultProfile.confidence.bodyAnalysis} />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {recommendationCards.map((card) => (
                    <div key={card.title} className="rounded-[16px] border border-white/75 bg-white/60 p-4 shadow-[0_16px_44px_rgba(109,40,217,0.1)] backdrop-blur-3xl">
                      <span className="material-symbols-outlined mb-3 text-[28px] text-violet-600">{card.icon}</span>
                      <h3 className="text-sm font-black text-slate-950">{card.title}</h3>
                      <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">{card.text}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto]">
                <button
                  type="button"
                  onClick={() => onComplete(resultProfile)}
                  className="flex h-14 items-center justify-center gap-3 rounded-[14px] bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 text-sm font-black text-white shadow-[0_18px_42px_rgba(99,65,238,0.25)]"
                >
                  <Sparkles className="h-5 w-5" />
                  Continue to NOVA Profile
                  <ArrowRight className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={handleRetake}
                  className="flex h-14 items-center justify-center gap-2 rounded-[14px] border border-violet-100 bg-white/70 px-6 text-sm font-black text-violet-700 shadow-sm backdrop-blur-2xl"
                >
                  <RefreshCw className="h-5 w-5" />
                  Retake Analysis
                </button>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

const HiddenInputs = ({
  cameraRef,
  galleryRef,
  onFile
}: {
  cameraRef: React.RefObject<HTMLInputElement | null>;
  galleryRef: React.RefObject<HTMLInputElement | null>;
  onFile: (file?: File) => void;
}) => (
  <>
    <input
      ref={cameraRef}
      type="file"
      accept="image/*"
      capture="user"
      className="hidden"
      onChange={(event) => onFile(event.target.files?.[0])}
    />
    <input
      ref={galleryRef}
      type="file"
      accept="image/*"
      className="hidden"
      onChange={(event) => onFile(event.target.files?.[0])}
    />
  </>
);

const NeuralField = ({ particles }: { particles: Array<{ id: number; left: string; top: string; size: number; delay: number; duration: number }> }) => (
  <div className="pointer-events-none absolute inset-0 overflow-hidden">
    <svg className="absolute inset-0 h-full w-full opacity-[0.24]" viewBox="0 0 900 900" preserveAspectRatio="none">
      <path d="M62 178 C160 88 278 318 376 236 S610 62 780 210" fill="none" stroke="#a78bfa" strokeWidth="1" />
      <path d="M126 610 C256 454 338 772 502 596 S692 390 838 618" fill="none" stroke="#c084fc" strokeWidth="1" />
      <path d="M72 420 C218 370 310 472 438 420 S648 260 820 338" fill="none" stroke="#818cf8" strokeWidth="1" />
    </svg>
    {particles.map((particle) => (
      <motion.span
        key={particle.id}
        className="absolute rounded-full bg-violet-400/70 shadow-[0_0_18px_rgba(167,139,250,0.85)]"
        style={{ left: particle.left, top: particle.top, width: particle.size, height: particle.size }}
        animate={{ y: [-8, 12, -8], opacity: [0.25, 0.85, 0.25], scale: [1, 1.5, 1] }}
        transition={{ duration: particle.duration, delay: particle.delay, repeat: Infinity, ease: 'easeInOut' }}
      />
    ))}
  </div>
);

const ConfidenceRow = ({ label, value }: { label: string; value: number }) => (
  <div className="mb-4 last:mb-0">
    <div className="mb-2 flex items-center justify-between text-sm font-bold">
      <span className="text-slate-600">{label}</span>
      <span className="text-violet-700">{value}%</span>
    </div>
    <div className="h-2 overflow-hidden rounded-full bg-violet-100">
      <motion.div
        className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-violet-600"
        initial={{ width: 0 }}
        animate={{ width: `${value}%` }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
      />
    </div>
  </div>
);

const tagPosition = (index: number) => {
  const positions = [
    'left-0 top-12 max-w-[210px]',
    'right-4 top-16 max-w-[190px]',
    'left-4 top-[178px] max-w-[180px]',
    'right-0 top-[198px] max-w-[170px]',
    'left-1/2 bottom-10 -translate-x-1/2 max-w-[210px]',
    'left-[7%] bottom-[112px] hidden max-w-[210px] sm:block',
    'right-[8%] bottom-[112px] hidden max-w-[180px] sm:block',
    'left-[28%] top-0 hidden max-w-[210px] sm:block',
    'left-1/2 top-[330px] -translate-x-1/2 max-w-[320px] sm:top-[354px]',
    'right-[16%] top-[292px] hidden max-w-[240px] sm:block'
  ];

  return positions[index] || 'left-0 top-0';
};
