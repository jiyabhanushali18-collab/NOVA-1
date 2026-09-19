export type ScreenId = 'home' | 'scan-outfit' | 'virtual-wardrobe' | 'ar-tryon' | 'outfit-builder' | 'profile';

export type WardrobeGender = 'Male' | 'Female';
export type WardrobeSize = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL' | 'XXXL';
export type WardrobeScanMethod = 'Live Scan' | 'Upload Photo';

export interface WardrobeDetectedAttributes {
  category?: string;
  primaryColor?: string;
  secondaryColor?: string;
  pattern?: string;
  sleeveType?: string;
  neckType?: string;
  fit?: string;
  material?: string;
  fabric?: string;
  style?: string;
  rise?: string;
  length?: string;
}

export interface WardrobeItem {
  id: string;
  category: string;
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
}

export interface WardrobeProfile {
  gender?: WardrobeGender;
  size?: WardrobeSize;
}

export interface ProductItem {
  id: string;
  name: string;
  category: string;
  subcategory?: string;
  brand?: string;
  price: number;
  rating?: number;
  reviewsCount?: number;
  imageUrl: string;
  mainImage?: string;
  images?: string[];
  colors: string[];
  sizes: string[];
  details: string[];
  tags: string[];
  inStock: boolean;
  description?: string;
  fabric?: string;
  fit?: string;
  gender?: string;
  pattern?: string;
  sleeveType?: string;
  neckType?: string;
  createdAt?: string;
}