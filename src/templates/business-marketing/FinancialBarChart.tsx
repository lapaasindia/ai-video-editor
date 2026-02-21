import React from 'react';
import {
    AbsoluteFill,
    useCurrentFrame,
    useVideoConfig,
    interpolate,
    spring,
    Img,
} from 'remotion';
import { z } from 'zod';
import { useIsPortrait, useScaleFactor } from '../../lib/responsive';
import { EditableText } from '../../components/EditableText';
import { registerTemplate } from '../registry';
import { interFont, montserratFont } from '../../lib/fonts';

// A multi-series bar chart (like the OLA financials example)
export const financialBarChartSchema = z.object({
    title: z.string().default('OLA Financials FY22'),
    yAxisLabel: z.string().default('Amount in ₹ Cr'),
    seriesLabels: z.array(z.string()).default(['FY20', 'FY21', 'FY22']),
    seriesColors: z.array(z.string()).default(['#ff6b57', '#1b4d75', '#8898a1']),
    categories: z.array(z.object({
        name: z.string(),
        values: z.array(z.number()),
        highlightPercentage: z.string().optional(), // e.g. "+100.4%"
        highlightColor: z.string().optional(),
    })).default([
        { 
            name: 'Operating Revenue', 
            values: [2662, 983, 1970], 
            highlightPercentage: '+100.4%', 
            highlightColor: '#10b981' 
        },
        { 
            name: 'Total Expenses', 
            values: [5058, 2007, 3362], 
            highlightPercentage: '+67.5%', 
            highlightColor: '#ef4444' 
        },
        { 
            name: 'Profit/Loss', 
            values: [-2208, -1116, -1522], 
            highlightPercentage: '+36.4%', 
            highlightColor: '#ef4444' 
        },
        { 
            name: 'Cash from Ops', 
            values: [-981, -559, -934], 
            highlightPercentage: '+67.1%', 
            highlightColor: '#ef4444' 
        },
    ]),
    backgroundColor: z.string().default('#f4f4f4'), // Light gray background like the example
    textColor: z.string().default('#111111'),
    gridColor: z.string().default('#d1d5db'),
    logoUrl: z.string().optional(), // Optional logo next to title
});

type Props = z.infer<typeof financialBarChartSchema>;

export const FinancialBarChart: React.FC<Props> = ({
    title,
    yAxisLabel,
    seriesLabels,
    seriesColors,
    categories,
    backgroundColor,
    textColor,
    gridColor,
    logoUrl,
}) => {
    const frame = useCurrentFrame();
    const { fps, width, height } = useVideoConfig();
    
    const scale = useScaleFactor();
    const isPortrait = useIsPortrait();

    const titleY = spring({ frame, fps, config: { damping: 12 } });
    const titleOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

    // Chart Dimensions
    const paddingX = isPortrait ? 60 * scale : 120 * scale;
    const paddingY = isPortrait ? 200 * scale : 150 * scale;
    const chartWidth = width - (paddingX * 2);
    
    // Calculate Y-Axis bounds based on data
    let maxVal = 0;
    let minVal = 0;
    categories.forEach(cat => {
        cat.values.forEach(val => {
            if (val > maxVal) maxVal = val;
            if (val < minVal) minVal = val;
        });
    });

    // Add some padding to max/min for the grid
    // Round to nearest neat number (e.g., nearest 1000)
    const yAxisMax = Math.ceil(maxVal / 1000) * 1000 || 1000;
    const yAxisMin = Math.floor(minVal / 1000) * 1000 || 0;
    const range = yAxisMax - yAxisMin;
    
    // We want the 0 line to be positioned correctly
    const chartHeight = height - (paddingY * 2) - 100 * scale;
    // Calculate where 0 is (as a percentage from bottom)
    const zeroLinePct = minVal < 0 ? Math.abs(yAxisMin) / range : 0;
    const zeroLineY = chartHeight * zeroLinePct;

    // Layout math for bars
    const numCategories = categories.length;
    const numSeries = Math.max(1, seriesLabels.length);
    const categoryWidth = chartWidth / numCategories;
    
    // Leave some gap between categories
    const barGroupWidth = categoryWidth * 0.8; 
    const barWidth = barGroupWidth / numSeries;
    const barGap = barWidth * 0.1; // small gap between bars in same category
    const actualBarWidth = barWidth - barGap;

    // Background gradient sections (like the reference image)
    const sectionBgColors = [
        'linear-gradient(to bottom, #e2eff6, transparent)',
        'linear-gradient(to bottom, #fcece0, transparent)',
        'linear-gradient(to bottom, #e2eff6, transparent)',
        'linear-gradient(to bottom, #fcece0, transparent)',
    ];

    return (
        <AbsoluteFill style={{ backgroundColor, fontFamily: interFont, color: textColor }}>
            {/* Header (Logo + Title) */}
            <div style={{
                position: 'absolute',
                top: isPortrait ? 80 * scale : 60 * scale,
                left: paddingX,
                display: 'flex',
                alignItems: 'center',
                gap: 20 * scale,
                transform: `translateY(${(1 - titleY) * -30}px)`,
                opacity: titleOpacity,
            }}>
                {logoUrl && (
                    <Img src={logoUrl} style={{ height: 60 * scale, objectFit: 'contain' }} />
                )}
                <EditableText
                    text={title}
                    style={{
                        fontFamily: montserratFont,
                        fontWeight: 900,
                        fontSize: (isPortrait ? 48 : 64) * scale,
                        margin: 0,
                        letterSpacing: '-0.02em',
                    }}
                />
            </div>

            {/* Legend */}
            <div style={{
                position: 'absolute',
                top: isPortrait ? 160 * scale : 80 * scale,
                right: paddingX,
                display: 'flex',
                gap: 20 * scale,
                backgroundColor: '#ffffff',
                padding: `${12 * scale}px ${24 * scale}px`,
                borderRadius: 8 * scale,
                boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                opacity: titleOpacity,
            }}>
                {seriesLabels.map((label, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 * scale }}>
                        <div style={{ width: 16 * scale, height: 16 * scale, backgroundColor: seriesColors[i % seriesColors.length], borderRadius: 4 * scale }} />
                        <span style={{ fontSize: 16 * scale, fontWeight: 600, color: '#4b5563' }}>{label}</span>
                    </div>
                ))}
            </div>

            {/* Chart Area */}
            <div style={{
                position: 'absolute',
                top: paddingY,
                left: paddingX,
                width: chartWidth,
                height: chartHeight,
            }}>
                {/* Background Alternating Columns */}
                {categories.map((_, i) => (
                    <div key={`bg-${i}`} style={{
                        position: 'absolute',
                        top: 0,
                        left: i * categoryWidth,
                        width: categoryWidth,
                        height: chartHeight,
                        background: sectionBgColors[i % sectionBgColors.length],
                        zIndex: 0,
                    }} />
                ))}

                {/* Y-Axis Label */}
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: -80 * scale,
                    transform: 'translate(-50%, -50%) rotate(-90deg)',
                    fontSize: 18 * scale,
                    fontWeight: 600,
                    color: '#4b5563',
                    whiteSpace: 'nowrap',
                }}>
                    {yAxisLabel}
                </div>

                {/* Horizontal Grid Lines */}
                {[...Array(5)].map((_, i) => {
                    const pct = i / 4; // 0, 0.25, 0.5, 0.75, 1
                    const val = yAxisMin + (range * pct);
                    const isZero = val === 0;

                    return (
                        <div key={`grid-${i}`} style={{
                            position: 'absolute',
                            bottom: `${pct * 100}%`,
                            left: 0,
                            width: '100%',
                            height: isZero ? 2 * scale : 1 * scale,
                            backgroundColor: isZero ? '#9ca3af' : gridColor,
                            zIndex: 1,
                        }}>
                            <div style={{
                                position: 'absolute',
                                left: -50 * scale,
                                top: '50%',
                                transform: 'translateY(-50%)',
                                fontSize: 14 * scale,
                                fontWeight: 500,
                                color: '#6b7280',
                                textAlign: 'right',
                                width: 40 * scale,
                            }}>
                                {Math.round(val)}
                            </div>
                        </div>
                    );
                })}

                {/* Bars & Categories */}
                {categories.map((category, catIdx) => {
                    return (
                        <div key={`cat-${catIdx}`} style={{
                            position: 'absolute',
                            left: catIdx * categoryWidth,
                            bottom: 0,
                            width: categoryWidth,
                            height: '100%',
                            zIndex: 2,
                        }}>
                            {/* Bars Group */}
                            <div style={{
                                position: 'absolute',
                                left: '50%',
                                bottom: zeroLineY,
                                transform: 'translateX(-50%)',
                                display: 'flex',
                                alignItems: 'flex-end', // for positive bars
                                gap: barGap,
                                height: 0, // start drawing from zero line
                                width: barGroupWidth,
                            }}>
                                {category.values.map((val, seriesIdx) => {
                                    // Calculate height as percentage of total range
                                    const absVal = Math.abs(val);
                                    const heightPct = absVal / range;
                                    const pixelHeight = heightPct * chartHeight;
                                    const isPositive = val >= 0;

                                    // Animation
                                    const delay = 20 + (catIdx * 10) + (seriesIdx * 5);
                                    const grow = spring({ frame: frame - delay, fps, config: { damping: 14, mass: 1.2 } });
                                    const currentHeight = Math.max(0, pixelHeight * grow);

                                    return (
                                        <div key={`bar-${seriesIdx}`} style={{
                                            position: 'relative',
                                            width: actualBarWidth,
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            // Handle drawing up (positive) or down (negative)
                                            ...(isPositive ? {
                                                height: currentHeight,
                                                transformOrigin: 'bottom',
                                                justifyContent: 'flex-start',
                                            } : {
                                                position: 'absolute',
                                                top: 0, // anchor to the zero line (which is bottom:0 of parent)
                                                left: seriesIdx * barWidth,
                                                height: currentHeight,
                                                transformOrigin: 'top',
                                                justifyContent: 'flex-end',
                                            })
                                        }}>
                                            {/* The Bar */}
                                            <div style={{
                                                width: '100%',
                                                height: '100%',
                                                backgroundColor: seriesColors[seriesIdx % seriesColors.length],
                                                // Only round the top/bottom edges based on polarity
                                                borderTopLeftRadius: isPositive ? 4 * scale : 0,
                                                borderTopRightRadius: isPositive ? 4 * scale : 0,
                                                borderBottomLeftRadius: !isPositive ? 4 * scale : 0,
                                                borderBottomRightRadius: !isPositive ? 4 * scale : 0,
                                            }} />
                                            
                                            {/* Value Label */}
                                            <div style={{
                                                position: 'absolute',
                                                [isPositive ? 'top' : 'bottom']: -25 * scale,
                                                fontSize: 16 * scale,
                                                fontWeight: 800,
                                                fontFamily: montserratFont,
                                                color: '#111',
                                                opacity: interpolate(grow, [0.8, 1], [0, 1], { extrapolateRight: 'clamp' }),
                                            }}>
                                                {isPositive ? '' : '-'}{Math.abs(val).toLocaleString()}
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* Arrow / Percentage Highlight (drawn between last two bars) */}
                                {category.highlightPercentage && category.values.length >= 2 && (
                                    <div style={{
                                        position: 'absolute',
                                        left: (barGroupWidth / numSeries) * (numSeries - 1.5), // position between last two bars
                                        // Position above the tallest bar of the two
                                        top: -(Math.max(Math.abs(category.values[numSeries-2]), Math.abs(category.values[numSeries-1])) / range * chartHeight) - 40 * scale,
                                        opacity: interpolate(frame - (40 + catIdx * 10), [0, 10], [0, 1], { extrapolateRight: 'clamp' }),
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        zIndex: 10,
                                    }}>
                                        <div style={{
                                            fontSize: 16 * scale,
                                            fontWeight: 800,
                                            color: category.highlightColor || '#ef4444',
                                        }}>
                                            {category.highlightPercentage}
                                        </div>
                                        {/* Curved Arrow SVG */}
                                        <svg width={40 * scale} height={40 * scale} viewBox="0 0 50 50" style={{ transform: 'rotate(10deg)' }}>
                                            <path d="M10,40 Q10,10 40,10" fill="none" stroke={category.highlightColor || '#ef4444'} strokeWidth={3 * scale} strokeLinecap="round" />
                                            <polygon points="35,5 45,10 35,15" fill={category.highlightColor || '#ef4444'} />
                                        </svg>
                                    </div>
                                )}
                            </div>

                            {/* X-Axis Category Label */}
                            <div style={{
                                position: 'absolute',
                                bottom: -40 * scale,
                                width: '100%',
                                textAlign: 'center',
                                fontSize: 18 * scale,
                                fontWeight: 600,
                                color: '#374151',
                                opacity: titleOpacity,
                            }}>
                                {category.name}
                            </div>
                        </div>
                    );
                })}
            </div>
            
            {/* Bottom Accent / Border */}
            <div style={{
                position: 'absolute',
                bottom: 0, left: 0, right: 0,
                height: 10 * scale,
                background: 'linear-gradient(90deg, #ff6b57, #1b4d75, #8898a1)',
            }} />
        </AbsoluteFill>
    );
};

registerTemplate({
    tags: [],
    id: 'financial-bar-chart-01',
    name: 'Multi-Series Financial Chart',
    description: 'A robust multi-series bar chart that handles positive and negative values. Great for comparing yearly/quarterly financials.',
    category: 'data-visualization',
    durationInFrames: 180,
    fps: 30,
    component: FinancialBarChart,
    schema: financialBarChartSchema,
    defaultProps: financialBarChartSchema.parse({}),
});
