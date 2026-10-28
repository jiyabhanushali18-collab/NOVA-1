import React, { useState, useEffect } from 'react';
import { Bell, Sparkles, X } from 'lucide-react';
import { requestPushNotificationPermission, syncPushTokenWithBackend } from '../../services/notificationClientService';

interface NotificationPermissionModalProps {
  user?: { uid?: string; email?: string };
  isDarkMode?: boolean;
  onClose?: () => void;
}

const STORAGE_KEY = 'nova_notification_intro_decided';

export const NotificationPermissionModal: React.FC<NotificationPermissionModalProps> = ({
  user,
  isDarkMode = false,
  onClose
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => {
    // Check if the user has already seen and decided on the introductory prompt
    const hasDecided = localStorage.getItem(STORAGE_KEY);
    if (!hasDecided) {
      // Delay display slightly so the user lands on the Home view first and sees context
      const timer = window.setTimeout(() => {
        setIsOpen(true);
      }, 1200);
      return () => window.clearTimeout(timer);
    }
  }, []);

  if (!isOpen) return null;

  const handleAllow = async () => {
    setIsRequesting(true);
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
      const result = await requestPushNotificationPermission();
      localStorage.setItem('nova_push_permission_status', result);
      if (result === 'granted') {
        await syncPushTokenWithBackend(user);
      }
    } catch (err) {
      console.warn('[Notification Permission] Error requesting permission:', err);
    } finally {
      setIsRequesting(false);
      setIsOpen(false);
      onClose?.();
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    localStorage.setItem('nova_push_permission_status', 'not_now');
    setIsOpen(false);
    onClose?.();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="notification-permission-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
    >
      <div
        className={`w-full max-w-sm rounded-3xl p-6 border relative overflow-hidden shadow-2xl transition-all ${
          isDarkMode
            ? 'bg-slate-900 border-slate-800 text-white'
            : 'bg-white border-[#E4DFF5] text-[#131426] shadow-[0_16px_40px_rgba(85,59,226,0.12)]'
        }`}
      >
        {/* Glow Accent */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-[#553BE2]/15 rounded-full blur-2xl pointer-events-none" />

        {/* Close button */}
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Close"
          className={`absolute top-4 right-4 p-1.5 rounded-full transition-colors ${
            isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-[#F2EEFF] text-[#5E667A]'
          }`}
        >
          <X className="w-4 h-4" />
        </button>

        <div className="text-center space-y-4">
          {/* Icon Badge */}
          <div className="relative inline-flex items-center justify-center mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-[#553BE2]/10 border border-[#553BE2]/20 flex items-center justify-center text-[#553BE2] shadow-sm">
              <Bell className="w-7 h-7 stroke-[2.2] animate-bounce" />
            </div>
            <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#553BE2] text-white flex items-center justify-center shadow">
              <Sparkles className="w-3.5 h-3.5" />
            </span>
          </div>

          {/* Heading & Subtitle */}
          <div className="space-y-1.5 px-2">
            <h3
              id="notification-permission-title"
              className={`text-lg font-black tracking-tight ${
                isDarkMode ? 'text-white' : 'text-[#131426]'
              }`}
            >
              Stay in the NOVA loop 💜
            </h3>
            <p
              className={`text-xs leading-relaxed font-medium ${
                isDarkMode ? 'text-slate-300' : 'text-[#5E667A]'
              }`}
            >
              Get outfit inspiration, styling tips and updates worth opening.
            </p>
          </div>

          {/* Micro text note */}
          <div
            className={`p-2.5 rounded-xl border text-[11px] leading-relaxed ${
              isDarkMode
                ? 'bg-slate-800/50 border-slate-700/80 text-slate-400'
                : 'bg-[#F7F5FC] border-[#E4DFF5] text-[#7A8296]'
            }`}
          >
            Notifications are completely optional and can be turned off anytime in your Profile.
          </div>

          {/* Action buttons */}
          <div className="space-y-2 pt-1">
            <button
              type="button"
              disabled={isRequesting}
              onClick={handleAllow}
              className="w-full py-3 px-4 rounded-xl text-xs font-bold bg-[#553BE2] hover:bg-[#472FC9] text-white shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-60"
            >
              {isRequesting ? 'Requesting...' : 'Allow Notifications'}
            </button>

            <button
              type="button"
              onClick={handleDismiss}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                isDarkMode
                  ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                  : 'text-[#5E667A] hover:text-[#131426] hover:bg-[#F2EEFF]'
              }`}
            >
              Not Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
