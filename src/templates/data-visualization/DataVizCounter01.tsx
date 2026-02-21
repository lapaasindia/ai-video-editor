import React from 'react';
import {
    AbsoluteFill,
    useCurrentFrame,
    useVideoConfig,
    interpolate,
    spring,
} from 'remotion';
import { z } from 'zod';
import { useIsPortrait, useResponsive, useScaleFactor } from "../../lib/responsive";
import { fadeIn, staggerDelay } from '../../lib/animations';
import { EditableText } from '../../components/EditableText';
import { AnimatedGradient } from '../../components/AnimatedGradient';
import {
    resolveCanvasBackground,
    shouldRenderBackgroundLayer,
    useResolvedBackgroundControls,
} from '../../lib/background';
import { registerTemplate } from '../registry';
import { DEFAULT_DURATION_FRAMES, DEFAULT_FPS } from '../../lib/constants';
import { linearGradient } from '../../lib/colors';
import { interFont } from '../../lib/fonts';
import { COLORS, GRADIENTS } from '../../lib/theme';

// ─── Schema ──────────────────────────────────────────────────
export const dataVizCounterSchema = z.object({
    title: z.string().default('Year in Review'),
    subtitle: z.string().default('2025 Key Performance Metrics'),
    metric1Label: z.string().default('Total Users'),
    metric1Value: z.number().default(2400000),
    metric1Suffix: z.string().default(''),
    metric1Prefix: z.string().default(''),
    metric2Label: z.string().default('Revenue'),
    metric2Value: z.number().default(18600000),
    metric2Suffix: z.string().default(''),
    metric2Prefix: z.string().default('$'),
    metric3Label: z.string().default('Countries'),
    metric3Value: z.number().default(142),
    metric3Suffix: z.string().default('+'),
    metric3Prefix: z.string().default(''),
    metric4Label: z.string().default('Uptime'),
    metric4Value: z.number().default(99.97),
    metric4Suffix: z.string().default('%'),
    metric4Prefix: z.string().default(''),
    primaryColor: z.string().default(COLORS.accent),
    accentColor: z.string().default(COLORS.accentLight),
    backgroundColor: z.string().default(COLORS.bg),
});

type Props = z.infer<typeof dataVizCounterSchema>;

function formatNumber(n: number): string {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'K';
    if (n % 1 !== 0) return n.toFixed(2);
    return n.toLocaleString();
}

// ─── Component ───────────────────────────────────────────────
export const DataVizCounter01: React.FC<Props> = (props) => {
    const scale = useScaleFactor();
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const isPortrait = useIsPortrait();
    const scale = useResponsive(1, 1);
    const backgroundControls = useResolvedBackgroundControls();
    const renderBackgroundLayers = shouldRenderBackgroundLayer(backgroundControls);

    const metrics = [
        { label: props.metric1Label, value: props.metric1Value, prefix: props.metric1Prefix, suffix: props.metric1Suffix },
        { label: props.metric2Label, value: props.metric2Value, prefix: props.metric2Prefix, suffix: props.metric2Suffix },
        { label: props.metric3Label, value: props.metric3Value, prefix: props.metric3Prefix, suffix: props.metric3Suffix },
        { label: props.metric4Label, value: props.metric4Value, prefix: props.metric4Prefix, suffix: props.metric4Suffix },
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
            {/* Radial glow */}
            {renderBackgroundLayers && (
                <div
                    style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '70%',
                        height: '70%',
                        borderRadius: '50%',
                        background: `radial-gradient(ellipse, ${props.primaryColor}08, transparent 70%)`,
                    }}
                />
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
                    gap: isPortrait ? 40 : 64,
                }}
            >
                {/* Header */}
                <div style={{ opacity: fadeIn(frame, 0) }}>
                    <EditableText
                        text={props.title}
                        fontSize={isPortrait ? 92 : 112}
                        fontFamily={interFont}
                        color={COLORS.textPrimary}
                        fontWeight={800}
                        lineHeight={1.1}
                        letterSpacing={-1}
                    />
                    <EditableText
                        text={props.subtitle}
                        fontSize={isPortrait ? 44 : 52}
                        fontFamily={interFont}
                        color={COLORS.textSecondary}
                        fontWeight={400}
                        style={{ marginTop: 16 * scale }}
                    />
                </div>

                {/* Metric cards */}
                <div
                    style={{
                        flex: isPortrait ? undefined : 1,
                        display: 'grid',
                        gridTemplateColumns: isPortrait ? '1fr' : '1fr 1fr',
                        gap: isPortrait ? 32 : 48,
                        alignContent: 'center',
                    }}
                >
                    {metrics.map((metric, i) => {
                        const delay = 15 + staggerDelay(i, 12);
                        const cardSpring = spring({
                            frame: frame - delay,
                            fps,
                            config: { damping: 14, stiffness: 100, mass: 0.6 },
                        });

                        // Animated counter
                        const counterProgress = interpolate(frame, [delay, delay + 45], [0, 1], {
                            extrapolateLeft: 'clamp',
                            extrapolateRight: 'clamp',
                        });
                        const currentValue = metric.value * counterProgress;

                        return (
                            <div
                                key={i}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: `${28 * scale}px`,
                                    borderRadius: 40 * scale,
                                    background: 'rgba(255,255,255,0.02)',
                                    border: '2px solid rgba(255,255,255,0.05)',
                                    gap: 16 * scale,
                                    transform: `scale(${cardSpring})`,
                                    opacity: fadeIn(frame, delay),
                                }}
                            >
                                <EditableText
                                    text={metric.label}
                                    fontSize={32 * scale}
                                    fontFamily={interFont}
                                    color={COLORS.textSecondary}
                                    fontWeight={500}
                                    textTransform="uppercase"
                                    letterSpacing={3}
                                />
                                <div
                                    style={{
                                        fontSize: isPortrait ? 58 : 84,
                                        fontFamily: interFont,
                                        fontWeight: 700,
                                        backgroundImage: linearGradient(135, props.primaryColor, props.accentColor),
                                        WebkitBackgroundClip: 'text',
                                        WebkitTextFillColor: 'transparent',
                                        backgroundClip: 'text',
                                    }}
                                >
                                    {metric.prefix}{formatNumber(currentValue)}{metric.suffix}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Bottom accent */}
            <div
                style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    width: `${interpolate(frame, [0, 80], [0, 100], { extrapolateRight: 'clamp' })}%`,
                    height: 6 * scale,
                    background: GRADIENTS.bgMain,
                }}
            />
        </AbsoluteFill>
    );
};

// ─── Register ────────────────────────────────────────────────
registerTemplate({
    id: 'data-viz-counter-01',
    name: 'Animated Counter Cards',
    category: 'data-visualization',
    description: 'Four big animated counter cards with number roll-up, gradient text, and spring entry',
    tags: ['counter', 'metrics', 'numbers', 'data', 'KPI'],
    component: DataVizCounter01,
    schema: dataVizCounterSchema,
    defaultProps: dataVizCounterSchema.parse({}),
    durationInFrames: DEFAULT_DURATION_FRAMES,
    fps: DEFAULT_FPS,
});
