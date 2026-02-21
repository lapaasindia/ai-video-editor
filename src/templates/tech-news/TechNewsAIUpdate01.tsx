import React from 'react';
import {
    AbsoluteFill,
    useCurrentFrame,
    useVideoConfig,
    interpolate,
    spring,
} from 'remotion';
import { z } from 'zod';
import { useIsPortrait, useResponsive } from '../../lib/responsive';
import { fadeIn, slideIn, staggerDelay } from '../../lib/animations';
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
export const techNewsAIUpdateSchema = z.object({
    badge: z.string().default('AI / ML'),
    headline: z.string().default('GPT-5 Sets New Benchmarks Across Every Category'),
    subheadline: z.string().default('OpenAI\'s latest model achieves superhuman performance on reasoning, coding, and multimodal tasks'),
    feature1Icon: z.string().default('🧠'),
    feature1Title: z.string().default('Reasoning'),
    feature1Desc: z.string().default('92% on ARC-AGI, up from 71%'),
    feature2Icon: z.string().default('💻'),
    feature2Title: z.string().default('Coding'),
    feature2Desc: z.string().default('98th percentile on SWE-bench'),
    feature3Icon: z.string().default('👁'),
    feature3Title: z.string().default('Multimodal'),
    feature3Desc: z.string().default('Native video + audio understanding'),
    feature4Icon: z.string().default('⚡'),
    feature4Title: z.string().default('Speed'),
    feature4Desc: z.string().default('3x throughput vs GPT-4o'),
    source: z.string().default('The Verge'),
    timestamp: z.string().default('2 hours ago'),
    primaryColor: z.string().default(COLORS.accent),
    accentColor: z.string().default(COLORS.accentLight),
    backgroundColor: z.string().default(COLORS.bg),
});

type Props = z.infer<typeof techNewsAIUpdateSchema>;

// ─── Component ───────────────────────────────────────────────
export const TechNewsAIUpdate01: React.FC<Props> = (props) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    
    const isPortrait = useIsPortrait();
    const scale = useResponsive(1, 1);
    const backgroundControls = useResolvedBackgroundControls();
    const renderBackgroundLayers = shouldRenderBackgroundLayer(backgroundControls);

    const features = [
        { icon: props.feature1Icon, title: props.feature1Title, desc: props.feature1Desc },
        { icon: props.feature2Icon, title: props.feature2Title, desc: props.feature2Desc },
        { icon: props.feature3Icon, title: props.feature3Title, desc: props.feature3Desc },
        { icon: props.feature4Icon, title: props.feature4Title, desc: props.feature4Desc },
    ];

    return (
        <AbsoluteFill
            style={{
                background: resolveCanvasBackground(COLORS.bg, backgroundControls),
                overflow: 'hidden',
            }}
        >
            {/* Animated background */}
            <AnimatedGradient />
            {/* Neural network background */}
            {renderBackgroundLayers && (
                <svg
                    viewBox="0 0 1920 1080"
                    style={{
                        position: 'absolute',
                        top: 0, left: 0, right: 0, bottom: 0,
                        opacity: 0.04,
                    }}
                >
                    {Array.from({ length: 20 }).map((_, i) => {
                        const x1 = (i * 137) % 1920;
                        const y1 = (i * 89) % 1080;
                        const x2 = ((i + 5) * 173) % 1920;
                        const y2 = ((i + 3) * 131) % 1080;
                        return (
                            <line
                                key={i}
                                x1={x1} y1={y1} x2={x2} y2={y2}
                                stroke={props.primaryColor}
                                strokeWidth="1"
                                strokeDasharray={`${interpolate(frame, [i * 5, i * 5 + 60], [0, 200], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}`}
                            />
                        );
                    })}
                    {Array.from({ length: 12 }).map((_, i) => {
                        const cx = (i * 173) % 1920;
                        const cy = (i * 107) % 1080;
                        return (
                            <circle
                                key={i}
                                cx={cx} cy={cy} r={4}
                                fill={props.primaryColor}
                                opacity={fadeIn(frame, i * 5, 15)}
                            />
                        );
                    })}
                </svg>
            )}

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
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 24,
                        opacity: fadeIn(frame, 0),
                    }}
                >
                    <div
                        style={{
                            padding: `${5 * scale}px ${14 * scale}px`,
                            borderRadius: 12,
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
                </div>

                {/* Headline */}
                <EditableText
                    text={props.headline}
                    fontSize={isPortrait ? 84 : 104}
                    fontFamily={interFont}
                    color={COLORS.textPrimary}
                    fontWeight={800}
                    lineHeight={1.1}
                    letterSpacing={-1}
                    maxLines={3}
                    style={{
                        opacity: fadeIn(frame, 8),
                        transform: slideIn(frame, 'up', 8, 25),
                    }}
                />

                <EditableText
                    text={props.subheadline}
                    fontSize={isPortrait ? 44 : 52}
                    fontFamily={interFont}
                    color={COLORS.textSecondary}
                    fontWeight={400}
                    lineHeight={1.5}
                    maxLines={2}
                    style={{ opacity: fadeIn(frame, 18) }}
                />

                {/* Feature grid */}
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: isPortrait ? '1fr' : '1fr 1fr',
                        gap: isPortrait ? 20 : 32,
                        marginTop: isPortrait ? 0 : 'auto',
                        marginBottom: isPortrait ? 0 : 16,
                    }}
                >
                    {features.map((feat, i) => {
                        const delay = 30 + staggerDelay(i, 10);
                        const cardSpring = spring({
                            frame: frame - delay,
                            fps,
                            config: { damping: 12, stiffness: 120, mass: 0.5 },
                        });

                        return (
                            <div
                                key={i}
                                style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: 28,
                                    padding: `${18 * scale}px ${20 * scale}px`,
                                    borderRadius: 28,
                                    background: 'rgba(255,255,255,0.03)',
                                    border: '2px solid rgba(255,255,255,0.06)',
                                    opacity: fadeIn(frame, delay),
                                    transform: `scale(${cardSpring})`,
                                }}
                            >
                                <div
                                    style={{
                                        width: 40 * scale,
                                        height: 40 * scale,
                                        borderRadius: 20,
                                        background: `${props.primaryColor}12`,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: 44 * scale,
                                        flexShrink: 0,
                                    }}
                                >
                                    {feat.icon}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    <EditableText
                                        text={feat.title}
                                        fontSize={36 * scale}
                                        fontFamily={interFont}
                                        color={COLORS.textSecondary}
                                        fontWeight={700}
                                    />
                                    <EditableText
                                        text={feat.desc}
                                        fontSize={32 * scale}
                                        fontFamily={interFont}
                                        color={COLORS.textSecondary}
                                        fontWeight={400}
                                        lineHeight={1.3}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Source */}
                <div
                    style={{
                        display: 'flex',
                        gap: 24,
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
                    <div style={{ width: 4, height: 8, borderRadius: '50%', background: '#ffffff33' }} />
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
                    height: 6,
                    background: GRADIENTS.bgMain,
                }}
            />
        </AbsoluteFill>
    );
};

// ─── Register ────────────────────────────────────────────────
registerTemplate({
    id: 'tech-news-ai-update-01',
    name: 'AI / ML Update',
    category: 'tech-news',
    description: 'AI model update with feature grid, neural network background, and benchmark data',
    tags: ['AI', 'ML', 'update', 'tech-news', 'model', 'benchmarks'],
    component: TechNewsAIUpdate01,
    schema: techNewsAIUpdateSchema,
    defaultProps: techNewsAIUpdateSchema.parse({}),
    durationInFrames: DEFAULT_DURATION_FRAMES,
    fps: DEFAULT_FPS,
});
