import React from 'react';
import {
    AbsoluteFill,
    useCurrentFrame,
    useVideoConfig,
    Img,
    interpolate,
    spring,
    Easing,
    Sequence,
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
export const cutoutHookSchema = z.object({
    presenterImageUrl: z.string().default('https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800'),
    backgroundVideoUrl: z.string().default('https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1920'),
    headline: z.string().default('3 SECRETS TO VIRAL CONTENT'),
    captionText: z.string().default('Watch till the end for the biggest tip'),
    icon1Emoji: z.string().default('📱'),
    icon2Emoji: z.string().default('🎬'),
    icon3Emoji: z.string().default('🚀'),
    icon1Label: z.string().default('TikTok'),
    icon2Label: z.string().default('YouTube'),
    icon3Label: z.string().default('Instagram'),
    primaryColor: z.string().default('#FF6B35'),
    accentColor: z.string().default('#00D4FF'),
    backgroundColor: z.string().default('#0A0A0F'),
    showGrain: z.boolean().default(true),
    showVignette: z.boolean().default(true),
});

type Props = z.infer<typeof cutoutHookSchema>;

// ─── Component ───────────────────────────────────────────────
export const CutoutHook01: React.FC<Props> = (props) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    
    const isPortrait = useIsPortrait();
    const s = useScaleFactor();
    const backgroundControls = useResolvedBackgroundControls();
    const renderBackgroundLayers = shouldRenderBackgroundLayer(backgroundControls);

    // ─── Presenter slam-in animation (f0-f12) ───
    const presenterSpring = spring({
        frame,
        fps,
        config: { damping: 16, stiffness: 140, mass: 1 },
    });
    const presenterScale = interpolate(presenterSpring, [0, 1], [1.25, 1]);
    const presenterY = interpolate(frame, [18, 28], [0, 200 * s], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.in(Easing.cubic),
    });
    const presenterBlur = interpolate(frame, [18, 28], [0, 8 * s], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const presenterOpacity = interpolate(frame, [18, 28], [1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    // Presenter glow animation (f8-f22)
    const glowOpacity = interpolate(frame, [8, 22], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    // ─── Icon animations (f28-f70) ───
    const icon1Spring = spring({
        frame: frame - 28,
        fps,
        config: { damping: 14, stiffness: 120, mass: 0.8 },
    });
    const icon2Spring = spring({
        frame: frame - 36,
        fps,
        config: { damping: 14, stiffness: 120, mass: 0.8 },
    });
    const icon3Spring = spring({
        frame: frame - 44,
        fps,
        config: { damping: 14, stiffness: 120, mass: 0.8 },
    });

    // ─── Caption bar animation (f70-f210) ───
    const captionWipe = interpolate(frame, [70, 90], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    // Keyword punch animation every ~45 frames
    const keywordPunchFrame = Math.floor((frame - 70) / 45) * 45 + 70;
    const keywordScale = frame >= 70 ? spring({
        frame: frame - keywordPunchFrame,
        fps,
        config: { damping: 12, stiffness: 200, mass: 0.5 },
    }) : 0;

    // ─── B-roll zoom drift (f210-f320) ───
    const bgZoom = interpolate(frame, [210, 320], [1.03, 1.06], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    // ─── Light leak flash (f320-f360) ───
    const flashOpacity = interpolate(frame, [320, 328, 340, 360], [0, 0.9, 0.4, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    // Presenter re-entry (f340-f360)
    const reentrySpring = spring({
        frame: frame - 340,
        fps,
        config: { damping: 14, stiffness: 100, mass: 1 },
    });
    const reentryScale = frame >= 340 ? interpolate(reentrySpring, [0, 1], [0.8, 1]) : 0;
    const reentryOpacity = frame >= 340 ? interpolate(reentrySpring, [0, 1], [0, 1]) : 0;

    const iconSize = (isPortrait ? 100 : 120) * s;
    const presenterSize = isPortrait ? { width: 500 * s, height: 700 * s } : { width: 600 * s, height: 850 * s };

    return (
        <AbsoluteFill
            style={{
                background: resolveCanvasBackground(props.backgroundColor, backgroundControls),
                overflow: 'hidden',
            }}
        >
            {/* Animated background */}
            <AnimatedGradient />

            {/* Background image with zoom drift */}
            {renderBackgroundLayers && (
                <AbsoluteFill
                    style={{
                        transform: `scale(${bgZoom})`,
                    }}
                >
                    <Img
                        src={props.backgroundVideoUrl}
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            filter: 'brightness(0.4) contrast(1.1) saturate(1.12)',
                        }}
                    />
                </AbsoluteFill>
            )}

            {/* Vignette overlay */}
            {renderBackgroundLayers && props.showVignette && (
                <AbsoluteFill
                    style={{
                        background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.7) 100%)',
                    }}
                />
            )}

            {/* Grain overlay */}
            {renderBackgroundLayers && props.showGrain && (
                <AbsoluteFill
                    style={{
                        background: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' /%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
                        opacity: 0.08,
                        mixBlendMode: 'overlay',
                    }}
                />
            )}

            {/* Phase 1: Presenter slam-in (f0-f28) */}
            {frame < 28 && (
                <AbsoluteFill
                    style={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: isPortrait ? 'center' : 'flex-end',
                        paddingBottom: isPortrait ? 0 : 100 * s,
                    }}
                >
                    <div
                        style={{
                            position: 'relative',
                            transform: `scale(${presenterScale}) translateY(${presenterY}px)`,
                            filter: `blur(${presenterBlur}px)`,
                            opacity: presenterOpacity,
                        }}
                    >
                        {/* Glow outline */}
                        <div
                            style={{
                                position: 'absolute',
                                inset: -8 * s,
                                borderRadius: 24 * s,
                                boxShadow: `0 0 ${60 * s}px ${props.primaryColor}`,
                                opacity: glowOpacity,
                            }}
                        />
                        <Img
                            src={props.presenterImageUrl}
                            style={{
                                ...presenterSize,
                                objectFit: 'cover',
                                borderRadius: 20 * s,
                                boxShadow: `0 ${20 * s}px ${60 * s}px rgba(0,0,0,0.5)`,
                            }}
                        />
                    </div>
                </AbsoluteFill>
            )}

            {/* Phase 2: Icon stack (f28-f70) */}
            <Sequence from={28}>
                <AbsoluteFill
                    style={{
                        display: 'flex',
                        flexDirection: isPortrait ? 'column' : 'row',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: (isPortrait ? 32 : 64) * s,
                        paddingTop: (isPortrait ? 140 : 72) * s,
                    }}
                >
                    {/* Icon 1 - slide from left */}
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 12 * s,
                            transform: `translateX(${interpolate(icon1Spring, [0, 1], [-100 * s, 0])}px) scale(${interpolate(icon1Spring, [0, 1], [0.8, 1])})`,
                            opacity: icon1Spring,
                        }}
                    >
                        <div
                            style={{
                                width: iconSize,
                                height: iconSize,
                                borderRadius: iconSize / 4,
                                background: `${props.primaryColor}20`,
                                border: `3px solid ${props.primaryColor}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: iconSize * 0.5,
                            }}
                        >
                            {props.icon1Emoji}
                        </div>
                        <EditableText
                            text={props.icon1Label}
                            fontSize={(isPortrait ? 28 : 32) * s}
                            fontFamily={interFont}
                            color={COLORS.textPrimary}
                            fontWeight={600}
                        />
                    </div>

                    {/* Icon 2 - drop from top */}
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 12 * s,
                            transform: `translateY(${interpolate(icon2Spring, [0, 1], [-80 * s, 0])}px) scale(${interpolate(icon2Spring, [0, 1], [0.7, 1])})`,
                            opacity: icon2Spring,
                        }}
                    >
                        <div
                            style={{
                                width: iconSize,
                                height: iconSize,
                                borderRadius: iconSize / 4,
                                background: `${props.accentColor}20`,
                                border: `${3 * s}px solid ${props.accentColor}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: iconSize * 0.5,
                            }}
                        >
                            {props.icon2Emoji}
                        </div>
                        <EditableText
                            text={props.icon2Label}
                            fontSize={(isPortrait ? 28 : 32) * s}
                            fontFamily={interFont}
                            color={COLORS.textPrimary}
                            fontWeight={600}
                        />
                    </div>

                    {/* Icon 3 - slide from right */}
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 12 * s,
                            transform: `translateX(${interpolate(icon3Spring, [0, 1], [100 * s, 0])}px) scale(${interpolate(icon3Spring, [0, 1], [0.8, 1])})`,
                            opacity: icon3Spring,
                        }}
                    >
                        <div
                            style={{
                                width: iconSize,
                                height: iconSize,
                                borderRadius: iconSize / 4,
                                background: `${props.primaryColor}20`,
                                border: `3px solid ${props.primaryColor}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: iconSize * 0.5,
                            }}
                        >
                            {props.icon3Emoji}
                        </div>
                        <EditableText
                            text={props.icon3Label}
                            fontSize={(isPortrait ? 28 : 32) * s}
                            fontFamily={interFont}
                            color={COLORS.textPrimary}
                            fontWeight={600}
                        />
                    </div>
                </AbsoluteFill>
            </Sequence>

            {/* Headline (f70+) */}
            <Sequence from={70}>
                <AbsoluteFill
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: isPortrait ? 'flex-end' : 'center',
                        alignItems: 'center',
                        padding: isPortrait ? `0 ${56 * s}px ${150 * s}px` : `0 ${112 * s}px`,
                    }}
                >
                    <div
                        style={{
                            transform: `scaleX(${captionWipe})`,
                            transformOrigin: 'left',
                            background: `linear-gradient(135deg, ${props.primaryColor}, ${props.accentColor})`,
                            padding: isPortrait ? `${24 * s}px ${48 * s}px` : `${32 * s}px ${64 * s}px`,
                            borderRadius: 16 * s,
                        }}
                    >
                        <EditableText
                            text={props.headline}
                            fontSize={(isPortrait ? 56 : 72) * s}
                            fontFamily={interFont}
                            color="#FFFFFF"
                            fontWeight={900}
                            textAlign="center"
                            style={{
                                transform: `scale(${1 + keywordScale * 0.06})`,
                                textShadow: '0 4px 20px rgba(0,0,0,0.3)',
                            }}
                        />
                    </div>

                    {/* Caption text */}
                    <div style={{ marginTop: 24 * s, opacity: fadeIn(frame - 70, 20) }}>
                        <EditableText
                            text={props.captionText}
                            fontSize={(isPortrait ? 32 : 40) * s}
                            fontFamily={interFont}
                            color={COLORS.textSecondary}
                            fontWeight={500}
                            textAlign="center"
                            style={{
                                ...(isPortrait ? {} : { textAlign: 'left' }),
                            }}
                        />
                    </div>
                </AbsoluteFill>
            </Sequence>

            {/* Light leak flash (f320-f360) */}
            {renderBackgroundLayers && (
                <AbsoluteFill
                    style={{
                        background: `linear-gradient(135deg, ${props.primaryColor}ee, ${props.accentColor}ee, #ffffff)`,
                        opacity: flashOpacity,
                        mixBlendMode: 'screen',
                    }}
                />
            )}

            {/* Presenter re-entry (f340-f360) */}
            {frame >= 340 && (
                <AbsoluteFill
                    style={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                    }}
                >
                    <div
                        style={{
                            transform: `scale(${reentryScale})`,
                            opacity: reentryOpacity,
                        }}
                    >
                        <Img
                            src={props.presenterImageUrl}
                            style={{
                                width: presenterSize.width * 0.8,
                                height: presenterSize.height * 0.8,
                                objectFit: 'cover',
                                borderRadius: 20 * s,
                                boxShadow: `0 0 ${80 * s}px ${props.primaryColor}`,
                            }}
                        />
                    </div>
                </AbsoluteFill>
            )}
        </AbsoluteFill>
    );
};

// ─── Register ────────────────────────────────────────────────
registerTemplate({
    id: 'cutout-hook-01',
    name: 'Cut-out Hook with Social Proof',
    category: 'social-hooks',
    description: 'Short-form hook opener with presenter cut-out, platform icons, and value tag. Perfect for explainer intros.',
    tags: ['hook', 'presenter', 'social-proof', 'icons', 'intro', 'explainer'],
    component: CutoutHook01,
    schema: cutoutHookSchema,
    defaultProps: cutoutHookSchema.parse({}),
    durationInFrames: 360, // 12s @ 30fps
    fps: 30,
});
