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

export const trustMetricsSchema = z.object({
    title: z.string().default('By The Numbers'),
    metrics: z.array(z.object({
        number: z.string(),
        label: z.string(),
        icon: z.string(),
    })).default([
        { number: '1M+', label: 'Active Users', icon: '👥' },
        { number: '99.9%', label: 'Uptime SLA', icon: '⚡' },
        { number: '24/7', label: 'Support', icon: '🎧' },
        { number: '50+', label: 'Countries', icon: '🌍' },
    ]),
    backgroundColor: z.string().default('#0f172a'),
    textColor: z.string().default('#ffffff'),
    accentColor: z.string().default('#3b82f6'),
});

type Props = z.infer<typeof trustMetricsSchema>;

export const TrustMetricsTicker: React.FC<Props> = ({
    title,
    metrics,
    backgroundColor,
    textColor,
    accentColor,
}) => {
    const frame = useCurrentFrame();
    const { fps, width } = useVideoConfig();
    
    const scale = useScaleFactor();
    const isPortrait = useIsPortrait();

    const titleY = spring({ frame, fps, config: { damping: 12 } });
    const titleOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

    const cols = isPortrait ? 2 : Math.min(4, metrics.length);
    const gap = isPortrait ? 40 * scale : 60 * scale;
    const paddingX = isPortrait ? 40 * scale : 100 * scale;
    const availableWidth = width - (paddingX * 2);

    return (
        <AbsoluteFill style={{ backgroundColor, fontFamily: interFont, color: textColor }}>
            {/* Background Accent Gradient */}
            <div style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                background: `radial-gradient(circle at 50% 50%, ${accentColor}20 0%, transparent 60%)`,
            }} />

            {/* Header */}
            <div style={{
                position: 'absolute',
                top: isPortrait ? 150 * scale : 150 * scale,
                left: paddingX,
                width: availableWidth,
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
                        color: accentColor,
                        textTransform: 'uppercase',
                    }}
                />
            </div>

            {/* Metrics Grid */}
            <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                display: 'grid',
                gridTemplateColumns: `repeat(${cols}, 1fr)`,
                gap: gap,
                width: availableWidth,
                maxWidth: 1400 * scale,
            }}>
                {metrics.map((m, i) => {
                    // Staggered pop-in animation
                    const delay = 20 + i * 8;
                    const pop = spring({ frame: frame - delay, fps, config: { damping: 12, mass: 1.2 } });
                    const op = interpolate(frame - delay, [0, 10], [0, 1], { extrapolateRight: 'clamp' });
                    
                    return (
                        <div key={i} style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            textAlign: 'center',
                            transform: `scale(${pop}) translateY(${(1 - pop) * 40}px)`,
                            opacity: op,
                            gap: 16 * scale,
                        }}>
                            <div style={{
                                fontSize: 48 * scale,
                                opacity: 0.8,
                            }}>
                                {m.icon}
                            </div>
                            
                            {/* The Big Number */}
                            <div style={{
                                fontSize: (isPortrait ? 72 : 96) * scale,
                                fontWeight: 900,
                                fontFamily: montserratFont,
                                letterSpacing: '-0.03em',
                                color: '#fff',
                                textShadow: `0 10px 30px ${accentColor}40`,
                                lineHeight: 1,
                            }}>
                                {m.number}
                            </div>
                            
                            <div style={{
                                fontSize: 24 * scale,
                                fontWeight: 600,
                                color: 'rgba(255,255,255,0.7)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.1em',
                            }}>
                                {m.label}
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
    id: 'trust-metrics-ticker-01',
    name: 'Trust Metrics Grid',
    description: 'A bold, punchy grid of stats/numbers to build instant social proof.',
    category: 'business-marketing',
    durationInFrames: 150,
    fps: 30,
    component: TrustMetricsTicker,
    schema: trustMetricsSchema,
    defaultProps: trustMetricsSchema.parse({}),
});
