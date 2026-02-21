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

export const verticalTimelineSchema = z.object({
    title: z.string().default('Company History'),
    events: z.array(z.object({
        date: z.string(),
        title: z.string(),
        desc: z.string(),
    backgroundColor: z.string().default(COLORS.bg),
    })).default([
        { date: '2020', title: 'Founded', desc: 'Started in a small garage in San Francisco.' },
        { date: '2021', title: 'Seed Funding', desc: 'Raised $2M to build the MVP.' },
        { date: '2022', title: 'Launch', desc: 'Released to the public with 10k waitlist.' },
        { date: '2023', title: 'Series A', desc: 'Raised $15M to scale the team globally.' },
        { date: '2024', title: '1M Users', desc: 'Crossed the 1 million active users milestone.' },
    ]),
    backgroundColor: z.string().default(COLORS.bg),
    textColor: z.string().default(COLORS.textPrimary),
    primaryColor: z.string().default('#f43f5e'),
});

type Props = z.infer<typeof verticalTimelineSchema>;

export const VerticalTimeline: React.FC<Props> = ({
    title,
    events,
    backgroundColor,
    textColor,
    primaryColor,
}) => {
    const frame = useCurrentFrame();
    const { fps, width, height } = useVideoConfig();
    
    const scale = useScaleFactor();
    const backgroundControls = useResolvedBackgroundControls();
    const isPortrait = useIsPortrait();

    const titleY = spring({ frame, fps, config: { damping: 12 } });
    const titleOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

    const totalEvents = events.length;
    const paddingX = isPortrait ? 60 * scale : 120 * scale;
    const availableWidth = width - (paddingX * 2);
    
    // Vertical layout
    const startY = isPortrait ? height * 0.25 : height * 0.3;
    const endY = height * 0.85;
    const pathHeight = endY - startY;
    const spacingY = pathHeight / Math.max(1, totalEvents - 1);

    // Line draw animation
        const lineProgress = spring({ frame: frame - 20, fps, config: { damping: 20, mass: 2 } });
    const currentLineHeight = lineProgress * pathHeight;

    return (
        <AbsoluteFill style={{ background: resolveCanvasBackground(backgroundColor, backgroundControls), fontFamily: interFont, color: textColor }}>
            {/* Header */}
            <div style={{
                position: 'absolute',
                top: isPortrait ? 100 * scale : 100 * scale,
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
            </div>

            {/* The Vertical Line (Background) */}
            <div style={{
                position: 'absolute',
                top: startY,
                left: isPortrait ? paddingX + 40 * scale : '50%',
                width: 6 * scale,
                height: pathHeight,
                backgroundColor: 'rgba(255,255,255,0.1)',
                borderRadius: 3 * scale,
                transform: 'translateX(-50%)',
                zIndex: 0,
            }} />

            {/* The Vertical Line (Animated Fill) */}
            <div style={{
                position: 'absolute',
                top: startY,
                left: isPortrait ? paddingX + 40 * scale : '50%',
                width: 6 * scale,
                height: currentLineHeight,
                backgroundColor: primaryColor,
                borderRadius: 3 * scale,
                transform: 'translateX(-50%)',
                boxShadow: `0 0 15px ${primaryColor}80`,
                zIndex: 1,
            }} />

            {/* Timeline Nodes */}
            {events.map((event, i) => {
                const nodeY = startY + (i * spacingY);
                // Alternating left/right in landscape, all right in portrait
                const isLeft = !isPortrait && i % 2 === 0;
                
                // Animate when the line reaches this node
                const reachTime = 20 + (i / Math.max(1, totalEvents - 1)) * 40; // approx frames based on line speed
                const pop = spring({ frame: frame - reachTime, fps, config: { damping: 10 } });
                const opacity = interpolate(frame - reachTime, [0, 10], [0, 1], { extrapolateRight: 'clamp' });

                const dotSize = 32 * scale;
                const cardWidth = isPortrait ? availableWidth - (dotSize + 40 * scale) : 400 * scale;

                return (
                    <div key={i} style={{
                        position: 'absolute',
                        top: nodeY,
                        left: isPortrait ? paddingX + 40 * scale : '50%',
                        transform: 'translate(-50%, -50%)',
                        zIndex: 2,
                    }}>
                        {/* Dot */}
                        <div style={{
                            width: dotSize,
                            height: dotSize,
                            backgroundColor: frame >= reachTime ? primaryColor : backgroundColor,
                            border: `${4 * scale}px solid ${frame >= reachTime ? primaryColor : 'rgba(255,255,255,0.3)'}`,
                            borderRadius: '50%',
                            transform: `scale(${pop || 1})`, // stay 1 if before pop, then pop
                            transition: 'background-color 0.2s, border-color 0.2s',
                            boxShadow: frame >= reachTime ? `0 0 20px ${primaryColor}` : 'none',
                            position: 'relative',
                        }} />

                        {/* Event Card */}
                        <div style={{
                            position: 'absolute',
                            top: '50%',
                            // If portrait, push everything right. If landscape, push left or right.
                            left: isPortrait ? dotSize + 20 * scale : (isLeft ? -(dotSize / 2 + cardWidth + 40 * scale) : dotSize / 2 + 40 * scale),
                            transform: `translateY(-50%) translateX(${(1 - pop) * (isLeft ? 20 : -20)}px)`,
                            opacity,
                            width: cardWidth,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 8 * scale,
                            textAlign: isLeft ? 'right' : 'left',
                        }}>
                            {/* Connecting Dash (landscape only) */}
                            {!isPortrait && (
                                <div style={{
                                    position: 'absolute',
                                    top: '50%',
                                    [isLeft ? 'right' : 'left']: -(40 * scale),
                                    width: 30 * scale,
                                    height: 2 * scale,
                                    backgroundColor: primaryColor,
                                    transform: 'translateY(-50%)',
                                    opacity: 0.5,
                                }} />
                            )}

                            <div style={{ 
                                fontSize: 20 * scale, 
                                fontWeight: 800, 
                                color: primaryColor,
                                fontFamily: interFont,
                                letterSpacing: '0.1em',
                            }}>
                                {event.date}
                            </div>
                            <div style={{ 
                                fontSize: 28 * scale, 
                                fontWeight: 700, 
                                color: textColor,
                                fontFamily: interFont
                            }}>
                                {event.title}
                            </div>
                            <div style={{ 
                                fontSize: 18 * scale, 
                                color: COLORS.textSecondary,
                                lineHeight: 1.4,
                            }}>
                                {event.desc}
                            </div>
                        </div>
                    </div>
                );
            })}
        </AbsoluteFill>
    );
};

registerTemplate({
    tags: [],
    id: 'vertical-timeline-01',
    name: 'Dynamic Vertical Timeline',
    description: 'A scrolling history timeline that draws a line downwards connecting N events.',
    category: 'business-marketing',
    durationInFrames: 210,
    fps: 30,
    component: VerticalTimeline,
    schema: verticalTimelineSchema,
    defaultProps: verticalTimelineSchema.parse({}),
});
