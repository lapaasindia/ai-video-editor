import React from 'react';
import {
    AbsoluteFill,
    useCurrentFrame,
    useVideoConfig,
    interpolate,
    Video,
} from 'remotion';
import { z } from 'zod';
import { useIsPortrait } from '../../lib/responsive';
import { fadeIn } from '../../lib/animations';
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
import { COLORS } from '../../lib/theme';

// ─── Schema ──────────────────────────────────────────────────
export const lifestyleBrandSchema = z.object({
    title: z.string().default('PREMIUM'),
    subtitle: z.string().default('Quality Redefined'),
    videoUrl1: z.string().default('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4'),
    videoUrl2: z.string().default('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4'),
    primaryColor: z.string().default(COLORS.accent),
    accentColor: z.string().default(COLORS.accentLight), // Gold
    showGrain: z.boolean().default(true),
    enableSplits: z.boolean().default(true),
});

type Props = z.infer<typeof lifestyleBrandSchema>;

// ─── Component ───────────────────────────────────────────────
export const LifestyleBrand01: React.FC<Props> = (props) => {
    const frame = useCurrentFrame();
    const { width, height } = useVideoConfig();
    const isPortrait = useIsPortrait();
    const backgroundControls = useResolvedBackgroundControls();
    const renderBackgroundLayers = shouldRenderBackgroundLayer(backgroundControls);

    // Split Screen Animation
    const splitProgress = interpolate(frame, [0, 60], [0, 100], { extrapolateRight: 'clamp' });
    const splitX = isPortrait ? 0 : interpolate(splitProgress, [0, 100], [width, width / 2]);
    const splitY = isPortrait ? interpolate(splitProgress, [0, 100], [height, height / 2]) : 0;

    return (
        <AbsoluteFill
            style={{
                background: resolveCanvasBackground(COLORS.bg, backgroundControls),
                overflow: 'hidden',
            }}
        >
            {/* Animated background */}
            <AnimatedGradient />
            {/* Background Layer (Video 1) */}
            {renderBackgroundLayers && (
            <AbsoluteFill>
                <Video
                    src={props.videoUrl1}
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        opacity: 0.6,
                        filter: 'grayscale(100%) contrast(1.1)',
                        transform: `scale(${interpolate(frame, [0, 300], [1, 1.1])})`,
                    }}
                />
            </AbsoluteFill>
            )}

            {/* Foreground Split Layer (Video 2) */}
            {renderBackgroundLayers && props.enableSplits && (
                <AbsoluteFill style={{
                    clipPath: isPortrait
                        ? `polygon(0 ${splitY}px, 100% ${splitY}px, 100% 100%, 0 100%)`
                        : `polygon(${splitX}px 0, 100% 0, 100% 100%, ${splitX}px 100%)`,
                }}>
                    <Video
                        src={props.videoUrl2}
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            filter: 'grayscale(50%) contrast(1.1) sepia(0.2)',
                            transform: `scale(${interpolate(frame, [0, 300], [1.2, 1])})`,
                        }}
                    />
                    {/* Border Line */}
                    <div style={{
                        position: 'absolute',
                        top: isPortrait ? splitY : 0,
                        left: isPortrait ? 0 : splitX,
                        width: isPortrait ? '100%' : 2,
                        height: isPortrait ? 2 : '100%',
                        background: COLORS.accentLight,
                    }} />
                </AbsoluteFill>
            )}

            {/* Film Grain */}
            {renderBackgroundLayers && props.showGrain && (
                <AbsoluteFill style={{
                    background: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='1'/%3E%3C/svg%3E")`,
                    opacity: 0.15,
                    mixBlendMode: 'overlay',
                    pointerEvents: 'none',
                    filter: 'contrast(1.5)',
                }} />
            )}

            {/* Text Overlay */}
            <AbsoluteFill style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                padding: isPortrait ? '140px 80px' : undefined,
                alignItems: 'center',
                zIndex: 10,
            }}>
                <div style={{
                    borderTop: `1px solid ${props.accentColor}`,
                    borderBottom: `1px solid ${props.accentColor}`,
                    padding: '20px 0',
                    textAlign: 'center',
                    transform: `scale(${interpolate(frame, [0, 100], [0.95, 1], { extrapolateRight: 'clamp' })})`,
                    opacity: fadeIn(frame, 30),
                }}>
                    <EditableText
                        text={props.title}
                        fontSize={isPortrait ? 100 : 180}
                        fontFamily={interFont}
                        color={COLORS.accent}
                        fontWeight={500}
                        letterSpacing={isPortrait ? 4 : 12}
                    />
                </div>

                <div style={{ marginTop: 32, opacity: fadeIn(frame, 50) }}>
                    <EditableText
                        text={props.subtitle}
                        fontSize={isPortrait ? 36 : 48}
                        fontFamily={interFont}
                        color={COLORS.textSecondary}
                        fontWeight={300}
                        letterSpacing={6}
                        textTransform="uppercase"
                    />
                </div>
            </AbsoluteFill>
        </AbsoluteFill>
    );
};

// ─── Register ────────────────────────────────────────────────
registerTemplate({
    id: 'lifestyle-brand-01',
    name: 'Lifestyle Brand Promo',
    category: 'startup-showcase',
    description: 'Luxurious lifestyle brand style with split screen transitions and elegant typography.',
    tags: ['lifestyle', 'brand', 'premium', 'startup', 'product'],
    component: LifestyleBrand01,
    schema: lifestyleBrandSchema,
    defaultProps: lifestyleBrandSchema.parse({}),
    durationInFrames: DEFAULT_DURATION_FRAMES,
    fps: DEFAULT_FPS,
});
