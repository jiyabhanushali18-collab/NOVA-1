export interface TryOnFeedback {
  id: string;
  rating: number; // 1-5
  tags: string[]; // e.g. ['Easy to use', 'Camera/lighting']
  notes: string;
  timestamp: number;
}

const TUTORIAL_ONBOARDING_COMPLETED_KEY = 'nova_tutorial_onboarding_completed';
const TUTORIAL_COMPLETED_FEATURES_KEY = 'nova_tutorial_completed_features';
const TRYON_FEEDBACK_KEY = 'nova_tryon_feedback';

export const tutorialService = {
  hasCompletedOnboardingWelcome(): boolean {
    try {
      return localStorage.getItem(TUTORIAL_ONBOARDING_COMPLETED_KEY) === 'true';
    } catch {
      return false;
    }
  },

  setOnboardingWelcomeCompleted(completed = true): void {
    try {
      if (completed) {
        localStorage.setItem(TUTORIAL_ONBOARDING_COMPLETED_KEY, 'true');
      } else {
        localStorage.removeItem(TUTORIAL_ONBOARDING_COMPLETED_KEY);
      }
    } catch (err) {
      console.warn('Failed to update tutorial onboarding completed state:', err);
    }
  },

  getCompletedFeatures(): string[] {
    try {
      const stored = localStorage.getItem(TUTORIAL_COMPLETED_FEATURES_KEY);
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  isFeatureTutorialCompleted(featureId: string): boolean {
    const list = this.getCompletedFeatures();
    return list.includes(featureId);
  },

  markFeatureTutorialCompleted(featureId: string): void {
    try {
      const list = this.getCompletedFeatures();
      if (!list.includes(featureId)) {
        list.push(featureId);
        localStorage.setItem(TUTORIAL_COMPLETED_FEATURES_KEY, JSON.stringify(list));
      }
      // Also mark overall welcome as completed once user finishes any tutorial
      this.setOnboardingWelcomeCompleted(true);
    } catch (err) {
      console.warn('Failed to mark feature tutorial completed:', err);
    }
  },

  saveTryOnFeedback(feedback: Omit<TryOnFeedback, 'id' | 'timestamp'>): TryOnFeedback {
    const entry: TryOnFeedback = {
      ...feedback,
      id: `fb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now()
    };
    try {
      const existing = this.getTryOnFeedback();
      existing.unshift(entry);
      localStorage.setItem(TRYON_FEEDBACK_KEY, JSON.stringify(existing.slice(0, 50)));
    } catch (err) {
      console.warn('Failed to save try-on feedback:', err);
    }
    return entry;
  },

  getTryOnFeedback(): TryOnFeedback[] {
    try {
      const stored = localStorage.getItem(TRYON_FEEDBACK_KEY);
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
};
