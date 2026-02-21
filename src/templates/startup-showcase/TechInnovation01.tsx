import React from 'react';
import {
    AbsoluteFill,
    useCurrentFrame,
    useVideoConfig,
    interpolate,
    spring,
    random,
    Video,
} from 'remotion';
import { z } from 'zod';
import { useIsPortrait, useScaleFactor } from "../../lib/responsive";
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
export const techInnovationSchema = z.object({
    title: z.string().default('AI DRIVEN'),
    subtitle: z.string().default('Next Gen Technology'),
    videoUrl: z.string().default('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4'),
    primaryColor: z.string().default(COLORS.accent), // Neon Cyan
    secondaryColor: z.string().default(COLORS.accentDark), // Neon Pink
    showGrid: z.boolean().default(true),
    enableGlow: z.boolean().default(true),
});

type Props = z.infer<typeof techInnovationSchema>;

// ─── Component ───────────────────────────────────────────────
export const TechInnovation01: React.FC<Props> = (props) => {
    const scale = useScaleFactor();
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const isPortrait = useIsPortrait();
    const backgroundControls = useResolvedBackgroundControls();
    const renderBackgroundLayers = shouldRenderBackgroundLayer(backgroundControls);

    // Grid movement
    const gridMove = interpolate(frame, [0, 300], [0, 200]);

    // Floating particles
    const particles = React.useMemo(() => new Array(15).fill(0).map((_, i) => ({
        x: random(i) * 100,
        y: random(i + 20) * 100,
        size: random(i + 40) * 4 + 2,
        speed: random(i + 60) * 0.5 + 0.5,
    })), []);

    const glowStyle = props.enableGlow ? {
        textShadow: `
            0 0 10px ${props.primaryColor},
            0 0 20px ${props.primaryColor},
            0 0 40px ${props.secondaryColor}
        `,
    } : {};

    return (
        <AbsoluteFill
            style={{
                background: resolveCanvasBackground('#050510', backgroundControls),
                overflow: 'hidden',
                perspective: 1000,
            }}
        >
            {/* Animated background */}
            <AnimatedGradient />
            {/* Background Video (Darkened) */}
            {renderBackgroundLayers && (
            <AbsoluteFill style={{ zIndex: 0 }}>
                <Video
                    src={props.videoUrl}
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        filter: 'brightness(0.3) contrast(1.2) hue-rotate(180deg)',
                        opacity: 0.5,
                    }}
                />
            </AbsoluteFill>
            )}

            {/* Retro 3D Grid Floor */}
            {renderBackgroundLayers && props.showGrid && (
                <div style={{
                    position: 'absolute',
                    bottom: '-40%',
                    left: '-50%',
                    width: '200%',
                    height: '100%',
                    transform: 'rotateX(60deg)',
                    background: `
                        linear-gradient(transparent 0%, ${props.secondaryColor}20 100%),
                        repeating-linear-gradient(90deg, ${props.primaryColor}40 0px, ${props.primaryColor}40 1px, transparent 1px, transparent 100px),
                        repeating-linear-gradient(0deg, ${props.primaryColor}40 0px, ${props.primaryColor}40 1px, transparent 1px, transparent 100px)
                    `,
                    backgroundPosition: `0 ${gridMove}px`,
                    maskImage: 'linear-gradient(to top, black 0%, transparent 80%)',
                    WebkitMaskImage: 'linear-gradient(to top, black 0%, transparent 80%)',
                }} />
            )}

            {/* Floating Cyber Particles */}
            {particles.map((p, i) => (
                <div
                    key={i}
                    style={{
                        position: 'absolute',
                        left: `${p.x}%`,
                        top: `${(p.y - frame * p.speed) % 110}%`,
                        width: p.size,
                        height: p.size,
                        background: i % 2 === 0 ? props.primaryColor : props.secondaryColor,
                        opacity: interpolate(frame, [0, 30], [0, 0.6], { extrapolateRight: 'clamp' }),
                        boxShadow: `0 0 8px ${i % 2 === 0 ? props.primaryColor : props.secondaryColor}`,
                    }}
                />
            ))}

            {/* Main Content */}
            <AbsoluteFill style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                padding: isPortrait ? '140px 80px' : undefined,
                alignItems: 'center',
                zIndex: 10,
            }}>
                <div style={{
                    border: `2px solid ${props.primaryColor}`,
                    padding: '40px 80px',
                    borderRadius: 4 * scale,
                    background: '#00000080',
                    boxShadow: `0 0 20px ${props.primaryColor}40`,
                    transform: `scale(${spring({ frame, fps, config: { damping: 10 } })})`,
                }}>
                    <EditableText
                        text={props.title}
                        fontSize={isPortrait ? 112 : 176}
                        fontFamily={interFont}
                        color={COLORS.textPrimary}
                        fontWeight={700}
                        letterSpacing={4}
                        style={glowStyle}
                    />
                </div>

                <div style={{ marginTop: 40 * scale, opacity: fadeIn(frame, 20) }}>
                    <EditableText
                        text={props.subtitle}
                        fontSize={isPortrait ? 40 : 64}
                        fontFamily={interFont}
                        color={COLORS.accentDark}
                        fontWeight={500}
                        letterSpacing={8}
                        textTransform="uppercase"
                        style={{
                            textShadow: `0 0 10px ${props.secondaryColor}`,
                        }}
                    />
                </div>
            </AbsoluteFill>

            {/* Scanline Overlay */}
            {renderBackgroundLayers && (
            <AbsoluteFill style={{
                background: `repeating-linear-gradient(
                    0deg,
                    transparent,
                    transparent 4px,
                    #000000 5px
                )`,
                opacity: 0.15,
                pointerEvents: 'none',
            }} />
            )}
        </AbsoluteFill>
    );
};

// ─── Register ────────────────────────────────────────────────
registerTemplate({
    id: 'tech-innovation-01',
    name: 'Tech Innovation Hub',
    category: 'startup-showcase',
    description: 'Futuristic tech showcase with 3D grid floor, neon glow text, and digital particles.',
    tags: ['tech', 'innovation', 'ai', 'startup', 'future'],
    component: TechInnovation01,
    schema: techInnovationSchema,
    defaultProps: techInnovationSchema.parse({}),
    durationInFrames: DEFAULT_DURATION_FRAMES,
    fps: DEFAULT_FPS,
});
