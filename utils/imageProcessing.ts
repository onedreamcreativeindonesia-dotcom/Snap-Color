import { EditSettings, Lut } from '../types';

const clamp = (value: number) => Math.max(0, Math.min(255, value));

function rgbToHsl(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number) {
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const hue2rgb = (t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    r = hue2rgb(h + 1/3);
    g = hue2rgb(h);
    b = hue2rgb(h - 1/3);
  }
  return [r * 255, g * 255, b * 255];
}

export const processImage = (
  imageData: ImageData, 
  settings: EditSettings,
  activeLut: Lut | null = null
): ImageData => {
  const data = imageData.data;
  const output = new Uint8ClampedArray(data);

  const exposureMultiplier = Math.pow(2, settings.exposure / 50);
  const contrastFactor = (259 * (settings.contrast + 255)) / (255 * (259 - settings.contrast));
  const saturationFactor = 1 + (settings.saturation / 100);

  const hasLut = activeLut && settings.lutIntensity > 0;
  const lutIntensity = hasLut ? settings.lutIntensity / 100 : 0;
  const lutSize = activeLut?.size || 0;
  const lutSizeSq = lutSize * lutSize;
  const lutSizeMinus1 = lutSize - 1;

  // Target skin hue is approx 15-30 degrees (0.04 - 0.08 in 0-1 range)
  const idealSkinHue = 0.06; 

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    // Global adjustments
    r *= exposureMultiplier; g *= exposureMultiplier; b *= exposureMultiplier;
    r = contrastFactor * (r - 128) + 128;
    g = contrastFactor * (g - 128) + 128;
    b = contrastFactor * (b - 128) + 128;
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    r = gray + (r - gray) * saturationFactor;
    g = gray + (g - gray) * saturationFactor;
    b = gray + (b - gray) * saturationFactor;

    // Apply LUT
    if (hasLut && activeLut) {
      const nr = clamp(r) / 255, ng = clamp(g) / 255, nb = clamp(b) / 255;
      const ri = Math.round(nr * lutSizeMinus1), gi = Math.round(ng * lutSizeMinus1), bi = Math.round(nb * lutSizeMinus1);
      const idx = (ri + gi * lutSize + bi * lutSizeSq) * 3;
      if (idx < activeLut.data.length - 2) {
        r = r * (1 - lutIntensity) + activeLut.data[idx] * 255 * lutIntensity;
        g = g * (1 - lutIntensity) + activeLut.data[idx+1] * 255 * lutIntensity;
        b = b * (1 - lutIntensity) + activeLut.data[idx+2] * 255 * lutIntensity;
      }
    }

    // Automatic Orange/Skin Detection
    let [h, s, l] = rgbToHsl(r, g, b);
    
    // Skin mask: hue between 0 and 0.17 (0 to 60 degrees)
    // We feather the selection
    const hDist = Math.min(Math.abs(h - idealSkinHue), 1 - Math.abs(h - idealSkinHue));
    const range = (settings.skinDetectionRange / 100) * 0.15; // Max range approx 54 degrees
    
    let weight = Math.max(0, 1 - hDist / range);
    
    // Skin also tends to have moderate saturation and brightness
    const sWeight = Math.max(0, 1 - Math.abs(s - 0.4) / 0.4);
    const lWeight = Math.max(0, 1 - Math.abs(l - 0.5) / 0.45);
    weight *= (sWeight * lWeight);

    if (weight > 0.05) {
      // 1. Map skinHue slider (0-100) to Red -> Orange -> Yellow (0 to 60 degrees)
      const targetHue = (settings.skinHue / 100) * (60 / 360);
      
      // Blend current hue towards the target skin hue
      h = h * (1 - weight) + targetHue * weight;
      
      // Adjust S/L based on skin settings
      s *= (1 + (settings.skinSaturation / 100) * weight);
      l *= (1 + (settings.skinLuminance / 200) * weight);
      
      [r, g, b] = hslToRgb(h % 1, Math.max(0, Math.min(1, s)), Math.max(0, Math.min(1, l)));
    }

    output[i] = clamp(r);
    output[i + 1] = clamp(g);
    output[i + 2] = clamp(b);
  }

  return new ImageData(output, imageData.width, imageData.height);
};