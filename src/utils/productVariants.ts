import { ProductVariant } from '../types';
import { getRequiredColorHex, isValidHexColor, normalizeColorKey } from './colors';

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

export const getVariantColor = (value: unknown): string => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const record = value as Record<string, unknown>;
  const candidate = record.colorName || record.color || record.name || record.label || record.colour;
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

const getVariantDisplayOrder = (value: unknown, fallback: number): number => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;
  const record = value as Record<string, unknown>;
  const order = Number(record.displayOrder ?? record.order ?? record.sortOrder ?? fallback);
  return Number.isFinite(order) ? order : fallback;
};

const getVariantId = (variant: Record<string, unknown>, colorName: string, displayOrder: number) => {
  const candidate = variant.id || variant.variantId;
  return typeof candidate === 'string' && candidate.trim()
    ? candidate.trim()
    : `${normalizeColorKey(colorName) || 'variant'}-${displayOrder}`;
};

const isVariantDefault = (variant: Record<string, unknown>, data: Record<string, any>, colorName: string) => {
  const id = typeof variant.id === 'string' ? variant.id : typeof variant.variantId === 'string' ? variant.variantId : '';
  const defaultId = data.defaultVariantId || data.defaultVariant || data.defaultVariantID;
  const defaultColor = data.defaultColorName || data.defaultColor || data.defaultColour;
  return Boolean(
    variant.isDefault ||
    variant.default ||
    (typeof defaultId === 'string' && id && defaultId === id) ||
    (typeof defaultColor === 'string' && normalizeColorKey(defaultColor) === normalizeColorKey(colorName))
  );
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

export const buildProductColorImages = (
  data: Record<string, any>,
  colors: string[]
): Record<string, string[]> => {
  const imagesByColor: Record<string, string[]> = {};
  const add = (colorValue: unknown, imageValue: unknown) => {
    const color = getVariantColor(colorValue);
    const key = normalizeColorKey(color);
    if (!key) return;
    const urls = collectImageUrls(imageValue);
    if (!urls.length) return;
    imagesByColor[key] = uniqueStrings([...(imagesByColor[key] || []), ...urls]);
  };

  [data.colorImages, data.imagesByColor, data.colorImageUrls].forEach((source) => {
    if (!source || typeof source !== 'object') return;
    if (Array.isArray(source)) {
      source.forEach((entry) => {
        if (!entry || typeof entry !== 'object') return;
        const value = entry as Record<string, unknown>;
        add(value.colorName || value.color || value.colour || value.name || value.label, value);
      });
      return;
    }
    Object.entries(source as Record<string, unknown>).forEach(([color, value]) => add(color, value));
  });

  [data.variants, data.colorVariants, data.colorsData, data.colors].forEach((source) => {
    if (!Array.isArray(source)) return;
    source.forEach((entry) => {
      if (!entry || typeof entry !== 'object') return;
      const value = entry as Record<string, unknown>;
      add(value.colorName || value.color || value.colour || value.name || value.label, value);
    });
  });

  // Legacy catalog records store images in fields such as BlackImage,
  // lavenderImage2, or NavyPhoto. Resolve those fields against the actual
  // product colors so older Firestore products keep their uploaded photos.
  Object.entries(data)
    .filter(([fieldName]) => /(image|photo|media|url|src)/i.test(fieldName))
    .forEach(([fieldName, value]) => {
    const fieldKey = normalizeColorKey(fieldName);
    if (!fieldKey) return;
    colors.forEach((color) => {
      const colorKey = normalizeColorKey(color);
      if (colorKey && fieldKey.includes(colorKey)) add(color, value);
    });
    });


  // Some existing catalog records store one image per color in parallel arrays.
  const orderedImages = collectImageUrls(data.imageUrls).length === colors.length
    ? collectImageUrls(data.imageUrls)
    : collectImageUrls(data.images);
  if (colors.length > 1 && orderedImages.length === colors.length) {
    colors.forEach((color, index) => add(color, orderedImages[index]));
  }

  // Older products often use imageUrl/imageUrl2 for the primary color while
  // naming the remaining color photos explicitly. Assign those generic image
  // fields only to colors that still have no mapped image.
  const unmappedColors = colors.filter((color) => !imagesByColor[normalizeColorKey(color)]?.length);
  const genericImages = Object.entries(data)
    .filter(([fieldName]) => /^(?:mainimage|image|imageurl|image\d+|imageurl\d+)$/i.test(fieldName))
    .flatMap(([, value]) => collectImageUrls(value));
  if (unmappedColors.length === 1 && genericImages.length > 0) {
    add(unmappedColors[0], genericImages);
  } else if (unmappedColors.length > 1 && genericImages.length === unmappedColors.length) {
    unmappedColors.forEach((color, index) => add(color, genericImages[index]));
  }

  return imagesByColor;
};

export const normalizeProductVariants = (
  data: Record<string, any>,
  colors: string[],
  colorImages?: Record<string, string | string[]>
): ProductVariant[] => {
  const explicitVariants = Array.isArray(data.variants) ? data.variants : [];
  const variants = explicitVariants
    .map((variant, index): ProductVariant | null => {
      if (!variant || typeof variant !== 'object' || Array.isArray(variant)) return null;
      const variantRecord = variant as Record<string, unknown>;
      const color = getVariantColor(variant);
      if (!color) return null;
      const images = collectImageUrls(variant);
      if (images.length === 0) return null;
      const stock = getVariantStock(variant);
      const displayOrder = getVariantDisplayOrder(variant, index);
      const thumbnail = collectImageUrls(variantRecord.thumbnail)[0] || images[0];
      const colorHex = getRequiredColorHex(color, variantRecord.colorHex || variantRecord.colorCode || variantRecord.hex);
      const isAvailable = variantRecord.isAvailable !== undefined
        ? Boolean(variantRecord.isAvailable)
        : stock !== undefined
          ? stock > 0
          : true;
      return {
        id: getVariantId(variantRecord, color, displayOrder),
        colorName: color,
        colorHex,
        images,
        thumbnail,
        ...(stock !== undefined ? { stock } : {}),
        sku: typeof variantRecord.sku === 'string' && variantRecord.sku.trim() ? variantRecord.sku.trim() : undefined,
        isAvailable,
        displayOrder,
        color
      };
    })
    .filter((variant): variant is ProductVariant => Boolean(variant));

  if (variants.length > 0) {
    const explicitColors = new Set(variants.map((variant) => normalizeColorKey(variant.colorName || variant.color)));
    const imageOnlyVariants: ProductVariant[] = colors
      .map((color, index): ProductVariant | null => {
        const key = normalizeColorKey(color);
        if (!key || explicitColors.has(key)) return null;
        const images = findColorImages(colorImages, color);
        if (!images.length) return null;
        return {
          id: `${key}-${index}`,
          colorName: color,
          colorHex: getRequiredColorHex(color),
          images,
          thumbnail: images[0],
          isAvailable: true,
          displayOrder: index,
          color
        };
      })
      .filter((variant): variant is ProductVariant => Boolean(variant));
    const merged = mergeVariants([...variants, ...imageOnlyVariants]).sort(sortVariants);
    const defaultVariant = merged.find((variant) => {
      const source = explicitVariants.find((item: any) => normalizeColorKey(getVariantColor(item)) === normalizeColorKey(variant.colorName));
      return source && typeof source === 'object' ? isVariantDefault(source as Record<string, unknown>, data, variant.colorName) : false;
    });
    return defaultVariant ? [defaultVariant, ...merged.filter((variant) => variant.id !== defaultVariant.id)] : merged;
  }

  const fallbackVariants: ProductVariant[] = colors
    .map((color, index): ProductVariant | null => {
      const images = findColorImages(colorImages, color);
      const colorHex = getRequiredColorHex(color);
      return images.length > 0 ? {
        id: `${normalizeColorKey(color) || 'variant'}-${index}`,
        colorName: color,
        colorHex,
        images,
        thumbnail: images[0],
        isAvailable: true,
        displayOrder: index,
        color
      } : null;
    })
    .filter((variant): variant is ProductVariant => Boolean(variant))
    .sort(sortVariants);

  return fallbackVariants;
};

export const mergeVariants = (variants: ProductVariant[]): ProductVariant[] => {
  const byColor = new Map<string, ProductVariant>();
  variants.forEach((variant) => {
    const key = normalizeColorKey(variant.colorName || variant.color);
    if (!key) return;
    const existing = byColor.get(key);
    if (!existing) {
      byColor.set(key, {
        ...variant,
        colorName: variant.colorName || variant.color || 'Color',
        colorHex: variant.colorHex || getRequiredColorHex(variant.colorName || variant.color),
        images: uniqueStrings(variant.images || []),
        thumbnail: variant.thumbnail || variant.images?.[0] || '',
        isAvailable: variant.isAvailable,
        displayOrder: variant.displayOrder
      });
      return;
    }
    existing.images = uniqueStrings([...(existing.images || []), ...(variant.images || [])]);
    existing.thumbnail = existing.thumbnail || variant.thumbnail || existing.images[0];
    if (existing.stock === undefined && variant.stock !== undefined) existing.stock = variant.stock;
    existing.isAvailable = existing.isAvailable || variant.isAvailable;
    existing.displayOrder = Math.min(existing.displayOrder, variant.displayOrder);
  });
  return Array.from(byColor.values());
};

export const sortVariants = (a: ProductVariant, b: ProductVariant) => (
  (a.displayOrder ?? 0) - (b.displayOrder ?? 0)
);

export const validateProductVariants = (variants: ProductVariant[]) => {
  const errors: string[] = [];
  if (!variants.length) errors.push('At least one product variant is required.');
  variants.forEach((variant) => {
    if (!variant.colorName.trim()) errors.push('Variant color name is required.');
    if (!isValidHexColor(variant.colorHex)) errors.push(`${variant.colorName || 'Variant'} needs a valid color HEX.`);
    if (!variant.images.length) errors.push(`${variant.colorName || 'Variant'} needs at least one image.`);
  });
  return errors;
};
