import React, { useState, useRef } from 'react';
import { ScreenId, ProductItem, NovaAiPersonalProfile, NovaAiProductRecommendation } from '../types';

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

  const photoInputRef = useRef<HTMLInputElement>(null);

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

  const activeAnalysisAbortRef = useRef<AbortController | null>(null);

  const handlePhotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset previous analysis state and abort ongoing request
    if (activeAnalysisAbortRef.current) {
      activeAnalysisAbortRef.current.abort();
      activeAnalysisAbortRef.current = null;
    }

    setAnalysisError('');
    setAnalysisStatus('idle');
    setProfile(null);
    setRecommendations([]);

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
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  /**
   * Fetches product recommendations using the active profile
   */
  const fetchRecommendations = async (targetProfile: NovaAiPersonalProfile) => {
    setRecommendationsLoading(true);
    setRecommendationsError('');
    try {
      const res = await fetch('/api/chat/recommendations', {
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
      } else {
        setRecommendations([]);
      }
    } catch (err: any) {
      console.error('Error fetching recommendations:', err);
      setRecommendationsError('Unable to load personalized product recommendations.');
    } finally {
      setRecommendationsLoading(false);
    }
  };

  /**
   * Invokes Gemini image analysis for personal profile
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
      const res = await fetch('/api/chat/analyze-profile', {
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
        throw new Error(data.error || 'Gemini visual analysis could not determine profile attributes.');
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

  const effectiveBodyShape = profile?.userConfirmedBodyShape || profile?.bodyShape;
  const effectiveSkinTone = profile?.userConfirmedSkinTone || profile?.skinTone;
  const effectiveUndertone = profile?.userConfirmedUndertone || profile?.undertone;
  const effectiveSize = profile?.userConfirmedSize || profile?.suggestedSize;
  const isSizeConfirmed = Boolean(profile?.userConfirmedSize);

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
          Upload your photo to run Gemini visual analysis on your body proportions and undertones, unlocking tailored clothing recommendations from the catalogue.
        </p>
      </header>

      {/* 2. Photo Upload & Gemini Analysis Panel */}
      <section className="nova-profile-panel rounded-2xl p-5 mb-5 bg-[#14182E] border border-violet-500/30 shadow-lg">
        {/* Upload Row */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="relative w-14 h-14 rounded-2xl overflow-hidden bg-black/40 border-2 border-violet-500/30 shrink-0 flex items-center justify-center shadow-inner group">
              {photoPreview ? (
                <img src={photoPreview} alt="Your uploaded photo" className="w-full h-full object-cover" />
              ) : (
                <span className="material-symbols-outlined text-2xl text-violet-300">add_a_photo</span>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-white flex items-center gap-2">
                NOVA AI Personal Profile
                {profile && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Analyzed
                  </span>
                )}
              </p>
              <p className="text-xs text-slate-400 truncate">
                {photoPreview
                  ? profile
                    ? 'Visual attributes active for product recommendations'
                    : 'Photo loaded — ready for Gemini visual analysis'
                  : 'Upload a clear full-length or upper-body photograph'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
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
          <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between gap-3">
            <p className="text-xs text-slate-300">
              Gemini will identify your body shape, skin tone and undertone, and tentative clothing size.
            </p>
            <button
              type="button"
              onClick={handleAnalyzePhoto}
              disabled={analysisStatus === 'loading'}
              className="shrink-0 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-xs font-bold text-white shadow-lg shadow-violet-600/40 transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              {analysisStatus === 'loading' ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Analysing with Gemini…</span>
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
          {/* 1. Body Shape */}
          <div className="rounded-xl p-3.5 bg-black/30 border border-white/10 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Body Shape</p>
                {profile && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 font-semibold">
                    {profile.bodyShapeConfidence}% confidence
                  </span>
                )}
              </div>
              <p className="text-sm font-bold text-white mt-1.5">
                {effectiveBodyShape || (analysisStatus === 'loading' ? 'Detecting proportions…' : analysisStatus === 'error' ? 'Analysis failed' : 'Awaiting analysis')}
              </p>
              {profile && (
                <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                  {profile.bodyShapeExplanation}
                </p>
              )}
            </div>

            {profile && (
              <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between">
                <span className="text-[10px] text-slate-500">Correct if needed:</span>
                <select
                  value={effectiveBodyShape}
                  onChange={(e) => handleUpdateProfileAttribute({ userConfirmedBodyShape: e.target.value })}
                  aria-label="Select body shape"
                  className="text-xs bg-[#1A1D36] border border-violet-500/40 rounded-lg px-2 py-1 text-violet-200 focus:outline-none"
                >
                  {BODY_SHAPE_OPTIONS.map((shape) => (
                    <option key={shape} value={shape}>{shape}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* 2. Skin Tone & Undertone */}
          <div className="rounded-xl p-3.5 bg-black/30 border border-white/10 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Skin Tone & Undertone</p>
                {profile && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 font-semibold">
                    {profile.skinToneConfidence}% confidence
                  </span>
                )}
              </div>
              <p className="text-sm font-bold text-white mt-1.5">
                {profile
                  ? `${effectiveSkinTone} • ${effectiveUndertone} Undertone`
                  : analysisStatus === 'loading'
                  ? 'Analyzing color palette…'
                  : analysisStatus === 'error'
                  ? 'Analysis failed'
                  : 'Awaiting analysis'}
              </p>
              {profile && (
                <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                  {profile.skinToneExplanation}
                </p>
              )}
            </div>

            {profile && (
              <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between gap-1">
                <select
                  value={effectiveSkinTone}
                  onChange={(e) => handleUpdateProfileAttribute({ userConfirmedSkinTone: e.target.value })}
                  aria-label="Select skin tone"
                  className="text-xs bg-[#1A1D36] border border-violet-500/40 rounded-lg px-2 py-1 text-violet-200 focus:outline-none"
                >
                  {SKIN_TONE_OPTIONS.map((tone) => (
                    <option key={tone} value={tone}>{tone}</option>
                  ))}
                </select>
                <select
                  value={effectiveUndertone}
                  onChange={(e) => handleUpdateProfileAttribute({ userConfirmedUndertone: e.target.value })}
                  aria-label="Select undertone"
                  className="text-xs bg-[#1A1D36] border border-violet-500/40 rounded-lg px-2 py-1 text-violet-200 focus:outline-none"
                >
                  {UNDERTONE_OPTIONS.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* 3. Clothing Size */}
          <div className="rounded-xl p-3.5 bg-black/30 border border-white/10 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Clothing Size</p>
                {profile && (
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${
                    isSizeConfirmed
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}>
                    {isSizeConfirmed ? 'User confirmed' : 'Tentative estimate'}
                  </span>
                )}
              </div>
              <p className="text-sm font-bold text-white mt-1.5">
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
                <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                  {profile.sizeExplanation}
                </p>
              )}
            </div>

            {profile && (
              <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between">
                <span className="text-[10px] text-slate-500">Confirm size:</span>
                <div className="flex gap-1">
                  {SIZE_OPTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => handleUpdateProfileAttribute({ userConfirmedSize: s })}
                      className={`px-2 py-0.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        effectiveSize === s
                          ? 'bg-violet-600 text-white shadow-sm'
                          : 'bg-white/5 text-slate-400 hover:text-white'
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

      {/* 3. Personalized Individual Product Recommendations Feed */}
      {profile ? (
        <section className="nova-recommendations-section mb-6">
          <div className="flex items-center justify-between mb-4 px-1">
            <div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-violet-400 text-lg">auto_awesome</span>
                <h2 className="text-lg font-black text-white tracking-tight">Personalized Clothing Recommendations</h2>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Curated for your {effectiveBodyShape} silhouette, {effectiveUndertone.toLowerCase()} undertones, and size {effectiveSize}.
              </p>
            </div>
            <button
              type="button"
              onClick={() => fetchRecommendations(profile)}
              disabled={recommendationsLoading}
              className="text-xs text-violet-300 hover:text-white flex items-center gap-1.5 font-semibold px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors disabled:opacity-50 cursor-pointer"
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
              <p className="text-xs text-slate-400 mt-1">Evaluating silhouette compatibility, color harmony & size availability</p>
            </div>
          )}

          {/* Recommendations Error State */}
          {recommendationsError && !recommendationsLoading && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs">
              {recommendationsError}
            </div>
          )}

          {/* Product Cards Feed matching reference styling */}
          {!recommendationsLoading && recommendations.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {recommendations.map((rec) => {
                const catalogueMatch = products[rec.productId] || Object.values(products).find((p) => p.id === rec.productId);

                return (
                  <article
                    key={rec.productId}
                    className="overflow-hidden rounded-3xl bg-[#14182E] border border-violet-500/25 hover:border-violet-500/60 transition-all duration-300 flex flex-col justify-between shadow-xl group"
                  >
                    <div>
                      {/* Image container */}
                      <div className="relative w-full h-64 sm:h-72 bg-[#0C1022] overflow-hidden flex items-center justify-center p-3">
                        <img
                          src={rec.imageUrl}
                          alt={rec.name}
                          className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
                        />
                        {/* Top-Right: Match Percentage Badge */}
                        <div className="absolute top-3.5 right-3.5 px-3 py-1 rounded-full bg-[#0D1527]/90 backdrop-blur-md border border-violet-400/50 text-violet-200 text-xs font-black shadow-lg">
                          {rec.matchScore}% Match
                        </div>
                        {/* Top-Left: Recommended Size Badge */}
                        <div className={`absolute top-3.5 left-3.5 px-3 py-1 rounded-full bg-[#0D1527]/90 backdrop-blur-md border text-xs font-bold shadow-lg ${
                          rec.sizeStatus === 'user_confirmed'
                            ? 'border-emerald-400/50 text-emerald-300'
                            : 'border-amber-400/50 text-amber-300'
                        }`}>
                          Size {rec.recommendedSize} • {rec.sizeStatus === 'user_confirmed' ? 'User confirmed' : 'Estimated'}
                        </div>
                      </div>

                      {/* Content Section */}
                      <div className="p-5">
                        <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                          <span className="uppercase font-bold tracking-wider text-violet-300 text-[11px]">{rec.category}</span>
                          <span className="font-extrabold text-white text-base">₹{rec.price.toLocaleString('en-IN')}</span>
                        </div>
                        <h3 className="text-base font-extrabold text-white tracking-tight line-clamp-1">{rec.name}</h3>

                        {/* Attribute Badges */}
                        <div className="flex flex-wrap gap-2 mt-2.5">
                          {rec.primaryColor && (
                            <span className="text-[11px] px-2.5 py-0.5 rounded-lg bg-white/5 border border-white/10 text-slate-200 font-semibold flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-violet-400 inline-block" />
                              {rec.primaryColor}
                            </span>
                          )}
                          {rec.fit && (
                            <span className="text-[11px] px-2.5 py-0.5 rounded-lg bg-white/5 border border-white/10 text-slate-200 font-semibold">
                              {rec.fit} fit
                            </span>
                          )}
                          {rec.subcategory && (
                            <span className="text-[11px] px-2.5 py-0.5 rounded-lg bg-white/5 border border-white/10 text-slate-200 font-semibold">
                              {rec.subcategory}
                            </span>
                          )}
                        </div>

                        {/* NOVA AI Styling Analysis Box (Reference Styling) */}
                        <div className="mt-4 p-4 rounded-2xl border border-[#30264e] bg-[#0e0f1e]/80 text-slate-300 text-xs">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="material-symbols-outlined text-sm text-[#a855f7]">psychology</span>
                            <span className="text-xs font-black uppercase tracking-wider text-[#a855f7]">
                              NOVA AI Styling Analysis
                            </span>
                          </div>
                          <div className="space-y-1.5 text-xs leading-relaxed text-slate-300">
                            <p className="flex items-start gap-2">
                              <span className="text-[#a855f7] font-bold">•</span>
                              <span><strong className="text-white">Silhouette:</strong> {rec.reasoning.silhouetteHarmonies}</span>
                            </p>
                            <p className="flex items-start gap-2">
                              <span className="text-[#a855f7] font-bold">•</span>
                              <span><strong className="text-white">Colour:</strong> {rec.reasoning.colorHarmonies}</span>
                            </p>
                            <p className="flex items-start gap-2">
                              <span className="text-[#a855f7] font-bold">•</span>
                              <span><strong className="text-white">Fit &amp; Size:</strong> {rec.sizeReason}</span>
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Card Action Footer */}
                    <div className="p-5 pt-0">
                      <button
                        type="button"
                        onClick={() => {
                          if (catalogueMatch && onSelectProduct) {
                            onSelectProduct(catalogueMatch);
                          } else if (onSelectProduct) {
                            onSelectProduct({
                              id: rec.productId,
                              name: rec.name,
                              price: rec.price,
                              imageUrl: rec.imageUrl,
                              category: rec.category,
                              subcategory: rec.subcategory,
                              sizes: rec.availableSizes,
                              colors: rec.colors,
                              inStock: true
                            } as any);
                          }
                        }}
                        className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-md shadow-violet-600/30 cursor-pointer active:scale-[0.99]"
                      >
                        <span className="material-symbols-outlined text-base">visibility</span>
                        View Product Details
                      </button>
                    </div>
                  </article>
                );
              })}
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
            Upload a photo above to run Gemini visual analysis and receive personalized clothing recommendations with grounded styling explanations.
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
