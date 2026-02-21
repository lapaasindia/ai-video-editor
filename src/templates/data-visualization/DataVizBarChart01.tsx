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
import { linearGradient } from '../../lib/colors';
import { interFont } from '../../lib/fonts';
import { COLORS, GRADIENTS } from '../../lib/theme';

// ─── Schema ──────────────────────────────────────────────────
export const dataVizBarChartSchema = z.object({
    title: z.string().default('Monthly Revenue Growth'),
    subtitle: z.string().default('Q4 2025 Performance by Region'),
    bar1Label: z.string().default('North America'),
    bar1Value: z.number().default(85),
    bar1Display: z.string().default('$4.2M'),
    bar2Label: z.string().default('Europe'),
    bar2Value: z.number().default(62),
    bar2Display: z.string().default('$3.1M'),
    bar3Label: z.string().default('Asia Pacific'),
    bar3Value: z.number().default(74),
    bar3Display: z.string().default('$3.7M'),
    bar4Label: z.string().default('Latin America'),
    bar4Value: z.number().default(45),
    bar4Display: z.string().default('$2.2M'),
    bar5Label: z.string().default('Middle East'),
    bar5Value: z.number().default(38),
    bar5Display: z.string().default('$1.9M'),
    primaryColor: z.string().default(COLORS.accent),
    accentColor: z.string().default(COLORS.accentLight),
    backgroundColor: z.string().default(COLORS.bg),
});

type Props = z.infer<typeof dataVizBarChartSchema>;

// ─── Component ───────────────────────────────────────────────
export const DataVizBarChart01: React.FC<Props> = (props) => {
    const scale = useScaleFactor();
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const isPortrait = useIsPortrait();
    const scale = useResponsive(1, 1);
    const backgroundControls = useResolvedBackgroundControls();
    const renderBackgroundLayers = shouldRenderBackgroundLayer(backgroundControls);

    const bars = [
        { label: props.bar1Label, value: props.bar1Value, display: props.bar1Display },
        { label: props.bar2Label, value: props.bar2Value, display: props.bar2Display },
        { label: props.bar3Label, value: props.bar3Value, display: props.bar3Display },
        { label: props.bar4Label, value: props.bar4Value, display: props.bar4Display },
        { label: props.bar5Label, value: props.bar5Value, display: props.bar5Display },
    ];

    const maxValue = Math.max(...bars.map((b) => b.value));

    return (
        <AbsoluteFill
            style={{
                background: resolveCanvasBackground(COLORS.bg, backgroundControls),
                overflow: 'hidden',
            }}
        >
            {/* Animated background */}
            <AnimatedGradient />
            {/* Grid lines */}
            {renderBackgroundLayers && (
                <div
                    style={{
                        position: 'absolute',
                        top: 0, left: 0, right: 0, bottom: 0,
                        backgroundImage: `linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px)`,
                        backgroundSize: '100% 60px',
                        opacity: fadeIn(frame, 0, 20),
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
                    gap: isPortrait ? 88 : 64,
                }}
            >
                {/* Header */}
                <div style={{ opacity: fadeIn(frame, 0), transform: slideIn(frame, 'down', 0, 20) }}>
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

                {/* Bar chart */}
                <div
                    style={{
                        flex: isPortrait ? undefined : 1,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        gap: isPortrait ? 60 : 44,
                    }}
                >
                    {bars.map((bar, i) => {
                        const delay = 15 + staggerDelay(i, 8);
                        const barGrow = spring({
                            frame: frame - delay,
                            fps,
                            config: { damping: 15, stiffness: 80, mass: 0.8 },
                        });
                        const widthPct = (bar.value / maxValue) * 100;
                        const hue = interpolate(i, [0, bars.length - 1], [0, 1]);

                        return (
                            <div
                                key={i}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: isPortrait ? 16 : 32,
                                    opacity: fadeIn(frame, delay),
                                }}
                                >
                                    {/* Label */}
                                <div style={{ width: isPortrait ? 360 : 300, flexShrink: 0 }}>
                                    <EditableText
                                        text={bar.label}
                                        fontSize={32 * scale}
                                        fontFamily={interFont}
                                        color={COLORS.textSecondary}
                                        fontWeight={500}
                                    />
                                </div>

                                {/* Bar */}
                                <div
                                    style={{
                                        flex: 1,
                                        height: isPortrait ? 48 : 36,
                                        borderRadius: 16 * scale,
                                        background: 'rgba(255,255,255,0.04)',
                                        overflow: 'hidden',
                                        position: 'relative',
                                    }}
                                >
                                    <div
                                        style={{
                                            width: `${widthPct * barGrow}%`,
                                            height: '100%',
                                            borderRadius: 16 * scale,
                                            background: linearGradient(
                                                90,
                                                interpolate(hue, [0, 1], [0, 1]) > 0.5 ? props.accentColor : props.primaryColor,
                                                interpolate(hue, [0, 1], [0, 1]) > 0.5 ? props.primaryColor : props.accentColor
                                            ),
                                            boxShadow: `0 0 20px ${props.primaryColor}33`,
                                        }}
                                    />
                                </div>

                                {/* Value */}
                                <div style={{ width: isPortrait ? 200 : 170, flexShrink: 0, textAlign: 'right' }}>
                                    <EditableText
                                        text={bar.display}
                                        fontSize={40 * scale}
                                        fontFamily={interFont}
                                        color={COLORS.textSecondary}
                                        fontWeight={700}
                                    />
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
    id: 'data-viz-bar-chart-01',
    name: 'Horizontal Bar Chart',
    category: 'data-visualization',
    description: 'Animated horizontal bar chart with 5 data bars, spring grow animation, and gradient fills',
    tags: ['chart', 'bar', 'data', 'visualization', 'metrics'],
    component: DataVizBarChart01,
    schema: dataVizBarChartSchema,
    defaultProps: dataVizBarChartSchema.parse({}),
    durationInFrames: DEFAULT_DURATION_FRAMES,
    fps: DEFAULT_FPS,
});
