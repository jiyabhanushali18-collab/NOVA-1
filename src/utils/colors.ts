export const COLOR_HEX_BY_NAME: Record<string, string> = {
  white: '#FFFFFF',
  black: '#000000',
  grey: '#808080',
  gray: '#808080',
  lightgrey: '#D1D5DB',
  lightgray: '#D1D5DB',
  darkgrey: '#4B5563',
  darkgray: '#4B5563',
  silver: '#C0C0C0',
  blue: '#2563EB',
  navy: '#1E3A8A',
  skyblue: '#38BDF8',
  royalblue: '#1D4ED8',
  babyblue: '#BFDBFE',
  red: '#DC2626',
  darkred: '#991B1B',
  maroon: '#7F1D1D',
  green: '#16A34A',
  olive: '#708238',
  lime: '#84CC16',
  mint: '#98FF98',
  mintgreen: '#98FF98',
  yellow: '#FACC15',
  mustard: '#D4A017',
  orange: '#F97316',
  peach: '#FFCBA4',
  pink: '#EC4899',
  hotpink: '#FF69B4',
  purple: '#9333EA',
  lavender: '#C4B5FD',
  violet: '#8B5CF6',
  brown: '#7C2D12',
  coffee: '#6F4E37',
  beige: '#F5F5DC',
  cream: '#FFFDD0',
  khaki: '#C3B091',
  tan: '#D2B48C',
  gold: '#D4AF37',
  rosegold: '#B76E79',
  bronze: '#CD7F32',
  turquoise: '#40E0D0',
  teal: '#0D9488',
  cyan: '#06B6D4',
  magenta: '#D946EF',
  indigo: '#4F46E5',
  charcoal: '#36454F'
};

export const normalizeColorName = (value: unknown) => (
  typeof value === 'string'
    ? value.trim()
    : ''
);

export const normalizeColorKey = (value: unknown) => (
  normalizeColorName(value).toLowerCase().replace(/[^a-z0-9]/g, '')
);

export const isValidHexColor = (value: unknown): value is string => (
  typeof value === 'string' && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim())
);

export const expandHexColor = (value: string) => {
  const hex = value.trim();
  if (hex.length !== 4) return hex.toUpperCase();
  return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`.toUpperCase();
};

export const resolveColorHex = (colorName: unknown, customHex?: unknown) => {
  if (isValidHexColor(customHex)) return expandHexColor(customHex);
  const mapped = COLOR_HEX_BY_NAME[normalizeColorKey(colorName)];
  return mapped || undefined;
};

export const isRecognizedColorName = (colorName: unknown) => Boolean(COLOR_HEX_BY_NAME[normalizeColorKey(colorName)]);

export const needsCustomColorPicker = (colorName: unknown, customHex?: unknown) => (
  normalizeColorName(colorName).length > 0 && !isRecognizedColorName(colorName) && !isValidHexColor(customHex)
);

export const getRequiredColorHex = (colorName: unknown, customHex?: unknown) => (
  resolveColorHex(colorName, customHex) || '#64748B'
);

export const isLightColor = (hex: string) => {
  const normalized = expandHexColor(hex);
  const r = parseInt(normalized.slice(1, 3), 16);
  const g = parseInt(normalized.slice(3, 5), 16);
  const b = parseInt(normalized.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 210;
};

export const isDarkColor = (hex: string) => {
  const normalized = expandHexColor(hex);
  const r = parseInt(normalized.slice(1, 3), 16);
  const g = parseInt(normalized.slice(3, 5), 16);
  const b = parseInt(normalized.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 < 85;
};
