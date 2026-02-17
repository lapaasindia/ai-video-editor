import { useVideoConfig } from 'remotion';
import { BASE_LANDSCAPE_WIDTH, BASE_PORTRAIT_WIDTH } from './constants';

/**
 * Returns true when the composition is set to portrait (9:16) mode.
 */
export function useIsPortrait(): boolean {
    const { width, height } = useVideoConfig();
    return height > width;
}

/**
 * Returns responsive values depending on current aspect ratio.
 * Usage: const fontSize = useResponsive(72, 56);
 *        → 72 in landscape, 56 in portrait
 */
export function useResponsive<T>(landscape: T, portrait: T): T {
    return useIsPortrait() ? portrait : landscape;
}

/**
 * Orientation-aware scale factor relative to 1080p baselines.
 * Landscape: width / 1920  (3840 → 2.0)
 * Portrait:  width / 1080  (2160 → 2.0)
 * Useful for scaling fonts/spacing proportionally to 4K.
 */
export function useScaleFactor(): number {
    const { width } = useVideoConfig();
    const isPortrait = useIsPortrait();
    const base = isPortrait ? BASE_PORTRAIT_WIDTH : BASE_LANDSCAPE_WIDTH;
    return width / base;
}
