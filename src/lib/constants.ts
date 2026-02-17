export const ASPECT_RATIOS = {
  LANDSCAPE: { width: 3840, height: 2160, label: '16:9 4K' },
  PORTRAIT: { width: 2160, height: 3840, label: '9:16 4K' },
} as const;

export type AspectRatioKey = keyof typeof ASPECT_RATIOS;

// 1080p baselines used for scale factor calculations
export const BASE_LANDSCAPE_WIDTH = 1920;
export const BASE_PORTRAIT_WIDTH = 1080;
export const BASE_LANDSCAPE_HEIGHT = 1080;
export const BASE_PORTRAIT_HEIGHT = 1920;

export const DEFAULT_FPS = 30;
export const DEFAULT_DURATION_SECONDS = 10;
export const DEFAULT_DURATION_FRAMES = DEFAULT_FPS * DEFAULT_DURATION_SECONDS;
