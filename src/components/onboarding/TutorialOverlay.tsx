import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useTutorial } from './TutorialContext';
import { TutorialTooltip } from './TutorialTooltip';

interface RectBox {
  top: number;
  left: number;
  width: number;
  height: number;
  bottom: number;
  right: number;
}

export const TutorialOverlay: React.FC = () => {
  const {
    activeTutorial,
    activeDefinition,
    currentStepIndex,
    currentStep,
    nextStep,
    prevStep,
    skipStep,
    exitTutorial
  } = useTutorial();

  const [targetRect, setTargetRect] = useState<RectBox | null>(null);
  const targetElementRef = useRef<HTMLElement | null>(null);

  const updateTargetRect = useCallback(() => {
    if (!currentStep) {
      setTargetRect(null);
      return;
    }

    const element = document.querySelector<HTMLElement>(currentStep.targetSelector);
    targetElementRef.current = element;

    if (!element) {
      setTargetRect(null);
      return;
    }

    const domRect = element.getBoundingClientRect();
    const pad = 6;
    const computedRect: RectBox = {
      top: Math.max(0, domRect.top - pad),
      left: Math.max(0, domRect.left - pad),
      width: domRect.width + pad * 2,
      height: domRect.height + pad * 2,
      bottom: domRect.bottom + pad,
      right: domRect.right + pad
    };

    setTargetRect(computedRect);
  }, [currentStep]);

  useEffect(() => {
    if (!activeTutorial || !currentStep) {
      setTargetRect(null);
      return;
    }

    // Immediate check
    updateTargetRect();

    // Check periodically for DOM element to mount or animate
    const interval = setInterval(updateTargetRect, 200);

    const handleScrollOrResize = () => {
      updateTargetRect();
    };

    window.addEventListener('resize', handleScrollOrResize, { passive: true });
    window.addEventListener('scroll', handleScrollOrResize, { passive: true });

    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize);
    };
  }, [activeTutorial, currentStep, updateTargetRect]);

  if (!activeTutorial || !activeDefinition || !currentStep) {
    return null;
  }

  const totalSteps = activeDefinition.steps.length;

  return (
    <div
      className="fixed inset-0 z-[9990] pointer-events-none select-none transition-all duration-300"
      aria-live="polite"
    >
      {/* 4 Backdrop pieces to create real cutout with 100% touch cut-through */}
      {targetRect ? (
        <>
          {/* Top backdrop */}
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              height: `${Math.max(0, targetRect.top)}px`
            }}
            className="bg-[#0B0C15]/75 backdrop-blur-[2px] pointer-events-auto transition-all duration-200"
          />

          {/* Bottom backdrop */}
          <div
            style={{
              position: 'fixed',
              top: `${targetRect.bottom}px`,
              left: 0,
              right: 0,
              bottom: 0
            }}
            className="bg-[#0B0C15]/75 backdrop-blur-[2px] pointer-events-auto transition-all duration-200"
          />

          {/* Left backdrop */}
          <div
            style={{
              position: 'fixed',
              top: `${targetRect.top}px`,
              left: 0,
              width: `${Math.max(0, targetRect.left)}px`,
              height: `${targetRect.height}px`
            }}
            className="bg-[#0B0C15]/75 backdrop-blur-[2px] pointer-events-auto transition-all duration-200"
          />

          {/* Right backdrop */}
          <div
            style={{
              position: 'fixed',
              top: `${targetRect.top}px`,
              left: `${targetRect.right}px`,
              right: 0,
              height: `${targetRect.height}px`
            }}
            className="bg-[#0B0C15]/75 backdrop-blur-[2px] pointer-events-auto transition-all duration-200"
          />

          {/* Glowing Lavender Spotlight Frame around Target */}
          <div
            style={{
              position: 'fixed',
              top: `${targetRect.top}px`,
              left: `${targetRect.left}px`,
              width: `${targetRect.width}px`,
              height: `${targetRect.height}px`
            }}
            className="rounded-2xl border-2 border-[#8B6DFD] shadow-[0_0_24px_rgba(139,109,253,0.7),inset_0_0_12px_rgba(139,109,253,0.3)] animate-pulse pointer-events-none z-[9995] transition-all duration-200"
          >
            {/* Corner highlight beacons */}
            <span className="absolute -top-1 -left-1 w-2.5 h-2.5 rounded-full bg-[#8B6DFD] shadow-[0_0_8px_#8B6DFD]" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#8B6DFD] shadow-[0_0_8px_#8B6DFD]" />
            <span className="absolute -bottom-1 -left-1 w-2.5 h-2.5 rounded-full bg-[#8B6DFD] shadow-[0_0_8px_#8B6DFD]" />
            <span className="absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#8B6DFD] shadow-[0_0_8px_#8B6DFD]" />
          </div>
        </>
      ) : (
        /* Fallback dark overlay while waiting for target element to mount */
        <div className="fixed inset-0 bg-[#0B0C15]/75 backdrop-blur-[2px] pointer-events-auto transition-opacity duration-200" />
      )}

      {/* Instructional Floating Tooltip */}
      <TutorialTooltip
        step={currentStep}
        stepIndex={currentStepIndex}
        totalSteps={totalSteps}
        targetRect={targetRect as any}
        onNext={nextStep}
        onPrev={prevStep}
        onSkip={skipStep}
        onExit={exitTutorial}
      />
    </div>
  );
};
