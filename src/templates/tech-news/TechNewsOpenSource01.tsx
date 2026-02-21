import React from 'react';
import {
    AbsoluteFill,
    useCurrentFrame,
    useVideoConfig,
    interpolate,
    spring,
} from 'remotion';
import { z } from 'zod';
import { useIsPortrait, useScaleFactor } from "../../lib/responsive";
import { fadeIn, slideIn } from '../../lib/animations';
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
import { COLORS, GRADIENTS } from '../../lib/theme';

// ─── Schema ──────────────────────────────────────────────────
export const techNewsOpenSourceSchema = z.object({
    badge: z.string().default('OPEN SOURCE'),
    projectName: z.string().default('LlamaCode'),
    headline: z.string().default('Meta Releases LlamaCode — Open-Source AI Coding Assistant'),
    subheadline: z.string().default('Outperforms GPT-4 on coding benchmarks with fully open weights and fine-tuning support'),
    stars: z.string().default('42.3k ★'),
    license: z.string().default('Apache 2.0'),
    languages: z.string().default('50+ languages'),
    modelSize: z.string().default('70B params'),
    source: z.string().default('GitHub Blog'),
    timestamp: z.string().default('Just released'),
    primaryColor: z.string().default(COLORS.accent),
    accentColor: z.string().default(COLORS.accentLight),
    backgroundColor: z.string().default(COLORS.bg),
});

type Props = z.infer<typeof techNewsOpenSourceSchema>;

// ─── Component ───────────────────────────────────────────────
export const TechNewsOpenSource01: React.FC<Props> = (props) => {
    const scale = useScaleFactor();
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    
    const isPortrait = useIsPortrait();
    const backgroundControls = useResolvedBackgroundControls();
    const renderBackgroundLayers = shouldRenderBackgroundLayer(backgroundControls);

    const codeRain = Array.from({ length: 20 }).map((_, i) => ({
        x: (i * 97) % 100,
        speed: 0.3 + (i % 5) * 0.15,
        char: ['0', '1', '{', '}', '/', '*', '<', '>', '=', ';'][i % 10],
        delay: i * 3,
    }));

    const stats = [
        { label: 'Stars', value: props.stars },
        { label: 'License', value: props.license },
        { label: 'Support', value: props.languages },
        { label: 'Size', value: props.modelSize },
    ];

    return (
        <AbsoluteFill
            style={{
                background: resolveCanvasBackground(props.backgroundColor, backgroundControls),
                overflow: 'hidden',
            }}
        >
            {/* Animated background */}
            <AnimatedGradient />
            {/* Code rain background */}
            {renderBackgroundLayers &&
                codeRain.map((drop, i) => (
                    <div
                        key={i}
                        style={{
                            position: 'absolute',
                            left: `${drop.x}%`,
                            top: `${((frame * drop.speed + drop.delay * 20) % 120) - 10}%`,
                            fontSize: 28 * scale,
                            fontFamily: 'monospace',
                            color: props.primaryColor,
                            opacity: 0.06,
                        }}
                    >
                        {drop.char}
                    </div>
                ))}

            <div
                style={{
                    position: 'relative',
                    zIndex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    width: '100%',
                    height: '100%',
                    justifyContent: 'center',
                    padding: isPortrait ? '140px 80px' : '60px 100px',
                    gap: isPortrait ? 32 : 48,
                }}
            >
                {/* Badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 24 * scale, opacity: fadeIn(frame, 0) }}>
                    <div
                        style={{
                            padding: `${5 * scale}px ${14 * scale}px`,
                            borderRadius: 12 * scale,
                            background: `${props.primaryColor}20`,
                            border: `2px solid ${props.primaryColor}40`,
                        }}
                    >
                        <EditableText
                            text={props.badge}
                            fontSize={32 * scale}
                            fontFamily={interFont}
                            color={COLORS.accent}
                            fontWeight={800}
                            letterSpacing={2}
                        />
                    </div>
                    <EditableText
                        text={props.projectName}
                        fontSize={40 * scale}
                        fontFamily={interFont}
                        color={COLORS.textSecondary}
                        fontWeight={600}
                    />
                </div>

                {/* Headline */}
                <EditableText
                    text={props.headline}
                    fontSize={isPortrait ? 84 : 112}
                    fontFamily={interFont}
                    color={COLORS.textPrimary}
                    fontWeight={800}
                    lineHeight={1.1}
                    letterSpacing={-1}
                    maxLines={3}
                    style={{ opacity: fadeIn(frame, 8), transform: slideIn(frame, 'up', 8, 25) }}
                />

                <EditableText
                    text={props.subheadline}
                    fontSize={isPortrait ? 44 : 52}
                    fontFamily={interFont}
                    color={COLORS.textSecondary}
                    fontWeight={400}
                    lineHeight={1.5}
                    maxLines={2}
                    style={{ opacity: fadeIn(frame, 20) }}
                />

                {/* Terminal-style stat cards */}
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: isPortrait ? '1fr 1fr' : 'repeat(4, 1fr)',
                        gap: isPortrait ? 20 : 32,
                        marginTop: isPortrait ? 0 : 'auto',
                        marginBottom: isPortrait ? 0 : 16,
                    }}
                >
                    {stats.map((stat, i) => {
                        const cardSpring = spring({
                            frame: frame - 35 - i * 8,
                            fps,
                            config: { damping: 12, stiffness: 130, mass: 0.5 },
                        });

                        return (
                            <div
                                key={i}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    padding: `${16 * scale}px`,
                                    borderRadius: 20 * scale,
                                    background: 'rgba(255,255,255,0.03)',
                                    border: `2px solid ${props.primaryColor}15`,
                                    gap: 12 * scale,
                                    transform: `scale(${cardSpring})`,
                                    opacity: fadeIn(frame, 35 + i * 8),
                                }}
                            >
                                <EditableText
                                    text={`// ${stat.label}`}
                                    fontSize={28 * scale}
                                    fontFamily={interFont}
                                    color={COLORS.textSecondary}
                                    fontWeight={500}
                                />
                                <EditableText
                                    text={stat.value}
                                    fontSize={48 * scale}
                                    fontFamily={interFont}
                                    color={COLORS.accent}
                                    fontWeight={700}
                                />
                            </div>
                        );
                    })}
                </div>

                {/* Source */}
                <div
                    style={{
                        display: 'flex',
                        gap: 24 * scale,
                        alignItems: 'center',
                        flexWrap: isPortrait ? 'wrap' : 'nowrap',
                        opacity: fadeIn(frame, 75),
                    }}
                >
                    <EditableText
                        text={props.source}
                        fontSize={32 * scale}
                        fontFamily={interFont}
                        color={COLORS.accent}
                        fontWeight={600}
                    />
                    <div style={{ width: 4 * scale, height: 8 * scale, borderRadius: '50%', background: '#ffffff33' }} />
                    <EditableText
                        text={props.timestamp}
                        fontSize={32 * scale}
                        fontFamily={interFont}
                        color={COLORS.textSecondary}
                        fontWeight={400}
                    />
                </div>
            </div>

            {/* Bottom accent */}
            <div
                style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    width: `${interpolate(frame, [0, 60], [0, 100], { extrapolateRight: 'clamp' })}%`,
                    height: 6 * scale,
                    background: GRADIENTS.bgMain,
                }}
            />
        </AbsoluteFill>
    );
};

// ─── Register ────────────────────────────────────────────────
registerTemplate({
    id: 'tech-news-open-source-01',
    name: 'Open Source Release',
    category: 'tech-news',
    description: 'Open source project release with code rain background, terminal-style stat cards',
    tags: ['open-source', 'github', 'release', 'tech-news', 'code'],
    component: TechNewsOpenSource01,
    schema: techNewsOpenSourceSchema,
    defaultProps: techNewsOpenSourceSchema.parse({}),
    durationInFrames: DEFAULT_DURATION_FRAMES,
    fps: DEFAULT_FPS,
});
