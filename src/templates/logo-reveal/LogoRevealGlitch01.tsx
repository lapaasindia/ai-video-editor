import React from 'react';
import {
    AbsoluteFill,
    useCurrentFrame,
    useVideoConfig,
    interpolate,
    spring,
} from 'remotion';
import { z } from 'zod';
import { useIsPortrait } from '../../lib/responsive';

import { EditableText } from '../../components/EditableText';
import { AnimatedGradient } from '../../components/AnimatedGradient';
import {
    resolveCanvasBackground,
    shouldRenderBackgroundLayer,
    useResolvedBackgroundControls,
} from '../../lib/background';
import { registerTemplate } from '../registry';
import { DEFAULT_DURATION_FRAMES, DEFAULT_FPS } from '../../lib/constants';
import { interFont } from '../../lib/fonts';
import { COLORS, GRADIENTS } from '../../lib/theme';

// ─── Schema ──────────────────────────────────────────────────
export const logoRevealGlitchSchema = z.object({
    brandName: z.string().default('NEXUS'),
    tagline: z.string().default('Redefine Everything'),
    primaryColor: z.string().default(COLORS.accent),
    accentColor: z.string().default(COLORS.accentLight),
    backgroundColor: z.string().default(COLORS.bg),
});

type Props = z.infer<typeof logoRevealGlitchSchema>;

// ─── Component ───────────────────────────────────────────────
export const LogoRevealGlitch01: React.FC<Props> = (props) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    
    const isPortrait = useIsPortrait();
    const backgroundControls = useResolvedBackgroundControls();
    const renderBackgroundLayers = shouldRenderBackgroundLayer(backgroundControls);
    const brandTextSize = isPortrait ? 68 : 94;
    const taglineTextSize = isPortrait ? 34 : 44;

    const nameReveal = spring({
        frame: frame - 15,
        fps,
        config: { damping: 10, stiffness: 100, mass: 0.7 },
    });

    const taglineOpacity = interpolate(frame, [55, 75], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    // Glitch effect — random offsets at certain frames
    const isGlitchFrame = (frame > 10 && frame < 15) || (frame > 40 && frame < 43) || (frame > 80 && frame < 83);
    const glitchX = isGlitchFrame ? Math.sin(frame * 37) * 8 : 0;
    const glitchY = isGlitchFrame ? Math.cos(frame * 29) * 4 : 0;

    // Scan lines
    const scanLineY = interpolate(frame % 60, [0, 60], [0, 100]);

    return (
        <AbsoluteFill
            style={{
                background: resolveCanvasBackground(COLORS.bg, backgroundControls),
                overflow: 'hidden',
            }}
        >
            {/* Animated background */}
            <AnimatedGradient />
            {/* Scan line */}
            {renderBackgroundLayers && (
                <div
                    style={{
                        position: 'absolute',
                        top: `${scanLineY}%`,
                        left: 0,
                        right: 0,
                        height: 2,
                        background: `${props.primaryColor}15`,
                        filter: 'blur(1px)',
                    }}
                />
            )}

            {/* Horizontal glitch lines */}
            {renderBackgroundLayers && isGlitchFrame && (
                <>
                    <div
                        style={{
                            position: 'absolute',
                            top: '30%',
                            left: 0,
                            right: 0,
                            height: 6,
                            background: COLORS.accent,
                            opacity: 0.3,
                            transform: `translateX(${glitchX * 3}px)`,
                        }}
                    />
                    <div
                        style={{
                            position: 'absolute',
                            top: '62%',
                            left: 0,
                            right: 0,
                            height: 2,
                            background: COLORS.accentLight,
                            opacity: 0.25,
                            transform: `translateX(${-glitchX * 2}px)`,
                        }}
                    />
                </>
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
                    gap: 40,
                }}
            >
                {/* Brand name with glitch offset layers */}
                <div style={{ position: 'relative' }}>
                    {/* Red offset layer */}
                    <div
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            fontSize: brandTextSize,
                            fontFamily: interFont,
                            fontWeight: 900,
                            letterSpacing: 14,
                            color: props.primaryColor,
                            opacity: isGlitchFrame ? 0.6 : 0,
                            transform: `translate(${glitchX}px, ${glitchY}px)`,
                            mixBlendMode: 'screen',
                        }}
                    >
                        {props.brandName}
                    </div>

                    {/* Cyan offset layer */}
                    <div
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            fontSize: brandTextSize,
                            fontFamily: interFont,
                            fontWeight: 900,
                            letterSpacing: 14,
                            color: props.accentColor,
                            opacity: isGlitchFrame ? 0.6 : 0,
                            transform: `translate(${-glitchX}px, ${-glitchY}px)`,
                            mixBlendMode: 'screen',
                        }}
                    >
                        {props.brandName}
                    </div>

                    {/* Main text */}
                    <div
                        style={{
                            fontSize: brandTextSize,
                            fontFamily: interFont,
                            fontWeight: 900,
                            letterSpacing: 14,
                            color: '#ffffff',
                            opacity: nameReveal,
                            transform: `scale(${nameReveal})`,
                        }}
                    >
                        {props.brandName}
                    </div>
                </div>

                {/* Divider line */}
                <div
                    style={{
                        width: interpolate(nameReveal, [0, 1], [0, isPortrait ? 180 : 280]),
                        height: 2,
                        background: GRADIENTS.bgMain,
                        boxShadow: `0 0 12px ${props.primaryColor}44`,
                    }}
                />

                {/* Tagline */}
                <EditableText
                    text={props.tagline}
                    fontSize={taglineTextSize}
                    fontFamily={interFont}
                    color={COLORS.textSecondary}
                    fontWeight={400}
                    letterSpacing={6}
                    textTransform="uppercase"
                    textAlign="center"
                    style={{ opacity: taglineOpacity }}
                />
            </div>

            {/* Bottom accent */}
            <div
                style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    width: `${interpolate(frame, [0, 60], [0, 100], { extrapolateRight: 'clamp' })}%`,
                    height: 6,
                    background: GRADIENTS.bgMain,
                }}
            />
        </AbsoluteFill>
    );
};

// ─── Register ────────────────────────────────────────────────
registerTemplate({
    id: 'logo-reveal-glitch-01',
    name: 'Glitch Logo Reveal',
    category: 'logo-reveal',
    description: 'Cyberpunk glitch logo reveal with RGB offset layers, scan lines, and spring animation',
    tags: ['logo', 'glitch', 'cyberpunk', 'brand', 'reveal'],
    component: LogoRevealGlitch01,
    schema: logoRevealGlitchSchema,
    defaultProps: logoRevealGlitchSchema.parse({}),
    durationInFrames: DEFAULT_DURATION_FRAMES,
    fps: DEFAULT_FPS,
});
