import React from 'react';
import {
    AbsoluteFill,
    useCurrentFrame,
    useVideoConfig,
    Img,
    interpolate,
    spring,
    Easing,
    random,
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
export const moneyRainSchema = z.object({
    backgroundImageUrl: z.string().default('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1920'),
    bigNumber: z.string().default('$47M'),
    perYearText: z.string().default('per year'),
    primaryColor: z.string().default(COLORS.accent),
    burstColor: z.string().default('#FFD700'),
    backgroundColor: z.string().default(COLORS.bg),
    showVignette: z.boolean().default(true),
    moneyCount: z.number().default(30),
});

type Props = z.infer<typeof moneyRainSchema>;

// ─── Component ───────────────────────────────────────────────
export const MoneyRain01: React.FC<Props> = (props) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    
    const isPortrait = useIsPortrait();
    const s = useScaleFactor();
    const backgroundControls = useResolvedBackgroundControls();
    const renderBackgroundLayers = shouldRenderBackgroundLayer(backgroundControls);

    // ─── Background establish (f0-f45) ───
    const bgZoom = interpolate(frame, [0, 45], [1.0, 1.03], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    // ─── Burst cloud (f45-f62) ───
    const burstOpacity = interpolate(frame, [45, 52, 62], [0, 0.8, 0.3], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const burstScale = interpolate(frame, [45, 62], [0.6, 1.1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.quad),
    });

    // ─── Big number slam (f54-f72) ───
    const numberSpring = spring({
        frame: frame - 54,
        fps,
        config: { damping: 12, stiffness: 180, mass: 0.8 },
    });
    const numberScale = interpolate(numberSpring, [0, 1], [1.4, 1]);
    const numberY = interpolate(numberSpring, [0, 1], [50 * s, 0]);

    // ─── Per year text (f80-f92) ───
    const perYearOpacity = fadeIn(frame - 80, 12);

    // ─── Money rain particles (f62-f360) ───
    const moneyParticles = Array.from({ length: props.moneyCount }, (_, i) => ({
        x: random(`mx${i}`) * 100,
        delay: random(`md${i}`) * 60,
        speed: 0.8 + random(`ms${i}`) * 0.6,
        rotation: random(`mr${i}`) * 360,
        rotSpeed: (random(`mrs${i}`) - 0.5) * 4,
        size: 0.6 + random(`msz${i}`) * 0.5,
    }));

    // ─── Outro zoom + vignette (f300-f360) ───
    const outroZoom = interpolate(frame, [300, 360], [1.0, 1.08], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const outroVignette = interpolate(frame, [300, 360], [0.7, 0.9], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const bigNumberSize = (isPortrait ? 150 : 176) * s;
    const perYearSize = (isPortrait ? 44 : 52) * s;
    const headlinePadding = isPortrait ? `${156 * s}px ${54 * s}px` : `0 ${112 * s}px`;

    return (
        <AbsoluteFill
            style={{
                background: resolveCanvasBackground(props.backgroundColor, backgroundControls),
                overflow: 'hidden',
            }}
        >
            <AnimatedGradient />

            {/* Background with zoom */}
            {renderBackgroundLayers && (
                <AbsoluteFill
                    style={{
                        transform: `scale(${bgZoom * outroZoom})`,
                    }}
                >
                    <Img
                        src={props.backgroundImageUrl}
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            filter: 'brightness(0.4) contrast(1.1)',
                        }}
                    />
                </AbsoluteFill>
            )}

            {/* Burst cloud */}
            {renderBackgroundLayers && frame >= 45 && (
                <AbsoluteFill
                    style={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                    }}
                >
                    <div
                        style={{
                            width: (isPortrait ? 600 : 800) * s,
                            height: (isPortrait ? 600 : 800) * s,
                            borderRadius: '50%',
                            background: `radial-gradient(circle, ${props.burstColor}88, ${props.primaryColor}44, transparent)`,
                            transform: `scale(${burstScale})`,
                            opacity: burstOpacity,
                            filter: `blur(${40 * s}px)`,
                        }}
                    />
                </AbsoluteFill>
            )}

            {/* Money rain particles */}
            {frame >= 62 && renderBackgroundLayers && moneyParticles.map((p, i) => {
                const particleFrame = frame - 62 - p.delay;
                if (particleFrame < 0) return null;
                
                const y = (particleFrame * p.speed * 8 * s) % ((isPortrait ? 2000 : 1200) * s);
                const rotation = p.rotation + particleFrame * p.rotSpeed;
                const opacity = interpolate(y, [0, 100, 1000, 1100], [0, 1, 1, 0]);

                return (
                    <div
                        key={i}
                        style={{
                            position: 'absolute',
                            left: `${p.x}%`,
                            top: y - 100 * s,
                            transform: `rotate(${rotation}deg) scale(${p.size})`,
                            opacity: opacity * 0.8,
                            fontSize: (isPortrait ? 48 : 56) * s,
                        }}
                    >
                        💵
                    </div>
                );
            })}

            {/* Big number */}
            {frame >= 54 && (
                <AbsoluteFill
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: isPortrait ? 'flex-start' : 'center',
                        alignItems: isPortrait ? 'center' : 'flex-start',
                        padding: headlinePadding,
                    }}
                >
                    <div
                        style={{
                            transform: `scale(${numberScale}) translateY(${numberY}px)`,
                        }}
                    >
                        <EditableText
                            text={props.bigNumber}
                            fontSize={bigNumberSize}
                            fontFamily={interFont}
                            color={props.primaryColor}
                            fontWeight={900}
                            style={{
                                textShadow: `0 0 ${80 * s}px ${props.primaryColor}88, 0 ${8 * s}px ${32 * s}px rgba(0,0,0,0.5)`,
                            }}
                        />
                    </div>
                    
                    {/* Per year text */}
                    <div
                        style={{
                            opacity: perYearOpacity,
                            marginTop: (isPortrait ? 20 : 16) * s,
                            textAlign: isPortrait ? 'center' : 'left',
                        }}
                    >
                        <EditableText
                            text={props.perYearText}
                            fontSize={perYearSize}
                            fontFamily={interFont}
                            color={COLORS.textSecondary}
                            fontWeight={600}
                        />
                    </div>
                </AbsoluteFill>
            )}

            {/* Vignette */}
            {renderBackgroundLayers && props.showVignette && (
                <AbsoluteFill
                    style={{
                        background: `radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,${outroVignette}) 100%)`,
                    }}
                />
            )}
        </AbsoluteFill>
    );
};

// ─── Register ────────────────────────────────────────────────
registerTemplate({
    id: 'money-rain-01',
    name: 'Money Rain Number Impact',
    category: 'social-hooks',
    description: 'Big green revenue number with burst cloud and continuous money rain particles.',
    tags: ['money', 'revenue', 'impact', 'number', 'rain', 'profit'],
    component: MoneyRain01,
    schema: moneyRainSchema,
    defaultProps: moneyRainSchema.parse({}),
    durationInFrames: 360, // 12s @ 30fps
    fps: 30,
});
