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

export const dynamicDonutChartSchema = z.object({
    title: z.string().default('Revenue by Channel'),
    subtitle: z.string().default('Q3 2024 Distribution'),
    segments: z.array(z.object({
        label: z.string(),
        value: z.number(), // will be converted to percentage
        color: z.string(),
    })).default([
        { label: 'Organic Search', value: 45, color: '#3b82f6' },
        { label: 'Paid Ads', value: 25, color: '#f43f5e' },
        { label: 'Direct', value: 20, color: '#10b981' },
        { label: 'Referral', value: 10, color: '#eab308' },
    ]),
    backgroundColor: z.string().default('#0f172a'),
    textColor: z.string().default('#ffffff'),
    centerText: z.string().default('$12.4M'),
});

type Props = z.infer<typeof dynamicDonutChartSchema>;

export const DynamicDonutChart: React.FC<Props> = ({
    title,
    subtitle,
    segments,
    backgroundColor,
    textColor,
    centerText,
}) => {
    const frame = useCurrentFrame();
    const { fps, width, height } = useVideoConfig();
    
    const scale = useScaleFactor();
    const isPortrait = useIsPortrait();

    const titleY = spring({ frame, fps, config: { damping: 12 } });
    const titleOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

    // Calculate percentages
    const totalValue = segments.reduce((sum, seg) => sum + seg.value, 0);
    
    // Animation for drawing the donut (0 to 360 degrees)
    const drawProgress = spring({ frame: frame - 20, fps, config: { damping: 20, mass: 1.5 } });
    const currentTotalAngle = drawProgress * 360;

    const radius = isPortrait ? width * 0.35 : height * 0.35;
    const thickness = radius * 0.3; // donut thickness

    // Layout
    const paddingX = isPortrait ? 60 * scale : 120 * scale;
    const availableWidth = width - (paddingX * 2);

    return (
        <AbsoluteFill style={{ backgroundColor, fontFamily: interFont, color: textColor }}>
            {/* Header */}
            <div style={{
                position: 'absolute',
                top: isPortrait ? 100 * scale : 80 * scale,
                left: paddingX,
                width: availableWidth,
                textAlign: isPortrait ? 'center' : 'left',
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

            {/* Donut Container */}
            <div style={{
                position: 'absolute',
                top: '50%',
                left: isPortrait ? '50%' : paddingX + radius,
                transform: 'translate(-50%, -50%)',
                width: radius * 2,
                height: radius * 2,
            }}>
                {/* SVG Donut implementation allows for clean stroke-dasharray drawing */}
                <svg width="100%" height="100%" viewBox="-100 -100 200 200" style={{ transform: 'rotate(-90deg)' }}>
                    {(() => {
                        let accumulatedAngle = 0;
                        return segments.map((seg, i) => {
                            const segAngle = (seg.value / totalValue) * 360;
                            // How much of this segment should be drawn right now?
                            const angleToDraw = Math.max(0, Math.min(segAngle, currentTotalAngle - accumulatedAngle));
                            
                            // SVG Circle math
                            const r = 100 - (thickness / scale / 2); // normalize to the 200x200 viewBox
                            const circumference = 2 * Math.PI * r;
                            const strokeDasharray = `${(angleToDraw / 360) * circumference} ${circumference}`;
                            const strokeDashoffset = -(accumulatedAngle / 360) * circumference;

                            accumulatedAngle += segAngle;

                            return (
                                <circle
                                    key={i}
                                    r={r}
                                    cx="0"
                                    cy="0"
                                    fill="transparent"
                                    stroke={seg.color}
                                    strokeWidth={thickness / scale}
                                    strokeDasharray={strokeDasharray}
                                    strokeDashoffset={strokeDashoffset}
                                    strokeLinecap="butt"
                                />
                            );
                        });
                    })()}
                </svg>

                {/* Center Text */}
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    textAlign: 'center',
                    opacity: interpolate(drawProgress, [0.5, 1], [0, 1], { extrapolateRight: 'clamp' }),
                }}>
                    <div style={{
                        fontSize: 48 * scale,
                        fontWeight: 900,
                        fontFamily: montserratFont,
                        color: textColor,
                    }}>
                        {centerText}
                    </div>
                </div>
            </div>

            {/* Legend */}
            <div style={{
                position: 'absolute',
                top: isPortrait ? height * 0.8 : '50%',
                left: isPortrait ? paddingX : paddingX + (radius * 2) + 80 * scale,
                transform: isPortrait ? 'none' : 'translateY(-50%)',
                width: isPortrait ? availableWidth : availableWidth - (radius * 2) - 80 * scale,
                display: 'flex',
                flexDirection: 'column',
                gap: 24 * scale,
            }}>
                {segments.map((seg, i) => {
                    const delay = 40 + i * 8;
                    const pop = spring({ frame: frame - delay, fps, config: { damping: 14 } });
                    const percentage = Math.round((seg.value / totalValue) * 100);

                    return (
                        <div key={i} style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            transform: `translateX(${(1 - pop) * 40}px)`,
                            opacity: pop,
                            backgroundColor: 'rgba(255,255,255,0.05)',
                            padding: `${16 * scale}px ${24 * scale}px`,
                            borderRadius: 16 * scale,
                            borderLeft: `6px solid ${seg.color}`,
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 16 * scale }}>
                                <div style={{ 
                                    fontSize: 24 * scale, 
                                    fontWeight: 700, 
                                    fontFamily: montserratFont,
                                    width: 60 * scale,
                                }}>
                                    {percentage}%
                                </div>
                                <div style={{ fontSize: 20 * scale, color: 'rgba(255,255,255,0.8)' }}>
                                    {seg.label}
                                </div>
                            </div>
                            <div style={{ fontSize: 24 * scale, fontWeight: 700 }}>
                                {seg.value}
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
    id: 'dynamic-donut-chart-01',
    name: 'Dynamic Donut Chart',
    description: 'An animated donut chart that smoothly draws its segments and displays a clean legend.',
    category: 'data-visualization',
    durationInFrames: 180,
    fps: 30,
    component: DynamicDonutChart,
    schema: dynamicDonutChartSchema,
    defaultProps: dynamicDonutChartSchema.parse({}),
});
