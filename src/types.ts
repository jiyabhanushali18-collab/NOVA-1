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
  | 'setup-preferences'
  | 'profile-analysis';

export interface ProductItem {
  id: string;
  productId?: string;
  vendorId?: string;
  vendorName?: string;
  vendorLogoUrl?: string;
  name: string;
  category: string;
  description?: string;
  price: number;
  originalPrice?: number;
  discountPrice?: number;
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
  isTopRated?: boolean;
  isFeatured?: boolean;
  badge?: string;
  details: string[];
  createdAt?: any;
}

export interface ProductReview {
  id: string;
  productId?: string;
  vendorId?: string;
  userId?: string;
  userName?: string;
  rating: number;
  comment?: string;
  createdAt?: any;
  reviewer?: string;
  text?: string;
  date?: string;
  source?: 'tryon' | 'product';
  accountUid?: string;
}

export interface VendorItem {
  id: string;
  vendorId: string;
  vendorName: string;
  logoUrl: string;
  bannerUrl?: string;
  description?: string;
  followers?: number;
  rating?: number;
  isVerified?: boolean;
  isActive?: boolean;
  createdAt?: any;
  productCount?: number;
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

export interface NovaAnalysisProfile {
  skinTone: string;
  undertone: string;
  faceShape: string;
  hairType: string;
  eyeColor: string;
  bodyType: string;
  heightEstimate: string;
  recommendedFit: string;
  recommendedColors: string[];
  eyewearSuggestions: string[];
  stylePreference: string;
  confidence: {
    skinToneDetection: number;
    faceShapeDetection: number;
    stylePreferenceDetection: number;
    bodyAnalysis: number;
  };
  selfieUrl?: string;
  imageHash?: string;
  rawAnalysis?: NovaStyleAnalysisResult;
  cached?: boolean;
  analyzedAt: string;
}

export type NovaAnalysisValue<T extends string> = {
  value: T;
  confidence: number;
};

export type SkinToneValue = 'fair' | 'light-medium' | 'medium' | 'tan' | 'deep' | 'unknown';
export type FaceShapeValue = 'oval' | 'round' | 'square' | 'heart' | 'diamond' | 'rectangle' | 'unknown';
export type HairTypeValue = 'straight' | 'wavy' | 'curly' | 'coily' | 'unknown';
export type HairColorValue = 'black' | 'dark brown' | 'brown' | 'blonde' | 'red' | 'gray' | 'unknown';
export type OutfitStyleValue = 'casual' | 'smart casual' | 'formal' | 'streetwear' | 'ethnic' | 'sporty' | 'unknown';

export interface NovaStyleAnalysis {
  skinTone: NovaAnalysisValue<SkinToneValue>;
  faceShape: NovaAnalysisValue<FaceShapeValue>;
  hairType: NovaAnalysisValue<HairTypeValue>;
  hairColor: NovaAnalysisValue<HairColorValue>;
  outfitStyle: NovaAnalysisValue<OutfitStyleValue>;
}

export interface NovaStyleAnalysisResult {
  analysis: NovaStyleAnalysis;
  recommendedColors: string[];
  recommendedFit: string;
  eyewearSuggestions: string[];
  styleSummary: string;
  error?: string;
  imageHash?: string;
  cached?: boolean;
  analyzedAt?: string;
}

export interface NovaAccount {
  uid: string;
  name?: string;
  username: string;
  email: string;
  profilePhoto?: string;
  gender?: string;
  size?: string;
  wardrobeCount?: number;
  createdAt: number;
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
