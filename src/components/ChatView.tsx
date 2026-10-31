import React, { useState, useRef, useEffect } from 'react';
import { ScreenId, ProductItem, NovaAiPersonalProfile, NovaAiProductRecommendation } from '../types';
import { apiUrl } from '../services/apiClient';

interface ChatViewProps {
  onNavigate: (screen: ScreenId) => void;
  userName: string;
  products?: Record<string, ProductItem>;
  onSelectProduct?: (product: ProductItem) => void;
}

const BODY_SHAPE_OPTIONS = ['Hourglass', 'Pear', 'Inverted Triangle', 'Rectangle', 'Apple', 'Athletic'] as const;
const SKIN_TONE_OPTIONS = ['Fair', 'Light', 'Medium', 'Olive', 'Tan', 'Deep'] as const;
const UNDERTONE_OPTIONS = ['Warm', 'Cool', 'Neutral'] as const;
const SIZE_OPTIONS = ['XS', 'S', 'M', 'L'] as const;

export const ChatView: React.FC<ChatViewProps> = ({ userName, products = {}, onSelectProduct }) => {
  // Photo & Analysis States
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [photoBase64, setPhotoBase64] = useState<string>('');
  const [photoMimeType, setPhotoMimeType] = useState<string>('image/jpeg');
  const [analysisStatus, setAnalysisStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [analysisError, setAnalysisError] = useState<string>('');
  const [profile, setProfile] = useState<NovaAiPersonalProfile | null>(null);

  // Recommendations States
  const [recommendations, setRecommendations] = useState<NovaAiProductRecommendation[]>([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [recommendationsError, setRecommendationsError] = useState('');
  const [currentRecIndex, setCurrentRecIndex] = useState(0);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const activeAnalysisAbortRef = useRef<AbortController | null>(null);
  const touchStartXRef = useRef<number | null>(null);

  /**
   * Client-side image validation and downscaling via Canvas
   */
  const processImageFile = async (file: File): Promise<{ base64: string; mimeType: string }> => {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        reject(new Error('Please select a valid image file (JPEG, PNG, or WebP).'));
        return;
      }
      if (file.size > 15 * 1024 * 1024) {
        reject(new Error('Image is too large. Please select a photo under 15MB.'));
        return;
      }

      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Failed to read image file.'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Unable to decode image. Please try a different photo.'));
        img.onload = () => {
          const maxDim = 1200;
          let width = img.width;
          let height = img.height;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve({ base64: reader.result as string, mimeType: file.type || 'image/jpeg' });
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          resolve({ base64: dataUrl, mimeType: 'image/jpeg' });
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handlePhotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (activeAnalysisAbortRef.current) {
      activeAnalysisAbortRef.current.abort();
      activeAnalysisAbortRef.current = null;
    }

    setAnalysisError('');
    setAnalysisStatus('idle');
    setProfile(null);
    setRecommendations([]);
    setCurrentRecIndex(0);

    try {
      const { base64, mimeType } = await processImageFile(file);
      setPhotoPreview(base64);
      setPhotoBase64(base64);
      setPhotoMimeType(mimeType);
      setAnalysisStatus('idle');
    } catch (err: any) {
      setAnalysisStatus('error');
      setAnalysisError(err.message || 'Invalid image file.');
    }
  };

  const handleRemovePhoto = () => {
    if (activeAnalysisAbortRef.current) {
      activeAnalysisAbortRef.current.abort();
      activeAnalysisAbortRef.current = null;
    }
    setPhotoPreview('');
    setPhotoBase64('');
    setAnalysisStatus('idle');
    setProfile(null);
    setRecommendations([]);
    setAnalysisError('');
    setCurrentRecIndex(0);
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  /**
   * Fetches product recommendations using the active profile
   */
  const fetchRecommendations = async (targetProfile: NovaAiPersonalProfile) => {
    setRecommendationsLoading(true);
    setRecommendationsError('');
    try {
      const res = await fetch(apiUrl('/api/chat/recommendations'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: targetProfile, limit: 8 })
      });

      if (!res.ok) {
        throw new Error('Could not retrieve recommendations.');
      }

      const data = await res.json();
      if (data.success && Array.isArray(data.recommendations)) {
        setRecommendations(data.recommendations);
        setCurrentRecIndex(0);
      } else {
        setRecommendations([]);
        setCurrentRecIndex(0);
      }
    } catch (err: any) {
      console.error('Error fetching recommendations:', err);
      setRecommendationsError('Unable to load personalized product recommendations.');
    } finally {
      setRecommendationsLoading(false);
    }
  };

  /**
   * Invokes NOVA AI image analysis for personal profile
   */
  const handleAnalyzePhoto = async () => {
    if (!photoBase64 || analysisStatus === 'loading') return;

    setAnalysisStatus('loading');
    setAnalysisError('');

    const controller = new AbortController();
    activeAnalysisAbortRef.current = controller;
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 50000); // 50 seconds client-side ceiling

    try {
      const res = await fetch(apiUrl('/api/chat/analyze-profile'), {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: photoBase64,
          mimeType: photoMimeType
        })
      });

      clearTimeout(timeoutId);

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        const text = await res.text().catch(() => '');
        throw new Error(text || `Server returned HTTP ${res.status}`);
      }

      if (!res.ok || !data.success || !data.profile) {
        throw new Error(data.error || 'NOVA AI visual analysis could not determine profile attributes.');
      }

      const newProfile: NovaAiPersonalProfile = {
        ...data.profile,
        photoPreview
      };

      setProfile(newProfile);
      setAnalysisStatus('success');
      activeAnalysisAbortRef.current = null;

      // Automatically trigger product recommendations from the new profile
      fetchRecommendations(newProfile);
    } catch (err: any) {
      clearTimeout(timeoutId);
      activeAnalysisAbortRef.current = null;
      console.error('Profile analysis failed:', err);
      setAnalysisStatus('error');
      if (err.name === 'AbortError') {
        setAnalysisError('Analysis timed out. Please try again with a clear, well-lit photo.');
      } else {
        setAnalysisError(err.message || 'NOVA AI personal visual analysis failed. Please try another clear photograph.');
      }
    }
  };

  /**
   * Update confirmed profile attributes
   */
  const handleUpdateProfileAttribute = async (updates: Partial<NovaAiPersonalProfile>) => {
    if (!profile) return;
    const updated = {
      ...profile,
      ...updates
    };
    setProfile(updated);
    // Refresh recommendations with confirmed attributes
    await fetchRecommendations(updated);
  };

  // Carousel Stepper Handlers
  const handlePrevRec = () => {
    if (recommendations.length <= 1) return;
    setCurrentRecIndex((prev) => (prev > 0 ? prev - 1 : recommendations.length - 1));
  };

  const handleNextRec = () => {
    if (recommendations.length <= 1) return;
    setCurrentRecIndex((prev) => (prev < recommendations.length - 1 ? prev + 1 : 0));
  };

  // Mobile Touch Swipe Handling
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const diff = touchStartXRef.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) {
        handleNextRec();
      } else {
        handlePrevRec();
      }
    }
    touchStartXRef.current = null;
  };

  // Keyboard Navigation for Looks
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (recommendations.length <= 1) return;
      if (e.key === 'ArrowLeft') {
        handlePrevRec();
      } else if (e.key === 'ArrowRight') {
        handleNextRec();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [recommendations.length]);

  const effectiveBodyShape = profile?.userConfirmedBodyShape || profile?.bodyShape;
  const effectiveSkinTone = profile?.userConfirmedSkinTone || profile?.skinTone;
  const effectiveUndertone = profile?.userConfirmedUndertone || profile?.undertone;
  const effectiveSize = profile?.userConfirmedSize || profile?.suggestedSize;
  const isSizeConfirmed = Boolean(profile?.userConfirmedSize);

  const safeIndex = Math.min(Math.max(0, currentRecIndex), Math.max(0, recommendations.length - 1));
  const activeRec = recommendations[safeIndex];

  return (
    <div className="nova-ai-shell flex flex-col min-h-screen pb-24 -mx-4 px-3 sm:px-5 bg-[#0D1527] text-white">
      {/* 1. Header Banner */}
      <header className="nova-ai-header rounded-3xl p-5 sm:p-7 mt-2 mb-4 bg-gradient-to-br from-[#1E1B38] to-[#12162B] border border-violet-500/20 shadow-xl">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#6045FF] animate-pulse" />
          <p className="text-[10px] uppercase tracking-[.24em] text-violet-300 font-bold">NOVA / PERSONAL STYLE INTELLIGENCE</p>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white mt-2">
          {userName ? `Welcome, ${userName}` : 'Your Style, Understood.'}
        </h1>
        <p className="text-sm text-slate-300 mt-2 max-w-lg leading-relaxed">
          Upload your photo to run NOVA AI visual analysis on your body proportions and undertones, unlocking tailored clothing recommendations from the catalogue.
        </p>
      </header>

      {/* 2. Photo Upload & Profile Analysis Panel */}
      <section className="nova-profile-panel rounded-2xl p-5 mb-5 bg-[#14182E] border border-violet-500/30 shadow-lg">
        {/* Upload Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="relative w-14 h-14 rounded-2xl overflow-hidden bg-black/40 border-2 border-violet-500/30 shrink-0 flex items-center justify-center shadow-inner group">
              {photoPreview ? (
                <img src={photoPreview} alt="Your uploaded photo" className="w-full h-full object-cover" />
              ) : (
                <span className="material-symbols-outlined text-2xl text-violet-300">add_a_photo</span>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-bold text-white">NOVA AI Personal Profile</p>
                {profile && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                    Analyzed
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 truncate mt-0.5">
                {photoPreview
                  ? profile
                    ? 'Visual attributes active for product recommendations'
                    : 'Photo loaded — ready for NOVA AI visual analysis'
                  : 'Upload a clear full-length or upper-body photograph'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              capture="user"
              className="hidden"
              onChange={handlePhotoChange}
            />
            {photoPreview ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-violet-200 transition-colors cursor-pointer"
                >
                  Change photo
                </button>
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="px-2.5 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-xs font-semibold text-red-300 transition-colors cursor-pointer"
                  title="Remove photograph"
                >
                  Remove
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-xs font-bold text-white shadow-md shadow-violet-600/30 transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">upload</span>
                Upload photo
              </button>
            )}
          </div>
        </div>

        {/* Action Button: Analyse Photo */}
        {photoPreview && !profile && (
          <div className="mt-4 pt-4 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-xs text-slate-300">
              NOVA AI will identify your body shape, skin tone and undertone, and tentative clothing size.
            </p>
            <button
              type="button"
              onClick={handleAnalyzePhoto}
              disabled={analysisStatus === 'loading'}
              className="shrink-0 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-xs font-bold text-white shadow-lg shadow-violet-600/40 transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {analysisStatus === 'loading' ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Analysing with NOVA AI…</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-sm">auto_awesome</span>
                  <span>Analyse photo</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Error Notification with Retry */}
        {analysisStatus === 'error' && (
          <div role="status" className="mt-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="material-symbols-outlined text-base shrink-0">warning</span>
              <span className="truncate">{analysisError || 'Analysis could not be completed. Please try a different clear image.'}</span>
            </div>
            {photoPreview && (
              <button
                type="button"
                onClick={handleAnalyzePhoto}
                className="shrink-0 px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-bold transition-colors cursor-pointer"
              >
                Retry
              </button>
            )}
          </div>
        )}

        {/* Profile Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mt-4">
          {/* 1. Body Shape */}
          <div className="rounded-2xl p-4 bg-black/30 border border-white/10 flex flex-col justify-between min-w-0 shadow-sm">
            <div>
              <div className="flex items-center justify-between gap-1 flex-wrap">
                <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Body Shape</p>
                {profile && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 font-semibold shrink-0">
                    {profile.bodyShapeConfidence}% confidence
                  </span>
                )}
              </div>
              <p className="text-base font-extrabold text-white mt-1.5">
                {effectiveBodyShape || (analysisStatus === 'loading' ? 'Detecting proportions…' : analysisStatus === 'error' ? 'Analysis failed' : 'Awaiting analysis')}
              </p>
              {profile && (
                <p className="text-[11px] text-slate-400 mt-1.5 leading-snug">
                  {profile.bodyShapeExplanation}
                </p>
              )}
            </div>

            {profile && (
              <div className="mt-4 pt-3 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-[10px] text-slate-400 shrink-0">Correct if needed:</span>
                <select
                  value={effectiveBodyShape}
                  onChange={(e) => handleUpdateProfileAttribute({ userConfirmedBodyShape: e.target.value })}
                  aria-label="Select body shape"
                  className="text-xs bg-[#1A1D36] border border-violet-500/40 rounded-lg px-2.5 py-1.5 text-violet-200 focus:outline-none w-full sm:w-auto"
                >
                  {BODY_SHAPE_OPTIONS.map((shape) => (
                    <option key={shape} value={shape}>{shape}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* 2. Skin Tone & Undertone */}
          <div className="rounded-2xl p-4 bg-black/30 border border-white/10 flex flex-col justify-between min-w-0 shadow-sm">
            <div>
              <div className="flex items-center justify-between gap-1 flex-wrap">
                <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Skin Tone & Undertone</p>
                {profile && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 font-semibold shrink-0">
                    {profile.skinToneConfidence}% confidence
                  </span>
                )}
              </div>
              <p className="text-base font-extrabold text-white mt-1.5">
                {profile
                  ? `${effectiveSkinTone} • ${effectiveUndertone} Undertone`
                  : analysisStatus === 'loading'
                  ? 'Analyzing color palette…'
                  : analysisStatus === 'error'
                  ? 'Analysis failed'
                  : 'Awaiting analysis'}
              </p>
              {profile && (
                <p className="text-[11px] text-slate-400 mt-1.5 leading-snug">
                  {profile.skinToneExplanation}
                </p>
              )}
            </div>

            {profile && (
              <div className="mt-4 pt-3 border-t border-white/10 flex flex-col gap-1.5">
                <span className="text-[10px] text-slate-400">Correct if needed:</span>
                <div className="grid grid-cols-2 gap-2 w-full">
                  <select
                    value={effectiveSkinTone}
                    onChange={(e) => handleUpdateProfileAttribute({ userConfirmedSkinTone: e.target.value })}
                    aria-label="Select skin tone"
                    className="text-xs bg-[#1A1D36] border border-violet-500/40 rounded-lg px-2 py-1.5 text-violet-200 focus:outline-none truncate"
                  >
                    {SKIN_TONE_OPTIONS.map((tone) => (
                      <option key={tone} value={tone}>{tone}</option>
                    ))}
                  </select>
                  <select
                    value={effectiveUndertone}
                    onChange={(e) => handleUpdateProfileAttribute({ userConfirmedUndertone: e.target.value })}
                    aria-label="Select undertone"
                    className="text-xs bg-[#1A1D36] border border-violet-500/40 rounded-lg px-2 py-1.5 text-violet-200 focus:outline-none truncate"
                  >
                    {UNDERTONE_OPTIONS.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* 3. Clothing Size */}
          <div className="rounded-2xl p-4 bg-black/30 border border-white/10 flex flex-col justify-between min-w-0 shadow-sm">
            <div>
              <div className="flex items-center justify-between gap-1 flex-wrap">
                <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Clothing Size</p>
                {profile && (
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold shrink-0 ${
                    isSizeConfirmed
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}>
                    {isSizeConfirmed ? 'User confirmed' : 'Tentative estimate'}
                  </span>
                )}
              </div>
              <p className="text-base font-extrabold text-white mt-1.5">
                {profile
                  ? effectiveSize && effectiveSize !== 'unknown'
                    ? `Size ${effectiveSize}`
                    : 'Unknown size'
                  : analysisStatus === 'loading'
                  ? 'Estimating size…'
                  : analysisStatus === 'error'
                  ? 'Analysis failed'
                  : 'Awaiting analysis'}
              </p>
              {profile && (
                <p className="text-[11px] text-slate-400 mt-1.5 leading-snug">
                  {profile.sizeExplanation}
                </p>
              )}
            </div>

            {profile && (
              <div className="mt-4 pt-3 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-[10px] text-slate-400 shrink-0">Confirm size:</span>
                <div className="flex items-center gap-1.5">
                  {SIZE_OPTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => handleUpdateProfileAttribute({ userConfirmedSize: s })}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        effectiveSize === s
                          ? 'bg-violet-600 text-white shadow-sm ring-1 ring-violet-400'
                          : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 3. Personalized Single Product Recommendation Feed */}
      {profile ? (
        <section className="nova-recommendations-section mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 px-1">
            <div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-violet-400 text-xl">auto_awesome</span>
                <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">Personalized Clothing Recommendations</h2>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Curated for your {effectiveBodyShape} silhouette, {effectiveUndertone.toLowerCase()} undertones, and size {effectiveSize}.
              </p>
            </div>
            <button
              type="button"
              onClick={() => fetchRecommendations(profile)}
              disabled={recommendationsLoading}
              className="self-start sm:self-auto text-xs text-violet-300 hover:text-white flex items-center gap-1.5 font-semibold px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <span className={`material-symbols-outlined text-sm ${recommendationsLoading ? 'animate-spin' : ''}`}>
                refresh
              </span>
              Refresh
            </button>
          </div>

          {/* Recommendations Loading State */}
          {recommendationsLoading && (
            <div className="p-10 rounded-3xl bg-[#14182E] border border-violet-500/20 text-center shadow-lg">
              <div className="w-9 h-9 mx-auto border-3 border-violet-500 border-t-transparent rounded-full animate-spin mb-3.5" />
              <p className="text-sm font-bold text-violet-200">NOVA AI curating products from catalogue…</p>
              <p className="text-xs text-slate-400 mt-1">Evaluating silhouette compatibility, color harmony &amp; size availability</p>
            </div>
          )}

          {/* Recommendations Error State */}
          {recommendationsError && !recommendationsLoading && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs">
              {recommendationsError}
            </div>
          )}

          {/* Single Product Card View (Show only one product at a time) */}
          {!recommendationsLoading && recommendations.length > 0 && activeRec && (
            <div className="space-y-4">
              {/* Stepper Navigation & Dots Bar */}
              <div className="flex items-center justify-between p-3.5 px-4 rounded-2xl bg-[#14182E] border border-violet-500/20 shadow-md">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-violet-300">
                    Look {safeIndex + 1} of {recommendations.length}
                  </span>
                  <span className="hidden sm:inline text-[11px] text-slate-400">
                    • {activeRec.matchScore}% Match
                  </span>
                </div>

                {/* Clickable Pagination Dots */}
                <div className="flex items-center gap-1.5">
                  {recommendations.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setCurrentRecIndex(idx)}
                      aria-label={`Go to look ${idx + 1}`}
                      className={`h-2 transition-all duration-300 rounded-full cursor-pointer ${
                        idx === safeIndex
                          ? 'w-6 bg-gradient-to-r from-violet-500 to-indigo-500 shadow-sm shadow-violet-500/50'
                          : 'w-2 bg-white/20 hover:bg-white/40'
                      }`}
                    />
                  ))}
                </div>

                {/* Previous & Next Header Arrow Buttons */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handlePrevRec}
                    aria-label="Previous recommendation"
                    className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer border border-white/10 active:scale-95"
                  >
                    <span className="material-symbols-outlined text-base">chevron_left</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleNextRec}
                    aria-label="Next recommendation"
                    className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer border border-white/10 active:scale-95"
                  >
                    <span className="material-symbols-outlined text-base">chevron_right</span>
                  </button>
                </div>
              </div>

              {/* Focused Single Product Card */}
              <article
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                className="overflow-hidden rounded-3xl bg-[#14182E] border border-violet-500/30 hover:border-violet-500/60 transition-all duration-300 shadow-2xl flex flex-col group"
              >
                {/* Large Product Hero Showcase Image */}
                <div className="relative w-full h-80 sm:h-96 bg-[#0C1022] overflow-hidden flex items-center justify-center p-4">
                  <img
                    src={activeRec.imageUrl}
                    alt={activeRec.name}
                    className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
                  />

                  {/* Top-Right: Match Percentage Badge */}
                  <div className="absolute top-4 right-4 px-3.5 py-1.5 rounded-full bg-[#0D1527]/90 backdrop-blur-md border border-violet-400/50 text-violet-200 text-xs font-black shadow-lg flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-violet-400">auto_awesome</span>
                    {activeRec.matchScore}% Match
                  </div>

                  {/* Top-Left: Recommended Size Badge */}
                  <div className={`absolute top-4 left-4 px-3.5 py-1.5 rounded-full bg-[#0D1527]/90 backdrop-blur-md border text-xs font-bold shadow-lg ${
                    activeRec.sizeStatus === 'user_confirmed'
                      ? 'border-emerald-400/50 text-emerald-300'
                      : 'border-amber-400/50 text-amber-300'
                  }`}>
                    Size {activeRec.recommendedSize} • {activeRec.sizeStatus === 'user_confirmed' ? 'User confirmed' : 'Estimated'}
                  </div>

                  {/* Side Navigation Buttons (Hover/Tap) */}
                  <button
                    type="button"
                    onClick={handlePrevRec}
                    aria-label="Previous look"
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-[#0D1527]/80 hover:bg-[#0D1527] text-white flex items-center justify-center backdrop-blur-md border border-white/10 transition-all opacity-80 hover:opacity-100 hover:scale-110 shadow-lg cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-xl">chevron_left</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleNextRec}
                    aria-label="Next look"
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-[#0D1527]/80 hover:bg-[#0D1527] text-white flex items-center justify-center backdrop-blur-md border border-white/10 transition-all opacity-80 hover:opacity-100 hover:scale-110 shadow-lg cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-xl">chevron_right</span>
                  </button>
                </div>

                {/* Content Details */}
                <div className="p-5 sm:p-7">
                  {/* Category & Price */}
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                    <span className="uppercase font-bold tracking-wider text-violet-300 text-xs px-2.5 py-0.5 rounded-md bg-violet-500/10 border border-violet-500/20">
                      {activeRec.category}
                    </span>
                    <span className="font-extrabold text-white text-2xl">
                      ₹{activeRec.price.toLocaleString('en-IN')}
                    </span>
                  </div>

                  {/* Product Title */}
                  <h3 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                    {activeRec.name}
                  </h3>

                  {/* Attribute Badges */}
                  <div className="flex flex-wrap gap-2 mt-3">
                    {activeRec.primaryColor && (
                      <span className="text-xs px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-slate-200 font-semibold flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-violet-400 inline-block" />
                        {activeRec.primaryColor}
                      </span>
                    )}
                    {activeRec.fit && (
                      <span className="text-xs px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-slate-200 font-semibold">
                        {activeRec.fit} fit
                      </span>
                    )}
                    {activeRec.subcategory && (
                      <span className="text-xs px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-slate-200 font-semibold">
                        {activeRec.subcategory}
                      </span>
                    )}
                  </div>

                  {/* NOVA AI Styling Analysis Box */}
                  <div className="mt-5 p-4 sm:p-5 rounded-2xl border border-[#30264e] bg-[#0e0f1e]/90 text-slate-300 shadow-inner">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="material-symbols-outlined text-base text-[#a855f7]">psychology</span>
                      <span className="text-xs font-black uppercase tracking-wider text-[#a855f7]">
                        NOVA AI Styling Analysis
                      </span>
                    </div>
                    <div className="space-y-3 text-xs sm:text-sm leading-relaxed text-slate-300">
                      <div className="flex items-start gap-2.5">
                        <span className="text-[#a855f7] font-bold text-base leading-none mt-0.5">•</span>
                        <div>
                          <strong className="text-white font-semibold">Silhouette Harmony:</strong>{' '}
                          <span className="text-slate-300">{activeRec.reasoning.silhouetteHarmonies}</span>
                        </div>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <span className="text-[#a855f7] font-bold text-base leading-none mt-0.5">•</span>
                        <div>
                          <strong className="text-white font-semibold">Colour Harmony:</strong>{' '}
                          <span className="text-slate-300">{activeRec.reasoning.colorHarmonies}</span>
                        </div>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <span className="text-[#a855f7] font-bold text-base leading-none mt-0.5">•</span>
                        <div>
                          <strong className="text-white font-semibold">Fit &amp; Size Guidance:</strong>{' '}
                          <span className="text-slate-300">{activeRec.sizeReason}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Primary CTA Button */}
                  <div className="mt-6">
                    <button
                      type="button"
                      onClick={() => {
                        const catalogueMatch = products[activeRec.productId] || Object.values(products).find((p) => p.id === activeRec.productId);
                        if (catalogueMatch && onSelectProduct) {
                          onSelectProduct(catalogueMatch);
                        } else if (onSelectProduct) {
                          onSelectProduct({
                            id: activeRec.productId,
                            name: activeRec.name,
                            price: activeRec.price,
                            imageUrl: activeRec.imageUrl,
                            category: activeRec.category,
                            subcategory: activeRec.subcategory,
                            sizes: activeRec.availableSizes,
                            colors: activeRec.colors,
                            inStock: true
                          } as any);
                        }
                      }}
                      className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-violet-600/30 cursor-pointer active:scale-[0.99]"
                    >
                      <span className="material-symbols-outlined text-lg">visibility</span>
                      View Product Details
                    </button>
                  </div>

                  {/* Bottom Navigation Buttons */}
                  <div className="mt-3.5 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handlePrevRec}
                      className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 border border-white/10 cursor-pointer active:scale-95"
                    >
                      <span className="material-symbols-outlined text-base">arrow_back</span>
                      Previous Look
                    </button>
                    <button
                      type="button"
                      onClick={handleNextRec}
                      className="flex-1 py-3 rounded-xl bg-violet-500/20 hover:bg-violet-500/30 text-violet-200 hover:text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 border border-violet-500/30 cursor-pointer active:scale-95"
                    >
                      Next Look
                      <span className="material-symbols-outlined text-base">arrow_forward</span>
                    </button>
                  </div>
                </div>
              </article>
            </div>
          )}

          {/* Empty state */}
          {!recommendationsLoading && recommendations.length === 0 && !recommendationsError && (
            <div className="p-10 rounded-3xl bg-[#14182E] border border-white/10 text-center">
              <span className="material-symbols-outlined text-4xl text-slate-400 mb-2">inventory_2</span>
              <p className="text-sm font-bold text-slate-200">No catalogue items currently match this profile.</p>
              <p className="text-xs text-slate-400 mt-1">Try confirming a different size or updating your preferences.</p>
            </div>
          )}
        </section>
      ) : (
        /* Pre-analysis placeholder inviting user to upload */
        <section className="p-8 sm:p-12 rounded-3xl bg-[#14182E] border border-dashed border-violet-500/30 text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-violet-600/20 border border-violet-500/40 text-violet-300 flex items-center justify-center">
            <span className="material-symbols-outlined text-3xl">auto_awesome</span>
          </div>
          <h2 className="text-lg font-black text-white">Unlock Your NOVA AI Style Analysis</h2>
          <p className="text-xs text-slate-400 mt-1.5 max-w-md mx-auto leading-relaxed">
            Upload a photo above to run NOVA AI visual analysis and receive personalized clothing recommendations with grounded styling explanations.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2.5 mt-5 max-w-lg mx-auto">
            {['Body Shape Analysis', 'Skin Undertone Matching', 'Recommended Size XS–L', 'NOVA AI Styling Analysis'].map((item) => (
              <span key={item} className="text-[11px] font-bold px-3 py-1 rounded-full bg-white/5 border border-white/10 text-violet-200">
                ✓ {item}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
