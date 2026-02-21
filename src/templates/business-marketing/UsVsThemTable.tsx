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

export const vsTableSchema = z.object({
    title: z.string().default('Why Us?'),
    competitors: z.array(z.string()).default(['Us', 'Them']),
    features: z.array(z.object({
        name: z.string(),
        values: z.array(z.boolean()), // true = check, false = X
    })).default([
        { name: 'AI-Powered Automation', values: [true, false] },
        { name: '24/7 Dedicated Support', values: [true, false] },
        { name: 'Unlimited Cloud Storage', values: [true, true] },
        { name: 'Custom API Integrations', values: [true, false] },
        { name: 'No Hidden Fees', values: [true, false] },
    ]),
    backgroundColor: z.string().default('#0f172a'),
    textColor: z.string().default('#ffffff'),
    accentColor: z.string().default('#10b981'),
});

type Props = z.infer<typeof vsTableSchema>;

export const UsVsThemTable: React.FC<Props> = ({
    title,
    competitors,
    features,
    backgroundColor,
    textColor,
    accentColor,
}) => {
    const frame = useCurrentFrame();
    const { fps, width, height } = useVideoConfig();
    const scale = useScaleFactor();
    const isPortrait = useIsPortrait();

    const titleY = spring({ frame, fps, config: { damping: 12 } });
    const titleOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

    const paddingX = isPortrait ? 40 * scale : 120 * scale;
    const availableWidth = width - (paddingX * 2);
    
    // Column widths: feature name takes 50%, remaining cols split the rest
    const featureColWidth = availableWidth * 0.4;
    const valueColWidth = (availableWidth * 0.6) / competitors.length;

    return (
        <AbsoluteFill style={{ backgroundColor, fontFamily: interFont, color: textColor }}>
            {/* Header */}
            <div style={{
                position: 'absolute',
                top: isPortrait ? 100 * scale : 80 * scale,
                left: 0,
                width: '100%',
                textAlign: 'center',
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
            </div>

            {/* Table Container */}
            <div style={{
                position: 'absolute',
                top: isPortrait ? 220 * scale : 200 * scale,
                left: paddingX,
                width: availableWidth,
                backgroundColor: 'rgba(255,255,255,0.02)',
                borderRadius: 24 * scale,
                border: '1px solid rgba(255,255,255,0.05)',
                overflow: 'hidden',
                boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            }}>
                {/* Table Header Row */}
                <div style={{
                    display: 'flex',
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    padding: `${20 * scale}px 0`,
                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                }}>
                    <div style={{ width: featureColWidth, paddingLeft: 30 * scale, fontSize: 18 * scale, fontWeight: 600, color: 'rgba(255,255,255,0.5)' }}>
                        FEATURES
                    </div>
                    {competitors.map((comp, i) => (
                        <div key={i} style={{ 
                            width: valueColWidth, 
                            textAlign: 'center', 
                            fontSize: 24 * scale, 
                            fontWeight: 800, 
                            fontFamily: montserratFont,
                            color: i === 0 ? accentColor : 'rgba(255,255,255,0.7)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                        }}>
                            {comp}
                        </div>
                    ))}
                </div>

                {/* Table Rows */}
                {features.map((feat, r) => {
                    const rowDelay = 20 + r * 10;
                    const pop = spring({ frame: frame - rowDelay, fps, config: { damping: 14 } });
                    const op = interpolate(frame - rowDelay, [0, 10], [0, 1], { extrapolateRight: 'clamp' });

                    return (
                        <div key={r} style={{
                            display: 'flex',
                            padding: `${24 * scale}px 0`,
                            borderBottom: r < features.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                            alignItems: 'center',
                            backgroundColor: r % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                            opacity: op,
                            transform: `translateY(${(1 - pop) * 20}px)`,
                        }}>
                            {/* Feature Name */}
                            <div style={{ 
                                width: featureColWidth, 
                                paddingLeft: 30 * scale, 
                                fontSize: 20 * scale, 
                                fontWeight: 500,
                                color: 'rgba(255,255,255,0.9)',
                            }}>
                                {feat.name}
                            </div>
                            
                            {/* Feature Values */}
                            {feat.values.map((val, c) => {
                                // Values pop in slightly after the row
                                const valDelay = rowDelay + 5 + c * 5;
                                const valPop = spring({ frame: frame - valDelay, fps, config: { damping: 12, mass: 0.8 } });
                                
                                return (
                                    <div key={c} style={{ 
                                        width: valueColWidth, 
                                        display: 'flex',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                    }}>
                                        <div style={{
                                            width: 40 * scale,
                                            height: 40 * scale,
                                            borderRadius: '50%',
                                            backgroundColor: val ? `${accentColor}20` : 'rgba(239, 68, 68, 0.1)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            transform: `scale(${valPop})`,
                                            boxShadow: val ? `0 0 15px ${accentColor}40` : 'none',
                                        }}>
                                            {val ? (
                                                <svg width={24 * scale} height={24 * scale} viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="20 6 9 17 4 12"></polyline>
                                                </svg>
                                            ) : (
                                                <svg width={20 * scale} height={20 * scale} viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                                </svg>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}
            </div>
            
            {/* Our Column Highlight Overlay (Drawn last to sit on top) */}
            <div style={{
                position: 'absolute',
                top: isPortrait ? 220 * scale : 200 * scale,
                left: paddingX + featureColWidth,
                width: valueColWidth,
                height: (features.length + 1) * (72 * scale), // approx height, would be exact in real DOM
                bottom: 0,
                backgroundColor: `${accentColor}05`,
                borderLeft: `2px solid ${accentColor}40`,
                borderRight: `2px solid ${accentColor}40`,
                pointerEvents: 'none',
                opacity: interpolate(frame - 20, [0, 20], [0, 1], { extrapolateRight: 'clamp' }),
                zIndex: 10, // Ensure it's on top of table rows
            }} />
        </AbsoluteFill>
    );
};

registerTemplate({
    id: 'us-vs-them-table-01',
    name: 'Dynamic Us Vs Them Table',
    description: 'A responsive comparison matrix that animates checkmarks and cross marks row by row.',
    category: 'product-features',
    durationInFrames: 180,
    fps: 30,
    component: UsVsThemTable,
    schema: vsTableSchema,
    defaultProps: vsTableSchema.parse({}),
});
