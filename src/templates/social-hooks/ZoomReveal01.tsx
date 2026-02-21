import React from 'react';
import {
    AbsoluteFill,
    useCurrentFrame,
    useVideoConfig,
    Img,
    interpolate,
    spring,
    Easing,
} from 'remotion';
import { z } from 'zod';
import { useIsPortrait, useScaleFactor } from '../../lib/responsive';
import { fadeIn } from '../../lib/animations';
import { EditableText } from '../../components/EditableText';
import { AnimatedGradient } from '../../components/AnimatedGradient';
import {
    resolveCanvasBackground,
    shouldRenderBackgroundLayer,
    useResolvedBackgroundControls,
} from '../../lib/background';
import { registerTemplate } from '../registry';
import { interFont } from '../../lib/fonts';
import { COLORS } from '../../lib/theme';

// ─── Schema ──────────────────────────────────────────────────
export const zoomRevealSchema = z.object({
    backgroundImageUrl: z.string().default('https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1920'),
    caption1: z.string().default('This changed everything'),
    caption2: z.string().default('Here\'s the PROOF'),
    highlightWord: z.string().default('PROOF'),
    primaryColor: z.string().default(COLORS.accent),
    accentColor: z.string().default(COLORS.accent),
    backgroundColor: z.string().default(COLORS.bg),
    showVignette: z.boolean().default(true),
});

type Props = z.infer<typeof zoomRevealSchema>;

// ─── Component ───────────────────────────────────────────────
export const ZoomReveal01: React.FC<Props> = (props) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    
    const isPortrait = useIsPortrait();
    const s = useScaleFactor();
    const backgroundControls = useResolvedBackgroundControls();
    const renderBackgroundLayers = shouldRenderBackgroundLayer(backgroundControls);

    // ─── Zoom-out reveal (f0-f52) ───
    const zoomScale = interpolate(frame, [0, 16, 52], [1.55, 1.55, 1.0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
    });
    const panX = interpolate(frame, [0, 16, 52], [80 * s, 80 * s, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
    });

    // ─── Caption bar 1 (f52-f84) ───
    const caption1Spring = spring({
        frame: frame - 52,
        fps,
        config: { damping: 14, stiffness: 120, mass: 0.8 },
    });
    const caption1Y = interpolate(caption1Spring, [0, 1], [60 * s, 0]);

    // ─── Highlight sweep (f84-f115) ───
    const highlightWidth = interpolate(frame, [84, 115], [0, 100], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    // ─── Hold with drift (f115-f260) ───
    const driftX = interpolate(frame, [115, 260], [0, 15 * s], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    // ─── Caption bar 2 slam (f260-f300) ───
    const caption2Spring = spring({
        frame: frame - 260,
        fps,
        config: { damping: 12, stiffness: 180, mass: 0.6 },
    });
    const caption2Scale = interpolate(caption2Spring, [0, 1], [1.3, 1]);

    // ─── Stamp word animation ───
    const stampScale = spring({
        frame: frame - 280,
        fps,
        config: { damping: 10, stiffness: 200, mass: 0.5 },
    });

    // ─── Outro (f300-f375) ───
    const outroOpacity = fadeIn(frame - 300, 20);

    return (
        <AbsoluteFill
            style={{
                background: resolveCanvasBackground(props.backgroundColor, backgroundControls),
                overflow: 'hidden',
            }}
        >
            {/* Animated background */}
            <AnimatedGradient />

            {/* Background with zoom-out reveal */}
            {renderBackgroundLayers && (
                <AbsoluteFill
                    style={{
                        transform: `scale(${zoomScale}) translateX(${panX + driftX}px)`,
                    }}
                >
                    <Img
                        src={props.backgroundImageUrl}
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            filter: 'brightness(0.6) contrast(1.1) saturate(1.1)',
                        }}
                    />
                </AbsoluteFill>
            )}

            {/* Vignette */}
            {renderBackgroundLayers && props.showVignette && (
                <AbsoluteFill
                    style={{
                        background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.6) 100%)',
                    }}
                />
            )}

            {/* Caption bar 1 (f52+) */}
            {frame >= 52 && (
                <AbsoluteFill
                    style={{
                        display: 'flex',
                        justifyContent: isPortrait ? 'center' : 'flex-start',
                        alignItems: 'flex-end',
                        padding: isPortrait ? '0 60px 500px' : '0 100px 200px',
                    }}
                >
                    <div
                        style={{
                            transform: `translateY(${caption1Y}px)`,
                            position: 'relative',
                        }}
                    >
                        {/* Highlight bar behind text */}
                        <div
                            style={{
                                position: 'absolute',
                                left: -12 * s,
                                right: -12 * s,
                                top: '50%',
                                height: '60%',
                                transform: 'translateY(-50%)',
                                background: `${props.primaryColor}40`,
                                width: `${highlightWidth}%`,
                                borderRadius: 8 * s,
                            }}
                        />
                        <EditableText
                            text={props.caption1}
                            fontSize={(isPortrait ? 56 : 72) * s}
                            fontFamily={interFont}
                            color={COLORS.textPrimary}
                            fontWeight={800}
                            style={{ position: 'relative', zIndex: 1 }}
                        />
                    </div>
                </AbsoluteFill>
            )}

            {/* Caption bar 2 with stamp (f260+) */}
            {frame >= 260 && (
                <AbsoluteFill
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        padding: isPortrait ? '0 60px' : '0 100px',
                    }}
                >
                    <div
                        style={{
                            transform: `scale(${caption2Scale})`,
                            display: 'flex',
                            flexWrap: 'wrap',
                            justifyContent: 'center',
                            gap: 16 * s,
                        }}
                    >
                        {props.caption2.split(' ').map((word, i) => {
                            const isHighlight = word.toUpperCase() === props.highlightWord.toUpperCase();
                            return (
                                <span
                                    key={i}
                                    style={{
                                        display: 'inline-block',
                                        transform: isHighlight ? `scale(${interpolate(stampScale, [0, 1], [1.4, 1])}) rotate(-3deg)` : undefined,
                                        background: isHighlight ? props.primaryColor : 'transparent',
                                        padding: isHighlight ? `${8 * s}px ${20 * s}px` : 0,
                                        borderRadius: isHighlight ? 8 * s : 0,
                                    }}
                                >
                                    <EditableText
                                        text={word}
                                        fontSize={(isPortrait ? 64 : 84) * s}
                                        fontFamily={interFont}
                                        color={isHighlight ? '#FFFFFF' : COLORS.textPrimary}
                                        fontWeight={900}
                                    />
                                </span>
                            );
                        })}
                    </div>
                </AbsoluteFill>
            )}

            {/* Outro icon (f300+) */}
            {frame >= 300 && (
                <AbsoluteFill
                    style={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'flex-end',
                        paddingBottom: isPortrait ? 112 : 80,
                        opacity: outroOpacity,
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12 * s,
                            background: `${props.accentColor}20`,
                            border: `${2 * s}px solid ${props.accentColor}`,
                            padding: `${12 * s}px ${28 * s}px`,
                            borderRadius: 100 * s,
                        }}
                    >
                        <span style={{ fontSize: 28 * s }}>💡</span>
                        <EditableText
                            text="So what does this mean?"
                            fontSize={(isPortrait ? 28 : 32) * s}
                            fontFamily={interFont}
                            color={props.accentColor}
                            fontWeight={600}
                        />
                    </div>
                </AbsoluteFill>
            )}
        </AbsoluteFill>
    );
};

// ─── Register ────────────────────────────────────────────────
registerTemplate({
    id: 'zoom-reveal-01',
    name: 'Zoom-Out B-roll Reveal',
    category: 'social-hooks',
    description: 'Dramatic zoom-out reveal with caption punches and highlight sweeps.',
    tags: ['zoom', 'reveal', 'caption', 'highlight', 'b-roll', 'dramatic'],
    component: ZoomReveal01,
    schema: zoomRevealSchema,
    defaultProps: zoomRevealSchema.parse({}),
    durationInFrames: 375, // 12.5s @ 30fps
    fps: 30,
});
