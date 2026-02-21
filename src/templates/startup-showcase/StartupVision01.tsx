import React from 'react';
import {
    AbsoluteFill,
    useCurrentFrame,
    useVideoConfig,
    Img,
    interpolate,
    random,
} from 'remotion';
import { z } from 'zod';
import { useIsPortrait, useResponsive, useScaleFactor } from "../../lib/responsive";
import { fadeIn } from '../../lib/animations';
import { EditableText } from '../../components/EditableText';
import {
    resolveCanvasBackground,
    shouldRenderBackgroundLayer,
    useResolvedBackgroundControls,
} from '../../lib/background';

import { registerTemplate } from '../registry';
import { DEFAULT_DURATION_FRAMES, DEFAULT_FPS } from '../../lib/constants';
import { interFont } from '../../lib/fonts';
import { COLORS } from '../../lib/theme';

// ─── Schema ──────────────────────────────────────────────────
export const startupVisionSchema = z.object({
    title: z.string().default('OUR VISION'),
    subtitle: z.string().default('Building the future of tech'),
    location: z.string().default('ESTABLISHED • 2026'),
    imageUrl: z.string().default('https://images.unsplash.com/photo-1476610182048-b716b8518aae?w=1600'),
    overlayColor: z.string().default('#000000'),
    accentColor: z.string().default(COLORS.accentLight), // Gold
    showDust: z.boolean().default(true),
    showVignette: z.boolean().default(true),
    enableGrade: z.boolean().default(true),
});

type Props = z.infer<typeof startupVisionSchema>;

// ─── Component ───────────────────────────────────────────────
export const StartupVision01: React.FC<Props> = (props) => {
    const scale = useScaleFactor();
    const frame = useCurrentFrame();
    useVideoConfig();
    const isPortrait = useIsPortrait();
    const backgroundControls = useResolvedBackgroundControls();
    const renderBackgroundLayers = shouldRenderBackgroundLayer(backgroundControls);

    // Parallax & Scale Animation
    // Image scales up slowly
    const imageScale = interpolate(frame, [0, 300], [1, 1.3], { extrapolateRight: 'clamp' });

    // Text moves slightly opposite to image movement concept (though image is just scaling here, we can add slight pan)
    const textY = interpolate(frame, [0, 150], [0, -40]);

    // Dust particles
    const dustParticles = React.useMemo(() => {
        return new Array(20).fill(0).map((_, i) => ({
            x: random(i) * 100,
            y: random(i + 10) * 100,
            size: random(i + 20) * 4 + 1,
            speed: random(i + 30) * 0.5 + 0.2,
            opacity: random(i + 40) * 0.5 + 0.2,
        }));
    }, []);

    return (
        <AbsoluteFill
            style={{
                background: resolveCanvasBackground(COLORS.bg, backgroundControls),
                overflow: 'hidden',
            }}
        >
            {/* Background Image Layer */}
            {renderBackgroundLayers && (
            <AbsoluteFill>
                <Img
                    src={props.imageUrl}
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        transform: `scale(${imageScale})`,
                        filter: props.enableGrade ? 'contrast(1.1) saturate(0.9) brightness(0.8)' : 'none',
                    }}
                />
            </AbsoluteFill>
            )}

            {/* Vignette Layer */}
            {renderBackgroundLayers && props.showVignette && (
                <AbsoluteFill
                    style={{
                        background: `radial-gradient(circle at center, transparent 40%, ${props.overlayColor}cc 100%)`,
                        opacity: 0.8,
                    }}
                />
            )}

            {/* Dust Particles Layer */}
            {renderBackgroundLayers && props.showDust && (
                <AbsoluteFill>
                    {dustParticles.map((p, i) => (
                        <div
                            key={i}
                            style={{
                                position: 'absolute',
                                left: `${p.x}%`,
                                top: `${(p.y + frame * p.speed) % 110 - 10}%`,
                                width: p.size,
                                height: p.size,
                                borderRadius: '50%',
                                background: '#fff',
                                opacity: p.opacity,
                                boxShadow: '0 0 4px rgba(255,255,255,0.8)',
                                filter: 'blur(1px)',
                            }}
                        />
                    ))}
                </AbsoluteFill>
            )}

            {/* Text Content Layer */}
            <AbsoluteFill
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    zIndex: 10,
                    padding: isPortrait ? '140px 80px' : undefined,
                }}
            >
                <div style={{ transform: `translateY(${textY}px)` }}>
                    {/* Location Tag */}
                    <div style={{
                        opacity: fadeIn(frame, 10),
                        transform: `translateY(${interpolate(frame, [0, 30], [20, 0], { extrapolateRight: 'clamp' })}px)`,
                        marginBottom: 40 * scale,
                        textAlign: 'center',
                    }}>
                        <EditableText
                            text={props.location}
                            fontSize={isPortrait ? 32 : 28 * scale}
                            fontFamily={interFont}
                            color={COLORS.accentLight}
                            fontWeight={600}
                            letterSpacing={6}
                            textTransform="uppercase"
                        />
                    </div>

                    {/* Main Title */}
                    <div style={{
                        opacity: fadeIn(frame, 30),
                        transform: `scale(${interpolate(frame, [30, 90], [1.1, 1], { extrapolateRight: 'clamp' })})`,
                        marginBottom: 20 * scale,
                        textAlign: 'center',
                    }}>
                        <EditableText
                            text={props.title}
                            fontSize={isPortrait ? 112 : 176}
                            fontFamily={interFont}
                            color={COLORS.textPrimary}
                            fontWeight={700}
                            letterSpacing={isPortrait ? 5 : 20}
                            lineHeight={1}
                        />
                    </div>

                    {/* Subtitle */}
                    <div style={{
                        opacity: fadeIn(frame, 60),
                        marginTop: 40 * scale,
                        textAlign: 'center',
                    }}>
                        <div style={{
                            width: 1 * scale,
                            height: 60 * scale,
                            background: '#fff',
                            margin: '0 auto 20px',
                            opacity: 0.5
                        }} />
                        <EditableText
                            text={props.subtitle}
                            fontSize={isPortrait ? 42 : 46 * scale}
                            fontFamily={interFont}
                            color={COLORS.textSecondary}
                            fontWeight={300}
                            letterSpacing={4}
                            fontStyle="italic"
                        />
                    </div>
                </div>
            </AbsoluteFill>

            {/* Cinematic Border/Frame */}
            {renderBackgroundLayers && (
            <AbsoluteFill style={{ pointerEvents: 'none' }}>
                <div style={{
                    position: 'absolute',
                    top: isPortrait ? 40 : 60,
                    left: isPortrait ? 20 : 60,
                    right: isPortrait ? 20 : 60,
                    bottom: isPortrait ? 40 : 60,
                    border: `2px solid ${props.accentColor}40`,
                    opacity: fadeIn(frame, 80),
                }} />
            </AbsoluteFill>
            )}
        </AbsoluteFill>
    );
};

// ─── Register ────────────────────────────────────────────────
registerTemplate({
    id: 'startup-vision-01',
    name: 'Startup Vision Journey',
    category: 'startup-showcase',
    description: 'Inspiring slow-motion parallax effect to showcase company vision and values.',
    tags: ['startup', 'vision', 'mission', 'corporate', 'future'],
    component: StartupVision01,
    schema: startupVisionSchema,
    defaultProps: startupVisionSchema.parse({}),
    durationInFrames: DEFAULT_DURATION_FRAMES,
    fps: DEFAULT_FPS,
});
