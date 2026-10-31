export type LegalDocumentType = 'terms' | 'privacy';

export type ScreenId =
  | 'home'
  | 'ar-tryon'
  | 'tryon-result'
  | 'camera-scan'
  | 'profile'
  | 'product-details'
  | 'scan-outfit'
  | 'virtual-wardrobe'
  | 'outfit-builder'
  | 'chat'
  | 'cart'
  | 'showroom'
  | 'wardrobe'
  | 'login'
  | 'signup'
  | 'email-verification'
  | 'splash'
  | 'onboarding'
  | 'setup-preferences'
  | 'profile-analysis'
  | 'terms'
  | 'privacy'
  | 'faq'
  | 'admin-campaigns';

export interface LegalConsentRecord {
  accepted: boolean;
  termsVersion: string;
  privacyVersion: string;
  consentedAt: string;
  userId?: string;
  email?: string;
  source?: 'signup' | 'renewal';
  serverRecordedAt?: string;
}

export interface ProductVariant {
  id: string;
  colorName: string;
  colorHex: string;
  images: string[];
  thumbnail: string;
  stock?: number;
  sku?: string;
  isAvailable: boolean;
  displayOrder: number;
  color?: string;
}

export interface ClothingVariant {
  color: string;
  sizes: string[];
  stock: number;
  images: string[];
}

export interface ClothingProduct {
  brand?: string;
  fabric?: string;
  fit?: string;
  gender?: string;
  occasion?: string;
  season?: string;
  pattern?: string;
  stretch?: string;
  sleeveType?: string;
  neckType?: string;
  careInstructions?: string;
  tags?: string[];
  newVariants?: ClothingVariant[];
}

export interface ProductItem extends ClothingProduct {
  id: string;
  productId?: string;
  vendorId?: string;
  vendorName?: string;
  vendorLogoUrl?: string;
  name: string;
  category: string;
  subcategory?: string;
  description?: string;
  price: number;
  originalPrice?: number;
  discountPrice?: number;
  rating?: number;
  reviewsCount?: number;
  imageUrl: string;
  mainImage?: string;
  images?: string[];
  imageUrls?: string[];
  colorImages?: Record<string, string | string[]>;
  variants?: ProductVariant[];
  defaultVariantId?: string;
  colors: string[];
  sizes: string[];
  inStock: boolean;
  stockLeft?: number;
  isTopRated?: boolean;
  isFeatured?: boolean;
  badge?: string;
  details: string[];
  tags?: string[];
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

export interface NovaAiPersonalProfile {
  bodyShape: 'Hourglass' | 'Pear' | 'Inverted Triangle' | 'Rectangle' | 'Apple' | 'Athletic' | 'Unknown' | string;
  bodyShapeConfidence: number;
  bodyShapeExplanation: string;
  skinTone: 'Fair' | 'Light' | 'Medium' | 'Olive' | 'Tan' | 'Deep' | 'Unknown' | string;
  undertone: 'Warm' | 'Cool' | 'Neutral' | 'Unknown' | string;
  skinToneConfidence: number;
  skinToneExplanation: string;
  suggestedSize: 'XS' | 'S' | 'M' | 'L' | 'unknown';
  sizeConfidence: number;
  sizeExplanation: string;
  userConfirmedBodyShape?: string;
  userConfirmedSkinTone?: string;
  userConfirmedUndertone?: string;
  userConfirmedSize?: 'XS' | 'S' | 'M' | 'L';
  analyzedAt: string;
  photoPreview?: string;
}

export interface NovaAiProductRecommendation {
  productId: string;
  name: string;
  category: string;
  subcategory: string;
  price: number;
  imageUrl: string;
  colors: string[];
  primaryColor: string;
  fit?: string;
  silhouette?: string;
  availableSizes: string[];
  recommendedSize: string;
  sizeStatus: 'user_confirmed' | 'estimated' | 'size_not_confirmed';
  sizeReason: string;
  matchScore: number;
  reasoning: {
    summary: string;
    colorHarmonies: string;
    silhouetteHarmonies: string;
  };
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

export interface DeliveryAddress {
  id?: string;
  label?: string;
  fullName: string;
  phone: string;
  flatNo: string;
  landmark?: string;
  city: string;
  state?: string;
  pinCode: string;
  country?: string;
  formattedAddress?: string;
  isDefault?: boolean;
  updatedAt?: string;
}

export interface OrderRecord {
  orderId: string;
  userId: string;
  isGuest?: boolean;
  items: CartItem[];
  subtotal: number;
  taxes: number;
  discount: number;
  shipping: number;
  grandTotal: number;
  paymentMethod: 'upi' | 'card' | 'cod';
  deliveryAddress: DeliveryAddress;
  createdAt: string;
}

export interface NovaAccount {
  uid: string;
  name?: string;
  username: string;
  email: string;
  contactEmail?: string;
  phone?: string;
  address?: string;
  pinCode?: string;
  deliveryAddress?: DeliveryAddress;
  savedAddresses?: DeliveryAddress[];
  sessionToken?: string;
  accountType?: 'Guest' | 'Registered' | 'Premium';
  isGuest?: boolean;
  profilePhoto?: string;
  gender?: string;
  size?: string;
  wardrobeCount?: number;
  createdAt: number;
  legalConsent?: LegalConsentRecord;
}

export type WardrobeGender = 'Male' | 'Female';
export type WardrobeSize = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL' | 'XXXL';
export type WardrobeScanMethod = 'Live Scan' | 'Upload Photo';

export * from './types/wardrobe';
import type { CanonicalGarmentData } from './types/wardrobe';

export interface WardrobeDetectedAttributes {
  category?: string;
  subcategory?: string;
  primaryColor?: string;
  secondaryColor?: string;
  colorFamily?: string[];
  pattern?: string;
  sleeveType?: string;
  neckType?: string;
  fit?: string;
  silhouette?: string;
  material?: string;
  fabric?: string;
  fabricConfidence?: 'low' | 'medium' | 'high' | 'inferred';
  style?: string;
  secondaryStyles?: string[];
  occasions?: string[];
  seasons?: string[];
  formality?: string;
  rise?: string;
  length?: string;
  visibleDetails?: string[];
  compatibleCategories?: string[];
  compatibleStyles?: string[];
  colorCompatibility?: string[];
  aiDescription?: string;
  schemaVersion?: string;
}

export interface WardrobeItem {
  id: string;
  category: string;
  gender?: WardrobeGender;
  colors: string[];
  pattern: string;
  fabric: string;
  size: WardrobeSize | string;
  dateAdded: string;
  generatedImage: string;
  originalScan?: string;
  tags: string[];
  /** Kept locally so closet insights can suggest neglected pieces. */
  lastWorn?: string;
  timesWorn?: number;
  attributes: WardrobeDetectedAttributes;
  /** Full canonical machine-readable garment intelligence for NOVA AI */
  canonical?: CanonicalGarmentData;
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


export interface SavedLook {
  id: string;
  userId: string;
  imageUrl: string;
  thumbnailUrl?: string;
  garmentId?: string;
  garmentName: string;
  garmentCategory?: string;
  garmentImg?: string;
  savedAt: string;
  gallerySaved?: boolean;
  galleryUri?: string;
  filename?: string;
  width?: number;
  height?: number;
}

export interface OutfitScanRecord {
  id: string;
  userId?: string;
  name: string;
  time: string;
  timestamp: number;
  imageUrl: string;
  score?: number | string;
  category?: string;
  colors?: string[];
  attributes?: {
    fit?: string;
    style?: string;
    season?: string;
  };
  matchedProductId?: string;
  matchedProductName?: string;
  matchedProductPrice?: number;
  matchedProductImage?: string;
}
