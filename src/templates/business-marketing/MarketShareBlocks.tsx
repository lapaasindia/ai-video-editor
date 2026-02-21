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

export const marketShareBlocksSchema = z.object({
    title: z.string().default('Market Dominance'),
    subtitle: z.string().default('US Search Engine Market Share'),
    shares: z.array(z.object({
        company: z.string(),
        percentage: z.number(),
        color: z.string(),
    })).default([
        { company: 'Google', percentage: 88, color: '#3b82f6' },
        { company: 'Bing', percentage: 7, color: '#10b981' },
        { company: 'Yahoo', percentage: 3, color: '#8b5cf6' },
        { company: 'Other', percentage: 2, color: '#64748b' },
    ]),
    backgroundColor: z.string().default('#0f172a'),
    textColor: z.string().default('#ffffff'),
});

type Props = z.infer<typeof marketShareBlocksSchema>;

export const MarketShareBlocks: React.FC<Props> = ({
    title,
    subtitle,
    shares,
    backgroundColor,
    textColor,
}) => {
    const frame = useCurrentFrame();
    const { fps, width, height } = useVideoConfig();
    
    const scale = useScaleFactor();
    const isPortrait = useIsPortrait();

    const titleY = spring({ frame, fps, config: { damping: 12 } });
    const titleOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

    // Treemap layout algorithm (simplified for 1D stacking since it's an array)
    // We normalize percentages to total 100 to be safe
    const totalPercentage = shares.reduce((sum, s) => sum + s.percentage, 0);
    const sortedShares = [...shares].sort((a, b) => b.percentage - a.percentage);

    const paddingX = isPortrait ? 60 * scale : 120 * scale;
    const paddingY = isPortrait ? 250 * scale : 200 * scale;
    const blockAreaWidth = width - (paddingX * 2);
    const blockAreaHeight = height - paddingY - 100 * scale;

    // We'll stack them vertically in portrait, horizontally in landscape
    const flexDirection = isPortrait ? 'column' : 'row';

    return (
        <AbsoluteFill style={{ backgroundColor, fontFamily: interFont, color: textColor }}>
            {/* Header */}
            <div style={{
                position: 'absolute',
                top: isPortrait ? 100 * scale : 80 * scale,
                left: paddingX,
                width: blockAreaWidth,
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

            {/* Treemap/Blocks Container */}
            <div style={{
                position: 'absolute',
                top: paddingY,
                left: paddingX,
                width: blockAreaWidth,
                height: blockAreaHeight,
                display: 'flex',
                flexDirection,
                gap: 8 * scale,
            }}>
                {sortedShares.map((share, i) => {
                    const normalizedPercent = (share.percentage / totalPercentage) * 100;
                    
                    // Grow animation
                    const delay = 20 + i * 15;
                    const grow = spring({ frame: frame - delay, fps, config: { damping: 14 } });
                    
                    
                    // For very small segments, hide text if it doesn't fit
                    const isTooSmall = normalizedPercent < 10;

                    return (
                        <div key={i} style={{
                            // Animate flex-basis to make them grow into their final size
                            flexBasis: `${grow * normalizedPercent}%`,
                            height: '100%',
                            backgroundColor: share.color,
                            borderRadius: 16 * scale,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative',
                            overflow: 'hidden',
                            boxShadow: 'inset 0 0 20px rgba(0,0,0,0.2)',
                            transition: 'opacity 0.2s',
                            opacity: grow > 0.1 ? 1 : 0,
                        }}>
                            {/* Texture overlay */}
                            <div style={{
                                position: 'absolute',
                                top: 0, left: 0, right: 0, bottom: 0,
                                background: 'linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 100%)',
                                zIndex: 0,
                            }} />

                            {!isTooSmall && grow > 0.5 && (
                                <div style={{
                                    zIndex: 1,
                                    textAlign: 'center',
                                    padding: 10 * scale,
                                }}>
                                    <div style={{
                                        fontSize: (isPortrait ? 48 : 64) * scale,
                                        fontWeight: 900,
                                        fontFamily: montserratFont,
                                        color: '#fff',
                                        textShadow: '0 4px 10px rgba(0,0,0,0.3)',
                                    }}>
                                        {share.percentage}%
                                    </div>
                                    <div style={{
                                        fontSize: (isPortrait ? 20 : 28) * scale,
                                        fontWeight: 700,
                                        color: 'rgba(255,255,255,0.9)',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em',
                                    }}>
                                        {share.company}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
            
            {/* Small Legend for items that were too small to fit text */}
            <div style={{
                position: 'absolute',
                bottom: 40 * scale,
                left: paddingX,
                width: blockAreaWidth,
                display: 'flex',
                justifyContent: 'center',
                flexWrap: 'wrap',
                gap: 20 * scale,
                opacity: interpolate(frame - 100, [0, 10], [0, 1], { extrapolateRight: 'clamp' }),
            }}>
                {sortedShares.filter(s => (s.percentage / totalPercentage) * 100 < 10).map((share, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 * scale }}>
                        <div style={{ width: 16 * scale, height: 16 * scale, borderRadius: '50%', backgroundColor: share.color }} />
                        <div style={{ fontSize: 16 * scale, color: 'rgba(255,255,255,0.7)' }}>
                            {share.company} ({share.percentage}%)
                        </div>
                    </div>
                ))}
            </div>
        </AbsoluteFill>
    );
};

registerTemplate({
    tags: [],
    id: 'market-share-blocks-01',
    name: 'Market Share Blocks',
    description: 'A stacked block diagram showing proportional data, great for market share or demographics.',
    category: 'data-visualization',
    durationInFrames: 180,
    fps: 30,
    component: MarketShareBlocks,
    schema: marketShareBlocksSchema,
    defaultProps: marketShareBlocksSchema.parse({}),
});
