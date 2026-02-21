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

export const statGridSchema = z.object({
    title: z.string().default('Platform Scale'),
    stats: z.array(z.object({
        value: z.string(),
        label: z.string(),
    backgroundColor: z.string().default(COLORS.bg),
    })).default([
        { value: '50M+', label: 'API Requests / Day' },
        { value: '99.99%', label: 'Guaranteed Uptime' },
        { value: '<50ms', label: 'Average Latency' },
        { value: '120+', label: 'Global PoPs' },
        { value: 'Zero', label: 'Maintenance Windows' },
        { value: 'SOC2', label: 'Type II Certified' },
    ]),
    backgroundColor: z.string().default(COLORS.bg),
    textColor: z.string().default(COLORS.textPrimary),
    accentColor: z.string().default(COLORS.accent),
});

type Props = z.infer<typeof statGridSchema>;

export const StatGrid3x3: React.FC<Props> = ({
    title,
    stats,
    backgroundColor,
    textColor,
    accentColor,
}) => {
    const frame = useCurrentFrame();
    const { fps, width } = useVideoConfig();
    
    const scale = useScaleFactor();
    const backgroundControls = useResolvedBackgroundControls();
    const isPortrait = useIsPortrait();

    const titleY = spring({ frame, fps, config: { damping: 12 } });
    const titleOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

    // Grid layout
    const totalStats = stats.length;
    // Auto calculate columns based on count and aspect ratio
    const cols = isPortrait ? 2 : Math.min(3, Math.ceil(Math.sqrt(totalStats)));
    
    const paddingX = isPortrait ? 40 * scale : 120 * scale;
    const gap = isPortrait ? 20 * scale : 30 * scale;
    const availableWidth = width - (paddingX * 2);

    return (
        <AbsoluteFill style={{ background: resolveCanvasBackground(backgroundColor, backgroundControls), fontFamily: interFont, color: textColor }}>
            {/* Header */}
            <div style={{
                position: 'absolute',
                top: isPortrait ? 120 * scale : 100 * scale,
                left: 0,
                width: '100%',
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
                        color: accentColor,
                        textTransform: 'uppercase',
                    }}
                />
            </div>

            {/* Grid */}
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
                {stats.map((stat, i) => {
                    // Staggered flip-up animation
                    const delay = 15 + i * 5;
                    const pop = spring({ frame: frame - delay, fps, config: { damping: 14 } });
                    const op = interpolate(frame - delay, [0, 10], [0, 1], { extrapolateRight: 'clamp' });
                    
                    return (
                        <div key={i} style={{
                            backgroundColor: COLORS.surface,
                            border: `1px solid ${accentColor}40`,
                            borderRadius: 24 * scale,
                            padding: isPortrait ? 30 * scale : 50 * scale,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            textAlign: 'center',
                            transform: `translateY(${(1 - pop) * 50}px) scale(${interpolate(pop, [0, 1], [0.9, 1])})`,
                            opacity: op,
                            boxShadow: `0 10px 30px ${accentColor}10`,
                            position: 'relative',
                            overflow: 'hidden',
                            aspectRatio: isPortrait ? '1' : '16/9',
                        }}>
                            {/* Accent Glow */}
                            <div style={{
                                position: 'absolute',
                                top: -50 * scale,
                                left: '50%',
                                transform: 'translateX(-50%)',
                                width: 100 * scale,
                                height: 100 * scale,
                                backgroundColor: accentColor,
                                filter: `blur(${40 * scale}px)`,
                                opacity: 0.3,
                                zIndex: 0,
                            }} />

                            <div style={{
                                fontSize: (isPortrait ? 48 : 72) * scale,
                                fontWeight: 900,
                                fontFamily: interFont,
                                color: '#fff',
                                marginBottom: 16 * scale,
                                zIndex: 1,
                                letterSpacing: '-0.03em',
                            }}>
                                {stat.value}
                            </div>
                            
                            <div style={{
                                fontSize: (isPortrait ? 16 : 20) * scale,
                                fontWeight: 500,
                                color: COLORS.textSecondary,
                                zIndex: 1,
                                textTransform: 'uppercase',
                                letterSpacing: '0.1em',
                            }}>
                                {stat.label}
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
    id: 'stat-grid-3x3-01',
    name: 'Metric Grid Cards',
    description: 'A clean, modern grid of statistics cards that pop in sequentially. Great for highlighting scale.',
    category: 'data-visualization',
    durationInFrames: 150,
    fps: 30,
    component: StatGrid3x3,
    schema: statGridSchema,
    defaultProps: statGridSchema.parse({}),
});
