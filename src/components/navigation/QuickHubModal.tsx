import React, { useEffect } from 'react';
import { ScreenId } from '../../types';

interface QuickHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (screen: ScreenId) => void;
}

interface HubItem {
  id: string;
  title: string;
  badge: string;
  description: string;
  screen: ScreenId;
  iconBg: string;
  icon: React.ReactNode;
}

export const QuickHubModal: React.FC<QuickHubModalProps> = ({
  isOpen,
  onClose,
  onNavigate
}) => {
  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      // Prevent background scrolling while modal is open
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSelect = (screen: ScreenId) => {
    onClose();
    onNavigate(screen);
  };

  const hubItems: HubItem[] = [
    {
      id: 'camera-scan',
      title: 'Camera Scan',
      badge: 'AI VISION',
      description: 'Scan outfit & garments in real-time',
      screen: 'camera-scan',
      iconBg: 'bg-[#4F46E5]',
      icon: (
        <svg 
          viewBox="0 0 24 24" 
          width="24" 
          height="24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2.2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
      )
    },
    {
      id: 'ar-fitting',
      title: 'AR Virtual Fitting',
      badge: 'REAL-TIME',
      description: 'Try 3D clothing directly on your camera',
      screen: 'ar-tryon',
      iconBg: 'bg-[#4F46E5]',
      icon: (
        <svg 
          viewBox="0 0 24 24" 
          width="24" 
          height="24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2.2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          {/* AR Focus Corners */}
          <path d="M3 7V4a1 1 0 0 1 1-1h3" />
          <path d="M17 3h3a1 1 0 0 1 1 1v3" />
          <path d="M21 17v3a1 1 0 0 1-1 1h-3" />
          <path d="M7 21H4a1 1 0 0 1-1-1v-3" />
          {/* Isometric Cube in center */}
          <path d="M12 7l5 2.8v5.6L12 18l-5-2.6V9.8z" />
          <path d="M12 7v5.5" />
          <path d="M12 12.5l5-2.7" />
          <path d="M12 12.5l-5-2.7" />
        </svg>
      )
    },
    {
      id: 'wardrobe',
      title: 'Virtual Wardrobe',
      badge: 'CLOSET',
      description: 'Organize, match and customize looks',
      screen: 'wardrobe',
      iconBg: 'bg-[#9333EA]',
      icon: (
        <svg 
          viewBox="0 0 24 24" 
          width="24" 
          height="24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2.2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <path d="M12 4a2.5 2.5 0 0 1 2.5 2.5c0 1.2-.8 2.2-2 2.4L20 14.5a1.5 1.5 0 0 1-.8 2.7H4.8A1.5 1.5 0 0 1 4 14.5L11.5 9" />
          <path d="M3 19h18" />
        </svg>
      )
    },
    {
      id: 'stylist',
      title: 'AI Fashion Stylist',
      badge: 'GENAI',
      description: 'Personalized outfit recommendations',
      screen: 'chat',
      iconBg: 'bg-[#059669]',
      icon: (
        <svg 
          viewBox="0 0 24 24" 
          width="24" 
          height="24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2.2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          {/* Head silhouette */}
          <path d="M12 3a7 7 0 0 0-7 7c0 2.8 1.6 5.3 4 6.4V19a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-2.6c2.4-1.1 4-3.6 4-6.4a7 7 0 0 0-7-7z" />
          {/* Inner Brain / Sparkle gear */}
          <circle cx="12" cy="10" r="2.5" />
          <path d="M12 7.5v-1" />
          <path d="M12 13.5v-1" />
          <path d="M9.5 10h-1" />
          <path d="M14.5 10h1" />
        </svg>
      )
    },
    {
      id: 'showroom',
      title: 'NOVA Showroom',
      badge: 'DROPS',
      description: 'Explore brand drops and curated collections',
      screen: 'showroom',
      iconBg: 'bg-[#EA580C]',
      icon: (
        <svg 
          viewBox="0 0 24 24" 
          width="24" 
          height="24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2.2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <path d="M3 9l2-5h14l2 5" />
          <path d="M3 9a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 4 0" />
          <path d="M4 11.5V20a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8.5" />
          <path d="M9 21v-7a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v7" />
        </svg>
      )
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center pointer-events-auto">
      {/* Dimmed backdrop overlay */}
      <div 
        className="fixed inset-0 bg-black/65 backdrop-blur-[2px] transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Bottom Sheet Container matching reference screenshot */}
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="nova-hub-heading"
        className="relative w-full max-w-md bg-[#0D1527] border-t border-x border-[#1E2E4E] rounded-t-[32px] px-5 pt-3 pb-8 z-10 shadow-[0_-16px_48px_rgba(0,0,0,0.8)] animate-in slide-in-from-bottom duration-300"
      >
        {/* Top Centered Drag Handle */}
        <div className="flex justify-center mb-4">
          <div className="w-12 h-1.5 bg-[#CBD5E1]/80 rounded-full" />
        </div>

        {/* Header: Title + Close Button */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#6045FF] inline-block shadow-[0_0_8px_#6045FF]" />
              <h2 id="nova-hub-heading" className="text-2xl font-black text-white tracking-tight">
                NOVA Hub
              </h2>
            </div>
            <p className="text-xs text-[#94A3B8] font-medium mt-1">
              Instant access to camera vision, AR fitting and AI tools
            </p>
          </div>

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close NOVA Hub"
            className="w-9 h-9 rounded-full bg-[#1E293B]/70 hover:bg-[#334155] border border-white/10 flex items-center justify-center text-[#94A3B8] hover:text-white transition-all cursor-pointer active:scale-90"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* 5 Stacked Feature Cards */}
        <div className="space-y-3">
          {hubItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelect(item.screen)}
              className="w-full bg-[#101B33] hover:bg-[#152342] active:bg-[#192b52] border border-[#1E2E4E] hover:border-[#2D4373] rounded-[20px] p-3.5 flex items-center justify-between text-left transition-all active:scale-[0.98] cursor-pointer group shadow-sm"
            >
              {/* Left side: Icon Tile + Text info */}
              <div className="flex items-center gap-3.5 min-w-0">
                {/* Colored Icon Tile */}
                <div className={`w-12 h-12 rounded-[16px] ${item.iconBg} flex items-center justify-center text-white shrink-0 shadow-md group-hover:scale-105 transition-transform duration-200`}>
                  {item.icon}
                </div>

                {/* Title + Badge + Subtitle */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-[15px] tracking-tight group-hover:text-white">
                      {item.title}
                    </span>
                    <span className="bg-[#1D1B48] text-[#818CF8] text-[9.5px] font-bold px-2 py-0.5 rounded-[5px] uppercase tracking-wider">
                      {item.badge}
                    </span>
                  </div>
                  <p className="text-[12px] text-[#94A3B8] truncate mt-0.5 font-normal">
                    {item.description}
                  </p>
                </div>
              </div>

              {/* Right side: Chevron */}
              <div className="pl-2 shrink-0">
                <svg 
                  viewBox="0 0 24 24" 
                  width="18" 
                  height="18" 
                  fill="none" 
                  stroke="#6045FF" 
                  strokeWidth="2.5" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  className="group-hover:translate-x-0.5 transition-transform duration-200"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
