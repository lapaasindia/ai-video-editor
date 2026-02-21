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

export const customerJourneySchema = z.object({
    title: z.string().default('Customer Journey Map'),
    touchpoints: z.array(z.object({
        title: z.string(),
        subtitle: z.string(),
        icon: z.string(),
    })).default([
        { title: 'Discovery', subtitle: 'Sees an ad on Instagram', icon: '📱' },
        { title: 'Consideration', subtitle: 'Reads a blog post', icon: '📖' },
        { title: 'Evaluation', subtitle: 'Compares pricing', icon: '⚖️' },
        { title: 'Purchase', subtitle: 'Signs up for Pro plan', icon: '💳' },
        { title: 'Retention', subtitle: 'Renews subscription', icon: '🔄' },
    ]),
    backgroundColor: z.string().default('#f8fafc'),
    textColor: z.string().default('#0f172a'),
    lineColor: z.string().default('#cbd5e1'),
    accentColor: z.string().default('#2563eb'),
});

type Props = z.infer<typeof customerJourneySchema>;

export const CustomerJourneyPath: React.FC<Props> = ({
    title,
    touchpoints,
    backgroundColor,
    textColor,
    lineColor,
    accentColor,
}) => {
    const frame = useCurrentFrame();
    const { fps, width, height } = useVideoConfig();
    const scale = useScaleFactor();
    const isPortrait = useIsPortrait();

    const titleY = spring({ frame, fps, config: { damping: 12 } });
    const titleOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

    const totalPoints = touchpoints.length;
    
    // Layout
    const paddingX = isPortrait ? 60 * scale : 120 * scale;
    const startY = isPortrait ? height * 0.25 : height * 0.3;
    const endY = height * 0.85;
    const pathHeight = endY - startY;
    const spacingY = pathHeight / Math.max(1, totalPoints - 1);

    // Path draw animation
    const pathDrawProgress = spring({ frame: frame - 20, fps, config: { damping: 20, mass: 2 } });
    const currentPathLength = pathDrawProgress * pathHeight;

    return (
        <AbsoluteFill style={{ backgroundColor, padding: 60 * scale, fontFamily: interFont, color: textColor }}>
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

            {/* The Path (Background Line) */}
            <div style={{
                position: 'absolute',
                top: startY,
                left: isPortrait ? paddingX : '50%',
                width: 8 * scale,
                height: pathHeight,
                backgroundColor: lineColor,
                borderRadius: 4 * scale,
                transform: 'translateX(-50%)',
            }} />

            {/* The Path (Animated Fill Line) */}
            <div style={{
                position: 'absolute',
                top: startY,
                left: isPortrait ? paddingX : '50%',
                width: 8 * scale,
                height: currentPathLength,
                backgroundColor: accentColor,
                borderRadius: 4 * scale,
                transform: 'translateX(-50%)',
                boxShadow: `0 0 20px ${accentColor}`,
            }} />

            {/* Touchpoints */}
            {touchpoints.map((point, i) => {
                const pointY = startY + (i * spacingY);
                const isLeft = i % 2 === 0;
                
                // Animate when the path reaches this point
                const reachTime = 20 + (i / Math.max(1, totalPoints - 1)) * 30; // approx frames
                const pop = spring({ frame: frame - reachTime, fps, config: { damping: 10 } });
                const opacity = interpolate(frame - reachTime, [0, 10], [0, 1], { extrapolateRight: 'clamp' });

                const dotSize = 40 * scale;

                return (
                    <div key={i} style={{
                        position: 'absolute',
                        top: pointY,
                        left: isPortrait ? paddingX : '50%',
                        transform: 'translate(-50%, -50%)',
                    }}>
                        {/* Dot */}
                        <div style={{
                            width: dotSize,
                            height: dotSize,
                            backgroundColor: frame >= reachTime ? accentColor : backgroundColor,
                            border: `${4 * scale}px solid ${frame >= reachTime ? accentColor : lineColor}`,
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 20 * scale,
                            transform: `scale(${pop})`,
                            zIndex: 10,
                            position: 'relative',
                            boxShadow: frame >= reachTime ? `0 0 20px ${accentColor}` : 'none',
                            transition: 'all 0.2s',
                        }}>
                            {frame >= reachTime && (
                                <span style={{ position: 'absolute', transform: `scale(${interpolate(pop, [0,1], [0.5, 1])})` }}>
                                    {point.icon}
                                </span>
                            )}
                        </div>

                        {/* Content Card */}
                        <div style={{
                            position: 'absolute',
                            top: '50%',
                            left: isPortrait ? dotSize : (isLeft ? -(dotSize + 400 * scale) : dotSize),
                            transform: `translateY(-50%) translateX(${(1 - pop) * (isLeft && !isPortrait ? 20 : -20)}px)`,
                            opacity,
                            width: isPortrait ? width - paddingX * 2.5 : 350 * scale,
                            backgroundColor: '#ffffff',
                            padding: 20 * scale,
                            borderRadius: 16 * scale,
                            boxShadow: '0 10px 30px rgba(0,0,0,0.05)',
                            border: `1px solid ${lineColor}`,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 8 * scale,
                            textAlign: isLeft && !isPortrait ? 'right' : 'left',
                        }}>
                            <div style={{ 
                                fontSize: 24 * scale, 
                                fontWeight: 800, 
                                color: textColor,
                                fontFamily: montserratFont
                            }}>
                                {point.title}
                            </div>
                            <div style={{ 
                                fontSize: 18 * scale, 
                                color: '#64748b',
                                lineHeight: 1.4,
                            }}>
                                {point.subtitle}
                            </div>
                        </div>
                    </div>
                );
            })}
        </AbsoluteFill>
    );
};

registerTemplate({
    id: 'customer-journey-path-01',
    name: 'Customer Journey Path',
    description: 'A step-by-step roadmap animation that dynamically draws a path through N touchpoints.',
    category: 'marketing-sales',
    durationInFrames: 180,
    fps: 30,
    component: CustomerJourneyPath,
    schema: customerJourneySchema,
    defaultProps: customerJourneySchema.parse({}),
});
