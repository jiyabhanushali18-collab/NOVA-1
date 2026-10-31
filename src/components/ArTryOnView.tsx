import { useI18n } from '../i18n';
import React, { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react';
import { ProductItem, ScreenId } from '../types';
import { analytics } from '../services/analyticsService';
import { useBackHandler } from '../services/backButtonService';
import { MinimalColorSelector } from './MinimalColorSelector';
import {
  getProductColorOptions,
  getGarmentColorImage,
  getGarmentColorModelBg,
  GarmentColorOption,
} from '../utils/arTryOnColors';
import { normalizeColorKey } from '../utils/colors';
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
  DEFAULT_MODELS,
  prepareGarmentForLiveTryOn,
  acquireCameraStream,
  applyTrackExposure,
  isHardwareExposureSupported,
  getCameraDevices,
  invalidateLiveTryOnToken,
} from '../services/liveTryOnService';
import {
  PersonDetectionResult,
  startPersonDetection,
} from '../services/personDetectionService';

export type ArTryOnState =
  | 'idle'
  | 'initializing'
  | 'camera_ready'
  | 'processing'
  | 'success'
  | 'retryable_error'
  | 'configuration_error'
  | 'cancelled';

interface ArTryOnViewProps {
  onNavigate: (screen: ScreenId, opts?: { productId?: string; product?: ProductItem }) => void;
  onBack?: () => void;
  selectedGarment: string;
  setSelectedGarment: (garment: string) => void;
  selectedColor?: string;
  setSelectedColor?: (color: string) => void;
  onSelectProductId?: (productId: string) => void;
  onCaptureImage?: (imageDataUrl: string, isLiveTryOn: boolean) => void;
  onTryOnSuccess?: (garment: { id: string; productId?: string; name: string; imageUrl: string; color?: string; variantId?: string }) => void;
  initialGarmentImage?: string | null;
  isDarkMode?: boolean;
  userId?: string;
  userEmail?: string;
  userName?: string;
  products: ProductItem[];
  productsLoading: boolean;
  productsError: string | null;
  wishlist: string[];
  onToggleWishlist: (productId: string) => void;
}

interface GarmentItem {
  id: string;
  productId?: string;
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
  garmentImg?: string;
  facingMode?: 'user' | 'environment';
  brightness?: number;
  isFlipping?: boolean;
  personDetection?: PersonDetectionResult | null;
}

const LiveTryOnViewport = memo<LiveTryOnViewportProps>(({
  videoRef,
  isCameraActive,
  isVideoLive,
  lighting,
  fallbackImg,
  garmentImg,
  facingMode = 'user',
  brightness = 0,
  isFlipping = false,
  personDetection,
}) => {
  const showVideo = isCameraActive || isVideoLive;
  const [imgError, setImgError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(fallbackImg);

  useEffect(() => {
    setCurrentSrc(fallbackImg);
    setImgError(false);
  }, [fallbackImg]);

  const handleImgError = () => {
    if (garmentImg && currentSrc !== garmentImg) {
      setCurrentSrc(garmentImg);
    } else {
      setImgError(true);
    }
  };

  const effectiveBrightness = 100 + brightness;
  const effectiveContrast = 100 + Math.round(Math.abs(brightness) * 0.15);

  return (
    <div
      className="absolute inset-0 overflow-hidden bg-slate-950 select-none pointer-events-none"
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
          transform: facingMode === 'user' ? 'scaleX(-1) translateZ(0)' : 'translateZ(0)',
          filter: `brightness(${effectiveBrightness}%) contrast(${effectiveContrast}%)`,
          willChange: 'transform, filter',
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
          transition: 'filter 0.25s ease-out',
        }}
        className={`absolute inset-0 w-full h-full object-cover object-top pointer-events-none transition-opacity duration-200 ${
          showVideo ? 'opacity-100 z-10' : 'opacity-0 z-0'
        }`}
      />

      {/* High-visibility portrait model when live stream is off */}
      {!showVideo && !imgError && (
        <img
          alt="AR Try-On Portrait Model"
          className="absolute inset-0 w-full h-full object-cover object-top z-0 pointer-events-none"
          referrerPolicy="no-referrer"
          src={currentSrc}
          onError={handleImgError}
        />
      )}

      {/* Fallback stylized mannequin placeholder if static image is unavailable */}
      {!showVideo && imgError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-gradient-to-b from-[#161B30] via-[#0F1322] to-[#0A0D18] text-white">
          <div className="w-16 h-16 rounded-3xl bg-[#5D3DF2]/20 border border-[#5D3DF2]/40 flex items-center justify-center text-[#A594FD] mb-3 shadow-inner">
            <span className="material-symbols-outlined text-3xl">view_in_ar</span>
          </div>
          <span className="text-sm font-bold text-slate-100 tracking-tight">Virtual Fitting Mannequin</span>
          <span className="text-xs text-slate-400 mt-1">Tap Try On Live to view on camera</span>
        </div>
      )}

      {/* Dynamic Person Framing Reticle Indicator */}
      {showVideo && (
        <div className="absolute inset-3 rounded-2xl pointer-events-none z-20">
          <div
            className={`absolute top-0 left-0 w-7 h-7 border-t-2 border-l-2 rounded-tl-xl transition-all duration-300 ${
              personDetection?.detected ? 'border-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'border-white/70'
            }`}
          />
          <div
            className={`absolute top-0 right-0 w-7 h-7 border-t-2 border-r-2 rounded-tr-xl transition-all duration-300 ${
              personDetection?.detected ? 'border-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'border-white/70'
            }`}
          />
          <div
            className={`absolute bottom-0 left-0 w-7 h-7 border-b-2 border-l-2 rounded-bl-xl transition-all duration-300 ${
              personDetection?.detected ? 'border-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'border-white/70'
            }`}
          />
          <div
            className={`absolute bottom-0 right-0 w-7 h-7 border-b-2 border-r-2 rounded-br-xl transition-all duration-300 ${
              personDetection?.detected ? 'border-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'border-white/70'
            }`}
          />
        </div>
      )}

      {/* Person Detection Real-Time Guidance Pill */}
      {showVideo && personDetection && (
        <div className="absolute top-11 inset-x-0 flex justify-center z-25 pointer-events-none">
          <div
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 backdrop-blur-md border shadow-sm transition-all duration-300 ${
              personDetection.detected
                ? 'bg-emerald-950/85 border-emerald-400/40 text-emerald-300'
                : 'bg-[#111322]/85 border-white/15 text-slate-300'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                personDetection.detected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <span>{personDetection.label}</span>
          </div>
        </div>
      )}

      {/* Camera Switching Spinner Overlay */}
      {isFlipping && (
        <div className="absolute inset-0 bg-[#0B0C15]/75 backdrop-blur-sm z-30 flex flex-col items-center justify-center gap-2 pointer-events-none">
          <span className="material-symbols-outlined text-3xl text-[#A594FD] animate-spin">sync</span>
          <span className="text-xs font-semibold text-slate-200">Switching camera...</span>
        </div>
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
  selectedColor: selectedColorProp,
  setSelectedColor: setSelectedColorProp,
  onSelectProductId,
  onCaptureImage,
  onTryOnSuccess,
  initialGarmentImage,
  isDarkMode = true,
  userId,
  userEmail,
  userName,
  products,
  productsLoading,
  productsError,
  wishlist,
  onToggleWishlist,
}) => {
  const { t } = useI18n();
  const [connectionState, setConnectionState] = useState<ArTryOnState>('idle');
  const [isSavingLook, setIsSavingLook] = useState(false);
  const [flash, setFlash] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isVideoLive, setIsVideoLive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [statusText, setStatusText] = useState('Camera ready');
  const [lighting, setLighting] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const facingModeRef = useRef(facingMode);
  facingModeRef.current = facingMode;
  const [isFlipping, setIsFlipping] = useState(false);
  const [showLightingPanel, setShowLightingPanel] = useState(false);
  const [brightness, setBrightness] = useState(0);
  const [isAutoLighting, setIsAutoLighting] = useState(false);
  const isAutoLightingRef = useRef(false);
  isAutoLightingRef.current = isAutoLighting;
  const [isHardwareExposure, setIsHardwareExposure] = useState(false);
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(false);
  const [personDetection, setPersonDetection] = useState<PersonDetectionResult | null>(null);
  const [availableCameras, setAvailableCameras] = useState<{ front: number; rear: number; total: number }>({ front: 1, rear: 1, total: 2 });
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [savePopup, setSavePopup] = useState<{
    isOpen: boolean;
    message: string;
    previewUrl?: string;
    isError?: boolean;
  } | null>(null);
  const [uploadedGarments, setUploadedGarments] = useState<GarmentItem[]>([]);

  // Priority 1: Dismiss open overlays and popups within AR Try-On
  const hasArOverlay = Boolean(savePopup?.isOpen || showLightingPanel || isPreviewExpanded);
  useBackHandler('ar-tryon-overlays', () => {
    if (savePopup?.isOpen) {
      setSavePopup(null);
      return true;
    }
    if (showLightingPanel) {
      setShowLightingPanel(false);
      return true;
    }
    if (isPreviewExpanded) {
      setIsPreviewExpanded(false);
      return true;
    }
    return false;
  }, 100, hasArOverlay);

  // Priority 3: When Back is pressed at root of AR Try-On, safely stop camera & WebRTC and navigate to Home
  useBackHandler('ar-tryon-root-exit', () => {
    stopLiveSession(true);
    onNavigate('home');
    return true;
  }, 20, true);
  const catalogGarments: GarmentItem[] = products
    .filter((product) => product.imageUrl)
    .sort((first, second) => Number(wishlist.includes(second.id)) - Number(wishlist.includes(first.id)))
    .map((product) => ({
      id: product.id,
      productId: product.id,
      name: product.name,
      category: product.category,
      img: product.imageUrl,
    }));
  const garmentsList = [...catalogGarments, ...uploadedGarments];

  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!isPreviewExpanded) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsPreviewExpanded(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPreviewExpanded]);
  const sessionRef = useRef<LiveTryOnSessionHandle | null>(null);
  const localPreviewStreamRef = useRef<MediaStream | null>(null);
  const isConnectingRef = useRef(false);
  const isLiveRef = useRef(false);
  const pendingConnectControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sessionStartTimeRef = useRef<number | null>(null);
  const lastActionTimeRef = useRef<number>(0);

  // Active product item matching selected garment (if in catalog)
  const selectedProduct = useMemo(() => {
    return products.find((p) => p.id === selectedGarment || p.productId === selectedGarment);
  }, [products, selectedGarment]);

  // Available in-stock colour options for the selected product (only if it has variants/colours)
  const availableColorVariants = useMemo(() => {
    return getProductColorOptions(selectedProduct);
  }, [selectedProduct]);

  // Internal color state fallback if selectedColorProp is not provided
  const [internalSelectedColor, setInternalSelectedColor] = useState<string>(selectedColorProp || 'Lavender');
  const effectiveColorName = selectedColorProp !== undefined ? selectedColorProp : internalSelectedColor;

  // Keep colour synchronized: when switching garments or when variants change,
  // ensure the selected colour exists in the garment's options (or default to first available)
  useEffect(() => {
    if (availableColorVariants.length > 0) {
      const hasMatch = availableColorVariants.some(
        (c) => normalizeColorKey(c.name) === normalizeColorKey(effectiveColorName)
      );
      if (!hasMatch) {
        const defaultColor = availableColorVariants[0].name;
        setInternalSelectedColor(defaultColor);
        setSelectedColorProp?.(defaultColor);
      }
    }
  }, [availableColorVariants, effectiveColorName, setSelectedColorProp]);

  const activeGarmentObj = garmentsList.find((g) => g.id === selectedGarment) || garmentsList[0];

  // Effective garment image URL respecting the selected colour variant
  const effectiveGarmentImage = useMemo(() => {
    if (selectedProduct && effectiveColorName) {
      return getGarmentColorImage(selectedProduct, effectiveColorName) || '';
    }
    return activeGarmentObj?.file || activeGarmentObj?.img || initialGarmentImage || '';
  }, [selectedProduct, effectiveColorName, activeGarmentObj, initialGarmentImage]);

  // Model background matching selected colour if known, otherwise default model
  const effectiveModelBg = useMemo(() => {
    const colorModelBg = getGarmentColorModelBg(effectiveColorName);
    return colorModelBg || DEFAULT_MODELS[selectedGarment] || DEFAULT_MODELS[effectiveColorName] || DEFAULT_MODELS['Lavender'];
  }, [effectiveColorName, selectedGarment]);

  useEffect(() => {
    if (
      !productsLoading
      && catalogGarments.length > 0
      && !garmentsList.some((garment) => garment.id === selectedGarment)
    ) {
      setSelectedGarment(catalogGarments[0].id);
    }
  }, [productsLoading, products, selectedGarment, uploadedGarments, setSelectedGarment]);

  // Stable references to eliminate stale closures in async callbacks
  const selectedGarmentRef = useRef(selectedGarment);
  selectedGarmentRef.current = selectedGarment;
  const activeGarmentObjRef = useRef(activeGarmentObj);
  activeGarmentObjRef.current = activeGarmentObj;
  const effectiveGarmentImageRef = useRef(effectiveGarmentImage);
  effectiveGarmentImageRef.current = effectiveGarmentImage;
  const effectiveColorNameRef = useRef(effectiveColorName);
  effectiveColorNameRef.current = effectiveColorName;
  const initialGarmentImageRef = useRef(initialGarmentImage);
  initialGarmentImageRef.current = initialGarmentImage;
  const garmentsListRef = useRef(garmentsList);
  garmentsListRef.current = garmentsList;

  useEffect(() => {
    if (selectedGarment && activeGarmentObj) {
      analytics.trackProductImpression({ id: selectedGarment, name: activeGarmentObj.name }, 'ar_tryon');
    }
  }, [selectedGarment, activeGarmentObj?.name]);

  // Stop session cleanly (can be called by user cancellation or session end)
  const stopLiveSession = useCallback((isUserCancel = false) => {
    const pendingConnect = pendingConnectControllerRef.current;
    if (pendingConnect) {
      pendingConnect.abort();
      pendingConnectControllerRef.current = null;
    }
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
      analytics.trackArTryOnEnded(selectedGarmentRef.current, elapsed);
    }
    isLiveRef.current = false;
    isConnectingRef.current = false;
    setIsCameraActive(false);
    setIsVideoLive(false);
    setIsConnecting(false);

    if (isUserCancel) {
      setConnectionState('cancelled');
      setStatusText(t('arTryOn.interrupted'));
    } else {
      setConnectionState('idle');
      setStatusText(t('arTryOn.ready'));
    }
  }, [t]);

  // Clean up session strictly on unmount
  useEffect(() => {
    return () => {
      pendingConnectControllerRef.current?.abort();
      pendingConnectControllerRef.current = null;
      if (sessionRef.current) {
        sessionRef.current.stop();
        sessionRef.current = null;
      } else if (localPreviewStreamRef.current) {
        localPreviewStreamRef.current.getTracks().forEach((track) => track.stop());
        localPreviewStreamRef.current = null;
      }
    };
  }, []);

  // Initialize camera preview stream on demand or on mount
  const initCameraPreview = useCallback(async (targetFacing: 'user' | 'environment') => {
    if (isLiveRef.current || isConnectingRef.current) return;
    try {
      if (localPreviewStreamRef.current) {
        localPreviewStreamRef.current.getTracks().forEach((track) => track.stop());
        localPreviewStreamRef.current = null;
      }
      const stream = await acquireCameraStream(targetFacing, 30);
      localPreviewStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch((playErr) => console.warn('Preview play error:', playErr));
      }
      setIsCameraActive(true);
      setFacingMode(targetFacing);
      setStatusText(t('arTryOn.cameraReady'));
      const videoTrack = stream.getVideoTracks()[0];
      setIsHardwareExposure(isHardwareExposureSupported(videoTrack));
    } catch (err: any) {
      console.warn('Camera preview init error:', err);
      setIsCameraActive(false);
      if (err?.name === 'NotAllowedError') {
        setStatusText(t('arTryOn.cameraDenied'));
      }
    }
  }, [t]);

  // Initialize camera preview immediately when AR Try-On screen opens
  useEffect(() => {
    initCameraPreview('user');
    getCameraDevices().then((info) => {
      setAvailableCameras({ front: info.frontCameras.length, rear: info.rearCameras.length, total: info.total });
    });
  }, [initCameraPreview]);

  // Dynamic real-time person detection loop
  useEffect(() => {
    if (!videoRef.current || (!isCameraActive && !isVideoLive)) {
      setPersonDetection(null);
      return;
    }

    const unbind = startPersonDetection(videoRef.current, facingMode, (result) => {
      setPersonDetection(result);
      // Auto-lighting adjustment if active
      if (isAutoLightingRef.current) {
        if (result.averageLuma < 70) {
          setBrightness((prev) => Math.min(30, prev + 2));
        } else if (result.averageLuma > 185) {
          setBrightness((prev) => Math.max(-25, prev - 2));
        }
      }
    });

    return () => {
      unbind();
    };
  }, [facingMode, isCameraActive, isVideoLive]);

  // Start live session on-demand (Single-flight connection with lifecycle state management)
  const startLiveSession = useCallback(async () => {
    if (isConnectingRef.current || isLiveRef.current || pendingConnectControllerRef.current) return;
    if (!videoRef.current) return;

    if (connectionState === 'retryable_error') {
      invalidateLiveTryOnToken();
    }

    if (localPreviewStreamRef.current) {
      localPreviewStreamRef.current.getTracks().forEach((track) => track.stop());
      localPreviewStreamRef.current = null;
      videoRef.current.srcObject = null;
      setIsCameraActive(false);
    }

    isConnectingRef.current = true;
    const connectController = new AbortController();
    pendingConnectControllerRef.current = connectController;
    setIsConnecting(true);
    setConnectionState('initializing');
    setStatusText(t('arTryOn.preparing'));
    sessionStartTimeRef.current = Date.now();
    const currentGarment = activeGarmentObjRef.current;
    const currentGarmentId = selectedGarmentRef.current;
    analytics.trackArTryOnStarted(currentGarmentId, currentGarment?.name, 'ar_tryon');

    const garmentSource = initialGarmentImageRef.current || effectiveGarmentImageRef.current || currentGarment?.file || currentGarment?.img;

    try {
      const handle = await startLiveTryOnSession({
        videoElement: videoRef.current,
        garmentImage: garmentSource,
        facingMode: facingModeRef.current,
        signal: connectController.signal,
        onLocalStream: (stream) => {
          localPreviewStreamRef.current = stream;
          setIsCameraActive(true);
          setStatusText(t('arTryOn.cameraReady'));
          const videoTrack = stream.getVideoTracks()[0];
          setIsHardwareExposure(isHardwareExposureSupported(videoTrack));
        },
        onFacingModeChange: (newFacing) => {
          setFacingMode(newFacing);
        },
        onStatusChange: (status) => {
          if (!isLiveRef.current && (status.includes('Connecting to AI') || status.includes('Applying garment') || status.includes('session'))) {
            setConnectionState('processing');
          }
          setStatusText(status);
        },
        onConnected: () => {
          isLiveRef.current = true;
          isConnectingRef.current = false;
          setIsVideoLive(true);
          setIsConnecting(false);
          setConnectionState('success');
          setStatusText(t('arTryOn.liveActive'));
          const durationMs = sessionStartTimeRef.current ? Date.now() - sessionStartTimeRef.current : undefined;
          analytics.trackArTryOnSucceeded(selectedGarmentRef.current, activeGarmentObjRef.current?.name, durationMs);
          if (activeGarmentObjRef.current) {
            const activeColor = effectiveColorNameRef.current;
            const finalImg = typeof effectiveGarmentImageRef.current === 'string' && !effectiveGarmentImageRef.current.startsWith('blob:')
              ? effectiveGarmentImageRef.current
              : (activeGarmentObjRef.current.img.startsWith('blob:') ? '' : activeGarmentObjRef.current.img);
            onTryOnSuccess?.({
              id: activeGarmentObjRef.current.id,
              productId: activeGarmentObjRef.current.productId,
              name: activeColor ? `${activeGarmentObjRef.current.name} (${activeColor})` : activeGarmentObjRef.current.name,
              imageUrl: finalImg,
              color: activeColor,
            });
          }
        },
        onError: (err) => {
          console.warn('Live session error:', err);
          analytics.trackArTryOnFailed(selectedGarmentRef.current, 'stream_error', activeGarmentObjRef.current?.name);
          stopLiveSession(false);
          setConnectionState('retryable_error');
          const errMsg = typeof err?.message === 'string' ? err.message : '';
          const displayErr = errMsg.toLowerCase().includes('stale connect attempt')
            ? 'Connection sync delay. Tap Retry.'
            : errMsg || 'AI session interrupted. Tap Retry to reconnect.';
          setStatusText(displayErr);
        },
      });

      if (connectController.signal.aborted) {
        handle.stop();
        return;
      }
      sessionRef.current = handle;
    } catch (err: any) {
      const errorMsg = typeof err?.message === 'string' ? err.message : String(err || '');
      const isExplicitAbort = connectController.signal.aborted;
      const isStale = errorMsg.toLowerCase().includes('stale connect attempt');

      // If superseded by a newer connection attempt, let the new attempt continue cleanly
      if (pendingConnectControllerRef.current && pendingConnectControllerRef.current !== connectController) {
        return;
      }

      if (isExplicitAbort) {
        setConnectionState('cancelled');
        setStatusText(t('arTryOn.interrupted'));
        return;
      }

      console.error('Could not start live session:', err);
      const isPermissionDenied = err?.name === 'NotAllowedError' || errorMsg.toLowerCase().includes('permission');
      const errorCategory = isPermissionDenied ? 'camera_permission_denied' : 'connection_failed';
      analytics.trackArTryOnFailed(selectedGarmentRef.current, errorCategory, activeGarmentObjRef.current?.name);

      if (isPermissionDenied) {
        setConnectionState('configuration_error');
        setStatusText(t('arTryOn.cameraDenied'));
      } else {
        setConnectionState('retryable_error');
        const rawMessage = typeof err?.message === 'string' && err.message.trim()
          ? err.message.trim()
          : typeof err?.error?.message === 'string' && err.error.message.trim()
          ? err.error.message.trim()
          : 'AI connection error';
        const sanitized = isStale
          ? 'Network sync delay. Tap Retry to connect.'
          : rawMessage.length > 90
          ? `${rawMessage.slice(0, 87)}...`
          : rawMessage;
        setStatusText(`${t('arTryOn.failed')}: ${sanitized}`);
      }
    } finally {
      if (pendingConnectControllerRef.current === connectController) {
        pendingConnectControllerRef.current = null;
      }
      isConnectingRef.current = false;
      setIsConnecting(false);
    }
  }, [onTryOnSuccess, stopLiveSession, t]);

  // Colour variant selection handler with live WebRTC Decart stream synchronization
  const handleColorSelect = useCallback((color: GarmentColorOption) => {
    setInternalSelectedColor(color.name);
    setSelectedColorProp?.(color.name);

    const newImg = selectedProduct
      ? getGarmentColorImage(selectedProduct, color.name)
      : color.imageUrl || activeGarmentObj?.img;
    if (sessionRef.current && isLiveRef.current && newImg) {
      sessionRef.current.setGarment(newImg).catch((err) => {
        console.warn('Real-time garment color update error:', err);
      });
    }
  }, [selectedProduct, activeGarmentObj?.img, setSelectedColorProp]);

  // Garment selection: instant dispatch via cached blob/file without tearing down camera stream
  const handleGarmentClick = (item: GarmentItem) => {
    const prev = selectedGarment;
    setSelectedGarment(item.id);
    if (onSelectProductId && (item.productId || item.id)) {
      onSelectProductId(item.productId || item.id);
    }

    let resolvedColor = effectiveColorName;
    if (prev !== item.id) {
      analytics.trackArTryOnProductChanged(item.id, prev);

      // Adapt colour selection to new garment's available variants
      const newProduct = products.find((p) => p.id === item.productId || p.id === item.id);
      const newColors = getProductColorOptions(newProduct);
      if (newColors.length > 0) {
        const hasCurrent = newColors.some(
          (c) => normalizeColorKey(c.name) === normalizeColorKey(effectiveColorName)
        );
        if (!hasCurrent) {
          resolvedColor = newColors[0].name;
          setInternalSelectedColor(resolvedColor);
          setSelectedColorProp?.(resolvedColor);
        }
      }
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('nova:tutorial:outfit_selected', { detail: { garmentId: item.id } }));
    }
    if (sessionRef.current && isLiveRef.current) {
      const newProduct = products.find((p) => p.id === item.productId || p.id === item.id);
      const variantImg = newProduct ? getGarmentColorImage(newProduct, resolvedColor) : undefined;
      const payload = item.file || variantImg || item.img;
      sessionRef.current.setGarment(payload).catch((err) => {
        console.warn('Garment update error:', err);
      });
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

    setUploadedGarments((prev) => [newGarment, ...prev]);
    setSelectedGarment(customId);
    if (onSelectProductId) {
      onSelectProductId(customId);
    }

    // Warm up compression in background
    prepareGarmentForLiveTryOn(file).catch(() => {});

    if (sessionRef.current && isLiveRef.current) {
      sessionRef.current.setGarment(file).catch(() => {});
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Primary Action Button (Try On Live / Cancel / Stop Live / Retry)
  const handlePrimaryAction = () => {
    const now = Date.now();
    // Guard against accidental double taps on mobile touchscreens (600ms debounce)
    if (now - lastActionTimeRef.current < 600) return;
    lastActionTimeRef.current = now;

    if (isConnectingRef.current || isConnecting || connectionState === 'initializing' || connectionState === 'processing') {
      // Cancel in-flight connection
      stopLiveSession(true);
    } else if (connectionState === 'success') {
      // Stop live stream
      stopLiveSession(false);
    } else {
      // 'idle', 'camera_ready', 'retryable_error', 'configuration_error', 'cancelled'
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('nova:tutorial:tryon_live_started'));
      }
      startLiveSession();
    }
  };

  // Backwards compatibility alias
  const handleToggleCamera = handlePrimaryAction;

  // Flip Camera - front and rear switching for both preview and live session
  const handleFlip = async () => {
    if (isFlipping) return;
    setIsFlipping(true);

    const nextFacing = facingMode === 'user' ? 'environment' : 'user';
    setToastMessage(nextFacing === 'environment' ? 'Switching to rear camera...' : 'Switching to front camera...');

    try {
      if (sessionRef.current && isLiveRef.current) {
        await sessionRef.current.flipCamera();
        setFacingMode(nextFacing);
      } else {
        await initCameraPreview(nextFacing);
      }

      setToastMessage(
        nextFacing === 'environment'
          ? 'Switched to rear camera (point at person)'
          : 'Switched to front camera (selfie)'
      );
      setTimeout(() => setToastMessage(null), 2500);
    } catch (error: any) {
      console.error('Camera flip error:', error);
      const errorName = error instanceof Error ? error.name : '';
      const message = errorName === 'CameraUnavailableError'
        || errorName === 'NotFoundError'
        || errorName === 'OverconstrainedError'
        ? 'This device does not have another available camera to switch to.'
        : errorName === 'NotAllowedError'
        ? 'Camera access was denied. Allow camera access in your browser settings and try again.'
        : 'Could not switch cameras. Check camera permissions and try again.';
      setToastMessage(message);
      setTimeout(() => setToastMessage(null), 3000);
    } finally {
      setIsFlipping(false);
    }
  };

  // Adjust display brightness & native hardware exposure
  const handleBrightnessChange = (val: number) => {
    setBrightness(val);
    setIsAutoLighting(false);
    const track = (localPreviewStreamRef.current || sessionRef.current?.localStream)?.getVideoTracks()[0];
    if (track && isHardwareExposure) {
      applyTrackExposure(track, val / 20).catch(() => {});
    }
  };

  // Reset brightness & exposure to default
  const handleResetLighting = () => {
    setBrightness(0);
    setIsAutoLighting(false);
    const track = (localPreviewStreamRef.current || sessionRef.current?.localStream)?.getVideoTracks()[0];
    if (track && isHardwareExposure) {
      applyTrackExposure(track, 0).catch(() => {});
    }
  };

  // Shutter capture handler
  const handleCapture = () => {
    setFlash(true);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('nova:tutorial:look_captured'));
    }

    if ((isCameraActive || isLiveRef.current) && videoRef.current) {
      const frame = captureVideoFrame(videoRef.current);
      if (frame && onCaptureImage) {
        onCaptureImage(frame, isLiveRef.current);
      }
    } else if (onCaptureImage) {
      onCaptureImage(effectiveModelBg, false);
    }

    const isTutorial = typeof window !== 'undefined' && (window as any).__nova_tutorial_active === 'ar-tryon';

    setTimeout(() => {
      setFlash(false);
      if (!isTutorial) {
        stopLiveSession();
        const activeProdId = activeGarmentObj?.productId || activeGarmentObj?.id || selectedGarment;
        onNavigate('tryon-result', activeProdId ? { productId: activeProdId } : undefined);
      }
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
        fallbackImageUrl: effectiveModelBg,
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
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('nova:tutorial:look_saved'));
        }
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
      <section data-tutorial-target="ar-camera-preview" className={`relative w-full overflow-hidden bg-slate-950 shadow-2xl group ${isPreviewExpanded ? 'fixed inset-0 z-[100] h-[100dvh] min-h-0 max-h-none rounded-none border-0' : 'aspect-[3/4] max-h-[44vh] min-h-[300px] rounded-[24px] border border-white/15'}`}>
        {/* Hardware-accelerated Video Layer */}
        <LiveTryOnViewport
          videoRef={videoRef}
          isCameraActive={isCameraActive}
          isVideoLive={isVideoLive}
          lighting={lighting}
          fallbackImg={effectiveModelBg}
          garmentImg={typeof effectiveGarmentImage === 'string' ? effectiveGarmentImage : activeGarmentObj?.img}
          facingMode={facingMode}
          brightness={brightness}
          isFlipping={isFlipping}
          personDetection={personDetection}
        />

        {/* Target Framing Brackets */}
        <div className="absolute inset-3 rounded-2xl pointer-events-none z-20">
          <div
            className={`absolute top-0 left-0 w-7 h-7 border-t-2 border-l-2 rounded-tl-xl transition-colors duration-300 ${
              personDetection?.detected ? 'border-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'border-white'
            }`}
          />
          <div
            className={`absolute top-0 right-0 w-7 h-7 border-t-2 border-r-2 rounded-tr-xl transition-colors duration-300 ${
              personDetection?.detected ? 'border-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'border-white'
            }`}
          />
          <div
            className={`absolute bottom-0 left-0 w-7 h-7 border-b-2 border-l-2 rounded-bl-xl transition-colors duration-300 ${
              personDetection?.detected ? 'border-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'border-white'
            }`}
          />
          <div
            className={`absolute bottom-0 right-0 w-7 h-7 border-b-2 border-r-2 rounded-br-xl transition-colors duration-300 ${
              personDetection?.detected ? 'border-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'border-white'
            }`}
          />
        </div>

        {/* Top Status Pill: Camera ready / Live status */}
        <button
          type="button"
          onClick={() => setIsPreviewExpanded((expanded) => !expanded)}
          className="absolute top-3 right-3 z-40 flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-[#111322]/85 text-white shadow-lg backdrop-blur-md transition-colors hover:bg-[#1C1F36] active:scale-95"
          title={isPreviewExpanded ? 'Exit full screen' : 'Full screen camera'}
          aria-label={isPreviewExpanded ? 'Exit full screen camera' : 'View camera full screen'}
        >
          <span className="material-symbols-outlined text-lg">{isPreviewExpanded ? 'fullscreen_exit' : 'fullscreen'}</span>
        </button>

        <div className="absolute top-3 inset-x-0 flex justify-center z-30 pointer-events-none">
          <div className="max-w-[calc(100%-1rem)] bg-[#111322]/85 border border-white/15 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-lg backdrop-blur-md">
            <span
              className={`w-2 h-2 rounded-full ${
                connectionState === 'success'
                  ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                  : connectionState === 'initializing' || connectionState === 'processing'
                  ? 'bg-amber-400 animate-ping'
                  : connectionState === 'retryable_error' || connectionState === 'configuration_error'
                  ? 'bg-rose-400'
                  : connectionState === 'camera_ready'
                  ? 'bg-cyan-400'
                  : connectionState === 'cancelled'
                  ? 'bg-amber-400'
                  : 'bg-slate-400'
              }`}
            />
            <span title={statusText} className="max-w-[70vw] truncate text-[11px] font-semibold text-slate-200 tracking-wide">
              {statusText}
            </span>
          </div>
        </div>

        {/* Interactive Lighting & Exposure Adjustment Panel */}
        {showLightingPanel && (
          <div className="absolute bottom-18 left-3 right-3 bg-[#111322]/95 backdrop-blur-xl border border-white/20 rounded-2xl p-3.5 shadow-2xl z-40 animate-in fade-in slide-in-from-bottom-2">
            {/* Panel Header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#FBBF24] text-base">lightbulb</span>
                <span className="text-xs font-bold text-white tracking-wide">
                  {t('arTryOn.adjustLighting') || 'Adjust Lighting'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#553BE2]/30 text-[#C4B5FD] border border-[#553BE2]/40">
                  {isHardwareExposure ? '⚡ Native Exposure' : '✨ Display Brightness'}
                </span>
                <button
                  type="button"
                  onClick={() => setShowLightingPanel(false)}
                  className="text-slate-400 hover:text-white p-0.5 rounded-lg active:scale-95 cursor-pointer"
                  title="Close"
                  aria-label="Close lighting panel"
                >
                  <span className="material-symbols-outlined text-sm leading-none">close</span>
                </button>
              </div>
            </div>

            {/* Brightness / Exposure Slider */}
            <div className="flex items-center gap-2.5 my-1.5">
              <span className="material-symbols-outlined text-xs text-slate-400">brightness_low</span>
              <input
                type="range"
                min={-40}
                max={40}
                step={1}
                value={brightness}
                onChange={(e) => handleBrightnessChange(Number(e.target.value))}
                className="flex-1 accent-[#553BE2] h-1.5 bg-slate-700/80 rounded-lg cursor-pointer"
                aria-label={t('arTryOn.adjustLighting') || 'Adjust Lighting'}
              />
              <span className="material-symbols-outlined text-xs text-slate-300">brightness_high</span>
              <span className="text-[11px] font-bold text-white min-w-[42px] text-right">
                {brightness === 0 ? 'Normal' : `${brightness > 0 ? '+' : ''}${brightness}`}
              </span>
            </div>

            {/* Quick Action Controls: Reset & Auto Mode */}
            <div className="flex items-center justify-between pt-2 border-t border-white/10 mt-2 text-[11px]">
              <button
                type="button"
                onClick={handleResetLighting}
                className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white font-medium flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                title={t('arTryOn.resetLighting') || 'Reset Lighting'}
              >
                <span className="material-symbols-outlined text-[13px]">restart_alt</span>
                <span>{t('arTryOn.resetLighting') || 'Reset'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsAutoLighting(!isAutoLighting)}
                className={`px-2.5 py-1 rounded-lg font-medium flex items-center gap-1 transition-all active:scale-95 cursor-pointer ${
                  isAutoLighting
                    ? 'bg-[#553BE2] text-white shadow-sm'
                    : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white'
                }`}
                title={t('arTryOn.autoLighting') || 'Auto Lighting'}
              >
                <span className="material-symbols-outlined text-[13px]">auto_fix_high</span>
                <span>Auto {isAutoLighting ? 'ON' : 'OFF'}</span>
              </button>
            </div>
          </div>
        )}

        {/* In-Camera Floating Bottom Controls: Flip, Shutter, Light */}
        <div data-tutorial-target="ar-camera-controls" className="absolute bottom-3.5 inset-x-0 flex justify-center items-center gap-5 z-30 px-4 pointer-events-auto">
          {/* Flip Camera */}
          <button
            type="button"
            data-tutorial-target="ar-flip-camera-btn"
            onClick={handleFlip}
            disabled={isFlipping}
            title={t('arTryOn.flipCamera')}
            aria-label={t('arTryOn.flipCamera')}
            className="w-10 h-10 rounded-full bg-[#111322]/85 hover:bg-[#1C1F36] backdrop-blur-md border border-white/15 text-white flex items-center justify-center shadow-lg active:scale-95 transition-all disabled:opacity-40 cursor-pointer relative"
          >
            <span className={`material-symbols-outlined text-base ${isFlipping ? 'animate-spin' : ''}`}>
              cameraswitch
            </span>
            {facingMode === 'environment' && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#553BE2] border border-white text-[8px] font-black flex items-center justify-center text-white shadow-sm">
                R
              </span>
            )}
          </button>

          {/* Center Large Shutter Button */}
          <button
            type="button"
            data-tutorial-target="ar-shutter-btn"
            onClick={handleCapture}
            title={t('arTryOn.takeSnapshot')}
            aria-label={t('arTryOn.takeSnapshot')}
            className="w-13 h-13 rounded-full bg-white flex items-center justify-center p-1 border-[3px] border-[#A594FD] shadow-[0_0_20px_rgba(165,148,253,0.6)] active:scale-90 hover:scale-105 transition-all cursor-pointer"
          >
            <div className="w-full h-full rounded-full bg-white shadow-inner" />
          </button>

          {/* Lighting Toggle / Slider Panel Opener */}
          <button
            type="button"
            data-tutorial-target="ar-lighting-btn"
            onClick={() => setShowLightingPanel((prev) => !prev)}
            title={t('arTryOn.adjustLighting') || 'Adjust Lighting'}
            aria-label={t('arTryOn.adjustLighting') || 'Adjust Lighting'}
            className={`w-10 h-10 rounded-full backdrop-blur-md border flex items-center justify-center shadow-lg active:scale-95 transition-all cursor-pointer ${
              showLightingPanel || brightness !== 0 || isAutoLighting
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
          <h2 className="text-base font-bold text-white">{t('arTryOn.selectOutfit')}</h2>
        </div>

        {/* Horizontal Carousel (Touch-smooth on phone) */}
        <div data-tutorial-target="ar-outfit-carousel" className="flex gap-2.5 overflow-x-auto hide-scrollbar touch-pan-x snap-x -mx-1 px-1 pb-1">
          {garmentsList.map((g, gIdx) => {
            const isSelected = selectedGarment === g.id;
            const productId = g.productId;
            const isWishlisted = productId ? wishlist.includes(productId) : false;
            return (
              <div
                key={g.id}
                data-tutorial-target={gIdx === 0 ? "ar-garment-item" : undefined}
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
                    src={isSelected && typeof effectiveGarmentImage === 'string' && effectiveGarmentImage ? effectiveGarmentImage : g.img}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover object-top transition-all duration-300"
                  />
                  {g.productId && (
                    <button
                      type="button"
                      aria-label={isWishlisted ? t('wishlist.remove') : t('wishlist.add')}
                      aria-pressed={isWishlisted}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (productId) onToggleWishlist(productId);
                      }}
                      className="absolute top-1 left-1 w-6 h-6 rounded-full bg-[#111322]/85 text-rose-400 flex items-center justify-center shadow-md"
                    >
                      <span
                        className="material-symbols-outlined text-sm leading-none"
                        style={{ fontVariationSettings: isWishlisted ? "'FILL' 1" : undefined }}
                      >
                        {isWishlisted ? 'favorite' : 'favorite_border'}
                      </span>
                    </button>
                  )}
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

          {garmentsList.length === 0 && (
            <p className="py-4 text-xs text-slate-400">
              {productsLoading ? t('common.loading') : productsError || t('showroom.noProducts')}
            </p>
          )}

          {/* Upload Card */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="snap-start shrink-0 w-[90px] rounded-2xl p-2 flex flex-col items-center justify-center border border-dashed border-white/20 bg-[#111322]/80 hover:bg-[#111322] hover:border-[#6D4AFF] cursor-pointer transition-all min-h-[104px]"
          >
            <div className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-[#A594FD] mb-1.5 border border-white/10">
              <span className="material-symbols-outlined text-xl">cloud_upload</span>
            </div>
            <span className="text-[10px] font-semibold text-slate-300 text-center">
              {t('arTryOn.upload')}
            </span>
          </div>
        </div>

        {/* Minimal Garment Colour Selector (Conditional: only shown when multiple colours exist) */}
        <MinimalColorSelector
          colors={availableColorVariants}
          selectedColorName={effectiveColorName}
          onSelectColor={handleColorSelect}
          className="mt-2.5"
        />
      </section>

      {/* 5. Action Buttons: Try On Live & Save Look */}
      <section className="grid grid-cols-2 gap-3 pt-0.5">
        <button
          type="button"
          data-tutorial-target="ar-tryon-live-btn"
          onClick={handlePrimaryAction}
          className={`w-full py-3.5 px-3 rounded-2xl active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer ${
            connectionState === 'initializing' || connectionState === 'processing'
              ? 'bg-[#5D3DF2] hover:bg-[#4E30E0] shadow-[#5D3DF2]/30'
              : connectionState === 'success'
              ? 'bg-[#E11D48] hover:bg-[#BE123C] shadow-rose-900/30'
              : connectionState === 'retryable_error'
              ? 'bg-[#6D28D9] hover:bg-[#5B21B6] shadow-purple-900/30'
              : 'bg-[#5D3DF2] hover:bg-[#4E30E0] shadow-[#5D3DF2]/30'
          }`}
        >
          {connectionState === 'initializing' || connectionState === 'processing' ? (
            <>
              <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
              <span>{t('arTryOn.connectingBtn')} ({t('arTryOn.cancelBtn')})</span>
            </>
          ) : connectionState === 'success' ? (
            <>
              <span className="material-symbols-outlined text-lg leading-none">videocam_off</span>
              <span>{t('arTryOn.stopLive')}</span>
            </>
          ) : connectionState === 'retryable_error' ? (
            <>
              <span className="material-symbols-outlined text-lg leading-none">refresh</span>
              <span>{t('arTryOn.retryBtn')}</span>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-lg leading-none">videocam</span>
              <span>{t('arTryOn.tryOnLive')}</span>
            </>
          )}
        </button>

        <button
          type="button"
          data-tutorial-target="ar-save-look-btn"
          onClick={handleSaveLook}
          disabled={isSavingLook}
          className="w-full py-3.5 px-3 rounded-2xl bg-[#111322] hover:bg-[#1A1C30] active:scale-95 border border-white/15 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm disabled:opacity-60"
        >
          {isSavingLook ? (
            <>
              <span className="w-3.5 h-3.5 rounded-full border-2 border-[#A594FD] border-t-transparent animate-spin" />
              <span>{t('arTryOn.savingLook')}</span>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-lg leading-none text-slate-300">bookmark_border</span>
              <span>{t('arTryOn.saveLook')}</span>
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
                {savePopup.isError ? t('arTryOn.savedFailTitle') : t('arTryOn.savedSuccessTitle')}
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
                    <span>{t('arTryOn.viewInProfile')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSavePopup(null)}
                    className="w-full py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 text-slate-300 hover:text-white font-semibold text-xs border border-white/10 transition-all cursor-pointer"
                  >
                    {t('arTryOn.keepTrying')}
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
