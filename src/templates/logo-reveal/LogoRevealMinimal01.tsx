import React from 'react';
import {
    AbsoluteFill,
    useCurrentFrame,
    useVideoConfig,
    interpolate,
    spring,
} from 'remotion';
import { z } from 'zod';
import { useIsPortrait, useResponsive } from '../../lib/responsive';
import { EditableText } from '../../components/EditableText';
import { AnimatedGradient } from '../../components/AnimatedGradient';
import {
    resolveCanvasBackground,
    shouldRenderBackgroundLayer,
    useResolvedBackgroundControls,
} from '../../lib/background';
import { registerTemplate } from '../registry';
import { DEFAULT_DURATION_FRAMES, DEFAULT_FPS } from '../../lib/constants';
import { linearGradient } from '../../lib/colors';
import { interFont } from '../../lib/fonts';
import { COLORS } from '../../lib/theme';

// ─── Schema ──────────────────────────────────────────────────
export const logoRevealSchema = z.object({
    brandName: z.string().default('AURORA'),
    tagline: z.string().default('Illuminate Your Future'),
    logoEmoji: z.string().default('✦'),
    primaryColor: z.string().default(COLORS.accent),
    accentColor: z.string().default(COLORS.accentLight),
    backgroundColor: z.string().default(COLORS.bg),
});

type Props = z.infer<typeof logoRevealSchema>;

// ─── Component ───────────────────────────────────────────────
export const LogoRevealMinimal01: React.FC<Props> = (props) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    
    const isPortrait = useIsPortrait();
    const scale = useResponsive(1, 1);
    const backgroundControls = useResolvedBackgroundControls();
    const renderBackgroundLayers = shouldRenderBackgroundLayer(backgroundControls);

    // Animation sequence
    const symbolScale = spring({
        frame: frame - 10,
        fps,
        config: { damping: 8, stiffness: 80, mass: 0.8 },
    });

    const symbolRotation = interpolate(frame, [10, 60], [180, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    const nameReveal = spring({
        frame: frame - 35,
        fps,
        config: { damping: 12, stiffness: 100, mass: 0.6 },
    });

    const taglineOpacity = interpolate(frame, [60, 80], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });

    const ringScale = spring({
        frame: frame - 5,
        fps,
        config: { damping: 15, stiffness: 60, mass: 1 },
    });

    const glowPulse = interpolate(
        Math.sin(frame * 0.06),
        [-1, 1],
        [0.5, 1]
    );

    return (
        <AbsoluteFill
            style={{
                background: resolveCanvasBackground(COLORS.bg, backgroundControls),
                overflow: 'hidden',
            }}
        >
            {/* Animated background */}
            <AnimatedGradient />
            {/* Background glow */}
            {renderBackgroundLayers && (
                <div
                    style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: 600,
                        height: 600,
                        borderRadius: '50%',
                        background: `${props.primaryColor}08`,
                        filter: 'blur(120px)',
                        opacity: glowPulse,
                    }}
                />
            )}

            <div
                style={{
                    position: 'relative',
                    zIndex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    width: '100%',
                    height: '100%',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 48,
                }}
                >
                {/* Logo symbol with ring */}
                <div style={{ position: 'relative' }}>
                    {/* Outer ring */}
                    <div
                        style={{
                            width: 176 * scale,
                            height: 176 * scale,
                            borderRadius: '50%',
                            border: `2px solid ${props.primaryColor}30`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transform: `scale(${ringScale})`,
                            boxShadow: `0 0 60px ${props.primaryColor}15`,
                        }}
                    >
                        {/* Inner symbol */}
                        <div
                            style={{
                                fontSize: 140 * scale,
                                transform: `scale(${symbolScale}) rotate(${symbolRotation}deg)`,
                                filter: `drop-shadow(0 0 20px ${props.primaryColor}66)`,
                            }}
                        >
                            {props.logoEmoji}
                        </div>
                    </div>
                </div>

                {/* Brand name */}
                <div
                    style={{
                        overflow: 'hidden',
                    }}
                >
                    <div
                        style={{
                            transform: `translateY(${interpolate(nameReveal, [0, 1], [60, 0])}px)`,
                            opacity: nameReveal,
                        }}
                    >
                        <div
                            style={{
                                fontSize: isPortrait ? 88 : 128,
                                fontFamily: interFont,
                                fontWeight: 900,
                                letterSpacing: isPortrait ? 10 : 14,
                                textAlign: 'center',
                                backgroundImage: linearGradient(135, props.primaryColor, props.accentColor),
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text',
                            }}
                        >
                            {props.brandName}
                        </div>
                    </div>
                </div>

                {/* Tagline */}
                <EditableText
                    text={props.tagline}
                    fontSize={isPortrait ? 36 : 44}
                    fontFamily={interFont}
                    color={COLORS.textSecondary}
                    fontWeight={400}
                    textAlign="center"
                    letterSpacing={3}
                    style={{ opacity: taglineOpacity }}
                />
            </div>
        </AbsoluteFill>
    );
};

// ─── Register ────────────────────────────────────────────────
registerTemplate({
    id: 'logo-reveal-minimal-01',
    name: 'Minimal Logo Reveal',
    category: 'logo-reveal',
    description: 'Clean logo reveal with rotating symbol, ring animation, gradient name, and tagline fade-in',
    tags: ['logo', 'reveal', 'brand', 'intro', 'minimal'],
    component: LogoRevealMinimal01,
    schema: logoRevealSchema,
    defaultProps: logoRevealSchema.parse({}),
    durationInFrames: DEFAULT_DURATION_FRAMES,
    fps: DEFAULT_FPS,
});
