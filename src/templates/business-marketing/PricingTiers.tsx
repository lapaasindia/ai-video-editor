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

export const pricingTiersSchema = z.object({
    title: z.string().default('Pricing'),
    subtitle: z.string().default('Simple, transparent pricing for everyone.'),
    tiers: z.array(z.object({
        name: z.string(),
        price: z.string(),
        period: z.string(),
        features: z.array(z.string()),
        isPopular: z.boolean().default(false),
        color: z.string(),
    backgroundColor: z.string().default(COLORS.bg),
    })).default([
        { 
            name: 'Starter', price: '$29', period: '/mo', color: '#64748b',
            features: ['1 User', '10GB Storage', 'Email Support']
        },
        { 
            name: 'Pro', price: '$99', period: '/mo', color: '#3b82f6', isPopular: true,
            features: ['5 Users', '100GB Storage', '24/7 Support', 'Analytics']
        },
        { 
            name: 'Enterprise', price: '$299', period: '/mo', color: '#10b981',
            features: ['Unlimited Users', '1TB Storage', 'Dedicated Rep', 'Custom API']
        },
    ]),
    backgroundColor: z.string().default(COLORS.bg),
    textColor: z.string().default(COLORS.textPrimary),
    cardBgColor: z.string().default(COLORS.surface),
});

type Props = z.infer<typeof pricingTiersSchema>;

export const PricingTiers: React.FC<Props> = ({
    title,
    subtitle,
    tiers,
    backgroundColor,
    textColor,
    cardBgColor,
}) => {
    const frame = useCurrentFrame();
    const { fps, width } = useVideoConfig();
    
    const scale = useScaleFactor();
    const backgroundControls = useResolvedBackgroundControls();
    const isPortrait = useIsPortrait();

    const titleY = spring({ frame, fps, config: { damping: 12 } });
    const titleOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

    // Grid layout
    const totalTiers = tiers.length;
    const cols = isPortrait ? 1 : Math.min(3, totalTiers);
    const rows = Math.ceil(totalTiers / cols);
    const paddingX = isPortrait ? 40 * scale : 120 * scale;
    const gap = isPortrait ? 20 * scale : 40 * scale;
    const availableWidth = width - (paddingX * 2);
    
    // Dynamic vertical positioning based on number of rows to prevent overflow
    // When there are more rows, we need to move the grid higher UP the screen (smaller topPos)
    const verticalOffset = rows > 1 ? -30 : -50;
    const topPos = rows > 1 ? '48%' : '50%';

    return (
        <AbsoluteFill style={{ background: resolveCanvasBackground(backgroundColor, backgroundControls), fontFamily: interFont, color: textColor }}>
            {/* Header */}
            <div style={{
                position: 'absolute',
                top: isPortrait ? 80 * scale : 60 * scale,
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
                top: topPos,
                left: '50%',
                transform: `translate(-50%, ${verticalOffset}%)`,
                display: 'grid',
                gridTemplateColumns: `repeat(${cols}, 1fr)`,
                gap: gap,
                width: availableWidth,
                maxWidth: 1400 * scale,
            }}>
                {tiers.map((tier, i) => {
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
                            flexDirection: 'column',
                            alignItems: 'center',
                            textAlign: 'center',
                            transform: `translateY(${(1 - pop) * 100}px)`,
                            opacity: op,
                            boxShadow: tier.isPopular ? `0 20px 40px ${tier.color}40` : '0 20px 40px rgba(0,0,0,0.2)',
                            borderTop: `4px solid ${tier.color}`,
                            position: 'relative',
                            overflow: 'hidden',
                        }}>
                            {tier.isPopular && (
                                <div style={{
                                    position: 'absolute',
                                    top: 16 * scale,
                                    right: -32 * scale,
                                    backgroundColor: tier.color,
                                    color: '#fff',
                                    fontSize: 12 * scale,
                                    fontWeight: 700,
                                    padding: `4px ${40 * scale}px`,
                                    transform: 'rotate(45deg)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                }}>
                                    Popular
                                </div>
                            )}

                            <div style={{
                                fontSize: (isPortrait ? 24 : 28) * scale,
                                fontWeight: 800,
                                fontFamily: interFont,
                                color: tier.color,
                                marginBottom: 16 * scale,
                            }}>
                                {tier.name}
                            </div>
                            
                            <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 30 * scale }}>
                                <span style={{ fontSize: (isPortrait ? 48 : 60) * scale, fontWeight: 900, fontFamily: interFont }}>
                                    {tier.price}
                                </span>
                                <span style={{ fontSize: 20 * scale, color: COLORS.textSecondary, marginLeft: 8 * scale }}>
                                    {tier.period}
                                </span>
                            </div>

                            <div style={{ width: '100%', height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginBottom: 30 * scale }} />

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 * scale, width: '100%', flex: 1 }}>
                                {tier.features.map((feat, j) => {
                                    const featDelay = delay + 10 + (j * 5);
                                    const featOp = interpolate(frame - featDelay, [0, 10], [0, 1], { extrapolateRight: 'clamp' });
                                    const featX = spring({ frame: frame - featDelay, fps, config: { damping: 14 } });
                                    
                                    return (
                                        <div key={j} style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 12 * scale,
                                            opacity: featOp,
                                            transform: `translateX(${(1 - featX) * -20}px)`,
                                        }}>
                                            <svg width={20 * scale} height={20 * scale} viewBox="0 0 24 24" fill="none" stroke={tier.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="20 6 9 17 4 12"></polyline>
                                            </svg>
                                            <span style={{ fontSize: 18 * scale, fontWeight: 500, color: COLORS.textPrimary }}>
                                                {feat}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>

                            <div style={{
                                marginTop: 30 * scale,
                                width: '100%',
                                padding: `${16 * scale}px 0`,
                                backgroundColor: tier.isPopular ? tier.color : 'rgba(255,255,255,0.1)',
                                borderRadius: 12 * scale,
                                textAlign: 'center',
                                fontSize: 18 * scale,
                                fontWeight: 700,
                                color: tier.isPopular ? '#fff' : tier.color,
                                transition: 'all 0.2s',
                            }}>
                                Get Started
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
    id: 'pricing-tiers-01',
    name: 'Pricing Tiers Grid',
    description: 'A responsive pricing grid that auto-adjusts based on the number of plans.',
    category: 'business-marketing',
    durationInFrames: 150,
    fps: 30,
    component: PricingTiers,
    schema: pricingTiersSchema,
    defaultProps: pricingTiersSchema.parse({}),
});
