import { Capacitor } from '@capacitor/core';

export const PRODUCTION_API_URL = 'https://nova-1-1.onrender.com';
export const PRODUCTION_WEB_HOST = 'nova.nova-fashion.workers.dev';

export const getApiBaseUrl = (): string => {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env || {};

  // 1. Explicit environment variable override takes highest precedence
  if (env.VITE_API_BASE_URL && env.VITE_API_BASE_URL.trim()) {
    return env.VITE_API_BASE_URL.trim().replace(/\/$/, '');
  }

  // 2. Android APK / Native Capacitor Environment
  // On physical mobile devices, Capacitor's local webview runs at 'localhost' (https://localhost),
  // but there is no local backend server inside the phone. Native builds MUST connect to the production backend.
  // Checking this FIRST avoids the false-positive localhost web check.
  if (Capacitor.isNativePlatform()) {
    return PRODUCTION_API_URL;
  }

  // 3. Localhost Web Development (Node.js / Express / Vite running on developer's machine)
  if (
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ) {
    return '';
  }

  // 4. Production Web Deployment (Cloudflare Workers, Netlify, Vercel, or custom production host)
  // The web SPA is hosted on Cloudflare Workers (nova.nova-fashion.workers.dev),
  // while backend API routes are hosted on the Render server (nova-1-1.onrender.com).
  // Non-localhost web environments MUST target the production backend.
  return PRODUCTION_API_URL;
};

export const apiUrl = (path: string): string => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const base = getApiBaseUrl();
  return `${base}${normalizedPath}`;
};
