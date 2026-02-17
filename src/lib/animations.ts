import { interpolate, spring } from 'remotion';

// ─── Opacity ─────────────────────────────────────────────────
export function fadeIn(frame: number, delay = 0, duration = 20): number {
    return interpolate(frame - delay, [0, duration], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
}

export function fadeOut(
    frame: number,
    startFrame: number,
    duration = 20,
): number {
    return interpolate(frame - startFrame, [0, duration], [1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
}

// ─── Slide ───────────────────────────────────────────────────
export type SlideDirection = 'left' | 'right' | 'up' | 'down';

export function slideIn(
    frame: number,
    direction: SlideDirection,
    delay = 0,
    distance = 100,
    duration = 20,
): string {
    const progress = interpolate(frame - delay, [0, duration], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    const remaining = (1 - progress) * distance;

    switch (direction) {
        case 'left':
            return `translateX(${-remaining}px)`;
        case 'right':
            return `translateX(${remaining}px)`;
        case 'up':
            return `translateY(${-remaining}px)`;
        case 'down':
            return `translateY(${remaining}px)`;
    }
}

// ─── Scale ───────────────────────────────────────────────────
export function scaleIn(
    frame: number,
    fps: number,
    delay = 0,
): number {
    return spring({
        frame: frame - delay,
        fps,
        config: { damping: 12, stiffness: 200, mass: 0.5 },
    });
}

// ─── Typewriter ──────────────────────────────────────────────
export function typewriter(
    frame: number,
    text: string,
    charsPerFrame = 0.5,
    delay = 0,
): string {
    const elapsed = Math.max(0, frame - delay);
    const charCount = Math.min(
        text.length,
        Math.floor(elapsed * charsPerFrame),
    );
    return text.slice(0, charCount);
}

// ─── Counter (animates a number from 0 → target) ────────────
export function animatedCounter(
    frame: number,
    target: number,
    delay = 0,
    duration = 60,
): number {
    const progress = interpolate(frame - delay, [0, duration], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    return Math.round(progress * target);
}

// ─── Pulse / Breathe ─────────────────────────────────────────
export function pulse(frame: number, speed = 0.05, amplitude = 0.05): number {
    return 1 + Math.sin(frame * speed) * amplitude;
}

// ─── Stagger utility ─────────────────────────────────────────
export function staggerDelay(index: number, stagger = 5): number {
    return index * stagger;
}
