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

export const interactivePollSchema = z.object({
    title: z.string().default('What is your biggest marketing challenge?'),
    options: z.array(z.object({
        label: z.string(),
        percentage: z.number().min(0).max(100),
        color: z.string(),
    backgroundColor: z.string().default(COLORS.bg),
    })).default([
        { label: 'Generating Leads', percentage: 45, color: '#3b82f6' },
        { label: 'Content Creation', percentage: 30, color: '#10b981' },
        { label: 'Budget Constraints', percentage: 15, color: '#f59e0b' },
        { label: 'Attribution', percentage: 10, color: '#ef4444' },
    ]),
    backgroundColor: z.string().default(COLORS.bg),
    textColor: z.string().default(COLORS.textPrimary),
    barBgColor: z.string().default('rgba(255,255,255,0.1)'),
});

type Props = z.infer<typeof interactivePollSchema>;

export const InteractivePoll: React.FC<Props> = ({
    title,
    options,
    backgroundColor,
    textColor,
    barBgColor,
}) => {
    const frame = useCurrentFrame();
    const { fps, width } = useVideoConfig();
    
    const scale = useScaleFactor();
    const backgroundControls = useResolvedBackgroundControls();
    const isPortrait = useIsPortrait();

    const titleY = spring({ frame, fps, config: { damping: 12 } });
    const titleOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

    const paddingX = isPortrait ? 60 * scale : 120 * scale;
    const availableWidth = width - (paddingX * 2);
    
    // Sort options by percentage descending for better visual hierarchy
    const sortedOptions = [...options].sort((a, b) => b.percentage - a.percentage);

    return (
        <AbsoluteFill style={{ background: resolveCanvasBackground(backgroundColor, backgroundControls), fontFamily: interFont, color: textColor }}>
            {/* Header */}
            <div style={{
                position: 'absolute',
                top: isPortrait ? 150 * scale : 120 * scale,
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
                        fontSize: (isPortrait ? 64 : 72) * scale,
                        margin: 0,
                        letterSpacing: '-0.02em',
                        lineHeight: 1.2,
                    }}
                />
            </div>

            {/* Poll Options */}
            <div style={{
                position: 'absolute',
                top: isPortrait ? 350 * scale : 300 * scale,
                left: paddingX,
                width: availableWidth,
                display: 'flex',
                flexDirection: 'column',
                gap: 30 * scale,
            }}>
                {sortedOptions.map((opt, i) => {
                    // Staggered reveal
                    const delay = 30 + i * 15;
                    const pop = spring({ frame: frame - delay, fps, config: { damping: 14 } });
                    const op = interpolate(frame - delay, [0, 10], [0, 1], { extrapolateRight: 'clamp' });
                    
                    // Bar fill animation
                    const fillProgress = spring({ frame: frame - (delay + 10), fps, config: { damping: 20, mass: 1.5 } });
                    const currentPercent = fillProgress * opt.percentage;

                    return (
                        <div key={i} style={{
                            transform: `translateY(${(1 - pop) * 30}px)`,
                            opacity: op,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 12 * scale,
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                                <div style={{
                                    fontSize: 24 * scale,
                                    fontWeight: 600,
                                    color: COLORS.textPrimary,
                                }}>
                                    {opt.label}
                                </div>
                                <div style={{
                                    fontSize: 28 * scale,
                                    fontWeight: 800,
                                    fontFamily: interFont,
                                    color: opt.color,
                                }}>
                                    {Math.round(currentPercent)}%
                                </div>
                            </div>
                            
                            {/* Progress Bar Container */}
                            <div style={{
                                width: '100%',
                                height: 24 * scale,
                                backgroundColor: barBgColor,
                                borderRadius: 12 * scale,
                                overflow: 'hidden',
                                position: 'relative',
                            }}>
                                {/* Animated Fill */}
                                <div style={{
                                    position: 'absolute',
                                    top: 0, left: 0, bottom: 0,
                                    width: `${currentPercent}%`,
                                    backgroundColor: opt.color,
                                    borderRadius: 12 * scale,
                                    boxShadow: `0 0 20px ${opt.color}80`,
                                }} />
                            </div>
                        </div>
                    );
                })}
            </div>
            
            {/* Call to action at bottom */}
            <div style={{
                position: 'absolute',
                bottom: 80 * scale,
                left: 0,
                width: '100%',
                textAlign: 'center',
                opacity: interpolate(frame - 100, [0, 20], [0, 1], { extrapolateRight: 'clamp' }),
                fontSize: 24 * scale,
                fontWeight: 600,
                color: COLORS.textMuted,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
            }}>
                Vote in the comments below 👇
            </div>
        </AbsoluteFill>
    );
};

registerTemplate({
    tags: [],
    id: 'interactive-poll-01',
    name: 'Dynamic Poll Results',
    description: 'An animated bar chart showing poll results, great for engagement.',
    category: 'business-marketing',
    durationInFrames: 180,
    fps: 30,
    component: InteractivePoll,
    schema: interactivePollSchema,
    defaultProps: interactivePollSchema.parse({}),
});
