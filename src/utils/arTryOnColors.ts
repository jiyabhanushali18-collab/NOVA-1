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
 * If no specific image exists, returns undefined (caller safely retains existing image).
 */
export function getGarmentColorImage(
  product: ProductItem | undefined,
  colorName: string
): string | undefined {
  if (!product || !colorName) return undefined;
  const targetKey = normalizeColorKey(colorName);
  if (!targetKey) return undefined;

  // 1. Explicit variants array with image or thumbnail
  if (Array.isArray(product.variants) && product.variants.length > 0) {
    const matched = product.variants.find((v) => {
      const vKey = normalizeColorKey(v.colorName || v.color);
      return vKey === targetKey;
    });
    if (matched) {
      if (Array.isArray(matched.images) && matched.images.length > 0 && typeof matched.images[0] === 'string' && matched.images[0].trim()) {
        return matched.images[0].trim();
      }
      if (typeof matched.thumbnail === 'string' && matched.thumbnail.trim()) {
        return matched.thumbnail.trim();
      }
    }
  }

  // 2. Product-level colorImages map
  if (product.colorImages) {
    const matchedImgs = findColorImages(product.colorImages, colorName);
    if (matchedImgs.length > 0 && matchedImgs[0]) {
      return matchedImgs[0];
    }
  }

  // 3. Parallel arrays: imageUrls and colors
  if (
    Array.isArray(product.imageUrls) &&
    Array.isArray(product.colors) &&
    product.imageUrls.length === product.colors.length
  ) {
    const idx = product.colors.findIndex((c) => normalizeColorKey(c) === targetKey);
    if (idx !== -1 && product.imageUrls[idx]) {
      return product.imageUrls[idx];
    }
  }

  // 4. If this is the default/primary color, use product's main imageUrl
  if (Array.isArray(product.colors) && product.colors.length > 0) {
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
      const img = (Array.isArray(v.images) && v.images.length > 0 ? v.images[0] : undefined) || v.thumbnail || getGarmentColorImage(product, name);

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
