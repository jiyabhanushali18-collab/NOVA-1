import { ProductVariant } from '../types';

export const normalizeColorKey = (value: unknown) => (
  typeof value === 'string'
    ? value.toLowerCase().trim().replace(/[^a-z0-9]/g, '')
    : ''
);

export const collectImageUrls = (value: unknown): string[] => {
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  if (typeof value === 'number') return [String(value).trim()];
  if (Array.isArray(value)) return uniqueStrings(value.flatMap((item) => collectImageUrls(item)));

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return uniqueStrings([
      ...collectImageUrls(record.images),
      ...collectImageUrls(record.imageUrls),
      ...collectImageUrls(record.imageUrl),
      ...collectImageUrls(record.mainImage),
      ...collectImageUrls(record.url),
      ...collectImageUrls(record.src),
      ...collectImageUrls(record.image),
      ...collectImageUrls(record.img),
      ...collectImageUrls(record.image1),
      ...collectImageUrls(record.imageUrl1)
    ]);
  }

  return [];
};

export const uniqueStrings = (values: string[]) => (
  values
    .map((value) => String(value || '').trim())
    .filter((value, index, array) => value.length > 0 && array.indexOf(value) === index)
);

const getVariantColor = (value: unknown): string => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const record = value as Record<string, unknown>;
  const candidate = record.color || record.name || record.label || record.colour;
  return typeof candidate === 'string' ? candidate.trim() : '';
};

const getVariantStock = (value: unknown): number | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const candidate = record.stock ?? record.stockLeft ?? record.quantity ?? record.inventory;
  if (candidate === undefined || candidate === null || candidate === '') return undefined;
  const stock = Number(candidate);
  return Number.isFinite(stock) ? stock : undefined;
};

export const findColorImages = (
  colorImages: Record<string, string | string[]> | undefined,
  color: string
): string[] => {
  if (!colorImages || !color) return [];
  const direct = colorImages[color];
  if (direct) return collectImageUrls(direct);

  const normalized = normalizeColorKey(color);
  const normalizedDirect = colorImages[normalized];
  if (normalizedDirect) return collectImageUrls(normalizedDirect);

  const matchedKey = Object.keys(colorImages).find((key) => normalizeColorKey(key) === normalized);
  return matchedKey ? collectImageUrls(colorImages[matchedKey]) : [];
};

export const normalizeProductVariants = (
  data: Record<string, any>,
  colors: string[],
  colorImages?: Record<string, string | string[]>
): ProductVariant[] => {
  const explicitVariants = Array.isArray(data.variants) ? data.variants : [];
  const variants = explicitVariants
    .map((variant): ProductVariant | null => {
      if (!variant || typeof variant !== 'object' || Array.isArray(variant)) return null;
      const color = getVariantColor(variant);
      if (!color) return null;
      const images = collectImageUrls(variant);
      const stock = getVariantStock(variant);
      return {
        color,
        images,
        ...(stock !== undefined ? { stock } : {})
      };
    })
    .filter((variant): variant is ProductVariant => Boolean(variant));

  if (variants.length > 0) return mergeVariants(variants);

  return colors
    .map((color) => {
      const images = findColorImages(colorImages, color);
      return images.length > 0 ? { color, images } : null;
    })
    .filter((variant): variant is ProductVariant => Boolean(variant));
};

export const mergeVariants = (variants: ProductVariant[]): ProductVariant[] => {
  const byColor = new Map<string, ProductVariant>();
  variants.forEach((variant) => {
    const key = normalizeColorKey(variant.color);
    if (!key) return;
    const existing = byColor.get(key);
    if (!existing) {
      byColor.set(key, {
        color: variant.color,
        images: uniqueStrings(variant.images || []),
        ...(variant.stock !== undefined ? { stock: variant.stock } : {})
      });
      return;
    }
    existing.images = uniqueStrings([...(existing.images || []), ...(variant.images || [])]);
    if (existing.stock === undefined && variant.stock !== undefined) existing.stock = variant.stock;
  });
  return Array.from(byColor.values());
};
