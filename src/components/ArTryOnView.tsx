import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { ScreenId } from '../types';
import { analytics } from '../services/analyticsService';
import { Capacitor } from '@capacitor/core';
import {
  saveImageToDeviceGallery,
  saveLookLocally,
  captureCurrentTryOnImage,
  generateLookFilename,
} from '../services/savedLooksService';
import {
  startLiveTryOnSession,
  captureVideoFrame,
  LiveTryOnSessionHandle,
  DEFAULT_GARMENTS,
  DEFAULT_MODELS,
  prepareGarmentForLiveTryOn,
} from '../services/liveTryOnService';

interface ArTryOnViewProps {
  onNavigate: (screen: ScreenId) => void;
  onBack?: () => void;
  selectedGarment: string;
  setSelectedGarment: (garment: string) => void;
  onCaptureImage?: (imageDataUrl: string) => void;
  initialGarmentImage?: string | null;
  isDarkMode?: boolean;
  userId?: string;
  userEmail?: string;
  userName?: string;
}

interface GarmentItem {
  id: string;
  name: string;
  category: string;
  img: string;
  file?: File;
}

// -------------------------------------------------------------
// Hardware-Accelerated Video / Model Layer for Mobile
// -------------------------------------------------------------
interface LiveTryOnViewportProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  isCameraActive: boolean;
  isVideoLive: boolean;
  lighting: boolean;
  fallbackImg: string;
}

const LiveTryOnViewport = memo<LiveTryOnViewportProps>(({
  videoRef,
  isCameraActive,
  isVideoLive,
  lighting,
  fallbackImg,
}) => {
  const showVideo = isCameraActive || isVideoLive;

  return (
    <div
      className="absolute inset-0 overflow-hidden bg-black select-none pointer-events-none"
      style={{
        contain: 'strict',
        isolation: 'isolate',
      }}
    >
      {/* Real-time transformed camera video stream with playsInline for mobile devices */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          transform: 'translateZ(0)',
          willChange: 'transform',
          backfaceVisibility: 'hidden',
        }}
        className={`absolute inset-0 w-full h-full object-cover object-top pointer-events-none transition-opacity duration-200 ${
          showVideo ? 'opacity-100 z-10' : 'opacity-0 z-0'
        }`}
      />

      {/* High-visibility portrait model when live stream is off */}
      {!showVideo && (
        <img
          alt="AR Try-On Portrait Model"
          className="absolute inset-0 w-full h-full object-cover object-top z-0 pointer-events-none"
          referrerPolicy="no-referrer"
          src={fallbackImg}
        />
      )}

      {/* Zero-invalidation hardware-accelerated lighting overlay */}
      {lighting && (
        <div className="absolute inset-0 bg-white/10 mix-blend-screen pointer-events-none z-15" />
      )}
    </div>
  );
});
LiveTryOnViewport.displayName = 'LiveTryOnViewport';

// -------------------------------------------------------------
// Main AR Try-On View
// -------------------------------------------------------------
export const ArTryOnView: React.FC<ArTryOnViewProps> = ({
  onNavigate,
  selectedGarment,
  setSelectedGarment,
  onCaptureImage,
  initialGarmentImage,
  isDarkMode = true,
  userId,
  userEmail,
  userName,
}) => {
  const [isSavingLook, setIsSavingLook] = useState(false);
  const [flash, setFlash] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isVideoLive, setIsVideoLive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [statusText, setStatusText] = useState('Camera ready');
  const [lighting, setLighting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [savePopup, setSavePopup] = useState<{
    isOpen: boolean;
    message: string;
    previewUrl?: string;
    isError?: boolean;
  } | null>(null);
  const [garmentsList, setGarmentsList] = useState<GarmentItem[]>(DEFAULT_GARMENTS);

  const videoRef = useRef<HTMLVideoElement>(null);
  const sessionRef = useRef<LiveTryOnSessionHandle | null>(null);
  const localPreviewStreamRef = useRef<MediaStream | null>(null);
  const isConnectingRef = useRef(false);
  const isLiveRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sessionStartTimeRef = useRef<number | null>(null);

  const activeModelBg = DEFAULT_MODELS[selectedGarment] || DEFAULT_MODELS['Lavender'];
  const activeGarmentObj = garmentsList.find((g) => g.id === selectedGarment) || garmentsList[0];

  useEffect(() => {
    if (selectedGarment && activeGarmentObj) {
      analytics.trackProductImpression({ id: selectedGarment, name: activeGarmentObj.name }, 'ar_tryon');
    }
  }, [selectedGarment, activeGarmentObj?.name]);

  // Stop session cleanly
  const stopLiveSession = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.stop();
      sessionRef.current = null;
    } else if (localPreviewStreamRef.current) {
      localPreviewStreamRef.current.getTracks().forEach((track) => track.stop());
      if (videoRef.current?.srcObject === localPreviewStreamRef.current) {
        videoRef.current.srcObject = null;
      }
    }
    localPreviewStreamRef.current = null;
    if (isLiveRef.current && sessionStartTimeRef.current) {
      const elapsed = Date.now() - sessionStartTimeRef.current;
      analytics.trackArTryOnEnded(selectedGarment, elapsed);
    }
    isLiveRef.current = false;
    isConnectingRef.current = false;
    setIsCameraActive(false);
    setIsVideoLive(false);
    setIsConnecting(false);
    setStatusText('Camera ready');
  }, [selectedGarment]);

  // Clean up session strictly on unmount
  useEffect(() => {
    return () => {
      if (sessionRef.current) {
        sessionRef.current.stop();
        sessionRef.current = null;
      } else if (localPreviewStreamRef.current) {
        localPreviewStreamRef.current.getTracks().forEach((track) => track.stop());
        localPreviewStreamRef.current = null;
      }
    };
  }, []);

  // Start live session on-demand
  const startLiveSession = useCallback(async () => {
    if (isConnectingRef.current || isLiveRef.current) return;
    if (!videoRef.current) return;

    if (localPreviewStreamRef.current) {
      localPreviewStreamRef.current.getTracks().forEach((track) => track.stop());
      localPreviewStreamRef.current = null;
      videoRef.current.srcObject = null;
      setIsCameraActive(false);
    }

    isConnectingRef.current = true;
    setIsConnecting(true);
    setStatusText('Connecting AI...');
    sessionStartTimeRef.current = Date.now();
    analytics.trackArTryOnStarted(selectedGarment, activeGarmentObj?.name, 'ar_tryon');

    const garmentSource = initialGarmentImage || activeGarmentObj?.file || activeGarmentObj?.img;

    try {
      const handle = await startLiveTryOnSession({
        videoElement: videoRef.current,
        garmentImage: garmentSource,
        facingMode: 'user',
        onLocalStream: (stream) => {
          localPreviewStreamRef.current = stream;
          setIsCameraActive(true);
          setStatusText('Camera active - connecting AI...');
        },
        onStatusChange: (status) => {
          setStatusText(status);
        },
        onConnected: () => {
          isLiveRef.current = true;
          isConnectingRef.current = false;
          setIsVideoLive(true);
          setIsConnecting(false);
          setStatusText('Live AI Active');
          const durationMs = sessionStartTimeRef.current ? Date.now() - sessionStartTimeRef.current : undefined;
          analytics.trackArTryOnSucceeded(selectedGarment, activeGarmentObj?.name, durationMs);
        },
        onError: (err) => {
          console.warn('Live session error:', err);
          analytics.trackArTryOnFailed(selectedGarment, 'stream_error', activeGarmentObj?.name);
          stopLiveSession();
          setStatusText(err.message || 'AI connection lost. Tap Try On Live to retry.');
        },
      });

      sessionRef.current = handle;
    } catch (err: any) {
      console.error('Could not start live session:', err);
      const errorCategory = err?.name === 'NotAllowedError' ? 'camera_permission_denied' : 'connection_failed';
      analytics.trackArTryOnFailed(selectedGarment, errorCategory, activeGarmentObj?.name);
      isConnectingRef.current = false;
      setIsConnecting(false);
      const errorMessage = typeof err?.message === 'string' && err.message.trim()
        ? err.message.trim()
        : typeof err?.error?.message === 'string' && err.error.message.trim()
        ? err.error.message.trim()
        : 'Unknown connection error';
      const detail = errorMessage.length > 140 ? `${errorMessage.slice(0, 137)}...` : errorMessage;
      setStatusText(err?.name === 'NotAllowedError'
        ? 'Camera access denied'
        : `AI connection failed: ${detail}`);
    }
  }, [activeGarmentObj, initialGarmentImage, stopLiveSession]);

  // Garment selection: instant dispatch via cached blob/file
  const handleGarmentClick = (item: GarmentItem) => {
    const prev = selectedGarment;
    setSelectedGarment(item.id);
    if (prev !== item.id) {
      analytics.trackArTryOnProductChanged(item.id, prev);
    }
    if (sessionRef.current && isLiveRef.current) {
      const payload = item.file || item.img;
      sessionRef.current.setGarment(payload).catch(() => {});
    }
  };

  // Custom garment upload handler
  const handleCustomUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const customId = `custom-${Date.now()}`;
    const previewUrl = URL.createObjectURL(file);

    const newGarment: GarmentItem = {
      id: customId,
      name: file.name.replace(/\.[^/.]+$/, '').slice(0, 16) || 'Custom Dress',
      category: 'Uploaded',
      img: previewUrl,
      file,
    };

    setGarmentsList((prev) => [newGarment, ...prev]);
    setSelectedGarment(customId);

    // Warm up compression in background
    prepareGarmentForLiveTryOn(file).catch(() => {});

    if (sessionRef.current && isLiveRef.current) {
      sessionRef.current.setGarment(file).catch(() => {});
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Toggle Live Camera / Fallback Mode
  const handleToggleCamera = () => {
    if (isLiveRef.current || isConnectingRef.current) {
      stopLiveSession();
    } else {
      startLiveSession();
    }
  };

  // Flip Camera
  const handleFlip = async () => {
    if (sessionRef.current && isLiveRef.current) {
      await sessionRef.current.flipCamera();
    }
  };

  // Shutter capture handler
  const handleCapture = () => {
    setFlash(true);

    if ((isCameraActive || isLiveRef.current) && videoRef.current) {
      const frame = captureVideoFrame(videoRef.current);
      if (frame && onCaptureImage) {
        onCaptureImage(frame);
      }
    } else if (onCaptureImage) {
      onCaptureImage(activeModelBg);
    }

    setTimeout(() => {
      setFlash(false);
      stopLiveSession();
      onNavigate('tryon-result');
    }, 300);
  };

  // Save current look: captures visible try-on, saves to phone gallery, and saves to NOVA account locally
  const handleSaveLook = async () => {
    if (isSavingLook) return;

    setIsSavingLook(true);

    try {
      // 1. Capture the actual visible, processed try-on result
      const captureResult = await captureCurrentTryOnImage({
        videoElement: videoRef.current,
        isVideoLive,
        isCameraActive,
        fallbackImageUrl: activeModelBg,
      });

      if (!captureResult || !captureResult.dataUrl) {
        setSavePopup({
          isOpen: true,
          message: 'Could not capture current look. Please try again.',
          isError: true,
        });
        return;
      }

      const filename = generateLookFilename();
      const effectiveUserId = userId || userEmail || 'local_user';

      // 2. Parallel / Independent destinations: Device Gallery + Local Device Store
      const [galleryResult, localStoreResult] = await Promise.allSettled([
        saveImageToDeviceGallery(captureResult.dataUrl, filename),
        saveLookLocally({
          userId: effectiveUserId,
          imageUrl: captureResult.dataUrl,
          garmentId: selectedGarment,
          garmentName: activeGarmentObj?.name || 'Curated Look',
          garmentCategory: activeGarmentObj?.category || 'Casual wear',
          garmentImg: activeGarmentObj?.img,
          filename,
          width: captureResult.width,
          height: captureResult.height,
        }),
      ]);

      const gallerySuccess =
        galleryResult.status === 'fulfilled' && galleryResult.value.success;
      const localSuccess =
        localStoreResult.status === 'fulfilled' && !!localStoreResult.value;

      // 3. Clear, accurate popup confirmation matching requirements
      if (localSuccess) {
        analytics.trackArTryOnResultSaved(selectedGarment, activeGarmentObj?.name);
      }

      if (localSuccess && gallerySuccess) {
        setSavePopup({
          isOpen: true,
          message: 'Your look is saved in NOVA and your phone gallery.',
          previewUrl: captureResult.dataUrl,
          isError: false,
        });
      } else if (localSuccess && !gallerySuccess) {
        setSavePopup({
          isOpen: true,
          message: "Your look is saved in NOVA. It couldn't be saved to your phone gallery.",
          previewUrl: captureResult.dataUrl,
          isError: false,
        });
      } else {
        setSavePopup({
          isOpen: true,
          message: 'Failed to save look locally. Please try again.',
          isError: true,
        });
      }
    } catch (err: any) {
      console.error('Save look failure:', err);
      setSavePopup({
        isOpen: true,
        message: 'Failed to save look. Please try again.',
        isError: true,
      });
    } finally {
      setIsSavingLook(false);
    }
  };

  const handleViewSavedLooks = () => {
    try {
      localStorage.setItem('nova_open_saved_looks', 'true');
    } catch {}
    setSavePopup(null);
    onNavigate('profile');
  };

  return (
    <div className="space-y-3.5 relative select-none pb-2">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#131426]/95 text-white px-4.5 py-2.5 rounded-full text-xs font-bold shadow-xl flex items-center gap-1.5 border border-[#553BE2]/40 backdrop-blur-md animate-bounce max-w-[280px] text-center leading-none">
          <span className="material-symbols-outlined text-[15px] text-[#A594FD]">bookmark_added</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Simulated camera flash */}
      {flash && (
        <div className="fixed inset-0 bg-white z-50 animate-ping opacity-100 pointer-events-none" />
      )}

      {/* Hidden file input for custom dress upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleCustomUpload}
      />

      {/* 1. Mode Selectors Pill: AR Try-On (active), Live Scan, Wardrobe */}
      <section className={`p-1 rounded-full flex relative border shadow-sm transition-colors ${
        isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-[#ECE7FF] border-[#E4DFF5]'
      }`}>
        {/* Tab 1: AR Try-On (active) */}
        <button 
          type="button"
          className="flex-1 py-2 text-xs font-bold rounded-full bg-[#553BE2] text-white shadow-md flex items-center justify-center gap-1.5 z-10 transition-all hover:bg-[#4830cb] active:scale-95 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[15px]">view_in_ar</span> AR Try-On
        </button>

        {/* Tab 2: Live Scan */}
        <button 
          type="button"
          onClick={() => onNavigate('scan-outfit')}
          title="Switch to Live Scan"
          className={`flex-1 py-2 text-xs font-semibold rounded-full flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
            isDarkMode 
              ? 'text-slate-300 hover:text-white hover:bg-slate-800/80' 
              : 'text-[#5E667A] hover:text-[#131426] hover:bg-white/70'
          }`}
        >
          <span className="material-symbols-outlined text-[14px]">camera_alt</span> Live Scan
        </button>

        {/* Tab 3: Wardrobe */}
        <button 
          type="button"
          onClick={() => onNavigate('wardrobe')}
          title="Switch to Wardrobe"
          className={`flex-1 py-2 text-xs font-semibold rounded-full flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
            isDarkMode 
              ? 'text-slate-300 hover:text-white hover:bg-slate-800/80' 
              : 'text-[#5E667A] hover:text-[#131426] hover:bg-white/70'
          }`}
        >
          <span className="material-symbols-outlined text-[14px]">checkroom</span> Wardrobe
        </button>
      </section>

      {/* 2. Screen Heading & History button */}
      <section className="flex justify-between items-start pt-0.5">
        <div>
          <h1 className="text-2xl font-bold text-white leading-tight flex items-center gap-1.5">
            AR Try-On <span className="material-symbols-outlined text-[#8B6DFD] text-xl">auto_awesome</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            See your selected outfit in real time.
          </p>
        </div>

        {/* History button */}
        <button
          type="button"
          onClick={() => onNavigate('scan-outfit')}
          title="View Scan & Try-On History"
          className="bg-[#111322] hover:bg-[#1C1F36] border border-white/10 rounded-xl px-3 py-1.5 flex items-center gap-1.5 text-slate-300 hover:text-white text-[11px] font-bold shadow-sm transition-all active:scale-95 cursor-pointer shrink-0 mt-0.5"
        >
          <span className="material-symbols-outlined text-sm text-[#A594FD]">history</span>
          <span className="tracking-wider">HISTORY</span>
        </button>
      </section>

      {/* 3. Camera Preview Area (Optimized for Mobile Phone Visibility) */}
      <section className="relative aspect-[3/4] max-h-[44vh] min-h-[300px] w-full rounded-[24px] overflow-hidden bg-slate-950 border border-white/15 shadow-2xl group">
        {/* Hardware-accelerated Video Layer */}
        <LiveTryOnViewport
          videoRef={videoRef}
          isCameraActive={isCameraActive}
          isVideoLive={isVideoLive}
          lighting={lighting}
          fallbackImg={activeModelBg}
        />

        {/* Target Framing Brackets */}
        <div className="absolute inset-3 rounded-2xl pointer-events-none z-20">
          <div className="absolute top-0 left-0 w-7 h-7 border-t-2 border-l-2 border-white rounded-tl-xl" />
          <div className="absolute top-0 right-0 w-7 h-7 border-t-2 border-r-2 border-white rounded-tr-xl" />
          <div className="absolute bottom-0 left-0 w-7 h-7 border-b-2 border-l-2 border-white rounded-bl-xl" />
          <div className="absolute bottom-0 right-0 w-7 h-7 border-b-2 border-r-2 border-white rounded-br-xl" />
        </div>

        {/* Top Status Pill: Camera ready / Live status */}
        <div className="absolute top-3 inset-x-0 flex justify-center z-30 pointer-events-none">
          <div className="max-w-[calc(100%-1rem)] bg-[#111322]/85 border border-white/15 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-lg backdrop-blur-md">
            <span
              className={`w-2 h-2 rounded-full ${
                isVideoLive
                  ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                  : isConnecting
                  ? 'bg-amber-400 animate-ping'
                  : statusText.includes('retry') || statusText.includes('denied') || statusText.includes('failed')
                  ? 'bg-rose-400'
                  : 'bg-emerald-400'
              }`}
            />
            <span title={statusText} className="max-w-[70vw] truncate text-[11px] font-semibold text-slate-200 tracking-wide">
              {statusText}
            </span>
          </div>
        </div>

        {/* Top Right Match Badge */}
        <div className="absolute top-3 right-3 z-30 pointer-events-auto">
          <div className="bg-[#111322]/85 rounded-full px-2.5 py-1 flex items-center gap-1 shadow-lg border border-white/15 backdrop-blur-md">
            <span className="material-symbols-outlined text-[#A594FD] text-xs leading-none">auto_awesome</span>
            <span className="text-white font-bold text-[11px] leading-none">92%</span>
            <span className="text-slate-300 text-[9px] uppercase tracking-wider font-bold leading-none">MATCH</span>
          </div>
        </div>

        {/* In-Camera Floating Bottom Controls: Flip, Shutter, Light */}
        <div className="absolute bottom-3.5 inset-x-0 flex justify-center items-center gap-5 z-30 px-4 pointer-events-auto">
          {/* Flip Camera */}
          <button
            type="button"
            onClick={handleFlip}
            disabled={!isVideoLive}
            title="Flip Camera"
            className="w-10 h-10 rounded-full bg-[#111322]/85 hover:bg-[#1C1F36] backdrop-blur-md border border-white/15 text-white flex items-center justify-center shadow-lg active:scale-95 transition-all disabled:opacity-40 cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">cameraswitch</span>
          </button>

          {/* Center Large Shutter Button */}
          <button
            type="button"
            onClick={handleCapture}
            title="Take Snapshot"
            className="w-13 h-13 rounded-full bg-white flex items-center justify-center p-1 border-[3px] border-[#A594FD] shadow-[0_0_20px_rgba(165,148,253,0.6)] active:scale-90 hover:scale-105 transition-all cursor-pointer"
          >
            <div className="w-full h-full rounded-full bg-white shadow-inner" />
          </button>

          {/* Lighting Toggle */}
          <button
            type="button"
            onClick={() => setLighting(!lighting)}
            title="Toggle Lighting"
            className={`w-10 h-10 rounded-full backdrop-blur-md border flex items-center justify-center shadow-lg active:scale-95 transition-all cursor-pointer ${
              lighting
                ? 'bg-[#553BE2] border-white/40 shadow-[#553BE2]/40 text-amber-300'
                : 'bg-[#111322]/85 hover:bg-[#1C1F36] border-white/15 text-white'
            }`}
          >
            <span className="material-symbols-outlined text-base">lightbulb</span>
          </button>
        </div>
      </section>

      {/* 4. Outfit Selection Section */}
      <section>
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-base font-bold text-white">Select Outfit</h2>
          <button 
            type="button"
            onClick={() => onNavigate('wardrobe')}
            className="text-xs font-semibold text-[#8B6DFD] hover:text-[#A594FD] flex items-center transition-colors cursor-pointer"
          >
            View All <span className="material-symbols-outlined text-sm ml-0.5 leading-none">chevron_right</span>
          </button>
        </div>

        {/* Horizontal Carousel (Touch-smooth on phone) */}
        <div className="flex gap-2.5 overflow-x-auto hide-scrollbar touch-pan-x snap-x -mx-1 px-1 pb-1">
          {garmentsList.map((g) => {
            const isSelected = selectedGarment === g.id;
            return (
              <div
                key={g.id}
                onClick={() => handleGarmentClick(g)}
                className={`snap-start shrink-0 w-[90px] rounded-2xl p-2 flex flex-col items-center border transition-all cursor-pointer ${
                  isSelected 
                    ? 'bg-[#1A1838] border-[#6D4AFF] shadow-lg shadow-[#6D4AFF]/25 ring-1 ring-[#6D4AFF]' 
                    : 'bg-[#111322] border-white/10 hover:border-white/20'
                }`}
              >
                <div className="w-full aspect-square rounded-xl overflow-hidden bg-slate-900/80 mb-1.5 relative border border-white/5">
                  <img
                    alt={g.name}
                    src={g.img}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover object-top"
                  />
                  {isSelected && (
                    <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[#6D4AFF] text-white flex items-center justify-center border border-white shadow-sm">
                      <span className="material-symbols-outlined text-[10px] font-bold leading-none">check</span>
                    </div>
                  )}
                </div>
                <span className={`text-[10px] font-semibold text-center truncate w-full ${
                  isSelected ? 'text-white font-bold' : 'text-slate-300'
                }`}>
                  {g.name}
                </span>
              </div>
            );
          })}

          {/* Upload Card */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="snap-start shrink-0 w-[90px] rounded-2xl p-2 flex flex-col items-center justify-center border border-dashed border-white/20 bg-[#111322]/80 hover:bg-[#111322] hover:border-[#6D4AFF] cursor-pointer transition-all min-h-[104px]"
          >
            <div className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-[#A594FD] mb-1.5 border border-white/10">
              <span className="material-symbols-outlined text-xl">cloud_upload</span>
            </div>
            <span className="text-[10px] font-semibold text-slate-300 text-center">
              Upload
            </span>
          </div>
        </div>
      </section>

      {/* 5. Action Buttons: Try On Live & Save Look */}
      <section className="grid grid-cols-2 gap-3 pt-0.5">
        <button
          type="button"
          onClick={handleToggleCamera}
          disabled={isConnecting}
          className="w-full py-3.5 px-3 rounded-2xl bg-[#5D3DF2] hover:bg-[#4E30E0] active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#5D3DF2]/30 transition-all cursor-pointer disabled:opacity-60"
        >
          {isConnecting ? (
            <>
              <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
              <span>Connecting...</span>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-lg leading-none">videocam</span>
              <span>{isVideoLive ? 'Stop Live AR' : 'Try On Live'}</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleSaveLook}
          disabled={isSavingLook}
          className="w-full py-3.5 px-3 rounded-2xl bg-[#111322] hover:bg-[#1A1C30] active:scale-95 border border-white/15 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm disabled:opacity-60"
        >
          {isSavingLook ? (
            <>
              <span className="w-3.5 h-3.5 rounded-full border-2 border-[#A594FD] border-t-transparent animate-spin" />
              <span>Saving Look...</span>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-lg leading-none text-slate-300">bookmark_border</span>
              <span>Save Look</span>
            </>
          )}
        </button>
      </section>

      {/* Save Look Confirmation Popup Modal */}
      {savePopup && savePopup.isOpen && (
        <div className="fixed inset-0 bg-[#0B0C15]/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-[28px] p-6 bg-[#111322] border border-[#553BE2]/40 shadow-2xl text-center space-y-4">
            {/* Status Icon */}
            <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto border ${
              savePopup.isError 
                ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' 
                : 'bg-[#553BE2]/15 text-[#A594FD] border-[#553BE2]/40'
            }`}>
              <span className="material-symbols-outlined text-3xl">
                {savePopup.isError ? 'error_outline' : 'bookmark_added'}
              </span>
            </div>

            {/* Title & Message */}
            <div className="space-y-1.5 px-1">
              <h3 className="text-lg font-bold text-white tracking-tight">
                {savePopup.isError ? 'Save Failed' : 'Look Saved Successfully!'}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                {savePopup.message}
              </p>
            </div>

            {/* Look thumbnail preview */}
            {savePopup.previewUrl && !savePopup.isError && (
              <div className="w-20 h-28 rounded-xl overflow-hidden mx-auto border border-white/15 bg-black shadow-inner">
                <img
                  alt="Saved Look"
                  src={savePopup.previewUrl}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover object-top"
                />
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2 pt-2">
              {!savePopup.isError ? (
                <>
                  <button
                    type="button"
                    onClick={handleViewSavedLooks}
                    className="w-full py-3 px-4 rounded-xl bg-[#553BE2] hover:bg-[#4830cb] active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#553BE2]/30 transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-base">auto_awesome</span>
                    <span>View Saved Looks</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSavePopup(null)}
                    className="w-full py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 text-slate-300 hover:text-white font-semibold text-xs border border-white/10 transition-all cursor-pointer"
                  >
                    Continue Try-On
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setSavePopup(null)}
                  className="w-full py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white font-semibold text-xs border border-white/10 transition-all cursor-pointer"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
