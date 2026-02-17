/**
 * Material Design Dark Theme with Green Accent
 * All values are 4K-optimized (3840×2160 / 2160×3840)
 */

// ─── Colors ──────────────────────────────────────────────────
export const COLORS = {
    // Backgrounds
    bg: 'var(--template-bg, #0F0F0F)',
    bgAlt: 'var(--template-bg-alt, #121212)',
    surface: '#1A1A1A',
    surfaceLight: '#242424',
    card: '#1E1E1E',
    cardHover: '#2A2A2A',

    // Green accent (Material Green A400 family)
    accent: '#00E676',
    accentDark: '#00C853',
    accentLight: '#69F0AE',
    accentMuted: 'rgba(0, 230, 118, 0.15)',
    accentBorder: 'rgba(0, 230, 118, 0.3)',

    // Text
    textPrimary: '#FFFFFF',
    textSecondary: 'rgba(255, 255, 255, 0.70)',
    textMuted: 'rgba(255, 255, 255, 0.45)',
    textOnAccent: '#0F0F0F',

    // Utility
    border: 'rgba(255, 255, 255, 0.08)',
    borderLight: 'rgba(255, 255, 255, 0.12)',
    overlay: 'rgba(0, 0, 0, 0.6)',
    overlayHeavy: 'rgba(0, 0, 0, 0.85)',
    glow: 'rgba(0, 230, 118, 0.25)',
    glowStrong: 'rgba(0, 230, 118, 0.45)',
} as const;

// ─── Typography (4K-optimized) ───────────────────────────────
// All sizes are calibrated for 3840×2160 landscape rendering
export const FONT = {
    // Size scale
    hero: 160,       // Main hero headline
    h1: 120,         // Section headline
    h2: 96,          // Large subheadline
    h3: 72,          // Medium heading
    h4: 56,          // Small heading
    body: 48,        // Body / paragraph
    bodySmall: 40,   // Smaller body
    label: 36,       // Labels, badges
    caption: 28,     // Captions, timestamps
    micro: 24,       // Tiny text

    // Weights
    black: 900,
    bold: 700,
    semibold: 600,
    medium: 500,
    regular: 400,

    // Line heights
    tight: 1.1,
    normal: 1.3,
    relaxed: 1.5,

    // Letter spacing
    wide: 4,
    normal_ls: 0,
    tight_ls: -1,
    tighter: -2,
} as const;

// ─── Portrait overrides ─────────────────────────────────────
// Portrait canvas is 56% the width of landscape, so text at ~95% of
// landscape absolute size is proportionally much larger on mobile.
export const PORTRAIT_SCALE = 1.05;

export function pSize(landscapeSize: number, isPortrait: boolean): number {
    return isPortrait ? Math.round(landscapeSize * PORTRAIT_SCALE) : landscapeSize;
}

// ─── Spacing (4K-optimized) ──────────────────────────────────
export const SPACING = {
    xs: 16,
    sm: 24,
    md: 40,
    lg: 64,
    xl: 96,
    xxl: 160,
    page: 120,        // Page padding landscape
    pagePt: 80,       // Page padding portrait (sides)
} as const;

/**
 * Portrait-aware spacing. Returns larger gaps in portrait to fill 3840px height.
 * In portrait, multiplies by 2.5× since canvas is 78% taller.
 */
export function pGap(landscapeGap: number, isPortrait: boolean): number {
    return isPortrait ? Math.round(landscapeGap * 2.5) : landscapeGap;
}

/**
 * Portrait-aware padding string.
 * Landscape: generous horizontal, moderate vertical
 * Portrait: generous vertical, moderate horizontal
 */
export function pPad(isPortrait: boolean): string {
    return isPortrait
        ? `${SPACING.xxl}px ${SPACING.pagePt}px`
        : `${SPACING.xl}px ${SPACING.page}px`;
}

// ─── Radii ───────────────────────────────────────────────────
export const RADIUS = {
    sm: 8,
    md: 16,
    lg: 24,
    xl: 40,
    pill: 100,
} as const;

// ─── Gradients ───────────────────────────────────────────────
export const GRADIENTS = {
    bgMain: `linear-gradient(135deg, ${COLORS.bg} 0%, var(--template-bg-mid, #0a1a0f) 50%, ${COLORS.bg} 100%)`,
    bgSubtle: `linear-gradient(180deg, ${COLORS.bgAlt} 0%, ${COLORS.bg} 100%)`,
    accentLine: `linear-gradient(90deg, ${COLORS.accent}, ${COLORS.accentLight})`,
    accentFade: `linear-gradient(90deg, ${COLORS.accent}, transparent)`,
    overlayBottom: `linear-gradient(180deg, transparent 0%, ${COLORS.bg} 100%)`,
    overlayTop: `linear-gradient(0deg, transparent 0%, ${COLORS.bg} 100%)`,
    cardGlow: `linear-gradient(135deg, ${COLORS.surfaceLight}, ${COLORS.card})`,
} as const;
