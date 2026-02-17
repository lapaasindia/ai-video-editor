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
import { EditableText } from '../../components/EditableText';
import { AnimatedGradient } from '../../components/AnimatedGradient';
import {
    resolveCanvasBackground,
    shouldRenderBackgroundLayer,
    useResolvedBackgroundControls,
} from '../../lib/background';
import { registerTemplate } from '../registry';
import { interFont } from '../../lib/fonts';

// ─── Schema ──────────────────────────────────────────────────
export const headlineCardSchema = z.object({
    presenterImageUrl: z.string().default('https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800'),
    backgroundImageUrl: z.string().default('https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1920'),
    titleLine1: z.string().default('PERSONALITY'),
    titleLine2: z.string().default('MATTERS MORE'),
    titleLine3: z.string().default('THAN MONEY'),
    titleColor: z.string().default('#F21A1D'),
    shadowColor: z.string().default('#000000'),
    backgroundColor: z.string().default('#0A0A0F'),
    showGrain: z.boolean().default(true),
});

type Props = z.infer<typeof headlineCardSchema>;

// ─── Component ───────────────────────────────────────────────
export const HeadlineCard01: React.FC<Props> = (props) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const isPortrait = useIsPortrait();
    const s = useScaleFactor();
    const backgroundControls = useResolvedBackgroundControls();
    const renderBackgroundLayers = shouldRenderBackgroundLayer(backgroundControls);

    // ─── Background zoom (f0-f18) ───
    const bgZoom = interpolate(frame, [0, 18], [1.0, 1.03], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    // ─── Presenter rise (f10-f28) ───
    const presenterSpring = spring({
        frame: frame - 10,
        fps,
        config: { damping: 18, stiffness: 120, mass: 1 },
    });
    const presenterY = interpolate(presenterSpring, [0, 1], [140 * s, 0]);

    // ─── Title chunk typing (f28-f60) ───
    const fullTitle = `${props.titleLine1} ${props.titleLine2} ${props.titleLine3}`;
    const charsPerChunk = 4;
    const typingStartFrame = 28;
    const typingFramesPerChunk = 4;
    
    const getVisibleChars = () => {
        if (frame < typingStartFrame) return 0;
        const elapsed = frame - typingStartFrame;
        const chunks = Math.floor(elapsed / typingFramesPerChunk);
        return Math.min(chunks * charsPerChunk, fullTitle.length);
    };
    const visibleChars = getVisibleChars();
    const visibleTitle = fullTitle.substring(0, visibleChars);

    // Final snap scale punch (f56-f60)
    const snapPunch = spring({
        frame: frame - 56,
        fps,
        config: { damping: 8, stiffness: 300, mass: 0.5 },
    });
    const titleScale = frame >= 56 ? interpolate(snapPunch, [0, 1], [1.06, 1]) : 1;

    // ─── Hold micro motion (f60-f240) ───
    const presenterBob = Math.sin((frame - 60) * 0.07) * (6 * s);

    // ─── Exit animation (f240-f315) ───
    const exitY = interpolate(frame, [240, 280], [0, -150 * s], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.in(Easing.cubic),
    });
    const exitOpacity = interpolate(frame, [240, 280], [1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    // Flash overlay (f280-f315)
    const flashOpacity = interpolate(frame, [280, 290, 300, 315], [0, 0.8, 0.3, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    const presenterHeight = (isPortrait ? 900 : 700) * s;
    const titleFontSize = (isPortrait ? 62 : 132) * s;

    return (
        <AbsoluteFill
            style={{
                background: resolveCanvasBackground(props.backgroundColor, backgroundControls),
                overflow: 'hidden',
            }}
        >
            {/* Animated background */}
            <AnimatedGradient />

            {/* Background image with zoom */}
            {renderBackgroundLayers && (
                <AbsoluteFill
                    style={{
                        transform: `scale(${bgZoom})`,
                    }}
                >
                    <Img
                        src={props.backgroundImageUrl}
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            filter: 'brightness(0.3) contrast(1.2)',
                        }}
                    />
                </AbsoluteFill>
            )}

            {/* Grain overlay */}
            {renderBackgroundLayers && props.showGrain && (
                <AbsoluteFill
                    style={{
                        background: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' /%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
                        opacity: 0.06,
                        mixBlendMode: 'overlay',
                    }}
                />
            )}

            {/* Title - top area */}
            <AbsoluteFill
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-start',
                    alignItems: isPortrait ? 'center' : 'flex-start',
                    padding: isPortrait ? `${120 * s}px ${60 * s}px` : `${100 * s}px ${120 * s}px`,
                    transform: `translateY(${exitY}px)`,
                    opacity: exitOpacity,
                }}
            >
                {/* Shadow text layer */}
                <div style={{ position: 'relative' }}>
                    <EditableText
                        text={visibleTitle || ' '}
                        fontSize={titleFontSize}
                        fontFamily={interFont}
                        color={props.shadowColor}
                        fontWeight={900}
                        lineHeight={1.1}
                        textAlign={isPortrait ? 'center' : 'left'}
                        style={{
                            position: 'absolute',
                            left: 6 * s,
                            top: 6 * s,
                            opacity: 0.7,
                            transform: `scale(${titleScale})`,
                            transformOrigin: isPortrait ? 'center top' : 'left top',
                            maxWidth: isPortrait ? '100%' : '70%',
                        }}
                    />
                    {/* Main title */}
                    <EditableText
                        text={visibleTitle || ' '}
                        fontSize={titleFontSize}
                        fontFamily={interFont}
                        color={props.titleColor}
                        fontWeight={900}
                        lineHeight={1.1}
                        textAlign={isPortrait ? 'center' : 'left'}
                        style={{
                            transform: `scale(${titleScale})`,
                            transformOrigin: isPortrait ? 'center top' : 'left top',
                            textShadow: `0 0 ${40 * s}px ${props.titleColor}66`,
                            maxWidth: isPortrait ? '100%' : '70%',
                        }}
                    />
                </div>
            </AbsoluteFill>

            {/* Presenter - bottom area */}
            <AbsoluteFill
                style={{
                    display: 'flex',
                    justifyContent: isPortrait ? 'center' : 'flex-end',
                    alignItems: 'flex-end',
                    padding: isPortrait ? '0 0 0 0' : `0 ${100 * s}px 0 0`,
                }}
            >
                <div
                    style={{
                        transform: `translateY(${presenterY + (frame >= 60 && frame < 240 ? presenterBob : 0)}px)`,
                    }}
                >
                    <Img
                        src={props.presenterImageUrl}
                        style={{
                            height: presenterHeight,
                            width: 'auto',
                            objectFit: 'contain',
                            filter: `drop-shadow(0 ${20 * s}px ${40 * s}px rgba(0,0,0,0.5))`,
                        }}
                    />
                </div>
            </AbsoluteFill>

            {/* Flash overlay */}
            {renderBackgroundLayers && (
                <AbsoluteFill
                    style={{
                        background: `linear-gradient(135deg, #ffffff, ${props.titleColor}88)`,
                        opacity: flashOpacity,
                        mixBlendMode: 'screen',
                    }}
                />
            )}
        </AbsoluteFill>
    );
};

// ─── Register ────────────────────────────────────────────────
registerTemplate({
    id: 'headline-card-01',
    name: 'Big Red Title Build',
    category: 'social-hooks',
    description: 'Define-the-topic card with background image, presenter, and kinetic all-caps title build.',
    tags: ['headline', 'title', 'presenter', 'kinetic', 'topic', 'intro'],
    component: HeadlineCard01,
    schema: headlineCardSchema,
    defaultProps: headlineCardSchema.parse({}),
    durationInFrames: 315, // 10.5s @ 30fps
    fps: 30,
});
