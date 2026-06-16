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
  | 'wardrobe'
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

export type WardrobeGender = 'Male' | 'Female';
export type WardrobeSize = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL' | 'XXXL';
export type WardrobeScanMethod = 'Live Scan' | 'Upload Photo';

export interface WardrobeDetectedAttributes {
  primaryColor: string;
  secondaryColor: string;
  pattern: string;
  fabric: string;
  style: string;
  sleeveType: string;
  neckType: string;
}

export interface WardrobeItem {
  id: string;
  category: string;
  gender: WardrobeGender;
  size: WardrobeSize;
  generatedImage: string;
  originalScan: string;
  colors: string[];
  pattern: string;
  fabric: string;
  tags: string[];
  dateAdded: string;
  attributes: WardrobeDetectedAttributes;
}

export interface WardrobeProfile {
  gender?: WardrobeGender;
  size?: WardrobeSize;
}

export interface OutfitBuilderSeed {
  wardrobeItemId: string;
  occasion?: string;
  weatherContext?: string;
}

export interface CapsuleWardrobePlan {
  id: string;
  name: string;
  itemIds: string[];
  tags: string[];
}
