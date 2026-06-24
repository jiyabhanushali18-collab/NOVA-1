import sharp from 'sharp';

export type AnalysisField = { value: string; confidence: number };
export type LocalVisionAnalysis = {
  skinTone: AnalysisField;
  faceShape: AnalysisField;
  hairType: AnalysisField;
  hairColor: AnalysisField;
  outfitStyle: AnalysisField;
};

type Pixel = { r: number; g: number; b: number; x: number; y: number };
type Bounds = { x: number; y: number; width: number; height: number };
type PreparedImage = { data: Buffer; width: number; height: number };

const defaultAnalysis: LocalVisionAnalysis = {
  skinTone: { value: 'unknown', confidence: 0 },
  faceShape: { value: 'unknown', confidence: 0 },
  hairType: { value: 'unknown', confidence: 0 },
  hairColor: { value: 'unknown', confidence: 0 },
  outfitStyle: { value: 'unknown', confidence: 0 }
};

const splitDataUrl = (imageDataUrl: string) => {
  const match = imageDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const getPixel = ({ data, width }: PreparedImage, x: number, y: number): Pixel => {
  const offset = (y * width + x) * 3;
  return { r: data[offset], g: data[offset + 1], b: data[offset + 2], x, y };
};

const rgbToHsv = (r: number, g: number, b: number) => {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  let h = 0;

  if (delta) {
    if (max === rn) h = 60 * (((gn - bn) / delta) % 6);
    else if (max === gn) h = 60 * ((bn - rn) / delta + 2);
    else h = 60 * ((rn - gn) / delta + 4);
  }

  return {
    h: h < 0 ? h + 360 : h,
    s: max === 0 ? 0 : delta / max,
    v: max
  };
};

const srgbToLinear = (value: number) => {
  const normalized = value / 255;
  return normalized <= 0.04045 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4);
};

const rgbToLab = (r: number, g: number, b: number) => {
  const rl = srgbToLinear(r);
  const gl = srgbToLinear(g);
  const bl = srgbToLinear(b);
  const x = (rl * 0.4124 + gl * 0.3576 + bl * 0.1805) / 0.95047;
  const y = (rl * 0.2126 + gl * 0.7152 + bl * 0.0722) / 1.0;
  const z = (rl * 0.0193 + gl * 0.1192 + bl * 0.9505) / 1.08883;
  const f = (value: number) => (value > 0.008856 ? Math.cbrt(value) : 7.787 * value + 16 / 116);

  return {
    l: 116 * f(y) - 16,
    a: 500 * (f(x) - f(y)),
    b: 200 * (f(y) - f(z))
  };
};

const isSkinPixel = ({ r, g, b }: Pixel) => {
  const { h, s, v } = rgbToHsv(r, g, b);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const y = 0.299 * r + 0.587 * g + 0.114 * b;
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  const hsvSkin = ((h <= 52 || h >= 340) && s >= 0.12 && s <= 0.72 && v >= 0.22 && v <= 0.98);
  const ycbcrSkin = y > 45 && cb >= 77 && cb <= 135 && cr >= 133 && cr <= 180;
  const rgbSkin = r > 45 && g > 30 && b > 20 && max - min > 12 && r > b && g >= b * 0.72;
  return hsvSkin && ycbcrSkin && rgbSkin;
};

const prepareImage = async (imageDataUrl: string): Promise<PreparedImage> => {
  const parsed = splitDataUrl(imageDataUrl);
  if (!parsed) throw new Error('imageDataUrl must be a base64 image data URL.');

  const input = Buffer.from(parsed.data, 'base64');
  const { data, info } = await sharp(input, { failOn: 'none' })
    .rotate()
    .resize({ width: 384, height: 384, fit: 'inside', withoutEnlargement: true })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return { data, width: info.width, height: info.height };
};

const detectFaceRegion = (image: PreparedImage): { bounds: Bounds; skinPixels: Pixel[]; confidence: number } => {
  const minX = Math.round(image.width * 0.15);
  const maxX = Math.round(image.width * 0.85);
  const minY = Math.round(image.height * 0.05);
  const maxY = Math.round(image.height * 0.78);
  const skinPixels: Pixel[] = [];

  for (let y = minY; y < maxY; y += 2) {
    for (let x = minX; x < maxX; x += 2) {
      const pixel = getPixel(image, x, y);
      if (isSkinPixel(pixel)) skinPixels.push(pixel);
    }
  }

  if (skinPixels.length < 50) {
    throw new Error('No clear face region was found. Please upload a front-facing selfie with your face visible.');
  }

  const centerX = image.width / 2;
  const weighted = skinPixels
    .map((pixel) => ({ pixel, score: 1 - Math.min(0.9, Math.abs(pixel.x - centerX) / centerX) }))
    .filter((item) => item.score > 0.28);
  const candidates = weighted.length >= 50 ? weighted.map((item) => item.pixel) : skinPixels;
  const xs = candidates.map((pixel) => pixel.x);
  const ys = candidates.map((pixel) => pixel.y);
  const x1 = Math.min(...xs);
  const x2 = Math.max(...xs);
  const y1 = Math.min(...ys);
  const y2 = Math.max(...ys);
  const width = Math.max(1, x2 - x1);
  const height = Math.max(1, y2 - y1);
  const coverage = candidates.length / (((maxX - minX) * (maxY - minY)) / 4);
  const aspectScore = 1 - Math.min(0.7, Math.abs(width / height - 0.72));

  return {
    bounds: {
      x: clamp(x1 - Math.round(width * 0.08), 0, image.width - 1),
      y: clamp(y1 - Math.round(height * 0.08), 0, image.height - 1),
      width: clamp(Math.round(width * 1.16), 1, image.width - x1),
      height: clamp(Math.round(height * 1.16), 1, image.height - y1)
    },
    skinPixels: candidates,
    confidence: clamp(Math.round(45 + coverage * 180 + aspectScore * 25), 45, 92)
  };
};

const averageLab = (pixels: Pixel[]) => {
  const total = pixels.reduce(
    (sum, pixel) => {
      const lab = rgbToLab(pixel.r, pixel.g, pixel.b);
      sum.l += lab.l;
      sum.a += lab.a;
      sum.b += lab.b;
      return sum;
    },
    { l: 0, a: 0, b: 0 }
  );

  return {
    l: total.l / pixels.length,
    a: total.a / pixels.length,
    b: total.b / pixels.length
  };
};

const classifySkinTone = (skinPixels: Pixel[], faceConfidence: number): AnalysisField => {
  if (!skinPixels.length) return defaultAnalysis.skinTone;
  const lab = averageLab(skinPixels);
  let value = 'deep';
  if (lab.l >= 73) value = 'fair';
  else if (lab.l >= 64) value = 'light-medium';
  else if (lab.l >= 54) value = 'medium';
  else if (lab.l >= 43) value = 'tan';

  return {
    value,
    confidence: clamp(Math.round(faceConfidence + Math.min(8, skinPixels.length / 220)), 55, 94)
  };
};

const classifyFaceShape = (bounds: Bounds, faceConfidence: number): AnalysisField => {
  const ratio = bounds.width / bounds.height;
  let value = 'oval';
  if (ratio >= 0.88) value = 'round';
  else if (ratio >= 0.78) value = 'square';
  else if (ratio <= 0.54) value = 'rectangle';
  else if (ratio <= 0.62) value = 'diamond';

  return {
    value,
    confidence: clamp(Math.round(faceConfidence - 10), 45, 82)
  };
};

const sampleRegion = (image: PreparedImage, bounds: Bounds, step = 2) => {
  const pixels: Pixel[] = [];
  const x1 = clamp(Math.round(bounds.x), 0, image.width - 1);
  const y1 = clamp(Math.round(bounds.y), 0, image.height - 1);
  const x2 = clamp(Math.round(bounds.x + bounds.width), 0, image.width);
  const y2 = clamp(Math.round(bounds.y + bounds.height), 0, image.height);

  for (let y = y1; y < y2; y += step) {
    for (let x = x1; x < x2; x += step) {
      pixels.push(getPixel(image, x, y));
    }
  }

  return pixels;
};

const luminance = (pixel: Pixel) => 0.299 * pixel.r + 0.587 * pixel.g + 0.114 * pixel.b;

const classifyHair = (image: PreparedImage, face: Bounds): { hairType: AnalysisField; hairColor: AnalysisField } => {
  const hairBounds = {
    x: clamp(face.x - face.width * 0.18, 0, image.width - 1),
    y: clamp(face.y - face.height * 0.36, 0, image.height - 1),
    width: clamp(face.width * 1.36, 1, image.width),
    height: clamp(face.height * 0.52, 1, image.height)
  };
  const pixels = sampleRegion(image, hairBounds, 2).filter((pixel) => !isSkinPixel(pixel));
  const candidates = pixels.filter((pixel) => {
    const { s, v } = rgbToHsv(pixel.r, pixel.g, pixel.b);
    return v < 0.62 || s > 0.22;
  });

  if (candidates.length < 35) {
    return {
      hairType: { value: 'unknown', confidence: 0 },
      hairColor: { value: 'unknown', confidence: 0 }
    };
  }

  const avg = candidates.reduce(
    (sum, pixel) => {
      sum.r += pixel.r;
      sum.g += pixel.g;
      sum.b += pixel.b;
      sum.y += luminance(pixel);
      return sum;
    },
    { r: 0, g: 0, b: 0, y: 0 }
  );
  avg.r /= candidates.length;
  avg.g /= candidates.length;
  avg.b /= candidates.length;
  avg.y /= candidates.length;

  const lab = rgbToLab(avg.r, avg.g, avg.b);
  let hairColor = 'black';
  if (avg.y > 185 && lab.b > 12) hairColor = 'blonde';
  else if (avg.r > avg.g * 1.16 && avg.r > avg.b * 1.35 && lab.a > 18) hairColor = 'red';
  else if (avg.y > 150 && Math.abs(avg.r - avg.g) < 18 && Math.abs(avg.g - avg.b) < 18) hairColor = 'gray';
  else if (avg.y > 92) hairColor = 'brown';
  else if (avg.y > 52) hairColor = 'dark brown';

  let edgeScore = 0;
  let comparisons = 0;
  for (let index = 0; index < candidates.length - 1; index += 2) {
    const current = candidates[index];
    const next = candidates[index + 1];
    if (Math.abs(current.y - next.y) <= 2 && Math.abs(current.x - next.x) <= 4) {
      edgeScore += Math.abs(luminance(current) - luminance(next));
      comparisons++;
    }
  }
  const texture = comparisons ? edgeScore / comparisons : 0;
  let hairType = 'straight';
  if (texture > 34) hairType = 'coily';
  else if (texture > 24) hairType = 'curly';
  else if (texture > 14) hairType = 'wavy';

  const confidence = clamp(Math.round(45 + Math.min(38, candidates.length / 45)), 45, 83);

  return {
    hairType: { value: hairType, confidence },
    hairColor: { value: hairColor, confidence: clamp(confidence + 5, 50, 88) }
  };
};

const classifyOutfit = (image: PreparedImage, face: Bounds): AnalysisField => {
  const torso = sampleRegion(
    image,
    {
      x: clamp(face.x - face.width * 0.35, 0, image.width - 1),
      y: clamp(face.y + face.height * 0.82, 0, image.height - 1),
      width: clamp(face.width * 1.7, 1, image.width),
      height: clamp(face.height * 0.75, 1, image.height)
    },
    3
  );

  if (torso.length < 20) return { value: 'unknown', confidence: 0 };

  const avg = torso.reduce(
    (sum, pixel) => {
      const hsv = rgbToHsv(pixel.r, pixel.g, pixel.b);
      sum.s += hsv.s;
      sum.v += hsv.v;
      sum.dark += hsv.v < 0.25 ? 1 : 0;
      return sum;
    },
    { s: 0, v: 0, dark: 0 }
  );
  const saturation = avg.s / torso.length;
  const value = avg.v / torso.length;
  const darkRatio = avg.dark / torso.length;
  let outfitStyle = 'casual';
  if (darkRatio > 0.45 && saturation < 0.28) outfitStyle = 'formal';
  else if (saturation > 0.52 && value > 0.48) outfitStyle = 'streetwear';
  else if (value > 0.72 && saturation < 0.22) outfitStyle = 'smart casual';

  return { value: outfitStyle, confidence: 58 };
};

export const analyzeSelfieLocally = async (imageDataUrl: string): Promise<LocalVisionAnalysis> => {
  const started = Date.now();
  const image = await prepareImage(imageDataUrl);
  const face = detectFaceRegion(image);
  const hair = classifyHair(image, face.bounds);
  const analysis = {
    skinTone: classifySkinTone(face.skinPixels, face.confidence),
    faceShape: classifyFaceShape(face.bounds, face.confidence),
    hairType: hair.hairType,
    hairColor: hair.hairColor,
    outfitStyle: classifyOutfit(image, face.bounds)
  };

  console.log('Local selfie analysis completed:', {
    elapsedMs: Date.now() - started,
    image: { width: image.width, height: image.height },
    faceBounds: face.bounds,
    analysis
  });

  return analysis;
};
