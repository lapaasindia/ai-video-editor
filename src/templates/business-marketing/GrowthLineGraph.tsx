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

export const growthLineGraphSchema = z.object({
    title: z.string().default('Active Users'),
    subtitle: z.string().default('Monthly Growth (in thousands)'),
    points: z.array(z.object({
        label: z.string(),
        value: z.number(),
    backgroundColor: z.string().default(COLORS.bg),
    })).default([
        { label: 'Jan', value: 10 },
        { label: 'Feb', value: 15 },
        { label: 'Mar', value: 25 },
        { label: 'Apr', value: 45 },
        { label: 'May', value: 60 },
        { label: 'Jun', value: 95 },
        { label: 'Jul', value: 150 },
    ]),
    backgroundColor: z.string().default(COLORS.bg),
    textColor: z.string().default(COLORS.textPrimary),
    lineColor: z.string().default('#10b981'),
    gridColor: z.string().default('rgba(255,255,255,0.1)'),
});

type Props = z.infer<typeof growthLineGraphSchema>;

export const GrowthLineGraph: React.FC<Props> = ({
    title,
    subtitle,
    points,
    backgroundColor,
    textColor,
    lineColor,
    gridColor,
}) => {
    const frame = useCurrentFrame();
    const { fps, width, height } = useVideoConfig();
    
    const scale = useScaleFactor();
    const backgroundControls = useResolvedBackgroundControls();
    const isPortrait = useIsPortrait();

    const titleY = spring({ frame, fps, config: { damping: 12 } });
    const titleOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

    // Chart dimensions
    const paddingX = isPortrait ? 80 * scale : 150 * scale;
    const paddingY = isPortrait ? 300 * scale : 200 * scale;
    const chartWidth = width - (paddingX * 2);
    const chartHeight = height - (paddingY * 2) - 100 * scale;
    const startX = paddingX;
    const startY = height - paddingY;

    // Data math
    const maxVal = Math.max(...points.map(p => p.value));
    const minVal = 0; // force 0 base
    const totalPoints = Math.max(1, points.length - 1);
    const xStep = chartWidth / totalPoints;

    // Generate path data
    let pathD = '';
    const pointsCoords: { x: number, y: number, label: string, value: number }[] = [];

    points.forEach((p, i) => {
        const x = i * xStep;
        const y = -((p.value - minVal) / (maxVal - minVal)) * chartHeight; // negative because SVG y goes down
        pointsCoords.push({ x, y, label: p.label, value: p.value });
        
        if (i === 0) pathD += `M ${x} ${y} `;
        else pathD += `L ${x} ${y} `;
    });

    // Animation progress
    const drawProgress = spring({ frame: frame - 20, fps, config: { damping: 20, mass: 2 } });
    
    // Create a closed path for the gradient fill below the line
    const fillPathD = `${pathD} L ${chartWidth} 0 L 0 0 Z`;

    return (
        <AbsoluteFill style={{ background: resolveCanvasBackground(backgroundColor, backgroundControls), fontFamily: interFont, color: textColor }}>
            {/* Header */}
            <div style={{
                position: 'absolute',
                top: isPortrait ? 100 * scale : 80 * scale,
                left: paddingX,
                width: chartWidth,
                textAlign: 'left',
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
                        color: lineColor,
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
                left: startX,
                top: startY - chartHeight,
                width: chartWidth,
                height: chartHeight,
            }}>
                {/* Horizontal Grid Lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => (
                    <div key={i} style={{
                        position: 'absolute',
                        bottom: `${pct * 100}%`,
                        left: 0,
                        width: '100%',
                        height: 1,
                        backgroundColor: gridColor,
                    }}>
                        <div style={{
                            position: 'absolute',
                            left: -60 * scale,
                            top: -10 * scale,
                            fontSize: 16 * scale,
                            color: COLORS.textMuted,
                            textAlign: 'right',
                            width: 50 * scale,
                        }}>
                            {Math.round(pct * maxVal)}
                        </div>
                    </div>
                ))}

                {/* Vertical Grid Lines (X-Axis) */}
                {pointsCoords.map((p, i) => (
                    <div key={i} style={{
                        position: 'absolute',
                        left: p.x,
                        bottom: -30 * scale,
                        height: chartHeight + 10 * scale,
                        borderLeft: `1px dashed ${gridColor}`,
                    }}>
                        <div style={{
                            position: 'absolute',
                            bottom: -30 * scale,
                            left: -40 * scale,
                            width: 80 * scale,
                            textAlign: 'center',
                            fontSize: 16 * scale,
                            fontWeight: 600,
                            color: COLORS.textSecondary,
                        }}>
                            {p.label}
                        </div>
                    </div>
                ))}

                {/* SVG Line and Fill */}
                {/* We use strokeDasharray trick to animate the line drawing */}
                <svg 
                    width="100%" 
                    height="100%" 
                    viewBox={`0 ${-chartHeight} ${chartWidth} ${chartHeight}`} 
                    style={{ overflow: 'visible' }}
                >
                    {/* Defs for gradient */}
                    <defs>
                        <linearGradient id="fillGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={lineColor} stopOpacity={0.4} />
                            <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
                        </linearGradient>
                    </defs>

                    {/* Fill */}
                    <path 
                        d={fillPathD} 
                        fill="url(#fillGradient)" 
                        style={{
                            clipPath: `inset(0 ${100 - (drawProgress * 100)}% 0 0)`, // Animate reveal from left to right
                        }}
                    />

                    {/* Line */}
                    <path 
                        d={pathD} 
                        fill="none" 
                        stroke={lineColor} 
                        strokeWidth={6 * scale}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{
                            // We use clipPath instead of dasharray because dasharray is tricky with multiple segments
                            clipPath: `inset(0 ${100 - (drawProgress * 100)}% 0 0)`,
                            filter: `drop-shadow(0 10px 10px ${lineColor}80)`,
                        }}
                    />

                    {/* Data Points (Dots) */}
                    {pointsCoords.map((p, i) => {
                        // Calculate when the line reaches this point
                        const progressAtPoint = i / totalPoints;
                        const isReached = drawProgress >= progressAtPoint;
                        
                        // Small pop animation when reached
                        const dotPop = isReached 
                            ? spring({ frame: frame - (20 + (progressAtPoint * 60)), fps, config: { damping: 10 } })
                            : 0;

                        if (!isReached) return null;

                        return (
                            <g key={i} transform={`translate(${p.x}, ${p.y}) scale(${dotPop})`}>
                                <circle 
                                    r={10 * scale} 
                                    fill={backgroundColor} 
                                    stroke={lineColor} 
                                    strokeWidth={4 * scale} 
                                />
                                {/* Value Popup */}
                                <g transform={`translate(0, ${-30 * scale})`}>
                                    <rect 
                                        x={-40 * scale} 
                                        y={-25 * scale} 
                                        width={80 * scale} 
                                        height={30 * scale} 
                                        rx={6 * scale} 
                                        fill={lineColor} 
                                    />
                                    <text 
                                        x="0" 
                                        y={-5 * scale} 
                                        textAnchor="middle" 
                                        fill={backgroundColor}
                                        fontSize={16 * scale}
                                        fontWeight="bold"
                                        fontFamily={interFont}
                                    >
                                        {p.value}
                                    </text>
                                </g>
                            </g>
                        );
                    })}
                </svg>
            </div>
        </AbsoluteFill>
    );
};

registerTemplate({
    tags: [],
    id: 'growth-line-graph-01',
    name: 'Animated Line Graph',
    description: 'A data visualization graph that draws a line from left to right showing growth over time.',
    category: 'data-visualization',
    durationInFrames: 180,
    fps: 30,
    component: GrowthLineGraph,
    schema: growthLineGraphSchema,
    defaultProps: growthLineGraphSchema.parse({}),
});
