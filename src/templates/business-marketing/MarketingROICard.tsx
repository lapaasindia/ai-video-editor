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
import { interFont, montserratFont } from '../../lib/fonts';

export const marketingRoiSchema = z.object({
    title: z.string().default('Q3 Marketing ROI'),
    subtitle: z.string().default('Campaign Performance Dashboard'),
    metrics: z.array(z.object({
        label: z.string(),
        value: z.string(),
        trend: z.number(), // positive is good, negative is bad
        icon: z.string(),
        color: z.string(),
    })).default([
        { label: 'Total Spend', value: '$45,000', trend: 5.2, icon: '💸', color: '#64748b' },
        { label: 'New Leads', value: '2,845', trend: 14.8, icon: '🎯', color: '#3b82f6' },
        { label: 'Conversions', value: '412', trend: 22.4, icon: '🏆', color: '#10b981' },
        { label: 'Cost Per Acq', value: '$109', trend: -8.5, icon: '📉', color: '#8b5cf6' },
    ]),
    backgroundColor: z.string().default('#0f172a'),
    textColor: z.string().default('#f8fafc'),
    cardBgColor: z.string().default('#1e293b'),
});

type Props = z.infer<typeof marketingRoiSchema>;

export const MarketingROICard: React.FC<Props> = ({
    title,
    subtitle,
    metrics,
    backgroundColor,
    textColor,
    cardBgColor,
}) => {
    const frame = useCurrentFrame();
    const { fps, width, height } = useVideoConfig();
    const scale = useScaleFactor();
    const isPortrait = useIsPortrait();

    const titleY = spring({ frame, fps, config: { damping: 12 } });
    const titleOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

    // Grid layout
    const totalMetrics = metrics.length;
    // Determine columns/rows based on portrait mode and item count
    const cols = isPortrait ? 1 : (totalMetrics > 4 ? 3 : 2);
    
    const paddingX = isPortrait ? 60 * scale : 120 * scale;
    const gap = 30 * scale;
    const startY = isPortrait ? height * 0.25 : height * 0.3;
    const availableWidth = width - (paddingX * 2);

    return (
        <AbsoluteFill style={{ backgroundColor, fontFamily: interFont, color: textColor }}>
            {/* Header */}
            <div style={{
                position: 'absolute',
                top: isPortrait ? 100 * scale : 100 * scale,
                left: paddingX,
                width: availableWidth,
                transform: `translateY(${(1 - titleY) * -30}px)`,
                opacity: titleOpacity,
            }}>
                <EditableText
                    text={title}
                    style={{
                        fontFamily: montserratFont,
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

            {/* Metrics Dashboard */}
            <div style={{
                position: 'absolute',
                top: startY,
                left: paddingX,
                width: availableWidth,
                display: 'grid',
                gridTemplateColumns: `repeat(${cols}, 1fr)`,
                gap: gap,
            }}>
                {metrics.map((metric, i) => {
                    const delay = 15 + i * 8;
                    const pop = spring({ frame: frame - delay, fps, config: { damping: 14 } });
                    const op = interpolate(frame - delay, [0, 10], [0, 1], { extrapolateRight: 'clamp' });

                    // Number counter animation (0 to value)
                    // If value is a string with symbols like "$45,000", we just animate opacity
                    // For a true number counter, we'd need to parse it, but for a template, string is safer.

                    const isPositive = metric.trend > 0;
                    const isCostMetric = metric.label.toLowerCase().includes('cost');
                    // For cost, negative trend is usually good (green), positive is bad (red)
                    const isGood = isCostMetric ? !isPositive : isPositive;
                    
                    const trendColor = isGood ? '#10b981' : '#ef4444';
                    const trendIcon = isPositive ? '↑' : '↓';

                    return (
                        <div key={i} style={{
                            backgroundColor: cardBgColor,
                            borderRadius: 24 * scale,
                            padding: 30 * scale,
                            transform: `scale(${interpolate(pop, [0, 1], [0.9, 1])}) translateY(${(1 - pop) * 30}px)`,
                            opacity: op,
                            boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
                            border: `1px solid rgba(255,255,255,0.05)`,
                            borderTop: `4px solid ${metric.color}`,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 16 * scale,
                            position: 'relative',
                            overflow: 'hidden',
                        }}>
                            {/* Subtle background glow from the top border color */}
                            <div style={{
                                position: 'absolute',
                                top: 0, left: 0, right: 0, height: 100 * scale,
                                background: `linear-gradient(180deg, ${metric.color}20 0%, transparent 100%)`,
                                zIndex: 0,
                            }} />

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', zIndex: 1 }}>
                                <span style={{ 
                                    fontSize: 18 * scale, 
                                    fontWeight: 600, 
                                    color: 'rgba(255,255,255,0.7)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em'
                                }}>
                                    {metric.label}
                                </span>
                                <div style={{
                                    width: 48 * scale,
                                    height: 48 * scale,
                                    backgroundColor: `${metric.color}20`,
                                    borderRadius: 12 * scale,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 24 * scale,
                                }}>
                                    {metric.icon}
                                </div>
                            </div>
                            
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 * scale, zIndex: 1 }}>
                                <span style={{ 
                                    fontSize: (isPortrait ? 48 : 56) * scale, 
                                    fontWeight: 800, 
                                    fontFamily: montserratFont,
                                    letterSpacing: '-0.02em',
                                    color: '#fff',
                                }}>
                                    {metric.value}
                                </span>
                                
                                <span style={{
                                    fontSize: 16 * scale,
                                    fontWeight: 700,
                                    color: trendColor,
                                    backgroundColor: `${trendColor}20`,
                                    padding: `${4 * scale}px ${10 * scale}px`,
                                    borderRadius: 20 * scale,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4 * scale,
                                }}>
                                    {trendIcon} {Math.abs(metric.trend)}%
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </AbsoluteFill>
    );
};

registerTemplate({
    id: 'marketing-roi-card-01',
    name: 'Marketing ROI Dashboard',
    description: 'A clean analytics dashboard showing key performance indicators (KPIs) and trends.',
    category: 'marketing-sales',
    durationInFrames: 150,
    fps: 30,
    component: MarketingROICard,
    schema: marketingRoiSchema,
    defaultProps: marketingRoiSchema.parse({}),
});
