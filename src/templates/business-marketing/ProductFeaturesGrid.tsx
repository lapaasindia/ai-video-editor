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

export const productFeaturesGridSchema = z.object({
    title: z.string().default('Why Choose Us'),
    subtitle: z.string().default('Everything you need to scale your business.'),
    features: z.array(z.object({
        title: z.string(),
        desc: z.string(),
        iconUrl: z.string(),
        color: z.string(),
    })).default([
        { title: 'Global Reach', desc: 'Deploy to 120+ edge locations instantly.', iconUrl: 'https://cdn-icons-png.flaticon.com/512/888/888879.png', color: '#3b82f6' },
        { title: 'Zero Downtime', desc: 'Our architecture ensures you never go offline.', iconUrl: 'https://cdn-icons-png.flaticon.com/512/888/888885.png', color: '#10b981' },
        { title: 'Auto Scaling', desc: 'Handles sudden traffic spikes without breaking a sweat.', iconUrl: 'https://cdn-icons-png.flaticon.com/512/888/888891.png', color: '#f59e0b' },
        { title: 'Ironclad Security', desc: 'Enterprise-grade encryption for all your data.', iconUrl: 'https://cdn-icons-png.flaticon.com/512/888/888898.png', color: '#ef4444' },
    ]),
    backgroundColor: z.string().default('#0f172a'),
    textColor: z.string().default('#ffffff'),
    cardBgColor: z.string().default('#1e293b'),
});

type Props = z.infer<typeof productFeaturesGridSchema>;

export const ProductFeaturesGrid: React.FC<Props> = ({
    title,
    subtitle,
    features,
    backgroundColor,
    textColor,
    cardBgColor,
}) => {
    const frame = useCurrentFrame();
    const { fps, width, height } = useVideoConfig();
    const scale = useScaleFactor();
    const isPortrait = useIsPortrait();

    const titleY = spring({ frame, fps, config: { damping: 12 } });
    const titleOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

    // Grid layout
    const totalFeatures = features.length;
    // Auto calculate columns based on count and aspect ratio
    const cols = isPortrait ? 1 : Math.min(2, Math.ceil(Math.sqrt(totalFeatures)));
    
    const paddingX = isPortrait ? 40 * scale : 120 * scale;
    const gap = isPortrait ? 20 * scale : 40 * scale;
    const availableWidth = width - (paddingX * 2);

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

            {/* Grid */}
            <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -40%)',
                display: 'grid',
                gridTemplateColumns: `repeat(${cols}, 1fr)`,
                gap: gap,
                width: availableWidth,
                maxWidth: 1400 * scale,
            }}>
                {features.map((feature, i) => {
                    // Staggered slide up
                    const delay = 15 + i * 5;
                    const pop = spring({ frame: frame - delay, fps, config: { damping: 14 } });
                    const op = interpolate(frame - delay, [0, 10], [0, 1], { extrapolateRight: 'clamp' });
                    
                    return (
                        <div key={i} style={{
                            backgroundColor: cardBgColor,
                            borderRadius: 24 * scale,
                            padding: isPortrait ? 24 * scale : 40 * scale,
                            display: 'flex',
                            alignItems: 'center',
                            textAlign: 'left',
                            transform: `translateY(${(1 - pop) * 100}px)`,
                            opacity: op,
                            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
                            borderLeft: `4px solid ${feature.color}`,
                            position: 'relative',
                            overflow: 'hidden',
                            gap: 24 * scale,
                        }}>
                            {/* Icon */}
                            <div style={{
                                width: (isPortrait ? 60 : 80) * scale,
                                height: (isPortrait ? 60 : 80) * scale,
                                borderRadius: '50%',
                                backgroundColor: `${feature.color}20`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                padding: 16 * scale,
                            }}>
                                <Img 
                                    src={feature.iconUrl} 
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'contain',
                                        // A trick to colorize black PNGs in Remotion (or just use colored ones)
                                        // filter: `drop-shadow(0 0 0 ${feature.color})`,
                                    }}
                                />
                            </div>

                            <div style={{ flex: 1 }}>
                                <div style={{
                                    fontSize: (isPortrait ? 24 : 28) * scale,
                                    fontWeight: 800,
                                    fontFamily: montserratFont,
                                    color: '#fff',
                                    marginBottom: 8 * scale,
                                }}>
                                    {feature.title}
                                </div>
                                
                                <div style={{
                                    fontSize: (isPortrait ? 16 : 18) * scale,
                                    color: 'rgba(255,255,255,0.7)',
                                    lineHeight: 1.4,
                                }}>
                                    {feature.desc}
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
    id: 'product-features-grid-01',
    name: 'Product Features Grid',
    description: 'A clean, responsive grid highlighting core features with icons and descriptions.',
    category: 'product-features',
    durationInFrames: 150,
    fps: 30,
    component: ProductFeaturesGrid,
    schema: productFeaturesGridSchema,
    defaultProps: productFeaturesGridSchema.parse({}),
});
