import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { ScreenId } from '../../types';
import {
  TutorialFeatureId,
  TutorialStep,
  TutorialDefinition,
  TUTORIAL_DEFINITIONS
} from '../../data/tutorialDefinitions';
import { tutorialService } from '../../services/tutorialService';

interface TutorialContextValue {
  activeTutorial: TutorialFeatureId | null;
  activeDefinition: TutorialDefinition | null;
  currentStepIndex: number;
  currentStep: TutorialStep | null;
  isWelcomeOpen: boolean;
  isFeedbackOpen: boolean;
  startTutorial: (featureId: TutorialFeatureId) => void;
  nextStep: () => void;
  prevStep: () => void;
  skipStep: () => void;
  exitTutorial: () => void;
  openWelcome: () => void;
  closeWelcome: () => void;
  openFeedback: () => void;
  closeFeedback: () => void;
}

const TutorialContext = createContext<TutorialContextValue | null>(null);

export const useTutorial = (): TutorialContextValue => {
  const ctx = useContext(TutorialContext);
  if (!ctx) {
    throw new Error('useTutorial must be used within a TutorialProvider');
  }
  return ctx;
};

interface TutorialProviderProps {
  children: React.ReactNode;
  currentScreen: ScreenId;
  onNavigate: (screen: ScreenId) => void;
}

export const TutorialProvider: React.FC<TutorialProviderProps> = ({
  children,
  currentScreen,
  onNavigate
}) => {
  const [activeTutorial, setActiveTutorial] = useState<TutorialFeatureId | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isWelcomeOpen, setIsWelcomeOpen] = useState<boolean>(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState<boolean>(false);

  const activeDefinition: TutorialDefinition | null = activeTutorial
    ? TUTORIAL_DEFINITIONS[activeTutorial] || null
    : null;

  const currentStep: TutorialStep | null =
    activeDefinition && currentStepIndex < activeDefinition.steps.length
      ? activeDefinition.steps[currentStepIndex]
      : null;

  const currentScreenRef = useRef(currentScreen);
  useEffect(() => {
    currentScreenRef.current = currentScreen;
  }, [currentScreen]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__nova_tutorial_active = activeTutorial;
    }
  }, [activeTutorial]);

  const openWelcome = useCallback(() => {
    setIsWelcomeOpen(true);
  }, []);

  const closeWelcome = useCallback(() => {
    setIsWelcomeOpen(false);
  }, []);

  const openFeedback = useCallback(() => {
    setIsFeedbackOpen(true);
  }, []);

  const closeFeedback = useCallback(() => {
    setIsFeedbackOpen(false);
  }, []);

  const exitTutorial = useCallback(() => {
    setActiveTutorial(null);
    setCurrentStepIndex(0);
  }, []);

  const startTutorial = useCallback((featureId: TutorialFeatureId) => {
    const def = TUTORIAL_DEFINITIONS[featureId];
    if (!def) return;

    setActiveTutorial(featureId);
    setCurrentStepIndex(0);
    setIsWelcomeOpen(false);

    // Auto-navigate to start screen if needed
    const firstStep = def.steps[0];
    const targetScreen = firstStep ? firstStep.requiredScreen : def.startScreen;
    if (targetScreen && currentScreenRef.current !== targetScreen) {
      onNavigate(targetScreen);
    }
  }, [onNavigate]);

  const nextStep = useCallback(() => {
    if (!activeDefinition) return;

    const nextIndex = currentStepIndex + 1;

    if (nextIndex >= activeDefinition.steps.length) {
      // Completed all steps
      const completedTutorial = activeDefinition.id;
      tutorialService.markFeatureTutorialCompleted(completedTutorial);
      setActiveTutorial(null);
      setCurrentStepIndex(0);

      // If AR Try-On, trigger feedback modal
      if (completedTutorial === 'ar-tryon') {
        setIsFeedbackOpen(true);
      }
      return;
    }

    setCurrentStepIndex(nextIndex);

    // Navigate if required for the next step
    const nextStepDef = activeDefinition.steps[nextIndex];
    if (nextStepDef && nextStepDef.requiredScreen !== currentScreenRef.current) {
      onNavigate(nextStepDef.requiredScreen);
    }
  }, [activeDefinition, currentStepIndex, onNavigate]);

  const prevStep = useCallback(() => {
    if (currentStepIndex <= 0 || !activeDefinition) return;
    const prevIndex = currentStepIndex - 1;
    setCurrentStepIndex(prevIndex);

    const prevStepDef = activeDefinition.steps[prevIndex];
    if (prevStepDef && prevStepDef.requiredScreen !== currentScreenRef.current) {
      onNavigate(prevStepDef.requiredScreen);
    }
  }, [activeDefinition, currentStepIndex, onNavigate]);

  const skipStep = useCallback(() => {
    nextStep();
  }, [nextStep]);

  // Listen for step-specific advance events (e.g. outfit_selected, tryon_live_started, etc.)
  useEffect(() => {
    if (!currentStep?.advanceEvent) return;

    const eventName = currentStep.advanceEvent;
    const handleAdvance = () => {
      // Small debounce delay so UI state updates cleanly before moving to next step
      setTimeout(() => {
        nextStep();
      }, 350);
    };

    window.addEventListener(eventName, handleAdvance);
    return () => {
      window.removeEventListener(eventName, handleAdvance);
    };
  }, [currentStep, nextStep]);

  // Listen for external tutorial triggers (from onboarding, profile, or shortcuts)
  useEffect(() => {
    const handleStart = (e: any) => {
      const featureId = e?.detail?.featureId;
      if (featureId) {
        startTutorial(featureId);
      }
    };
    const handleOpenWelcome = () => {
      openWelcome();
    };

    window.addEventListener('nova:start_tutorial', handleStart);
    window.addEventListener('nova:open_tutorial_welcome', handleOpenWelcome);
    return () => {
      window.removeEventListener('nova:start_tutorial', handleStart);
      window.removeEventListener('nova:open_tutorial_welcome', handleOpenWelcome);
    };
  }, [startTutorial, openWelcome]);

  // If active tutorial screen doesn't match current step screen, navigate if necessary
  useEffect(() => {
    if (currentStep && currentStep.requiredScreen !== currentScreen) {
      onNavigate(currentStep.requiredScreen);
    }
  }, [currentStep, currentScreen, onNavigate]);

  return (
    <TutorialContext.Provider
      value={{
        activeTutorial,
        activeDefinition,
        currentStepIndex,
        currentStep,
        isWelcomeOpen,
        isFeedbackOpen,
        startTutorial,
        nextStep,
        prevStep,
        skipStep,
        exitTutorial,
        openWelcome,
        closeWelcome,
        openFeedback,
        closeFeedback
      }}
    >
      {children}
    </TutorialContext.Provider>
  );
};
