import React from 'react';
import {
    AbsoluteFill,
    useCurrentFrame,
    Img,
    interpolate,
    Easing,
} from 'remotion';
import { z } from 'zod';
import { useIsPortrait, useScaleFactor } from '../../lib/responsive';
import { AnimatedGradient } from '../../components/AnimatedGradient';
import {
    resolveCanvasBackground,
    shouldRenderBackgroundLayer,
    useResolvedBackgroundControls,
} from '../../lib/background';
import { registerTemplate } from '../registry';
import { EditableText } from '../../components/EditableText';
import { interFont } from '../../lib/fonts';

// ─── Schema ──────────────────────────────────────────────────
export const lightLeakSmashSchema = z.object({
    clip1Url: z.string().default('https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1920'),
    clip2Url: z.string().default('https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1920'),
    clip3Url: z.string().default('https://images.unsplash.com/photo-1553877522-43269d4ea984?w=1920'),
    ctaText: z.string().default('Follow for more'),
    leakColor1: z.string().default('#FF6B35'),
    leakColor2: z.string().default('#FFD93D'),
    backgroundColor: z.string().default('#0A0A0F'),
    showScanlines: z.boolean().default(true),
    showGrain: z.boolean().default(true),
});

type Props = z.infer<typeof lightLeakSmashSchema>;

// ─── Component ───────────────────────────────────────────────
export const LightLeakSmash01: React.FC<Props> = (props) => {
    const frame = useCurrentFrame();
    const isPortrait = useIsPortrait();
    const s = useScaleFactor();
    const backgroundControls = useResolvedBackgroundControls();
    const renderBackgroundLayers = shouldRenderBackgroundLayer(backgroundControls);

    // ─── Clip 1 (f0-f120) ───
    const clip1Zoom = interpolate(frame, [0, 12], [1.0, 1.04], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const clip1Opacity = frame < 120 ? 1 : 0;

    // ─── Transition 1 (f120-f145) ───
    const leak1Opacity = interpolate(frame, [120, 126, 128, 145], [0, 0.9, 1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const wash1Opacity = interpolate(frame, [126, 128, 132], [0, 0.6, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    // ─── Clip 2 (f145-f255) ───
    const clip2Scale = interpolate(frame, [145, 155], [1.08, 1.0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.quad),
    });
    const clip2Opacity = frame >= 128 && frame < 255 ? 1 : 0;

    // ─── Transition 2 (f255-f280) ───
    const leak2Opacity = interpolate(frame, [255, 261, 263, 280], [0, 0.9, 1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const wash2Opacity = interpolate(frame, [261, 263, 267], [0, 0.6, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    // ─── Clip 3 (f280-f330) ───
    const clip3Scale = interpolate(frame, [280, 290], [1.06, 1.0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.quad),
    });
    const clip3Opacity = frame >= 263 ? 1 : 0;

    // CTA sticker bounce (f300-f330)
    const ctaY = interpolate(frame, [300, 315], [50 * s, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.back(1.5)),
    });
    const ctaOpacity = interpolate(frame, [300, 315], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    return (
        <AbsoluteFill
            style={{
                background: resolveCanvasBackground(props.backgroundColor, backgroundControls),
                overflow: 'hidden',
            }}
        >
            {/* Animated background */}
            <AnimatedGradient />

            {/* Clip 1 */}
            {clip1Opacity > 0 && (
                <AbsoluteFill
                    style={{
                        transform: `scale(${clip1Zoom})`,
                        opacity: clip1Opacity,
                    }}
                >
                    <Img
                        src={props.clip1Url}
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                        }}
                    />
                </AbsoluteFill>
            )}

            {/* Clip 2 */}
            {clip2Opacity > 0 && (
                <AbsoluteFill
                    style={{
                        transform: `scale(${clip2Scale})`,
                        opacity: clip2Opacity,
                    }}
                >
                    <Img
                        src={props.clip2Url}
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                        }}
                    />
                </AbsoluteFill>
            )}

            {/* Clip 3 */}
            {clip3Opacity > 0 && (
                <AbsoluteFill
                    style={{
                        transform: `scale(${clip3Scale})`,
                        opacity: clip3Opacity,
                    }}
                >
                    <Img
                        src={props.clip3Url}
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                        }}
                    />
                </AbsoluteFill>
            )}

            {/* Light leak overlay 1 */}
            {renderBackgroundLayers && (
                <AbsoluteFill
                    style={{
                        background: `linear-gradient(135deg, ${props.leakColor1}ee, ${props.leakColor2}ee, transparent)`,
                        opacity: leak1Opacity,
                        mixBlendMode: 'screen',
                    }}
                />
            )}

            {/* Exposure wash 1 */}
            {renderBackgroundLayers && (
                <AbsoluteFill
                    style={{
                        background: '#ffffff',
                        opacity: wash1Opacity,
                    }}
                />
            )}

            {/* Light leak overlay 2 */}
            {renderBackgroundLayers && (
                <AbsoluteFill
                    style={{
                        background: `linear-gradient(-45deg, ${props.leakColor2}ee, ${props.leakColor1}ee, transparent)`,
                        opacity: leak2Opacity,
                        mixBlendMode: 'screen',
                    }}
                />
            )}

            {/* Exposure wash 2 */}
            {renderBackgroundLayers && (
                <AbsoluteFill
                    style={{
                        background: '#ffffff',
                        opacity: wash2Opacity,
                    }}
                />
            )}

            {/* Scanlines */}
            {renderBackgroundLayers && props.showScanlines && (
                <AbsoluteFill
                    style={{
                        background: `repeating-linear-gradient(
                            0deg,
                            transparent,
                            transparent 2px,
                            rgba(0,0,0,0.1) 2px,
                            rgba(0,0,0,0.1) 4px
                        )`,
                        opacity: 0.06,
                    }}
                />
            )}

            {/* Grain overlay */}
            {renderBackgroundLayers && props.showGrain && (
                <AbsoluteFill
                    style={{
                        background: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' /%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
                        opacity: 0.07,
                        mixBlendMode: 'overlay',
                    }}
                />
            )}

            {/* CTA Sticker (f300+) */}
            {frame >= 300 && (
                <AbsoluteFill
                    style={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'flex-end',
                        paddingBottom: isPortrait ? 136 : 92,
                    }}
                >
                    <div
                        style={{
                            transform: `translateY(${ctaY}px)`,
                            opacity: ctaOpacity,
                            background: `linear-gradient(135deg, ${props.leakColor1}, ${props.leakColor2})`,
                            padding: isPortrait ? `${20 * s}px ${48 * s}px` : `${24 * s}px ${56 * s}px`,
                            borderRadius: 100 * s,
                            boxShadow: `0 ${8 * s}px ${32 * s}px ${props.leakColor1}66`,
                        }}
                    >
                        <EditableText
                            text={props.ctaText}
                            fontSize={(isPortrait ? 36 : 44) * s}
                            fontFamily={interFont}
                            color="#FFFFFF"
                            fontWeight={700}
                        />
                    </div>
                </AbsoluteFill>
            )}
        </AbsoluteFill>
    );
};

// ─── Register ────────────────────────────────────────────────
registerTemplate({
    id: 'light-leak-smash-01',
    name: 'Light-Leak Smash Transitions',
    category: 'social-hooks',
    description: 'Transition playground with 3 clips and 2 flashy light-leak cuts.',
    tags: ['transition', 'light-leak', 'flash', 'cut', 'b-roll'],
    component: LightLeakSmash01,
    schema: lightLeakSmashSchema,
    defaultProps: lightLeakSmashSchema.parse({}),
    durationInFrames: 330, // 11s @ 30fps
    fps: 30,
});
