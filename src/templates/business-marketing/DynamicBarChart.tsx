import React from 'react';
import {
    AbsoluteFill,
    useCurrentFrame,
    useVideoConfig,
    interpolate,
    spring,
} from 'remotion';
import { z } from 'zod';
import { useIsPortrait, useScaleFactor } from '../../lib/responsive';
import { EditableText } from '../../components/EditableText';
import { registerTemplate } from '../registry';
import { COLORS } from '../../lib/theme';
import {
    resolveCanvasBackground,
    useResolvedBackgroundControls,
} from '../../lib/background';
import { interFont } from '../../lib/fonts';

export const dynamicBarChartSchema = z.object({
    title: z.string().default('Revenue Growth'),
    subtitle: z.string().default('Year over Year ($M)'),
    dataPoints: z.array(z.object({
        label: z.string(),
        value: z.number(),
        color: z.string(),
    backgroundColor: z.string().default(COLORS.bg),
    })).default([
        { label: '2020', value: 2.4, color: '#3b82f6' },
        { label: '2021', value: 4.8, color: '#6366f1' },
        { label: '2022', value: 9.6, color: '#8b5cf6' },
        { label: '2023', value: 18.2, color: '#a855f7' },
        { label: '2024', value: 34.5, color: '#d946ef' },
    ]),
    backgroundColor: z.string().default(COLORS.bg),
    textColor: z.string().default(COLORS.textPrimary),
    axisColor: z.string().default('rgba(255,255,255,0.2)'),
});

type Props = z.infer<typeof dynamicBarChartSchema>;

export const DynamicBarChart: React.FC<Props> = ({
    title,
    subtitle,
    dataPoints,
    backgroundColor,
    textColor,
    axisColor,
}) => {
    const frame = useCurrentFrame();
    const { fps, width, height } = useVideoConfig();
    
    const scale = useScaleFactor();
    const backgroundControls = useResolvedBackgroundControls();
    const isPortrait = useIsPortrait();

    const titleY = spring({ frame, fps, config: { damping: 12 } });
    const titleOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

    const totalBars = dataPoints.length;
    const maxValue = Math.max(...dataPoints.map(d => d.value));
    
    // Layout
    const paddingX = isPortrait ? 60 * scale : 120 * scale;
    const paddingY = 150 * scale;
    const availableWidth = width - (paddingX * 2);
    const chartHeight = height - (paddingY * 2) - (isPortrait ? 200 * scale : 150 * scale);
    
    // Calculate width for each bar
    const barSpacing = isPortrait ? 20 * scale : 40 * scale;
    const barWidth = (availableWidth - (barSpacing * (totalBars - 1))) / totalBars;

    return (
        <AbsoluteFill style={{ background: resolveCanvasBackground(backgroundColor, backgroundControls), fontFamily: interFont, color: textColor }}>
            {/* Header */}
            <div style={{
                position: 'absolute',
                top: isPortrait ? 100 * scale : 80 * scale,
                left: paddingX,
                width: availableWidth,
                textAlign: 'center',
                transform: `translateY(${(1 - titleY) * -30}px)`,
                opacity: titleOpacity,
            }}>
                <EditableText
                    text={title}
                    style={{
                        fontFamily: interFont,
                        fontWeight: 800,
                        fontSize: (isPortrait ? 60 : 72) * scale,
                        margin: 0,
                        letterSpacing: '-0.02em',
                    }}
                />
                <EditableText
                    text={subtitle}
                    style={{
                        fontSize: (isPortrait ? 24 : 32) * scale,
                        opacity: 0.6,
                        marginTop: 10 * scale,
                    }}
                />
            </div>

            {/* Chart Area */}
            <div style={{
                position: 'absolute',
                bottom: paddingY,
                left: paddingX,
                width: availableWidth,
                height: chartHeight,
                borderBottom: `2px solid ${axisColor}`,
                borderLeft: `2px solid ${axisColor}`,
                display: 'flex',
                alignItems: 'flex-end',
                gap: barSpacing,
            }}>
                {/* Y-Axis Labels (Max, Mid, Zero) */}
                <div style={{
                    position: 'absolute', top: -10 * scale, left: -40 * scale,
                    fontSize: 16 * scale, color: COLORS.textMuted,
                }}>
                    {Math.ceil(maxValue)}
                </div>
                <div style={{
                    position: 'absolute', top: chartHeight / 2 - 10 * scale, left: -40 * scale,
                    fontSize: 16 * scale, color: COLORS.textMuted,
                }}>
                    {Math.ceil(maxValue / 2)}
                </div>
                <div style={{
                    position: 'absolute', bottom: 10 * scale, left: -40 * scale,
                    fontSize: 16 * scale, color: COLORS.textMuted,
                }}>
                    0
                </div>

                {/* Bars */}
                {dataPoints.map((point, i) => {
                    const targetHeight = (point.value / maxValue) * chartHeight;
                    
                    // Animate growing up
                    const delay = 30 + i * 10;
                    const grow = spring({ frame: frame - delay, fps, config: { damping: 14, mass: 1.5 } });
                    const currentHeight = grow * targetHeight;
                    
                    return (
                        <div key={i} style={{
                            width: barWidth,
                            height: Math.max(0, currentHeight), // prevent negative height on bounce back
                            backgroundColor: point.color,
                            borderTopLeftRadius: 12 * scale,
                            borderTopRightRadius: 12 * scale,
                            position: 'relative',
                            boxShadow: `0 -10px 30px ${point.color}40`,
                        }}>
                            {/* Inner gradient */}
                            <div style={{
                                position: 'absolute',
                                top: 0, left: 0, right: 0, bottom: 0,
                                background: `linear-gradient(180deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 100%)`,
                                borderTopLeftRadius: 12 * scale,
                                borderTopRightRadius: 12 * scale,
                            }} />

                            {/* Value Label on Top */}
                            <div style={{
                                position: 'absolute',
                                top: -40 * scale,
                                width: '100%',
                                textAlign: 'center',
                                fontSize: 24 * scale,
                                fontWeight: 800,
                                fontFamily: interFont,
                                opacity: grow, // fade in as it grows
                                color: '#fff',
                            }}>
                                {point.value}
                            </div>
                            
                            {/* X-Axis Label at Bottom */}
                            <div style={{
                                position: 'absolute',
                                bottom: -40 * scale,
                                width: '100%',
                                textAlign: 'center',
                                fontSize: 18 * scale,
                                fontWeight: 600,
                                color: COLORS.textSecondary,
                            }}>
                                {point.label}
                            </div>
                        </div>
                    );
                })}
            </div>
        </AbsoluteFill>
    );
};

registerTemplate({
    tags: [],
    id: 'dynamic-bar-chart-01',
    name: 'Dynamic Bar Chart',
    description: 'A data visualization chart that auto-scales the Y-axis and animates bars upwards sequentially.',
    category: 'data-visualization',
    durationInFrames: 180,
    fps: 30,
    component: DynamicBarChart,
    schema: dynamicBarChartSchema,
    defaultProps: dynamicBarChartSchema.parse({}),
});
