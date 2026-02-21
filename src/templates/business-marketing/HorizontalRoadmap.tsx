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

export const horizontalRoadmapSchema = z.object({
    title: z.string().default('Product Roadmap'),
    subtitle: z.string().default('What we are building next.'),
    milestones: z.array(z.object({
        time: z.string(),
        title: z.string(),
        desc: z.string(),
        color: z.string(),
    })).default([
        { time: 'Q1', title: 'Beta Launch', desc: 'Invite-only release for early adopters.', color: '#3b82f6' },
        { time: 'Q2', title: 'Mobile App', desc: 'Native iOS and Android applications.', color: '#10b981' },
        { time: 'Q3', title: 'API Access', desc: 'Public REST API for developers.', color: '#f59e0b' },
        { time: 'Q4', title: 'Enterprise', desc: 'SSO, SLA, and dedicated support.', color: '#8b5cf6' },
    ]),
    backgroundColor: z.string().default('#0f172a'),
    textColor: z.string().default('#ffffff'),
    lineColor: z.string().default('rgba(255,255,255,0.2)'),
});

type Props = z.infer<typeof horizontalRoadmapSchema>;

export const HorizontalRoadmap: React.FC<Props> = ({
    title,
    subtitle,
    milestones,
    backgroundColor,
    textColor,
    lineColor,
}) => {
    const frame = useCurrentFrame();
    const { fps, width, height } = useVideoConfig();
    const scale = useScaleFactor();
    const isPortrait = useIsPortrait();

    const titleY = spring({ frame, fps, config: { damping: 12 } });
    const titleOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

    const totalMilestones = milestones.length;
    const paddingX = isPortrait ? 60 * scale : 120 * scale;
    const availableWidth = width - (paddingX * 2);
    
    // In landscape, we lay out horizontally. In portrait, we lay out vertically to fit.
    const flexDirection = isPortrait ? 'column' : 'row';
    const alignPoints = isPortrait ? 'flex-start' : 'center';
    const startY = isPortrait ? 300 * scale : height * 0.5;

    // Line drawing animation
    const drawProgress = spring({ frame: frame - 20, fps, config: { damping: 20, mass: 1.5 } });

    return (
        <AbsoluteFill style={{ backgroundColor, fontFamily: interFont, color: textColor }}>
            {/* Header */}
            <div style={{
                position: 'absolute',
                top: isPortrait ? 100 * scale : 100 * scale,
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
                        color: textColor,
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

            {/* Container */}
            <div style={{
                position: 'absolute',
                top: isPortrait ? startY : '50%',
                left: paddingX,
                width: availableWidth,
                height: isPortrait ? height - startY - 100 * scale : 'auto',
                display: 'flex',
                flexDirection,
                alignItems: alignPoints,
                justifyContent: 'space-between',
                transform: isPortrait ? 'none' : 'translateY(-50%)',
            }}>
                {/* Connecting Line */}
                <div style={{
                    position: 'absolute',
                    [isPortrait ? 'top' : 'left']: 0,
                    [isPortrait ? 'bottom' : 'right']: 0,
                    [isPortrait ? 'left' : 'top']: isPortrait ? 24 * scale : '50%',
                    [isPortrait ? 'width' : 'height']: 4 * scale,
                    backgroundColor: lineColor,
                    transform: isPortrait ? 'none' : 'translateY(-50%)',
                    zIndex: 0,
                }}>
                    <div style={{
                        position: 'absolute',
                        top: 0, left: 0,
                        [isPortrait ? 'height' : 'width']: `${drawProgress * 100}%`,
                        [isPortrait ? 'width' : 'height']: '100%',
                        background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
                        boxShadow: '0 0 10px rgba(59, 130, 246, 0.5)',
                    }} />
                </div>

                {/* Milestones */}
                {milestones.map((m, i) => {
                    const delay = 30 + i * 15;
                    const pop = spring({ frame: frame - delay, fps, config: { damping: 12, mass: 0.8 } });
                    const op = interpolate(frame - delay, [0, 10], [0, 1], { extrapolateRight: 'clamp' });
                    
                    // Alternating top/bottom placement in landscape
                    const isTop = !isPortrait && i % 2 === 0;

                    return (
                        <div key={i} style={{
                            position: 'relative',
                            display: 'flex',
                            flexDirection: isPortrait ? 'row' : 'column',
                            alignItems: isPortrait ? 'center' : 'center',
                            gap: 20 * scale,
                            opacity: op,
                            zIndex: 1,
                            width: isPortrait ? '100%' : (availableWidth / totalMilestones) * 0.9,
                        }}>
                            {/* Node Dot */}
                            <div style={{
                                width: 48 * scale,
                                height: 48 * scale,
                                borderRadius: '50%',
                                backgroundColor: m.color,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transform: `scale(${pop})`,
                                boxShadow: `0 0 20px ${m.color}60`,
                                flexShrink: 0,
                                zIndex: 10,
                                // If landscape and top, push node down. If bottom, push node up to center on line.
                                // It's easier to just use flexbox order
                                order: isPortrait ? 1 : (isTop ? 2 : 1),
                            }}>
                                <div style={{ width: 16 * scale, height: 16 * scale, borderRadius: '50%', backgroundColor: '#fff' }} />
                            </div>

                            {/* Content Box */}
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: isPortrait ? 'flex-start' : 'center',
                                textAlign: isPortrait ? 'left' : 'center',
                                order: isPortrait ? 2 : (isTop ? 1 : 2),
                                // Offset the box slightly from the center line in landscape
                                paddingBottom: isTop ? 40 * scale : 0,
                                paddingTop: !isTop && !isPortrait ? 40 * scale : 0,
                                transform: `translateY(${(1 - pop) * (isTop ? -20 : 20)}px)`,
                            }}>
                                <div style={{
                                    fontSize: 20 * scale,
                                    fontWeight: 800,
                                    color: m.color,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.1em',
                                    marginBottom: 8 * scale,
                                }}>
                                    {m.time}
                                </div>
                                <div style={{
                                    fontSize: 28 * scale,
                                    fontWeight: 700,
                                    fontFamily: montserratFont,
                                    color: '#fff',
                                    marginBottom: 12 * scale,
                                }}>
                                    {m.title}
                                </div>
                                <div style={{
                                    fontSize: 18 * scale,
                                    color: 'rgba(255,255,255,0.7)',
                                    lineHeight: 1.4,
                                    maxWidth: 300 * scale,
                                }}>
                                    {m.desc}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </AbsoluteFill>
    );
};

registerTemplate({
    id: 'horizontal-roadmap-01',
    name: 'Dynamic Roadmap',
    description: 'A timeline roadmap that connects milestones. Adapts layout based on device orientation.',
    category: 'dynamic-timelines',
    durationInFrames: 210,
    fps: 30,
    component: HorizontalRoadmap,
    schema: horizontalRoadmapSchema,
    defaultProps: horizontalRoadmapSchema.parse({}),
});
