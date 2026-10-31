import { useEffect } from 'react';
import { App as CapApp } from '@capacitor/app';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';

export type BackActionHandler = () => boolean;

interface RegisteredHandler {
  id: string;
  priority: number;
  timestamp: number;
  handler: BackActionHandler;
}

class BackButtonService {
  private handlers: RegisteredHandler[] = [];
  private isListenerAttached = false;
  private listenerPromise: Promise<PluginListenerHandle> | null = null;
  private lastBackTimestamp = 0;
  private readonly DEBOUNCE_MS = 280;

  /**
   * Initializes the native Capacitor backButton listener.
   * Safe to call multiple times — only one native listener is ever registered.
   */
  public init(): void {
    if (this.isListenerAttached) return;

    if (Capacitor.isNativePlatform()) {
      try {
        this.listenerPromise = CapApp.addListener('backButton', () => {
          this.triggerBack();
        });
        this.isListenerAttached = true;
      } catch (err) {
        console.warn('[BackButtonService] Failed to bind Capacitor backButton listener:', err);
      }
    }
  }

  /**
   * Cleans up native listener.
   */
  public destroy(): void {
    if (this.listenerPromise) {
      this.listenerPromise
        .then((handle) => handle.remove())
        .catch(() => {});
      this.listenerPromise = null;
    }
    this.isListenerAttached = false;
    this.handlers = [];
  }

  /**
   * Registers a back action handler with priority.
   * Higher priority numbers execute first.
   * Modals / Popups: Priority 100+
   * Sub-screens / Steps: Priority 50-90
   * Feature Roots: Priority 10-40
   * Global fallback / Home: Priority 0
   */
  public register(id: string, handler: BackActionHandler, priority: number = 100): () => void {
    this.handlers = this.handlers.filter((h) => h.id !== id);
    this.handlers.push({
      id,
      priority,
      timestamp: Date.now(),
      handler
    });

    // Sort descending by priority, then by most recently registered (LIFO for equal priority)
    this.handlers.sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return b.timestamp - a.timestamp;
    });

    return () => {
      this.unregister(id);
    };
  }

  public unregister(id: string): void {
    this.handlers = this.handlers.filter((h) => h.id !== id);
  }

  /**
   * Debounced entrypoint for back navigation.
   * Prevents rapid duplicate hardware or gesture triggers.
   */
  public triggerBack(): boolean {
    const now = Date.now();
    if (now - this.lastBackTimestamp < this.DEBOUNCE_MS) {
      return true;
    }
    this.lastBackTimestamp = now;
    return this.executeBack();
  }

  /**
   * Iterates through registered handlers in priority order.
   * Returns true if a handler consumed the event.
   */
  public executeBack(): boolean {
    const currentHandlers = [...this.handlers];
    for (const item of currentHandlers) {
      try {
        const handled = item.handler();
        if (handled) {
          return true;
        }
      } catch (err) {
        console.error(`[BackButtonService] Error executing back handler "${item.id}":`, err);
      }
    }
    return false;
  }

  public getActiveHandlers(): string[] {
    return this.handlers.map((h) => `${h.id} (p:${h.priority})`);
  }
}

export const backButtonService = new BackButtonService();

/**
 * React hook to register a back action handler that automatically
 * unregisters when unmounted or disabled.
 */
export function useBackHandler(
  id: string,
  handler: BackActionHandler,
  priority: number = 100,
  enabled: boolean = true
): void {
  useEffect(() => {
    if (!enabled) return;
    const unregister = backButtonService.register(id, handler, priority);
    return () => {
      unregister();
    };
  }, [id, handler, priority, enabled]);
}
