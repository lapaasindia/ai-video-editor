// ─── Design Token Palettes ──────────────────────────────────

export const PALETTES = {
    // Professional / Corporate
    corporate: {
        primary: '#1a1a2e',
        secondary: '#16213e',
        accent: '#0f3460',
        highlight: '#e94560',
        text: '#ffffff',
        textSecondary: '#a0a0b0',
        background: '#0a0a1a',
    },
    // Modern Tech
    tech: {
        primary: '#0d1117',
        secondary: '#161b22',
        accent: '#58a6ff',
        highlight: '#f78166',
        text: '#f0f6fc',
        textSecondary: '#8b949e',
        background: '#010409',
    },
    // Bold News
    news: {
        primary: '#b71c1c',
        secondary: '#1a1a1a',
        accent: '#ff5252',
        highlight: '#ffd740',
        text: '#ffffff',
        textSecondary: '#cccccc',
        background: '#121212',
    },
    // Vibrant Business
    business: {
        primary: '#1e3a5f',
        secondary: '#2d5a8a',
        accent: '#4fc3f7',
        highlight: '#ff8a65',
        text: '#ffffff',
        textSecondary: '#b0c4de',
        background: '#0d1b2a',
    },
    // Clean / Minimal
    clean: {
        primary: '#ffffff',
        secondary: '#f5f5f5',
        accent: '#2962ff',
        highlight: '#00c853',
        text: '#212121',
        textSecondary: '#757575',
        background: '#fafafa',
    },
    // Dark Gold (Case Studies)
    darkGold: {
        primary: '#1c1c1c',
        secondary: '#2a2a2a',
        accent: '#d4af37',
        highlight: '#f5d060',
        text: '#ffffff',
        textSecondary: '#b0b0b0',
        background: '#111111',
    },
    // Neon Tech
    neon: {
        primary: '#0a0a0a',
        secondary: '#1a1a2e',
        accent: '#00ff87',
        highlight: '#ff00ff',
        text: '#ffffff',
        textSecondary: '#888888',
        background: '#050505',
    },
} as const;

export type PaletteName = keyof typeof PALETTES;
export type Palette = (typeof PALETTES)[PaletteName];

export function getPalette(name: PaletteName): Palette {
    return PALETTES[name];
}

// Gradient helpers
export function linearGradient(
    angle: number,
    ...colors: string[]
): string {
    return `linear-gradient(${angle}deg, ${colors.join(', ')})`;
}

export function radialGradient(...colors: string[]): string {
    return `radial-gradient(circle, ${colors.join(', ')})`;
}
