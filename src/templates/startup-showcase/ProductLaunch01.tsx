import React from 'react';
import {
    AbsoluteFill,
    useCurrentFrame,
    useVideoConfig,
    spring,
    random,
    Video,
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
import { DEFAULT_FPS } from '../../lib/constants';
import { interFont } from '../../lib/fonts';
import { COLORS } from '../../lib/theme';

// ─── Schema ──────────────────────────────────────────────────
export const productLaunchSchema = z.object({
    word1: z.string().default('LAUNCH'),
    word2: z.string().default('YOUR'),
    word3: z.string().default('PRODUCT'),
    videoUrl: z.string().default('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4'),
    primaryColor: z.string().default(COLORS.accent), // Cyan
    secondaryColor: z.string().default(COLORS.accentDark), // Magenta
    showGlitch: z.boolean().default(true),
    enableFlash: z.boolean().default(true),
});

type Props = z.infer<typeof productLaunchSchema>;

// ─── Component ───────────────────────────────────────────────
export const ProductLaunch01: React.FC<Props> = (props) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const isPortrait = useIsPortrait();
    const backgroundControls = useResolvedBackgroundControls();
    const renderBackgroundLayers = shouldRenderBackgroundLayer(backgroundControls);

    // Random glitch displacement
    const glitchX = props.showGlitch ? (random(frame) - 0.5) * 40 : 0;
    const glitchY = props.showGlitch ? (random(frame + 100) - 0.5) * 10 : 0;
    const glitchOpposite = props.showGlitch ? (random(frame + 200) - 0.5) * -40 : 0;

    // Word Timings
    const word1Start = 0;
    const word2Start = 15;
    const word3Start = 30;

    // Stomp effect for words
    const stomp = (delay: number) => spring({
        frame: frame - delay,
        fps,
        config: { damping: 12, stiffness: 200, mass: 0.5 },
    });

    const flash = props.enableFlash && frame % 45 < 5 ? 1 : 0;

    return (
        <AbsoluteFill
            style={{
                background: resolveCanvasBackground(COLORS.bg, backgroundControls),
                overflow: 'hidden',
            }}
        >
            {/* Animated background */}
            <AnimatedGradient />
            {/* Background Video with Glitch */}
            {renderBackgroundLayers && (
            <AbsoluteFill style={{
                transform: `translate(${glitchX * 0.2}px, ${glitchY * 0.2}px) scale(1.1)`,
            }}>
                <Video
                    src={props.videoUrl}
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        filter: 'grayscale(100%) contrast(1.2)',
                        opacity: 0.6,
                    }}
                />
            </AbsoluteFill>
            )}

            {/* RGB Split Layers (Cyan/Magenta) */}
            {renderBackgroundLayers && props.showGlitch && (
                <>
                    <AbsoluteFill style={{
                        mixBlendMode: 'screen',
                        transform: `translate(${glitchX}px, 0)`,
                        opacity: 0.7,
                    }}>
                        <div style={{
                            width: '100%', height: '100%', background: COLORS.accent,
                            clipPath: `inset(${random(frame) * 100}% 0 ${random(frame + 50) * 100}% 0)`
                        }} />
                    </AbsoluteFill>
                    <AbsoluteFill style={{
                        mixBlendMode: 'screen',
                        transform: `translate(${glitchOpposite}px, 0)`,
                        opacity: 0.7,
                    }}>
                        <div style={{
                            width: '100%', height: '100%', background: props.secondaryColor,
                            clipPath: `inset(${random(frame + 20) * 100}% 0 ${random(frame + 70) * 100}% 0)`
                        }} />
                    </AbsoluteFill>
                </>
            )}

            {/* Text Overlay */}
            <AbsoluteFill style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 10,
                gap: 0,
                padding: isPortrait ? '140px 80px' : undefined,
            }}>
                {/* Word 1 */}
                <div style={{ transform: `scale(${stomp(word1Start)})`, opacity: frame >= word1Start ? 1 : 0 }}>
                    <EditableText
                        text={props.word1}
                        fontSize={isPortrait ? 124 : 168}
                        fontFamily={interFont}
                        color={COLORS.textPrimary}
                        fontWeight={900}
                        fontStyle="italic"
                        letterSpacing={-5}
                        lineHeight={0.9}
                        style={{
                            textShadow: `${glitchX}px 0 ${props.primaryColor}, ${glitchOpposite}px 0 ${props.secondaryColor}`,
                            transform: `skewX(-10deg)`,
                        }}
                    />
                </div>

                {/* Word 2 */}
                <div style={{ transform: `scale(${stomp(word2Start)})`, opacity: frame >= word2Start ? 1 : 0 }}>
                    <EditableText
                        text={props.word2}
                        fontSize={isPortrait ? 76 : 88}
                        fontFamily={interFont}
                        color={COLORS.accent}
                        fontWeight={700}
                        letterSpacing={10}
                        lineHeight={1}
                        style={{
                            background: renderBackgroundLayers ? COLORS.bg : 'transparent',
                            padding: '0 20px',
                            transform: `skewX(-10deg)`,
                        }}
                    />
                </div>

                {/* Word 3 */}
                <div style={{ transform: `scale(${stomp(word3Start)})`, opacity: frame >= word3Start ? 1 : 0 }}>
                    <EditableText
                        text={props.word3}
                        fontSize={isPortrait ? 152 : 180}
                        fontFamily={interFont}
                        color={COLORS.textPrimary}
                        fontWeight={900}
                        fontStyle="italic"
                        letterSpacing={-8}
                        lineHeight={0.8}
                        style={{
                            textShadow: `${glitchOpposite}px 0 ${props.secondaryColor}, ${glitchX}px 0 ${props.primaryColor}`,
                            transform: `skewX(-10deg)`,
                            WebkitTextStroke: '2px white',
                            color: 'transparent',
                        }}
                    />
                </div>
            </AbsoluteFill>

            {/* Flash Overlay */}
            {renderBackgroundLayers && props.enableFlash && (
                <AbsoluteFill style={{
                    background: '#fff',
                    opacity: flash * 0.15,
                    mixBlendMode: 'overlay',
                }} />
            )}

            {/* Scanlines */}
            {renderBackgroundLayers && (
            <AbsoluteFill style={{
                background: `repeating-linear-gradient(
                    0deg,
                    transparent,
                    transparent 2px,
                    #000000 3px,
                    #000000 4px
                )`,
                opacity: 0.2,
                pointerEvents: 'none',
            }} />
            )}

            {/* Vignette */}
            {renderBackgroundLayers && (
            <AbsoluteFill style={{
                background: 'radial-gradient(circle, transparent 50%, black 100%)',
                opacity: 0.6,
            }} />
            )}

        </AbsoluteFill>
    );
};

// ─── Register ────────────────────────────────────────────────
registerTemplate({
    id: 'product-launch-01',
    name: 'Product Launch Energy',
    category: 'startup-showcase',
    description: 'High-energy rhythmic opener for product launches with aggressive glitch effects and stomp typography.',
    tags: ['product', 'launch', 'startup', 'energy', 'bold'],
    component: ProductLaunch01,
    schema: productLaunchSchema,
    defaultProps: productLaunchSchema.parse({}),
    durationInFrames: 90, // Short & punchy
    fps: DEFAULT_FPS,
});
