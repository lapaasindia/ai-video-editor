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

export const featureListPopupsSchema = z.object({
    title: z.string().default('Core Features'),
    features: z.array(z.object({
        title: z.string(),
        desc: z.string(),
        icon: z.string(),
    })).default([
        { title: 'Lightning Fast', desc: 'Render times up to 10x faster than competitors.', icon: '⚡' },
        { title: 'AI-Powered', desc: 'Smart algorithms do the heavy lifting for you.', icon: '🧠' },
        { title: 'Cloud Sync', desc: 'Access your projects from any device, anywhere.', icon: '☁️' },
        { title: 'Team Collaboration', desc: 'Work together in real-time without conflicts.', icon: '🤝' },
    ]),
    backgroundColor: z.string().default('#0f172a'),
    textColor: z.string().default('#ffffff'),
    cardBgColor: z.string().default('#1e293b'),
    accentColor: z.string().default('#a855f7'),
});

type Props = z.infer<typeof featureListPopupsSchema>;

export const FeatureListPopups: React.FC<Props> = ({
    title,
    features,
    backgroundColor,
    textColor,
    cardBgColor,
    accentColor,
}) => {
    const frame = useCurrentFrame();
    const { fps, width } = useVideoConfig();
    
    const scale = useScaleFactor();
    const isPortrait = useIsPortrait();

    const titleY = spring({ frame, fps, config: { damping: 12 } });
    const titleOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

    const totalFeatures = features.length;
    // Auto layout: 1 col for portrait, up to 2 cols for landscape
    const cols = isPortrait ? 1 : Math.min(2, totalFeatures);
    const gap = 30 * scale;
    const paddingX = isPortrait ? 60 * scale : 120 * scale;
    const availableWidth = width - (paddingX * 2);

    return (
        <AbsoluteFill style={{ backgroundColor, fontFamily: interFont, color: textColor }}>
            {/* Header */}
            <div style={{
                position: 'absolute',
                top: isPortrait ? 120 * scale : 100 * scale,
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
                <div style={{
                    width: 100 * scale,
                    height: 8 * scale,
                    backgroundColor: accentColor,
                    marginTop: 20 * scale,
                    borderRadius: 4 * scale,
                    margin: isPortrait ? '20px auto 0' : '20px 0 0',
                }} />
            </div>

            {/* Features Grid */}
            <div style={{
                position: 'absolute',
                top: isPortrait ? 250 * scale : 220 * scale,
                left: paddingX,
                width: availableWidth,
                display: 'grid',
                gridTemplateColumns: `repeat(${cols}, 1fr)`,
                gap: gap,
            }}>
                {features.map((feat, i) => {
                    const delay = 20 + i * 10;
                    
                    // Slide up and fade in
                    const yOffset = spring({ frame: frame - delay, fps, config: { damping: 14 } });
                    const op = interpolate(frame - delay, [0, 10], [0, 1], { extrapolateRight: 'clamp' });
                    
                    // Hover effect (simulated on loop or fixed)
                    const hoverScale = interpolate(
                        spring({ frame: frame - delay - 30, fps, config: { damping: 12 } }),
                        [0, 1], [1, 1.02]
                    );

                    return (
                        <div key={i} style={{
                            backgroundColor: cardBgColor,
                            borderRadius: 20 * scale,
                            padding: 30 * scale,
                            transform: `translateY(${(1 - yOffset) * 50}px) scale(${hoverScale})`,
                            opacity: op,
                            boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
                            border: '1px solid rgba(255,255,255,0.05)',
                            display: 'flex',
                            gap: 24 * scale,
                            alignItems: 'flex-start',
                        }}>
                            {/* Icon Box */}
                            <div style={{
                                width: 64 * scale,
                                height: 64 * scale,
                                backgroundColor: `${accentColor}20`,
                                borderRadius: 16 * scale,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 32 * scale,
                                color: accentColor,
                                flexShrink: 0,
                                border: `1px solid ${accentColor}40`,
                            }}>
                                {feat.icon}
                            </div>
                            
                            {/* Text */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 * scale }}>
                                <div style={{
                                    fontSize: 24 * scale,
                                    fontWeight: 700,
                                    fontFamily: montserratFont,
                                    color: '#fff',
                                    letterSpacing: '0.01em',
                                }}>
                                    {feat.title}
                                </div>
                                <div style={{
                                    fontSize: 18 * scale,
                                    color: 'rgba(255,255,255,0.7)',
                                    lineHeight: 1.5,
                                }}>
                                    {feat.desc}
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
    tags: [],
    id: 'feature-list-popups-01',
    name: 'Dynamic Feature Popups',
    description: 'A clean grid of feature cards that sequentially slide up and fade in.',
    category: 'business-marketing',
    durationInFrames: 150,
    fps: 30,
    component: FeatureListPopups,
    schema: featureListPopupsSchema,
    defaultProps: featureListPopupsSchema.parse({}),
});
