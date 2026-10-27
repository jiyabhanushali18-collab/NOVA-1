import { useState, useRef, useEffect } from 'react';
import { createDecartClient, models } from '@decartai/sdk';
import type { RealTimeClient } from '@decartai/sdk';
import './App.css';

function App() {
  const [status, setStatus] = useState<string>('Disconnected');
  const videoRef = useRef<HTMLVideoElement>(null);
  const [clientRef, setClientRef] = useState<RealTimeClient | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  
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
         clientRef.setImage(file).catch(err => console.error("Error setting image:", err));
      }
    }
  };

  const startSession = async () => {
    try {
      setStatus('Requesting camera...');
      // Use the correct Virtual Try-On model
      const model = models.realtime("lucy-vton-latest");
      
      // Safely resolve the model's FPS parameter since it can be a number or an object
      const captureFps = typeof model.fps === 'number' ? model.fps : (model.fps.ideal || 30);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: { 
          frameRate: captureFps,
          width: model.width,
          height: model.height,
        }
      });

      setStatus('Connecting...');
      const client = createDecartClient({
        apiKeyProvider: async () => {
          const res = await fetch("http://localhost:3001/api/token");
          if (!res.ok) {
             const err = await res.json();
             throw new Error(err.error || "Failed to fetch token");
          }
          const tokenData = await res.json();
          return tokenData.apiKey; 
        },
      });

      const realtimeClient = await client.realtime.connect(stream, {
        model,
        onRemoteStream: (transformedStream) => {
          if (videoRef.current) {
            videoRef.current.srcObject = transformedStream;
            videoRef.current.play().catch(e => console.error("Video play error:", e));
          }
          setStatus('Connected (Live AI Output)');
        },
        initialState: {
          image: dressFile || undefined,
        }
      });

      setClientRef(realtimeClient);

    } catch (err: any) {
      console.error("Error starting session:", err);
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
      stream.getTracks().forEach(track => track.stop());
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
    <div className="App" style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Virtual Try-On (VTON)</h1>
      
      <div style={{ marginBottom: '20px', display: 'flex', gap: '20px', alignItems: 'center' }}>
        <div>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>
            Upload Dress Image:
          </label>
          <input 
            type="file" 
            accept="image/jpeg, image/png, image/webp" 
            onChange={handleDressUpload} 
          />
        </div>
        {dressPreview && (
          <div>
            <p style={{ margin: '0 0 5px 0', fontSize: '12px' }}>Selected Dress:</p>
            <img 
              src={dressPreview} 
              alt="Dress Preview" 
              style={{ width: '80px', height: '80px', objectFit: 'contain', border: '1px solid #ccc' }} 
            />
          </div>
        )}
      </div>

      <div style={{ marginBottom: '20px' }}>
        <p>Status: <strong>{status}</strong></p>
        <button 
          onClick={startSession} 
          disabled={status !== 'Disconnected'} 
          style={{ marginRight: '10px', padding: '10px' }}
        >
          Start Camera & AI
        </button>
        <button 
          onClick={stopSession} 
          disabled={status === 'Disconnected'} 
          style={{ padding: '10px' }}
        >
          Stop
        </button>
      </div>

      <div style={{ border: '2px solid #ccc', width: '640px', height: '480px', backgroundColor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <video 
          ref={videoRef} 
          width="640" 
          height="480" 
          autoPlay 
          playsInline 
          muted={false}
          style={{ objectFit: 'cover' }}
        />
      </div>
    </div>
  );
}

export default App;
