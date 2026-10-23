import { Capacitor } from '@capacitor/core';

export const PRODUCTION_API_URL = 'https://nova-1-1.onrender.com';

export const getApiBaseUrl = () => {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env || {};
  if (env.VITE_API_BASE_URL) {
    return env.VITE_API_BASE_URL.replace(/\/$/, '');
  }
  if (Capacitor.isNativePlatform()) {
    return PRODUCTION_API_URL;
  }
  return '';
};

export const apiUrl = (path: string) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getApiBaseUrl()}${normalizedPath}`;
};
