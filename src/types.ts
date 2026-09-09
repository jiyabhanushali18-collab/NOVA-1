export type ScreenId = 'home' | 'scan-outfit' | 'virtual-wardrobe' | 'ar-tryon' | 'outfit-builder' | 'profile';

export type WardrobeGender = 'Male' | 'Female';
export type WardrobeSize = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL' | 'XXXL';
export type WardrobeScanMethod = 'Live Scan' | 'Upload Photo';

export interface WardrobeDetectedAttributes {
<<<<<<< HEAD
  category?: string;
  primaryColor?: string;
  secondaryColor?: string;
  pattern?: string;
  sleeveType?: string;
  neckType?: string;
  fit?: string;
  material?: string;
=======
  primaryColor: string;
  secondaryColor: string;
  pattern: string;
  fabric: string;
  style: string;
  sleeveType: string;
  neckType: string;
  rise?: string;
  length?: string;
>>>>>>> e62f32f31b9f107a939cba2a3d51796f8e7cde6c
}

export interface WardrobeItem {
  id: string;
  category: string;
  colors: string[];
  pattern: string;
  fabric: string;
  size: WardrobeSize | string;
  dateAdded: string;
<<<<<<< HEAD
  generatedImage: string;
  tags: string[];
  attributes: Record<string, any>;
=======
  /** Kept locally so closet insights can suggest neglected pieces. */
  lastWorn?: string;
  timesWorn?: number;
  attributes: WardrobeDetectedAttributes;
>>>>>>> e62f32f31b9f107a939cba2a3d51796f8e7cde6c
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