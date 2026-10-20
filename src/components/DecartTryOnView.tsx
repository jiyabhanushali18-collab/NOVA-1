import React, { useState, useRef, useEffect } from 'react';
import { createDecartClient, models } from '@decartai/sdk';
import type { RealTimeClient } from '@decartai/sdk';

interface DecartTryOnViewProps {
  onBack?: () => void;
}

export const DecartTryOnView: React.FC<DecartTryOnViewProps> = ({ onBack }) => {
  const [status, setStatus] = useState<string>('Disconnected');
  const videoRef = useRef<HTMLVideoElement>(null);
  const [clientRef, setClientRef] = useState<RealTimeClient | null>(null);

  const [dressFile, setDressFile] = useState<File | null>(null);
  const [dressPreview, setDressPreview] = useState<string | null>(null);

  const handleDressUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setDressFile(file);
      const url = URL.createObjectURL(file);
      setDressPreview(url);

      // If a session is already active, send the image immediately
      if (clientRef && clientRef.isConnected()) {
        clientRef.setImage(file).catch((err) => console.error('Error setting image:', err));
      }
    }
  };

  const startSession = async () => {
    try {
      setStatus('Requesting camera...');
      // Use the Virtual Try-On model
      const model = models.realtime('lucy-vton-latest');

      const captureFps = typeof model.fps === 'number' ? model.fps : (model.fps?.ideal || 30);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: {
          frameRate: captureFps,
          width: model.width || 1280,
          height: model.height || 720,
        },
      });

      setStatus('Connecting to Decart AI...');
      const client = createDecartClient({
        apiKeyProvider: async () => {
          const res = await fetch('/api/token');
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Failed to fetch token');
          }
          const tokenData = await res.json();
          return tokenData.apiKey || tokenData.token;
        },
      });

      const realtimeClient = await client.realtime.connect(stream, {
        model,
        onRemoteStream: (transformedStream: MediaStream) => {
          if (videoRef.current) {
            videoRef.current.srcObject = transformedStream;
            videoRef.current.play().catch((e) => console.error('Video play error:', e));
          }
          setStatus('Connected (Live AI Output)');
        },
        initialState: {
          image: dressFile || undefined,
        },
      });

      setClientRef(realtimeClient);
    } catch (err: any) {
      console.error('Error starting session:', err);
      setStatus(`Error: ${err.message}`);
    }
  };

  const stopSession = () => {
    if (clientRef) {
      clientRef.disconnect();
      setClientRef(null);
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setStatus('Disconnected');
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (clientRef) {
        clientRef.disconnect();
      }
    };
  }, [clientRef]);

  return (
    <div className="p-4 bg-slate-950 text-white rounded-3xl min-h-[600px] flex flex-col items-center select-none">
      <div className="w-full flex items-center justify-between mb-4 border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[#A594FD]">videocam</span>
          <h2 className="text-base font-bold">Decart Real-Time Virtual Try-On</h2>
        </div>
        {onBack && (
          <button
            onClick={onBack}
            className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-full text-xs font-semibold transition-colors"
          >
            Back
          </button>
        )}
      </div>

      <div className="w-full max-w-md mb-4 flex items-center gap-4 bg-white/5 p-3 rounded-2xl border border-white/10">
        <div className="flex-1">
          <label className="block text-xs font-semibold mb-1 text-slate-300">
            Upload Dress Image:
          </label>
          <input
            type="file"
            accept="image/jpeg, image/png, image/webp"
            onChange={handleDressUpload}
            className="text-xs file:mr-2 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-[#553BE2] file:text-white hover:file:bg-[#462CC9] cursor-pointer"
          />
        </div>
        {dressPreview && (
          <div className="shrink-0 flex flex-col items-center">
            <span className="text-[10px] text-slate-400 mb-1">Preview</span>
            <img
              src={dressPreview}
              alt="Dress Preview"
              className="w-14 h-14 object-contain rounded-lg border border-white/20 bg-black/40"
            />
          </div>
        )}
      </div>

      <div className="mb-4 flex items-center gap-3">
        <span className="text-xs text-slate-300">
          Status:{' '}
          <strong
            className={`${
              status.startsWith('Connected')
                ? 'text-emerald-400'
                : status.startsWith('Error')
                ? 'text-red-400'
                : 'text-amber-400'
            }`}
          >
            {status}
          </strong>
        </span>
        <button
          onClick={startSession}
          disabled={status !== 'Disconnected'}
          className="bg-[#553BE2] hover:bg-[#462CC9] disabled:opacity-40 text-white rounded-full px-4 py-1.5 text-xs font-semibold transition-colors active:scale-95 shadow-md"
        >
          Start Camera &amp; AI
        </button>
        <button
          onClick={stopSession}
          disabled={status === 'Disconnected'}
          className="bg-red-500/80 hover:bg-red-600 disabled:opacity-40 text-white rounded-full px-4 py-1.5 text-xs font-semibold transition-colors active:scale-95"
        >
          Stop
        </button>
      </div>

      <div className="w-full max-w-lg aspect-[4/3] rounded-2xl overflow-hidden bg-black border border-white/20 flex items-center justify-center relative shadow-2xl">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={false}
          className="w-full h-full object-cover"
        />
        {status === 'Disconnected' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 bg-slate-900/80">
            <span className="material-symbols-outlined text-4xl mb-2 text-slate-600">videocam_off</span>
            <span className="text-xs">Camera is offline. Tap &ldquo;Start Camera &amp; AI&rdquo; to begin.</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default DecartTryOnView;
