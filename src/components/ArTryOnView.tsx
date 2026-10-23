import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { ScreenId } from '../types';
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
  selectedGarment: string;
  setSelectedGarment: (garment: string) => void;
  onCaptureImage?: (imageDataUrl: string) => void;
  initialGarmentImage?: string | null;
}

interface GarmentItem {
  id: string;
  name: string;
  category: string;
  img: string;
  file?: File;
}

// -------------------------------------------------------------
// Isolated, Hardware-Accelerated Video Layer
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
      {/* Real-time transformed video element with zero CSS filters */}
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
        className={`absolute inset-0 w-full h-full object-cover object-center pointer-events-none transition-opacity duration-200 ${
          showVideo ? 'opacity-100 z-10' : 'opacity-0 z-0'
        }`}
      />

      {/* Fallback portrait model when live camera is off */}
      {!showVideo && (
        <img
          alt="AR Try-On Portrait Model"
          className="absolute inset-0 w-full h-full object-cover object-center z-0 pointer-events-none"
          referrerPolicy="no-referrer"
          src={fallbackImg}
        />
      )}

      {/* Zero-invalidation hardware-accelerated lighting overlay (never touches video buffer) */}
      {lighting && (
        <div className="absolute inset-0 bg-white/10 mix-blend-screen pointer-events-none z-15" />
      )}

      {/* AR holographic target framing overlay */}
      <div className="absolute inset-x-8 top-20 bottom-32 border border-white/20 rounded-[32px] pointer-events-none z-20">
        <div className="absolute top-0 left-0 w-10 h-10 border-t-2 border-l-2 border-white rounded-tl-[32px]" />
        <div className="absolute top-0 right-0 w-10 h-10 border-t-2 border-r-2 border-white rounded-tr-[32px]" />
        <div className="absolute bottom-0 left-0 w-10 h-10 border-b-2 border-l-2 border-white rounded-bl-[32px]" />
        <div className="absolute bottom-0 right-0 w-10 h-10 border-b-2 border-r-2 border-white rounded-br-[32px]" />
      </div>
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
}) => {
  const [activeCategory, setActiveCategory] = useState<'outfit' | 'tops' | 'bottoms' | 'shoes'>('outfit');
  const [flash, setFlash] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isVideoLive, setIsVideoLive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [statusText, setStatusText] = useState('Camera Ready');
  const [lighting, setLighting] = useState(false);
  const [showFitInfo, setShowFitInfo] = useState(false);
  const [garmentsList, setGarmentsList] = useState<GarmentItem[]>(DEFAULT_GARMENTS);

  const videoRef = useRef<HTMLVideoElement>(null);
  const sessionRef = useRef<LiveTryOnSessionHandle | null>(null);
  const isConnectingRef = useRef(false);
  const isLiveRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeModelBg = DEFAULT_MODELS[selectedGarment] || DEFAULT_MODELS['Lavender'];
  const activeGarmentObj = garmentsList.find((g) => g.id === selectedGarment) || garmentsList[0];

  // Stop session cleanly
  const stopLiveSession = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.stop();
      sessionRef.current = null;
    }
    isLiveRef.current = false;
    isConnectingRef.current = false;
    setIsCameraActive(false);
    setIsVideoLive(false);
    setIsConnecting(false);
    setStatusText('Camera Ready');
  }, []);

  // Clean up session strictly on unmount
  useEffect(() => {
    return () => {
      if (sessionRef.current) {
        sessionRef.current.stop();
        sessionRef.current = null;
      }
    };
  }, []);

  // Start live session on-demand
  const startLiveSession = useCallback(async () => {
    if (isConnectingRef.current || isLiveRef.current) return;
    if (!videoRef.current) return;

    isConnectingRef.current = true;
    setIsConnecting(true);
    setStatusText('Connecting AI...');

    const garmentSource = initialGarmentImage || activeGarmentObj?.file || activeGarmentObj?.img;

    try {
      const handle = await startLiveTryOnSession({
        videoElement: videoRef.current,
        garmentImage: garmentSource,
        facingMode: 'user',
        onLocalStream: () => {
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
        },
        onError: (err) => {
          console.warn('Live session error:', err);
          stopLiveSession();
        },
      });

      sessionRef.current = handle;
    } catch (err: any) {
      console.error('Could not start live session:', err);
      stopLiveSession();
      setStatusText(err?.message || 'Connection failed');
    }
  }, [activeGarmentObj, initialGarmentImage, stopLiveSession]);

  // Garment selection: instant dispatch via cached blob/file
  const handleGarmentClick = (item: GarmentItem) => {
    setSelectedGarment(item.id);
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

    // Warm up the compression in background
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

  const handleExit = () => {
    stopLiveSession();
    onNavigate('home');
  };

  const handleConsult = () => {
    stopLiveSession();
    onNavigate('chat');
  };

  return (
    <div className="absolute inset-0 z-0 h-full overflow-hidden bg-slate-950 rounded-3xl select-none">
      {/* Simulated camera flash */}
      {flash && (
        <div className="absolute inset-0 bg-white z-50 animate-ping opacity-100 pointer-events-none" />
      )}

      {/* Hidden file input for custom dress upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleCustomUpload}
      />

      {/* Dedicated, hardware-accelerated video layer */}
      <LiveTryOnViewport
        videoRef={videoRef}
        isCameraActive={isCameraActive}
        isVideoLive={isVideoLive}
        lighting={lighting}
        fallbackImg={activeModelBg}
      />

      {/* Top Status & AI Indicator Pill */}
      <div className="absolute top-4 inset-x-0 flex justify-center z-30 pointer-events-none">
        <div className="bg-[#131426]/90 border border-white/15 px-3.5 py-1.5 rounded-full flex items-center gap-2 shadow-lg backdrop-blur-sm pointer-events-auto">
          <span
            className={`w-2 h-2 rounded-full ${
              isVideoLive
                ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                : isConnecting
                ? 'bg-amber-400 animate-ping'
                : 'bg-slate-400'
            }`}
          />
          <span className="text-[11px] font-semibold text-slate-200 tracking-wide">
            {statusText}
          </span>
        </div>
      </div>

      {/* Start Camera on-demand overlay button (only shown when camera is off) */}
      {!isVideoLive && (
        <div className="absolute inset-x-0 bottom-44 z-20 flex justify-center pointer-events-auto">
          <button
            onClick={startLiveSession}
            disabled={isConnecting}
            className="bg-[#131426]/90 hover:bg-[#553BE2] border border-white/20 text-white rounded-full px-5 py-2.5 text-xs font-semibold flex items-center gap-2.5 shadow-xl transition-colors active:scale-95 disabled:opacity-50"
          >
            {isConnecting ? (
              <>
                <span className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                <span>Connecting AI...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-base text-[#A594FD]">videocam</span>
                <span>Try On Live (Camera)</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Modern, GPU-Light Match Pill */}
      <div className="absolute top-16 right-5 z-20 pointer-events-auto">
        <div className="bg-[#131426]/90 rounded-2xl px-3 py-1.5 flex items-center gap-1.5 shadow-lg border border-[#ECE7FF]/20">
          <span className="material-symbols-outlined text-[#A594FD] text-sm">auto_awesome</span>
          <span className="text-white font-bold text-xs">92%</span>
          <span className="text-slate-300 text-[10px] uppercase tracking-wider">Match</span>
        </div>
      </div>

      {/* AI Fit tooltip popover */}
      {showFitInfo && (
        <div className="absolute top-28 right-5 z-30 bg-[#131426]/95 border border-white/20 rounded-2xl p-3 max-w-[200px] text-white shadow-2xl pointer-events-auto">
          <div className="text-[10px] font-bold text-[#A594FD] uppercase tracking-wider mb-0.5">Fit Analysis</div>
          <p className="text-[11px] leading-tight text-slate-200">
            Relaxed street silhouette. Fabric adapts smoothly to posture and motion.
          </p>
        </div>
      )}

      {/* Left side category selectors (floating bar) */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2 z-20 pointer-events-auto">
        <div className="bg-[#131426]/90 rounded-full py-4 px-2 flex flex-col space-y-4 shadow-xl border border-white/10 text-slate-300">
          <button
            onClick={() => setActiveCategory('outfit')}
            className={`flex flex-col items-center space-y-0.5 w-10 transition-colors ${
              activeCategory === 'outfit' ? 'text-[#ECE7FF]' : 'hover:text-white'
            }`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                activeCategory === 'outfit' ? 'bg-[#553BE2] text-white shadow-md' : ''
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">checkroom</span>
            </div>
            <span className="text-[9px] font-medium font-sans">Outfits</span>
          </button>

          <button
            onClick={() => setActiveCategory('tops')}
            className={`flex flex-col items-center space-y-0.5 w-10 transition-colors ${
              activeCategory === 'tops' ? 'text-[#ECE7FF]' : 'hover:text-white'
            }`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                activeCategory === 'tops' ? 'bg-[#553BE2] text-white shadow-md' : ''
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">apparel</span>
            </div>
            <span className="text-[9px] font-medium font-sans">Tops</span>
          </button>

          <button
            onClick={() => setActiveCategory('bottoms')}
            className={`flex flex-col items-center space-y-0.5 w-10 transition-colors ${
              activeCategory === 'bottoms' ? 'text-[#ECE7FF]' : 'hover:text-white'
            }`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                activeCategory === 'bottoms' ? 'bg-[#553BE2] text-white shadow-md' : ''
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">styler</span>
            </div>
            <span className="text-[9px] font-medium font-sans">Bottoms</span>
          </button>

          <button
            onClick={() => setActiveCategory('shoes')}
            className={`flex flex-col items-center space-y-0.5 w-10 transition-colors ${
              activeCategory === 'shoes' ? 'text-[#ECE7FF]' : 'hover:text-white'
            }`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                activeCategory === 'shoes' ? 'bg-[#553BE2] text-white shadow-md' : ''
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">directions_walk</span>
            </div>
            <span className="text-[9px] font-medium font-sans">Shoes</span>
          </button>
        </div>
      </div>

      {/* Right side options: Camera Toggle, Flip, light, Fit (floating bar) */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 z-20 pointer-events-auto">
        <div className="bg-[#131426]/90 rounded-full py-4 px-2 flex flex-col space-y-4 shadow-xl border border-white/10 text-slate-300">
          <button
            onClick={handleToggleCamera}
            className={`flex flex-col items-center space-y-0.5 w-10 transition-colors ${
              isVideoLive ? 'text-[#A594FD]' : 'hover:text-white'
            }`}
            title={isVideoLive ? 'Stop Camera' : 'Start Camera'}
          >
            <span className="material-symbols-outlined text-lg">
              {isCameraActive ? 'videocam' : 'videocam_off'}
            </span>
            <span className="text-[9px]">{isCameraActive ? 'Live' : 'Cam'}</span>
          </button>

          <button
            onClick={handleFlip}
            disabled={!isVideoLive}
            className="flex flex-col items-center space-y-0.5 w-10 hover:text-white transition-colors disabled:opacity-30"
          >
            <span className="material-symbols-outlined text-lg">flip_camera_ios</span>
            <span className="text-[9px]">Flip</span>
          </button>

          <button
            onClick={() => setLighting(!lighting)}
            className={`flex flex-col items-center space-y-0.5 w-10 transition-colors ${
              lighting ? 'text-[#A594FD]' : 'hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-lg">light_mode</span>
            <span className="text-[9px]">Light</span>
          </button>

          <button
            onClick={() => setShowFitInfo(!showFitInfo)}
            className={`flex flex-col items-center space-y-0.5 w-10 transition-colors ${
              showFitInfo ? 'text-[#A594FD]' : 'hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-lg">man</span>
            <span className="text-[9px]">Fit</span>
          </button>
        </div>
      </div>

      {/* Dynamic bottom garment carousel & capture container */}
      <div className="absolute bottom-4 inset-x-0 z-30 px-4 flex flex-col items-center space-y-3 pointer-events-auto">
        {/* Swipe selection list + Custom Upload */}
        <div className="w-full flex items-center space-x-2.5 overflow-x-auto hide-scrollbar snap-x px-2">
          {/* Custom Garment Upload Tile */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="snap-center shrink-0 w-20 rounded-2xl p-2 flex flex-col items-center border border-dashed border-white/30 bg-[#131426]/80 hover:bg-[#131426] hover:border-[#553BE2] cursor-pointer transition-colors"
          >
            <div className="w-full aspect-square rounded-xl bg-white/5 mb-1.5 flex flex-col items-center justify-center text-slate-300 hover:text-white">
              <span className="material-symbols-outlined text-2xl text-[#A594FD]">add_photo_alternate</span>
            </div>
            <span className="text-white text-[9px] font-sans text-center leading-tight truncate w-full font-medium">
              Upload
            </span>
          </div>

          {/* Curated garments */}
          {garmentsList.map((g) => (
            <div
              key={g.id}
              onClick={() => handleGarmentClick(g)}
              className={`snap-center shrink-0 w-20 rounded-2xl p-2 flex flex-col items-center border transition-all duration-150 cursor-pointer ${
                selectedGarment === g.id
                  ? 'bg-[#553BE2]/40 border-[#553BE2] font-bold scale-105 shadow-md shadow-[#553BE2]/20'
                  : 'bg-[#131426]/80 border-white/10 opacity-75 hover:opacity-95'
              }`}
            >
              <div className="w-full aspect-square rounded-xl bg-slate-900 mb-1.5 overflow-hidden flex items-center justify-center relative">
                <img
                  alt={g.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                  src={g.img}
                />
                {selectedGarment === g.id && (
                  <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[#553BE2] text-white flex items-center justify-center border border-white">
                    <span className="material-symbols-outlined text-[10px] font-bold leading-none">check</span>
                  </div>
                )}
              </div>
              <span className="text-white text-[9px] font-sans text-center leading-tight truncate w-full">{g.name}</span>
            </div>
          ))}
        </div>

        {/* Shutter capture bar */}
        <div className="bg-[#131426]/95 rounded-full w-full max-w-sm flex items-center justify-between px-6 py-2.5 border border-white/15 shadow-2xl">
          <button
            onClick={handleExit}
            className="flex items-center space-x-1 text-slate-300 hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined text-base">home</span>
            <span className="text-xs font-semibold">Exit</span>
          </button>

          {/* Shutter center button */}
          <button
            onClick={handleCapture}
            className="w-13 h-13 rounded-full bg-[#553BE2] flex items-center justify-center shadow-[0_0_15px_rgba(85,59,226,0.5)] border-2 border-white -mt-5 hover:scale-105 active:scale-95 transition-transform"
          >
            <span className="material-symbols-outlined text-white text-2xl leading-none">photo_camera</span>
          </button>

          <button
            onClick={handleConsult}
            className="flex items-center space-x-1 text-slate-300 hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined text-base">chat</span>
            <span className="text-xs font-semibold">Consult</span>
          </button>
        </div>
      </div>
    </div>
  );
};
