export type ScreenId =
  | 'home'
  | 'ar-tryon'
  | 'tryon-result'
  | 'camera-scan'
  | 'profile'
  | 'product-details'
  | 'scan-outfit'
  | 'chat'
  | 'cart'
  | 'showroom'
  | 'login'
  | 'signup'
  | 'splash'
  | 'onboarding'
  | 'setup-preferences';

export interface ProductItem {
  id: string;
  name: string;
  category: string;
  price: number;
  originalPrice?: number;
  rating: number;
  reviewsCount: number;
  imageUrl: string;
  imageUrls?: string[];
  // colorImages can be a single URL or an array of URLs per color
  colorImages?: Record<string, string | string[]>;
  colors: string[];
  sizes: string[];
  inStock: boolean;
  stockLeft?: number;
  badge?: string;
  details: string[];
}

export interface CartItem {
  product: ProductItem;
  quantity: number;
  color: string;
  size: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  isPairingResult?: boolean;
  pairingProducts?: Array<{
    name: string;
    price: number;
    imageUrl: string;
  }>;
}

export interface Measurement {
  label: string;
  value: string;
  iconName: string;
}

export interface Preference {
  label: string;
  value: string;
  iconName: string;
}
