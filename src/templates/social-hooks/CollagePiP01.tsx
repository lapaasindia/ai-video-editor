import React from 'react';
import {
    AbsoluteFill,
    useCurrentFrame,
    useVideoConfig,
    Img,
    interpolate,
    spring,
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
export const collagePiPSchema = z.object({
    backgroundImageUrl: z.string().default('https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1920'),
    card1Url: z.string().default('https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600'),
    card2Url: z.string().default('https://images.unsplash.com/photo-1553877522-43269d4ea984?w=600'),
    card3Url: z.string().default('https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600'),
    card4Url: z.string().default('https://images.unsplash.com/photo-1557804506-669a67965ba0?w=600'),
    card5Url: z.string().default('https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=600'),
    pipImageUrl: z.string().default('https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400'),
    subtitle1: z.string().default('Multiple factors'),
    subtitle2: z.string().default('lead to success'),
    primaryColor: z.string().default(COLORS.accent),
    accentColor: z.string().default(COLORS.accent),
    backgroundColor: z.string().default(COLORS.bg),
});

type Props = z.infer<typeof collagePiPSchema>;

// ─── Component ───────────────────────────────────────────────
export const CollagePiP01: React.FC<Props> = (props) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    
    const isPortrait = useIsPortrait();
    const s = useScaleFactor();
    const backgroundControls = useResolvedBackgroundControls();
    const renderBackgroundLayers = shouldRenderBackgroundLayer(backgroundControls);

    const cardUrls = [props.card1Url, props.card2Url, props.card3Url, props.card4Url, props.card5Url];
    const cardRotations = [-12, 8, -6, 10, -8];
    const cardOffsets = isPortrait 
        ? [{ x: -120 * s, y: -200 * s }, { x: 100 * s, y: -150 * s }, { x: -80 * s, y: 50 * s }, { x: 120 * s, y: 100 * s }, { x: 0 * s, y: 250 * s }]
        : [{ x: -300 * s, y: -100 * s }, { x: -150 * s, y: 50 * s }, { x: 0, y: -80 * s }, { x: 150 * s, y: 60 * s }, { x: 300 * s, y: -40 * s }];

    // ─── Background settle (f0-f20) ───
    const bgScale = interpolate(frame, [0, 20], [1.2, 1.0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    // ─── Card animations (f12-f70) ───
    const getCardSpring = (index: number) => spring({
        frame: frame - (12 + index * 12),
        fps,
        config: { damping: 14, stiffness: 100, mass: 0.8 },
    });

    // ─── PiP popup (f60-f105) ───
    const pipSpring = spring({
        frame: frame - 60,
        fps,
        config: { damping: 12, stiffness: 120, mass: 1 },
    });
    const pipY = interpolate(pipSpring, [0, 1], [200 * s, 0]);
    const pipScale = interpolate(pipSpring, [0, 1], [0.6, 1]);

    // Ring stroke reveal (f60-f105)
    const ringProgress = interpolate(frame, [60, 105], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    // ─── Card micro float (f105-f360) ───
    const getFloat = (index: number) => Math.sin((frame - 105 + index * 20) * 0.05) * (4 * s);

    // ─── PiP breathing (f105-f360) ───
    const pipBreath = 1 + Math.sin((frame - 105) * 0.03) * 0.02;

    // ─── Subtitle (f360-f420) ───
    const subtitleOpacity = fadeIn(frame - 360, 30);
    const subtitleY = interpolate(frame, [360, 390], [30 * s, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    // ─── Exit flash (f420-f450) ───
    const flashOpacity = interpolate(frame, [420, 430, 440, 450], [0, 0.8, 0.3, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    const pipSize = (isPortrait ? 160 : 200) * s;
    const cardSize = isPortrait ? { w: 180 * s, h: 240 * s } : { w: 220 * s, h: 300 * s };
    const subtitlePrimarySize = (isPortrait ? 58 : 68) * s;
    const subtitleSecondarySize = (isPortrait ? 30 : 34) * s;

    return (
        <AbsoluteFill
            style={{
                background: resolveCanvasBackground(props.backgroundColor, backgroundControls),
                overflow: 'hidden',
            }}
        >
            <AnimatedGradient />

            {/* Background subject */}
            {renderBackgroundLayers && (
                <AbsoluteFill style={{ transform: `scale(${bgScale})` }}>
                    <Img
                        src={props.backgroundImageUrl}
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            filter: 'brightness(0.4) blur(2px)',
                        }}
                    />
                </AbsoluteFill>
            )}

            {/* Collage cards */}
            <AbsoluteFill
                style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                }}
            >
                {cardUrls.map((url, i) => {
                    const cardSpring = getCardSpring(i);
                    const float = frame >= 105 && frame < 360 ? getFloat(i) : 0;
                    return (
                        <div
                            key={i}
                            style={{
                                position: 'absolute',
                                transform: `
                                    translate(${cardOffsets[i].x}px, ${cardOffsets[i].y + float}px)
                                    rotate(${interpolate(cardSpring, [0, 1], [cardRotations[i] * 2, cardRotations[i]])}deg)
                                    scale(${interpolate(cardSpring, [0, 1], [0.6, 1])})
                                `,
                                opacity: cardSpring,
                            }}
                        >
                            <Img
                                src={url}
                                style={{
                                    width: cardSize.w,
                                    height: cardSize.h,
                                    objectFit: 'cover',
                                    borderRadius: 16 * s,
                                    boxShadow: `0 ${12 * s}px ${40 * s}px rgba(0,0,0,0.5)`,
                                    border: `${3 * s}px solid ${COLORS.surface}`,
                                }}
                            />
                        </div>
                    );
                })}
            </AbsoluteFill>

            {/* Circular PiP with ring */}
            <AbsoluteFill
                style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: isPortrait ? 'flex-end' : 'flex-end',
                    padding: isPortrait ? '0 0 300px' : '0 0 120px',
                }}
            >
                <div
                    style={{
                        position: 'relative',
                        transform: `translateY(${pipY}px) scale(${pipScale * (frame >= 105 ? pipBreath : 1)})`,
                    }}
                >
                    {/* Ring stroke */}
                    <svg
                        width={(pipSize + 20 * s)}
                        height={(pipSize + 20 * s)}
                        style={{
                            position: 'absolute',
                            top: -10 * s,
                            left: -10 * s,
                        }}
                    >
                        <circle
                            cx={(pipSize + 20 * s) / 2}
                            cy={(pipSize + 20 * s) / 2}
                            r={pipSize / 2 + 5 * s}
                            fill="none"
                            stroke={props.primaryColor}
                            strokeWidth={4 * s}
                            strokeDasharray={Math.PI * (pipSize + 10 * s)}
                            strokeDashoffset={Math.PI * (pipSize + 10 * s) * (1 - ringProgress)}
                            strokeLinecap="round"
                        />
                    </svg>
                    <Img
                        src={props.pipImageUrl}
                        style={{
                            width: pipSize,
                            height: pipSize,
                            objectFit: 'cover',
                            borderRadius: '50%',
                            boxShadow: `0 ${8 * s}px ${32 * s}px ${props.primaryColor}44`,
                        }}
                    />
                </div>
            </AbsoluteFill>

            {/* Subtitle (f360-f420) */}
            {frame >= 360 && (
                <AbsoluteFill
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'flex-end',
                        alignItems: 'center',
                        padding: isPortrait ? '0 60px 120px' : '0 100px 60px',
                        opacity: subtitleOpacity,
                        transform: `translateY(${subtitleY}px)`,
                    }}
                >
                    <EditableText
                        text={props.subtitle1}
                        fontSize={subtitlePrimarySize}
                        fontFamily={interFont}
                        color={COLORS.textPrimary}
                        fontWeight={700}
                    />
                    <EditableText
                        text={props.subtitle2}
                        fontSize={subtitleSecondarySize}
                        fontFamily={interFont}
                        color={props.primaryColor}
                        fontWeight={700}
                    />
                </AbsoluteFill>
            )}

            {/* Flash exit */}
            {renderBackgroundLayers && (
                <AbsoluteFill
                    style={{
                        background: `linear-gradient(135deg, ${props.primaryColor}, #ffffff)`,
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
    id: 'collage-pip-01',
    name: 'Collage + Circular PiP',
    category: 'social-hooks',
    description: 'Background subject with fanned mini-cards and circular presenter PiP for multi-factor explanations.',
    tags: ['collage', 'pip', 'cards', 'presenter', 'factors', 'explainer'],
    component: CollagePiP01,
    schema: collagePiPSchema,
    defaultProps: collagePiPSchema.parse({}),
    durationInFrames: 450, // 15s @ 30fps
    fps: 30,
});
