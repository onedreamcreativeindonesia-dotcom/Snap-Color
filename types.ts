export interface Photo {
  id: string;
  file: File;
  previewUrl: string;
  name: string;
}

export interface Lut {
  id: string;
  name: string;
  size: number;
  data: Float32Array;
}

export interface EditSettings {
  exposure: number;
  contrast: number;
  highlights: number;
  shadows: number;
  saturation: number;
  temperature: number;
  tint: number;
  
  lutId: string | null;
  lutIntensity: number;

  // Global Skin/Orange Adjustments
  skinHue: number; // 0 to 100 (Red -> Orange -> Yellow mapping)
  skinSaturation: number; // -100 to 100
  skinLuminance: number; // -100 to 100
  skinTexture: number; // -100 to 100
  skinClarity: number; // -100 to 100
  skinDetectionRange: number; // 0 to 100 (precision of orange mask)

  crop: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
}

export const DEFAULT_SETTINGS: EditSettings = {
  exposure: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  saturation: 0,
  temperature: 0,
  tint: 0,
  lutId: null,
  lutIntensity: 100,
  
  skinHue: 50, // Default to Orange
  skinSaturation: 0,
  skinLuminance: 0,
  skinTexture: 0,
  skinClarity: 0,
  skinDetectionRange: 40,
  
  crop: null,
};