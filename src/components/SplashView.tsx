import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Sparkles } from 'lucide-react';

interface SplashViewProps {
  onComplete: () => void;
}

export const SplashView: React.FC<SplashViewProps> = ({ onComplete }) => {
  const [progressReady, setProgressReady] = useState(false);

  useEffect(() => {
    const progressStart = window.setTimeout(() => {
      setProgressReady(true);
    }, 250);

    const timeout = setTimeout(() => {
      onComplete();
    }, 3200);

    return () => {
      clearTimeout(progressStart);
      clearTimeout(timeout);
    };
  }, [onComplete]);

  return (
    <div className="min-h-screen w-full relative overflow-hidden bg-[linear-gradient(180deg,#ECE7FF_0%,#F2EEFF_48%,#F2EEFF_100%)] font-sans text-[#131426]">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(85, 59, 226,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(85, 59, 226,0.08)_1px,transparent_1px)] bg-[size:32px_32px] opacity-40"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(255,255,255,0.92)_0%,rgba(255,255,255,0.45)_26%,rgba(234,229,255,0.28)_54%,transparent_76%)]"></div>
      <div className="absolute left-1/2 bottom-[-24vh] h-[48vh] w-[130vw] max-w-[980px] -translate-x-1/2 rounded-[50%_50%_0_0] bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.96)_0%,rgba(255,255,255,0.72)_46%,rgba(234,229,255,0.52)_72%,rgba(85, 59, 226,0.12)_100%)] shadow-[0_-18px_70px_rgba(255,255,255,0.92)]"></div>
      <div className="absolute left-1/2 bottom-[10vh] h-px w-[82vw] max-w-[780px] -translate-x-1/2 bg-white/80 shadow-[0_0_28px_rgba(255,255,255,0.95)]"></div>

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-between px-6 py-[9vh]">
        <div aria-hidden="true"></div>

        <motion.div
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, ease: 'easeOut' }}
          className="relative flex w-full justify-center"
        >
          <img
            src="/novalogo_withoutbg.png"
            alt="NOVA - Next Gen Optical Vision Assistant"
            className="h-auto w-[min(74vw,360px)] object-contain drop-shadow-[0_20px_38px_rgba(85, 59, 226,0.16)]"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65, duration: 0.8 }}
          className="w-full pb-[4vh] text-center"
        >
          <div className="flex items-center justify-center gap-2 text-[clamp(16px,2.2vw,20px)] font-semibold text-[#5E667A]">
            <Sparkles className="h-5 w-5 text-[#553BE2]" fill="currentColor" />
            <span>See the world.</span>
          </div>
          <p className="mt-5 text-[clamp(11px,1.5vw,14px)] font-bold uppercase tracking-[0.22em] text-[#5E667A]">
            Empowered by AI. Guided by NOVA.
          </p>
          <div className="mx-auto mt-8 h-3 w-[min(46vw,280px)] overflow-hidden rounded-full bg-[#ECE7FF]">
            <div
              className={`h-full rounded-full bg-[#553BE2] transition-[width] duration-[2800ms] ease-out ${
                progressReady ? 'w-[72%]' : 'w-0'
              }`}
            ></div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
