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
    <div className="min-h-screen w-full relative overflow-hidden bg-[linear-gradient(180deg,#d6e5ff_0%,#f7fbff_45%,#eef5ff_100%)] font-sans text-slate-900">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(101,132,178,0.16)_1px,transparent_1px),linear-gradient(to_bottom,rgba(101,132,178,0.14)_1px,transparent_1px)] bg-[size:32px_32px] opacity-35"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(255,255,255,0.95)_0%,rgba(255,255,255,0.45)_24%,rgba(213,228,255,0.18)_52%,transparent_76%)]"></div>
      <div className="absolute left-1/2 bottom-[-24vh] h-[48vh] w-[130vw] max-w-[980px] -translate-x-1/2 rounded-[50%_50%_0_0] bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.96)_0%,rgba(255,255,255,0.72)_46%,rgba(211,226,255,0.46)_72%,rgba(169,197,246,0.18)_100%)] shadow-[0_-18px_70px_rgba(255,255,255,0.95)]"></div>
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
            className="h-auto w-[min(74vw,360px)] object-contain drop-shadow-[0_20px_38px_rgba(63,111,195,0.16)]"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65, duration: 0.8 }}
          className="w-full pb-[4vh] text-center"
        >
          <div className="flex items-center justify-center gap-2 text-[clamp(16px,2.2vw,20px)] font-semibold text-[#65728f]">
            <Sparkles className="h-5 w-5 text-blue-600" fill="currentColor" />
            <span>See the world.</span>
          </div>
          <p className="mt-5 text-[clamp(11px,1.5vw,14px)] font-bold uppercase tracking-[0.22em] text-[#65728f]">
            Empowered by AI. Guided by NOVA.
          </p>
          <div className="mx-auto mt-8 h-3 w-[min(46vw,280px)] overflow-hidden rounded-full bg-[#bfcee5]">
            <div
              className={`h-full rounded-full bg-[linear-gradient(90deg,#0968f3_0%,#0b80f7_48%,#32c7ef_100%)] transition-[width] duration-[2800ms] ease-out ${
                progressReady ? 'w-[72%]' : 'w-0'
              }`}
            ></div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
