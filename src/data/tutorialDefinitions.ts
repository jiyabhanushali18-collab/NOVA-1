import { ScreenId } from '../types';

export type TutorialFeatureId =
  | 'ar-tryon'
  | 'virtual-wardrobe'
  | 'camera-scan'
  | 'ai-assistant'
  | 'showroom'
  | 'full-app';

export interface TutorialStep {
  id: string;
  title: string;
  instruction: string;
  targetSelector: string;
  requiredScreen: ScreenId;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
  actionRequired?: 'tap' | 'state_change' | 'none';
  advanceEvent?: string;
  actionLabel?: string;
  allowTargetClick?: boolean;
}

export interface TutorialDefinition {
  id: TutorialFeatureId;
  title: string;
  badge: string;
  icon: string;
  description: string;
  startScreen: ScreenId;
  steps: TutorialStep[];
}

export const TUTORIAL_DEFINITIONS: Record<TutorialFeatureId, TutorialDefinition> = {
  'ar-tryon': {
    id: 'ar-tryon',
    title: 'AR Try-On',
    badge: 'Real-Time AR',
    icon: 'view_in_ar',
    description: 'See how selected outfits look on you in the live camera preview.',
    startScreen: 'ar-tryon',
    steps: [
      {
        id: 'ar-intro',
        title: 'Welcome to AR Try-On',
        instruction: 'Experience real-time AI styling directly on your camera. See how designer outfits look on you instantly before buying.',
        targetSelector: '[data-tutorial-target="ar-camera-preview"]',
        requiredScreen: 'ar-tryon',
        position: 'bottom',
        actionLabel: 'Next',
        allowTargetClick: false
      },
      {
        id: 'ar-framing',
        title: 'Framing & Camera Preview',
        instruction: 'Stand about 1.5–2 meters back so your upper body is clearly framed. Ensure good lighting — the green frame confirms your posture is detected.',
        targetSelector: '[data-tutorial-target="ar-camera-preview"]',
        requiredScreen: 'ar-tryon',
        position: 'bottom',
        actionLabel: "I'm In Position",
        allowTargetClick: false
      },
      {
        id: 'ar-outfit',
        title: 'Choose Your Outfit',
        instruction: 'Swipe through the curated carousel below and tap any garment you want to try on.',
        targetSelector: '[data-tutorial-target="ar-outfit-carousel"]',
        requiredScreen: 'ar-tryon',
        position: 'top',
        actionRequired: 'tap',
        advanceEvent: 'nova:tutorial:outfit_selected',
        actionLabel: 'Select & Next',
        allowTargetClick: true
      },
      {
        id: 'ar-tryon-live',
        title: 'Start Live Try-On',
        instruction: "Tap 'Try On Live' to connect with NOVA's real-time optical vision engine and render the garment onto your live camera.",
        targetSelector: '[data-tutorial-target="ar-tryon-live-btn"]',
        requiredScreen: 'ar-tryon',
        position: 'top',
        actionRequired: 'tap',
        advanceEvent: 'nova:tutorial:tryon_live_started',
        actionLabel: 'Next',
        allowTargetClick: true
      },
      {
        id: 'ar-controls',
        title: 'Smart Camera Controls',
        instruction: 'Use the flip button to switch between front and back cameras, or tap the bulb icon to fine-tune brightness and exposure in dim rooms.',
        targetSelector: '[data-tutorial-target="ar-camera-controls"]',
        requiredScreen: 'ar-tryon',
        position: 'top',
        actionLabel: 'Got It',
        allowTargetClick: true
      },
      {
        id: 'ar-shutter',
        title: 'Capture Your Look',
        instruction: 'Strike a pose and tap the shutter button in the center to capture a high-resolution snapshot of your styled look.',
        targetSelector: '[data-tutorial-target="ar-shutter-btn"]',
        requiredScreen: 'ar-tryon',
        position: 'top',
        actionRequired: 'tap',
        advanceEvent: 'nova:tutorial:look_captured',
        actionLabel: 'Next',
        allowTargetClick: true
      },
      {
        id: 'ar-save',
        title: 'Save Your Look',
        instruction: "Love how it looks? Tap 'Save Look' to bookmark this outfit in your Virtual Wardrobe and Profile for quick access anytime.",
        targetSelector: '[data-tutorial-target="ar-save-look-btn"]',
        requiredScreen: 'ar-tryon',
        position: 'top',
        actionRequired: 'tap',
        advanceEvent: 'nova:tutorial:look_saved',
        actionLabel: 'Finish & Rate',
        allowTargetClick: true
      }
    ]
  },

  'virtual-wardrobe': {
    id: 'virtual-wardrobe',
    title: 'Virtual Wardrobe',
    badge: 'Wardrobe AI',
    icon: 'checkroom',
    description: 'Explore and manage clothes in your digital closet.',
    startScreen: 'wardrobe',
    steps: [
      {
        id: 'wardrobe-intro',
        title: 'Your Digital Wardrobe',
        instruction: 'Organize, mix, and match every piece in your personal collection with AI assistance.',
        targetSelector: '[data-tutorial-target="wardrobe-header"]',
        requiredScreen: 'wardrobe',
        position: 'bottom',
        actionLabel: 'Next'
      },
      {
        id: 'wardrobe-categories',
        title: 'Filter by Garment Type',
        instruction: 'Easily switch between Tops, Bottoms, Dresses, Outerwear, and Ethnic wear with these category tabs.',
        targetSelector: '[data-tutorial-target="wardrobe-categories"]',
        requiredScreen: 'wardrobe',
        position: 'bottom',
        actionLabel: 'Next',
        allowTargetClick: true
      },
      {
        id: 'wardrobe-add',
        title: 'Add or Scan Clothes',
        instruction: 'Tap here to snap a photo of any real garment in your closet or upload from your gallery to add it to your digital wardrobe.',
        targetSelector: '[data-tutorial-target="wardrobe-add-btn"]',
        requiredScreen: 'wardrobe',
        position: 'top',
        actionLabel: 'Next',
        allowTargetClick: true
      },
      {
        id: 'wardrobe-items',
        title: 'Mix & Match Outfits',
        instruction: 'Tap any wardrobe item to view AI-suggested pairings, build matching outfits, or wear them virtually in AR.',
        targetSelector: '[data-tutorial-target="wardrobe-items-grid"]',
        requiredScreen: 'wardrobe',
        position: 'top',
        actionLabel: 'Complete Tour',
        allowTargetClick: true
      }
    ]
  },

  'camera-scan': {
    id: 'camera-scan',
    title: 'Camera Scan',
    badge: 'Visual Search',
    icon: 'document_scanner',
    description: 'Scan real clothing or tags to find styles.',
    startScreen: 'camera-scan',
    steps: [
      {
        id: 'scan-intro',
        title: 'AI Camera Scanner',
        instruction: 'Point your camera at any garment, outfit in a store, or clothing tag to identify matching styles instantly.',
        targetSelector: '[data-tutorial-target="scan-viewfinder"]',
        requiredScreen: 'camera-scan',
        position: 'bottom',
        actionLabel: 'Next'
      },
      {
        id: 'scan-framing',
        title: 'Align the Garment',
        instruction: 'Frame the clothing item inside the viewfinder brackets for optimal AI pattern and fabric detection.',
        targetSelector: '[data-tutorial-target="scan-viewfinder"]',
        requiredScreen: 'camera-scan',
        position: 'bottom',
        actionLabel: 'Got It'
      },
      {
        id: 'scan-capture',
        title: 'Tap to Scan',
        instruction: "Press the scan button to capture and let NOVA's neural vision search for identical or similar catalog pieces.",
        targetSelector: '[data-tutorial-target="scan-shutter-btn"]',
        requiredScreen: 'camera-scan',
        position: 'top',
        actionLabel: 'Next',
        allowTargetClick: true
      },
      {
        id: 'scan-results',
        title: 'Discover Matching Fits',
        instruction: 'Browse detected items, examine fabric details, add directly to your wardrobe, or try them on in AR.',
        targetSelector: '[data-tutorial-target="scan-viewfinder"]',
        requiredScreen: 'camera-scan',
        position: 'bottom',
        actionLabel: 'Complete Tour'
      }
    ]
  },

  'ai-assistant': {
    id: 'ai-assistant',
    title: 'AI Assistant',
    badge: 'Stylist Chat',
    icon: 'smart_toy',
    description: "Chat with NOVA's smart fashion stylist.",
    startScreen: 'chat',
    steps: [
      {
        id: 'chat-intro',
        title: 'Meet Your Fashion Stylist',
        instruction: 'NOVA Stylist is your 24/7 personal fashion consultant. Ask for event outfit ideas, color coordination advice, or season trends.',
        targetSelector: '[data-tutorial-target="chat-header"]',
        requiredScreen: 'chat',
        position: 'bottom',
        actionLabel: 'Next'
      },
      {
        id: 'chat-messages',
        title: 'Style Advice Stream',
        instruction: 'See tailored outfit recommendations, style tips, and direct links to products that complement your profile.',
        targetSelector: '[data-tutorial-target="chat-messages"]',
        requiredScreen: 'chat',
        position: 'top',
        actionLabel: 'Next'
      },
      {
        id: 'chat-prompts',
        title: 'One-Tap Inspiration',
        instruction: "Tap any suggested topic like 'What to wear to a dinner party?' or 'Casual summer outfits' to get instant styling tips.",
        targetSelector: '[data-tutorial-target="chat-quick-prompts"]',
        requiredScreen: 'chat',
        position: 'top',
        actionLabel: 'Next',
        allowTargetClick: true
      },
      {
        id: 'chat-input',
        title: 'Ask Anything',
        instruction: 'Describe your style preferences, upcoming occasions, or budget, and NOVA will curate the perfect look.',
        targetSelector: '[data-tutorial-target="chat-input-bar"]',
        requiredScreen: 'chat',
        position: 'top',
        actionLabel: 'Complete Tour',
        allowTargetClick: true
      }
    ]
  },

  'showroom': {
    id: 'showroom',
    title: 'NOVA Showroom',
    badge: 'Catalog & Store',
    icon: 'storefront',
    description: 'Browse curated collections and trending items.',
    startScreen: 'showroom',
    steps: [
      {
        id: 'showroom-intro',
        title: 'Curated Collections',
        instruction: 'Explore trending fashion, new arrivals, and designer apparel curated specifically for your tastes.',
        targetSelector: '[data-tutorial-target="showroom-header"]',
        requiredScreen: 'showroom',
        position: 'bottom',
        actionLabel: 'Next'
      },
      {
        id: 'showroom-filters',
        title: 'Filter & Refine',
        instruction: 'Quickly filter collections by garment category, price range, brand, or customer ratings.',
        targetSelector: '[data-tutorial-target="showroom-filters"]',
        requiredScreen: 'showroom',
        position: 'bottom',
        actionLabel: 'Next',
        allowTargetClick: true
      },
      {
        id: 'showroom-grid',
        title: 'Browse Available Styles',
        instruction: 'Tap on any product card to see high-res photos, available sizes, customer reviews, and fabric composition.',
        targetSelector: '[data-tutorial-target="showroom-product-grid"]',
        requiredScreen: 'showroom',
        position: 'top',
        actionLabel: 'Next'
      },
      {
        id: 'showroom-action',
        title: 'Try Before You Buy',
        instruction: "Hit 'Try On' to see it on yourself in real time, or add it to your shopping bag with one tap.",
        targetSelector: '[data-tutorial-target="showroom-top-collections"]',
        requiredScreen: 'showroom',
        position: 'top',
        actionLabel: 'Complete Tour',
        allowTargetClick: true
      }
    ]
  },

  'full-app': {
    id: 'full-app',
    title: 'Explore Full App',
    badge: 'Complete Tour',
    icon: 'explore',
    description: 'Guided tour through the core features of NOVA.',
    startScreen: 'home',
    steps: [
      {
        id: 'tour-home',
        title: 'Home Dashboard',
        instruction: 'Your central hub for optical vision fashion, recent try-ons, and personalized styling recommendations.',
        targetSelector: '[data-tutorial-target="home-hero"]',
        requiredScreen: 'home',
        position: 'bottom',
        actionLabel: 'Next'
      },
      {
        id: 'tour-ar',
        title: 'AR Try-On',
        instruction: 'Tap here to enter the smart mirror camera and try on clothes virtually before purchasing.',
        targetSelector: '[data-tutorial-target="home-ar-tryon-card"]',
        requiredScreen: 'home',
        position: 'top',
        actionLabel: 'Next'
      },
      {
        id: 'tour-wardrobe',
        title: 'Digital Wardrobe',
        instruction: 'Keep track of your physical wardrobe, build matching outfits, and never wonder what to wear.',
        targetSelector: '[data-tutorial-target="home-wardrobe-card"]',
        requiredScreen: 'home',
        position: 'top',
        actionLabel: 'Next'
      },
      {
        id: 'tour-scan',
        title: 'Camera Scanner',
        instruction: 'Scan any piece of clothing or fabric tag to find matching or similar items in the catalog.',
        targetSelector: '[data-tutorial-target="home-scan-card"]',
        requiredScreen: 'home',
        position: 'top',
        actionLabel: 'Next'
      },
      {
        id: 'tour-stylist',
        title: 'AI Fashion Stylist',
        instruction: 'Chat with NOVA Stylist for personalized fashion advice, event dressing, and color theory.',
        targetSelector: '[data-tutorial-target="home-stylist-card"]',
        requiredScreen: 'home',
        position: 'top',
        actionLabel: 'Next'
      },
      {
        id: 'tour-showroom',
        title: 'NOVA Showroom',
        instruction: 'Browse exclusive designer drops, top trending outfits, and enjoy seamless in-app checkout.',
        targetSelector: '[data-tutorial-target="home-showroom-card"]',
        requiredScreen: 'home',
        position: 'top',
        actionLabel: 'Finish Tour'
      }
    ]
  }
};

export const TUTORIAL_CARD_ITEMS: {
  id: TutorialFeatureId;
  title: string;
  badge: string;
  icon: string;
  description: string;
  color: string;
}[] = [
  {
    id: 'ar-tryon',
    title: 'AR Try-On',
    badge: 'Popular',
    icon: 'view_in_ar',
    description: 'See how selected outfits look on you in the camera preview.',
    color: 'from-[#6D4AFF] to-[#553BE2]'
  },
  {
    id: 'virtual-wardrobe',
    title: 'Virtual Wardrobe',
    badge: 'Smart Closet',
    icon: 'checkroom',
    description: 'Explore and manage clothes in your closet.',
    color: 'from-[#8B6DFD] to-[#6D4AFF]'
  },
  {
    id: 'camera-scan',
    title: 'Camera Scan',
    badge: 'AI Vision',
    icon: 'document_scanner',
    description: 'Scan real clothing or tags to find styles.',
    color: 'from-[#06B6D4] to-[#0284C7]'
  },
  {
    id: 'ai-assistant',
    title: 'AI Assistant',
    badge: '24/7 Stylist',
    icon: 'smart_toy',
    description: "Chat with NOVA's smart fashion stylist.",
    color: 'from-[#EC4899] to-[#8B5CF6]'
  },
  {
    id: 'showroom',
    title: 'NOVA Showroom',
    badge: 'Store',
    icon: 'storefront',
    description: 'Browse curated collections and trending items.',
    color: 'from-[#F59E0B] to-[#D97706]'
  },
  {
    id: 'full-app',
    title: 'Explore Full App',
    badge: 'Complete Tour',
    icon: 'explore',
    description: 'Guided tour through the core features of NOVA.',
    color: 'from-[#10B981] to-[#059669]'
  }
];
