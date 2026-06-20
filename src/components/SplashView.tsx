import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Sparkles } from 'lucide-react';

interface SplashViewProps {
  onComplete: () => void;
}

export const SplashView: React.FC<SplashViewProps> = ({ onComplete }) => {
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    // Trigger pulse loop
    const interval = setInterval(() => {
      setPulse(prev => !prev);
    }, 2000);

    // Auto complete after 3 seconds so user transitions smoothly
    const timeout = setTimeout(() => {
      onComplete();
    }, 3200);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [onComplete]);

  return (
    <div className="min-h-screen flex flex-col justify-between max-w-md mx-auto relative bg-gradient-to-b from-blue-100 via-blue-50 to-indigo-50 overflow-hidden font-sans border-x border-blue-200 shadow-2xl">
      {/* Decorative Grid Mesh Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#bfdbfe_1px,transparent_1px),linear-gradient(to_bottom,#bfdbfe_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_40%,#000_70%,transparent_100%)] opacity-15"></div>

      {/* Modern gradient orb in center background */}
      <div className="absolute top-[40%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-gradient-to-tr from-blue-200/20 via-cyan-200/20 to-indigo-200/20 blur-3xl"></div>

      {/* Header spacing */}
      <div className="h-20"></div>

      {/* Main branded star logo section */}
      <div className="flex-1 flex flex-col items-center justify-center relative z-10 px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, ease: 'easeOut' }}
          className="relative mb-6"
        >
          {/* Ambient visual ring */}
          <div className="absolute -inset-6 rounded-full border border-indigo-100/60 animate-ping opacity-15"></div>
          <div className="absolute -inset-10 rounded-full border border-indigo-200/30 animate-pulse opacity-20"></div>

          {/* Compass / Starburst Gradient SVG Vector */}
          <div className="w-28 h-28 flex items-center justify-center relative bg-white rounded-full shadow-xl overflow-hidden">
            <img src="/logoone.jpeg" alt="NOVA splash logo" className="w-full h-full object-contain p-3" />
          </div>
        </motion.div>

        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          className="text-center"
        >
          <h1 className="text-4xl font-extrabold tracking-[0.18em] text-slate-900 font-sans">
            NOVA
          </h1>
          <p className="text-[10px] font-black tracking-[0.3em] text-indigo-600 uppercase mt-2 font-mono">
            Next Gen Optical Vision Assistant
          </p>
        </motion.div>
      </div>

      {/* Elegant minimalist Footer credits */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8, duration: 0.8 }}
        className="pb-16 text-center px-8 relative z-10"
      >
        <div className="flex justify-center items-center gap-1.5 text-[11px] font-medium text-slate-400">
          <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
          <span>See the world.</span>
        </div>
        <p className="text-[10px] font-bold text-slate-500/80 mt-1 uppercase tracking-wider font-mono">
          Empowered by AI. Guided by NOVA.
        </p>

        {/* Loading status bar indicator */}
        <div className="w-24 h-1 bg-indigo-50/50 rounded-full mx-auto mt-5 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-400 rounded-full animate-loading-bar w-full"></div>
        </div>
      </motion.div>

      {/* Simple global CSS injection for anim progress bar inside Tailwind */}
      <style>{`
        @keyframes loadingBar {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-loading-bar {
          animation: loadingBar 2s infinite linear;
        }
      `}</style>
    </div>
  );
};
