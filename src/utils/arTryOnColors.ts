import { ProductItem, ProductVariant } from '../types';
import { normalizeColorKey, getRequiredColorHex, isValidHexColor, isLightColor } from './colors';
import { findColorImages } from './productVariants';
import { swipeModels } from '../data';

export interface GarmentColorOption {
  name: string;
  hex: string;
  imageUrl?: string;
  variantId?: string;
  sku?: string;
  isAvailable: boolean;
}

/**
 * Resolves the variant-specific garment image URL for a product and color.
 * Shared/default photos are not returned for a multi-color product.
 */
export function getGarmentColorImage(
  product: ProductItem | undefined,
  colorName: string
): string | undefined {
  if (!product || !colorName) return undefined;
  const targetKey = normalizeColorKey(colorName);
  if (!targetKey) return undefined;

  const sharedImagesFromOtherColors = new Set<string>();
  (product.variants || []).forEach((variant) => {
    if (normalizeColorKey(variant.colorName || variant.color) === targetKey) return;
    (variant.images || []).forEach((image) => sharedImagesFromOtherColors.add(image));
    if (variant.thumbnail) sharedImagesFromOtherColors.add(variant.thumbnail);
  });

  // 1. Explicit variant images, excluding photos also assigned to other colors.
  if (Array.isArray(product.variants) && product.variants.length > 0) {
    const matched = product.variants.find((v) => {
      const vKey = normalizeColorKey(v.colorName || v.color);
      return vKey === targetKey;
    });
    if (matched) {
      const images = [...(matched.images || []), matched.thumbnail]
        .filter((image): image is string => typeof image === 'string' && image.trim().length > 0)
        .filter((image) => !sharedImagesFromOtherColors.has(image));
      if (images.length > 0) return images[0].trim();
      if (product.defaultVariantId === matched.id) {
        const defaultImage = matched.images?.[0] || matched.thumbnail;
        if (defaultImage?.trim()) return defaultImage.trim();
      }
    }
  }

  // 2. Product-level colorImages map
  if (product.colorImages) {
    const matchedImgs = findColorImages(product.colorImages, colorName);
    const specific = matchedImgs.find((image) => !sharedImagesFromOtherColors.has(image));
    if (specific) return specific;
  }

  // A legacy single-color record can use its default product image. A
  // multi-color product must have a variant-specific image for this color.
  if (Array.isArray(product.colors) && product.colors.length === 1) {
    if (normalizeColorKey(product.colors[0]) === targetKey) {
      return product.imageUrl || product.mainImage;
    }
  }

  return undefined;
}

/**
 * Returns model background preview for a specific color if known.
 */
export function getGarmentColorModelBg(colorName: string): string | undefined {
  if (!colorName) return undefined;
  const targetKey = normalizeColorKey(colorName);
  const exact = swipeModels[colorName];
  if (exact) return exact;
  const matchedKey = Object.keys(swipeModels).find((k) => normalizeColorKey(k) === targetKey);
  return matchedKey ? swipeModels[matchedKey] : undefined;
}

/**
 * Extract available, in-stock color options for a product.
 * Returns empty array if product has no color data or is completely out of stock.
 * Only returns colors actually available for that product.
 */
export function getProductColorOptions(product: ProductItem | undefined): GarmentColorOption[] {
  if (!product) return [];

  // Check overall product availability
  if (product.inStock === false || (product.stockLeft !== undefined && product.stockLeft <= 0)) {
    return [];
  }

  // Case 1: Explicit variants
  if (Array.isArray(product.variants) && product.variants.length > 0) {
    const seen = new Set<string>();
    const options: GarmentColorOption[] = [];

    for (const v of product.variants) {
      const name = (v.colorName || v.color || '').trim();
      const key = normalizeColorKey(name);
      if (!name || !key || seen.has(key)) continue;

      // Filter out unavailable / out-of-stock variants
      const isAvailable = v.isAvailable !== false && (v.stock === undefined || v.stock > 0);
      if (!isAvailable) continue;

      seen.add(key);
      const hex = v.colorHex && isValidHexColor(v.colorHex)
        ? v.colorHex
        : getRequiredColorHex(name);
      const img = getGarmentColorImage(product, name);
      if (!img) continue;

      options.push({
        name,
        hex,
        imageUrl: img,
        variantId: v.id,
        sku: v.sku,
        isAvailable: true,
      });
    }

    return options;
  }

  // Case 2: Product has colors array
  if (Array.isArray(product.colors) && product.colors.length > 0) {
    const seen = new Set<string>();
    const options: GarmentColorOption[] = [];

    for (const c of product.colors) {
      const name = String(c || '').trim();
      const key = normalizeColorKey(name);
      if (!name || !key || seen.has(key)) continue;

      // If newVariants specify per-color stock, verify it
      if (Array.isArray(product.newVariants) && product.newVariants.length > 0) {
        const matchingNewVariant = product.newVariants.find(
          (nv) => normalizeColorKey(nv.color) === key
        );
        if (matchingNewVariant && matchingNewVariant.stock !== undefined && matchingNewVariant.stock <= 0) {
          continue; // Out of stock color
        }
      }

      seen.add(key);
      const hex = getRequiredColorHex(name);
      const img = getGarmentColorImage(product, name);
      if (!img) continue;

      options.push({
        name,
        hex,
        imageUrl: img,
        isAvailable: true,
      });
    }

    return options;
  }

  return [];
}
