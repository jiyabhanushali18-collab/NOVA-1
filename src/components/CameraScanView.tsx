import React, { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource, CameraDirection } from '@capacitor/camera';
import { ProductItem, ScreenId } from '../types';
import { CameraScanResult, ScanImageSource, ScanProductResult, runCameraScan } from '../services/cameraScanService';
import { saveOutfitScan } from '../services/scanHistoryService';
import { useI18n } from '../i18n';

interface CameraScanViewProps {
  onNavigate: (screen: ScreenId, opts?: { productId?: string }) => void;
  onProductMatched?: (product: ProductItem, scanImageUrl?: string) => void;
  userGender?: string;
  userId?: string;
}

const previewImage = "https://lh3.googleusercontent.com/aida-public/AB6AXuD2NUEgLOUwK_v7hE4JYUKaRzKcCl9wvuCnJyQG-_L_crquoeM_bAtJHefPqGCbycHP0_cmZcffL8KrQVFWbiAp30-xINbUbzGsMCCxozik23wF1uzSgJ1_sj_lcs4xB7MGprn_Hudn4j5yf2R6VY8O1WnwnbX7QY6jBoXHHAiIOIpQlZIER60anAU9qeH3ck0N-dMYjnzmxGYOdgP2BVUZQ_VOtpLnzw-yJNVWv1mt7fhXmSrt5JwTbECdwP7a2rKSECAZQi4bd0Mw";
const createScanHistoryThumbnail = async (imageUrl: string): Promise<string> => {
  if (!imageUrl.startsWith('data:')) return imageUrl;

  const image = new Image();
  const imageReady = new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('Could not prepare scan image for history.'));
  });
  image.src = imageUrl;
  await imageReady;

  const maxDimension = 240;
  const scale = Math.min(maxDimension / image.naturalWidth, maxDimension / image.naturalHeight, 1);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not prepare scan image for history.');

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.55);
};

export const CameraScanView: React.FC<CameraScanViewProps> = ({ onNavigate, onProductMatched, userGender, userId }) => {
  const { t } = useI18n();
  const [scanning, setScanning] = useState(false);
  const [activeChip, setActiveChip] = useState<'clothing' | 'shoes' | 'accessories' | 'others'>('clothing');
  const [showSourceSheet, setShowSourceSheet] = useState(true);
  const [scanSource, setScanSource] = useState<ScanImageSource>('camera');
  const [scanMessage, setScanMessage] = useState(() => t('cameraScan.scanning'));
  const [scanResult, setScanResult] = useState<CameraScanResult | null>(null);
  const [activeItemIndex, setActiveItemIndex] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasSelectedImage, setHasSelectedImage] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!scanResult?.results?.length) {
      setActiveItemIndex(0);
      return;
    }

    const bestIndex = scanResult.results.reduce((selectedIndex, result, index, allResults) => {
      return result.score > allResults[selectedIndex].score ? index : selectedIndex;
    }, 0);

    setActiveItemIndex(bestIndex);
  }, [scanResult]);

  const currentResult: ScanProductResult | undefined = scanResult?.results[activeItemIndex] || scanResult?.results[0];
  const detectedImage = currentResult?.item.cropDataUrl;
  const displayProduct = currentResult?.product;
  const displayColor = currentResult?.item.features.dominantColor || displayProduct?.colors?.[0] || '';
  const secondaryColor = currentResult?.item.features.secondaryColor || displayProduct?.colors?.[1] || '';
  const clothingTypeLabel = currentResult?.item.features.garmentType || currentResult?.item.label || displayProduct?.name || t('cameraScan.unknownClothing');
  const categoryLabel = currentResult?.item.features.category || displayProduct?.category || t('cameraScan.apparel');
  const materialLabel = currentResult?.item.features.fabric || displayProduct?.fabric || displayProduct?.details?.[0] || 'Unknown Material';
  const patternLabel = currentResult?.item.features.pattern || displayProduct?.pattern || 'Detected';
  const matchReasons = currentResult ? (currentResult.recommendationReasons.length > 0 ? currentResult.recommendationReasons : ['Same category', 'Same color', 'Same silhouette']) : [];
  const pairingProduct = currentResult?.pairedWith[0];

  const isNative = Capacitor.getPlatform?.() !== 'web';

  const createFileFromDataUrl = async (dataUrl: string, fileName = 'camera-scan.jpg'): Promise<File> => {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    return new File([blob], fileName, { type: blob.type || 'image/jpeg' });
  };

  const openNativeCamera = async () => {
    try {
      const photo = await Camera.getPhoto({
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
        quality: 80,
        correctOrientation: true,
        direction: CameraDirection.Rear
      });

      if (!photo || !photo.dataUrl) {
        throw new Error('Camera photo unavailable');
      }

      const file = await createFileFromDataUrl(photo.dataUrl, 'camera-scan.jpg');
      await handleFileSelected('camera', file);
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'Unable to open camera.';
      setErrorMessage(message.includes('Permission') ? 'Camera permission denied. Please enable camera access.' : 'Could not open native camera. Using upload instead.');
      setShowSourceSheet(true);
    }
  };

  const openSource = (source: ScanImageSource) => {
    setScanSource(source);
    setShowSourceSheet(false);

    if (source === 'camera' && isNative) {
      openNativeCamera();
      return;
    }

    requestAnimationFrame(() => {
      if (source === 'camera') cameraInputRef.current?.click();
      else galleryInputRef.current?.click();
    });
  };

  const handleFileSelected = async (source: ScanImageSource, file?: File) => {
    if (!file) {
      setShowSourceSheet(true);
      return;
    }

    setScanSource(source);
    setErrorMessage(null);
    setScanResult(null);
    setHasSelectedImage(true);
    setScanning(true);
    setScanMessage(t('cameraScan.scanning'));

    try {
      const result = await runCameraScan(file, source, (message) => setScanMessage(message), userGender);
      setScanResult(result);
      if (result.results.length > 0) {
        const bestResult = result.results.reduce((best, entry) => (entry.score > best.score ? entry : best), result.results[0]);
        const actualScanImg = bestResult.item?.cropDataUrl || result.compressedImageUrl || bestResult.product?.imageUrl;
        if (!actualScanImg) throw new Error('The scan completed without an image to save.');
        onProductMatched?.(bestResult.product, bestResult.product?.imageUrl);

        try {
          saveOutfitScan({
            name: bestResult.product?.name || bestResult.title || 'Scanned Outfit',
            imageUrl: await createScanHistoryThumbnail(actualScanImg),
            score: typeof bestResult.score === 'number'
              ? (bestResult.score > 1 ? Number(bestResult.score.toFixed(1)) : Number((bestResult.score * 10).toFixed(1)))
              : undefined,
            category: bestResult.product?.category || bestResult.item?.label || 'Curated Outfit',
            colors: (bestResult.item?.features as any)?.palette?.map((p: any) => p.hex) || [bestResult.item?.features?.colorHex || '#553BE2', '#A594FD', '#131426'],
            matchedProductId: bestResult.product?.id,
            matchedProductName: bestResult.product?.name,
            matchedProductPrice: bestResult.product?.price,
            matchedProductImage: bestResult.product?.imageUrl,
          }, userId);
        } catch (error) {
          console.error('Scan finished, but recent scan history could not be saved:', error);
          setErrorMessage('Scan completed, but could not save it to Recent Scans. Check available browser storage and try again.');
        }
      } else if (result.compressedImageUrl) {
        try {
          saveOutfitScan({
            name: 'Custom Outfit Scan',
            imageUrl: await createScanHistoryThumbnail(result.compressedImageUrl),
            category: 'Personal Style',
            colors: ['#553BE2', '#A594FD', '#131426'],
          }, userId);
        } catch (error) {
          console.error('Scan finished, but recent scan history could not be saved:', error);
          setErrorMessage('Scan completed, but could not save it to Recent Scans. Check available browser storage and try again.');
        }
      }
    } catch (error) {
      const message = error instanceof Error && error.message.includes('fetch products')
        ? 'Unable to fetch products. Please try again.'
        : "Couldn't detect clothing. Try another image.";
      setErrorMessage(message);
    } finally {
      setScanning(false);
    }
  };

  const handleScanAgain = () => {
    setErrorMessage(null);
    setScanResult(null);
    setHasSelectedImage(false);
    if (scanSource === 'camera') cameraInputRef.current?.click();
    else galleryInputRef.current?.click();
  };

  const handleViewDetails = () => {
    const product = pairingProduct || displayProduct;
    if (!product) return;
    onProductMatched?.(product);
    onNavigate('product-details', { productId: product.id });
  };

  const goToPreviousItem = () => {
    if (!scanResult) return;
    setActiveItemIndex((index) => Math.max(0, index - 1));
  };

  const goToNextItem = () => {
    if (!scanResult) return;
    setActiveItemIndex((index) => Math.min(scanResult.results.length - 1, index + 1));
  };

  return (
    <div className="space-y-6">
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          handleFileSelected('camera', event.target.files?.[0]);
          event.currentTarget.value = '';
        }}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          handleFileSelected('gallery', event.target.files?.[0]);
          event.currentTarget.value = '';
        }}
      />

      {/* Upper Title Row & orbital AI Head */}
      <section className="relative pt-2">
        <div className="flex justify-between items-start">
          <div className="max-w-[70%]">
            <h1 className="text-2xl font-bold text-[#131426] leading-tight">{t('cameraScan.title')}</h1>
            <p className="text-xs text-[#5E667A] mt-1">
              {t('cameraScan.description')}
            </p>
          </div>
          
          {/* AI Floating Robot Head Sphere */}
          <div className="relative w-14 h-14 shrink-0 shadow-inner">
            <div className="absolute inset-0 bg-[#ECE7FF] rounded-full blur-md animate-pulse"></div>
            <div className="relative w-full h-full rounded-full bg-gradient-to-br from-[#131426] via-[#2B245A] to-[#553BE2] border-2 border-[#553BE2]/40 flex items-center justify-center overflow-hidden">
              <div className="flex gap-1.5 z-10">
                <div className="w-1.5 h-1.5 rounded-full bg-[#ECE7FF] shadow-[0_0_6px_#ECE7FF]"></div>
                <div className="w-1.5 h-1.5 rounded-full bg-[#ECE7FF] shadow-[0_0_6px_#ECE7FF]"></div>
              </div>
              <div className="absolute inset-0 border border-[#ECE7FF]/20 rounded-full scale-110 -rotate-12"></div>
              <div className="absolute inset-0 border border-[#ECE7FF]/10 rounded-full scale-125 rotate-45"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Point instruction text */}
      <div className="text-center text-xs text-[#5E667A] leading-none">
        {scanResult && scanResult.results.length > 1 ? t('cameraScan.itemsFound', { count: scanResult.results.length }) : t('cameraScan.pointAtClothing')}
      </div>

      {/* Floating horizontal category picker tags */}
      <div className="flex overflow-x-auto gap-2 pb-2 hide-scrollbar -mx-4 px-4">
        {[
          { id: 'clothing', label: t('cameraScan.clothing'), icon: 'apparel' },
          { id: 'shoes', label: t('cameraScan.shoes'), icon: 'steps' },
          { id: 'accessories', label: t('cameraScan.accessories'), icon: 'shopping_bag' },
          { id: 'others', label: t('cameraScan.others'), icon: 'more_horiz' }
        ].map((chip) => {
          const isActive = activeChip === chip.id;
          return (
            <button
              key={chip.id}
              onClick={() => setActiveChip(chip.id as any)}
              className={`px-4 py-2 rounded-full flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap transition-all ${
                isActive 
                  ? 'bg-[#553BE2] text-white shadow-md shadow-[#553BE2]/20 border border-[#553BE2]' 
                  : 'bg-white text-[#5E667A] border border-[#E4DFF5] hover:text-[#131426]'
              }`}
            >
              <span className="material-symbols-outlined text-[15px] leading-none">{chip.icon}</span> 
              {chip.label}
            </button>
          );
        })}
      </div>

      {/* Camera scan framing viewfinder card */}
      <section className="relative w-full aspect-[4/5] rounded-3xl overflow-hidden shadow-lg border border-[#E4DFF5] bg-black">
        {/* Underlay canvas image: Lavender Hoodie on organic hanger */}
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: hasSelectedImage ? `url('${scanResult?.compressedImageUrl || previewImage}')` : 'none'
          }}
        />
        {!hasSelectedImage && (
          <div className="absolute inset-0 bg-gradient-to-br from-[#131426] via-[#2B245A] to-[#553BE2]/70 flex items-center justify-center">
            <button
              onClick={() => setShowSourceSheet(true)}
              className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white border border-white/20 shadow-lg"
            >
              <span className="material-symbols-outlined text-3xl">add_a_photo</span>
            </button>
          </div>
        )}

        {/* Viewfinder ambient dark filter */}
        <div className="absolute inset-0 bg-black/25"></div>

        {/* Framing target elements */}
        <div className="absolute inset-4 rounded-2xl overflow-hidden border border-white/15">
          <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-white rounded-tl"></div>
          <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-white rounded-tr"></div>
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-white rounded-bl"></div>
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-white rounded-br"></div>

          {/* Quick HUD controls */}
          <div className="absolute top-3 left-3 right-3 flex justify-between">
            <button className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white border border-white/10 hover:bg-black/60">
              <span className="material-symbols-outlined text-base">bolt</span>
            </button>
            <button
              onClick={() => setShowSourceSheet(true)}
              className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white border border-white/10 hover:bg-black/60"
            >
              <span className="material-symbols-outlined text-base">photo_library</span>
            </button>
          </div>

          {/* Scanning line animation laser with pulse glow */}
          {scanning && (
            <div className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#553BE2] to-transparent top-1/2 shadow-[0_0_12px_#ECE7FF] scan-line-animation" />
          )}

          {scanResult && scanResult.results.length > 1 && (
            <div className="absolute bottom-4 inset-x-4 flex justify-between items-center">
              <button
                onClick={goToPreviousItem}
                disabled={activeItemIndex === 0}
                className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white border border-white/10 disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-base">chevron_left</span>
              </button>
              <div className="px-3 py-1 rounded-full bg-black/60 backdrop-blur-md text-white text-xs font-bold border border-white/20">
                {activeItemIndex + 1}/{scanResult.results.length}
              </div>
              <button
                onClick={goToNextItem}
                disabled={activeItemIndex === scanResult.results.length - 1}
                className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white border border-white/10 disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-base">chevron_right</span>
              </button>
            </div>
          )}

          {/* Lens focus factor */}
          {(!scanResult || scanResult.results.length <= 1) && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
              <div className="px-3 py-1 rounded-full bg-black/60 backdrop-blur-md text-white text-xs font-bold border border-white/20">
                1x
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Analysis Reports container panel */}
      <section className="glass-panel rounded-3xl p-4">
        {scanning ? (
          <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-10 h-10 rounded-full border-2 border-[#553BE2] border-t-transparent animate-spin"></div>
            <p className="text-xs font-bold text-[#553BE2] tracking-wide">{scanMessage}</p>
            <p className="text-[10px] text-[#5E667A]">{t('cameraScan.analyzing')}</p>
          </div>
        ) : errorMessage ? (
          <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 border border-rose-100">
              <span className="material-symbols-outlined text-xl">error</span>
            </div>
            <p className="text-xs font-bold text-[#131426] tracking-wide">{errorMessage}</p>
            <button
              onClick={() => setShowSourceSheet(true)}
              className="mt-1 py-2.5 px-5 rounded-full bg-[#553BE2] text-white font-bold text-xs shadow-md shadow-[#553BE2]/20"
            >
              {t('cameraScan.tryAgain')}
            </button>
          </div>
        ) : currentResult ? (
          <div className="animate-fade-in">
            <div className="space-y-4">
              <div className="flex min-w-0 items-start gap-3">
                <div className="h-[76px] w-[76px] shrink-0 rounded-2xl border border-[#E4DFF5] bg-white p-1">
                  <div
                    className="h-full w-full rounded-xl bg-cover bg-center"
                    style={{ backgroundImage: `url('${detectedImage || displayProduct?.imageUrl || previewImage}')` }}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h3 className="break-words text-base font-bold leading-tight text-[#131426]">{clothingTypeLabel}</h3>
                    <span className="rounded-full bg-[#F2EEFF] px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-[#553BE2]">{categoryLabel}</span>
                  </div>
                  <p className="mt-1 text-[11px] font-semibold leading-snug text-[#553BE2]">{currentResult.title}</p>
                  <span className="mt-2 inline-flex rounded-full bg-[#F2EEFF] px-2.5 py-1 text-[11px] font-bold text-[#553BE2]">
                    {currentResult.score}% match
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: t('cameraScan.primaryColor'), value: displayColor || t('cameraScan.detected'), color: currentResult.item.features.colorHex },
                  { label: t('cameraScan.secondaryColor'), value: secondaryColor || t('cameraScan.notDetected') },
                  { label: t('cameraScan.pattern'), value: patternLabel },
                  { label: t('cameraScan.material'), value: materialLabel || t('cameraScan.detectedFabric') }
                ].map((detail) => (
                  <div key={detail.label} className="min-w-0 rounded-xl bg-[#F8F7FC] px-3 py-2">
                    <p className="text-[10px] font-medium text-[#7A8194]">{detail.label}</p>
                    <p className="mt-0.5 flex min-w-0 items-center gap-1.5 break-words text-xs font-semibold leading-snug text-[#131426]">
                      {detail.color && (
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full border border-[#E4DFF5]" style={{ backgroundColor: detail.color }} />
                      )}
                      <span className="min-w-0">{detail.value}</span>
                    </p>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-[#E4DFF5] px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#7A8194]">{t('cameraScan.matchedProduct')}</p>
                <p className="mt-0.5 break-words text-sm font-bold text-[#131426]">{displayProduct?.name || t('cameraScan.noMatch')}</p>
                <p className="mt-0.5 text-[11px] text-[#5E667A]">{displayProduct?.vendorName || t('cameraScan.vendorUnavailable')}</p>
              </div>

              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#7A8194]">{t('cameraScan.whyMatched')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {matchReasons.map((reason) => (
                    <span key={reason} className="rounded-full bg-[#F2EEFF] px-2.5 py-1 text-[10px] font-semibold text-[#553BE2]">
                      <span aria-hidden="true" className="mr-1">✓</span>{reason}
                    </span>
                  ))}
                </div>
              </div>

              {pairingProduct && (
                <div className="flex min-w-0 items-center gap-3 rounded-xl border border-[#E4DFF5] bg-[#FAF9FF] p-2.5">
                  <div
                    className="h-12 w-12 shrink-0 rounded-lg border border-[#E4DFF5] bg-white bg-cover bg-center"
                    style={{ backgroundImage: `url('${pairingProduct.imageUrl || pairingProduct.mainImage || ''}')` }}
                  />
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[#7A8194]">{t('cameraScan.pairedWith')}</p>
                    <p className="break-words text-xs font-bold text-[#131426]">{pairingProduct.name || pairingProduct.category}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Scanning details action buttons */}
            <div className="mt-4 grid grid-cols-3 gap-2">
              <button 
                onClick={handleScanAgain}
                className="flex-1 py-2.5 rounded-full border border-[#E4DFF5] text-[#131426] bg-white hover:bg-[#F2EEFF] transition-colors font-bold flex items-center justify-center gap-1 text-xs shadow-sm"
              >
                <span className="material-symbols-outlined text-sm">refresh</span>
                {t('cameraScan.again')}
              </button>
              
              <button 
                onClick={() => {
                  if (displayProduct) {
                    onProductMatched?.(displayProduct, detectedImage);
                  }
                  onNavigate('ar-tryon');
                }}
                className="flex-1 py-2.5 rounded-full border border-[#553BE2] text-[#553BE2] bg-[#F2EEFF] hover:bg-[#ECE7FF] transition-colors font-bold flex items-center justify-center gap-1 text-xs shadow-sm"
              >
                <span className="material-symbols-outlined text-sm">view_in_ar</span>
                {t('cameraScan.arTryOn')}
              </button>

              <button 
                onClick={handleViewDetails}
                className="flex-1 py-2.5 rounded-full bg-[#553BE2] text-white font-bold flex items-center justify-center gap-1 hover:opacity-95 transition-opacity text-xs shadow-md shadow-[#553BE2]/20"
              >
                {t('cameraScan.details')}
                <span className="material-symbols-outlined text-sm leading-none">chevron_right</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
            <button
              onClick={() => setShowSourceSheet(true)}
              className="w-12 h-12 rounded-full bg-[#553BE2] text-white flex items-center justify-center shadow-md shadow-[#553BE2]/20"
            >
              <span className="material-symbols-outlined text-2xl">photo_camera</span>
            </button>
            <p className="text-xs font-bold text-[#553BE2] tracking-wide">{t('cameraScan.chooseImage')}</p>
            <p className="text-[10px] text-[#5E667A]">{t('cameraScan.samePipeline')}</p>
          </div>
        )}
      </section>

      {showSourceSheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px]" onClick={() => setShowSourceSheet(false)} />
          <div className="relative w-full max-w-md glass-panel rounded-t-3xl p-5 pb-8 shadow-2xl animate-fade-in">
            <div className="w-10 h-1 rounded-full bg-[#E4DFF5] mx-auto mb-4"></div>
            <h2 className="text-lg font-bold text-[#131426] leading-none">{t('cameraScan.scanOutfit')}</h2>
            <p className="text-xs text-[#5E667A] mt-1 mb-4">{t('cameraScan.chooseSource')}</p>
            <div className="grid gap-3">
              <button
                onClick={() => openSource('camera')}
                className="w-full py-3 rounded-2xl bg-[#F2EEFF] border border-[#E4DFF5] hover:border-[#553BE2]/40 text-[#131426] font-bold flex items-center justify-center gap-2 text-sm shadow-sm transition-colors"
              >
                <span className="material-symbols-outlined text-[#553BE2]">photo_camera</span>
                {t('cameraScan.openCamera')}
              </button>
              <button
                onClick={() => openSource('gallery')}
                className="w-full py-3 rounded-2xl bg-[#F2EEFF] border border-[#E4DFF5] hover:border-[#553BE2]/40 text-[#131426] font-bold flex items-center justify-center gap-2 text-sm shadow-sm transition-colors"
              >
                <span className="material-symbols-outlined text-[#553BE2]">image</span>
                {t('cameraScan.uploadGallery')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
