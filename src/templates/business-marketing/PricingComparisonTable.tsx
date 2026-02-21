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

export const pricingComparisonSchema = z.object({
    title: z.string().default('Choose Your Plan'),
    plans: z.array(z.object({
        name: z.string(),
        price: z.string(),
        period: z.string(),
        features: z.array(z.string()),
        isPopular: z.boolean().default(false),
        color: z.string(),
    })).default([
        { 
            name: 'Basic', price: '$29', period: '/mo', color: '#64748b',
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
    backgroundColor: z.string().default('#0f172a'),
    textColor: z.string().default('#ffffff'),
    cardBgColor: z.string().default('#1e293b'),
});

type Props = z.infer<typeof pricingComparisonSchema>;

export const PricingComparisonTable: React.FC<Props> = ({
    title,
    plans,
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

    // Layout math
    const totalPlans = plans.length;
    const gap = 40 * scale;
    const paddingX = isPortrait ? 60 * scale : 120 * scale;
    
    // Calculate card width dynamically based on how many plans there are
    const availableWidth = width - (paddingX * 2);
    const cardWidth = isPortrait 
        ? availableWidth // Stack vertically in portrait
        : (availableWidth - (gap * (totalPlans - 1))) / totalPlans;
    
    const cardHeight = isPortrait ? (height * 0.7) / totalPlans : height * 0.6;
    const startY = isPortrait ? height * 0.2 : height * 0.25;

    return (
        <AbsoluteFill style={{ backgroundColor, fontFamily: interFont, color: textColor }}>
            {/* Header */}
            <div style={{
                position: 'absolute',
                top: isPortrait ? 80 * scale : 80 * scale,
                left: 0,
                width: '100%',
                textAlign: 'center',
                transform: `translateY(${(1 - titleY) * -50}px)`,
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

            {/* Plans Container */}
            <div style={{
                position: 'absolute',
                top: startY,
                left: paddingX,
                width: availableWidth,
                display: 'flex',
                flexDirection: isPortrait ? 'column' : 'row',
                justifyContent: 'center',
                alignItems: isPortrait ? 'center' : 'stretch',
                gap: gap,
            }}>
                {plans.map((plan, i) => {
                    const delay = 15 + i * 15;
                    const pop = spring({ frame: frame - delay, fps, config: { damping: 12, mass: 1.2 } });
                    
                    const isPopular = plan.isPopular;
                    const popularScale = isPopular && !isPortrait ? 1.05 : 1;
                    
                    return (
                        <div key={i} style={{
                            width: isPortrait ? '100%' : cardWidth,
                            height: isPortrait ? 'auto' : cardHeight,
                            backgroundColor: cardBgColor,
                            borderRadius: 24 * scale,
                            padding: isPortrait ? 30 * scale : 40 * scale,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            transform: `scale(${pop * popularScale}) translateY(${(1 - pop) * 50}px)`,
                            opacity: interpolate(frame - delay, [0, 10], [0, 1], { extrapolateRight: 'clamp' }),
                            boxShadow: isPopular ? `0 20px 40px ${plan.color}40` : '0 10px 30px rgba(0,0,0,0.2)',
                            border: isPopular ? `2px solid ${plan.color}` : '1px solid rgba(255,255,255,0.1)',
                            position: 'relative',
                        }}>
                            {/* Popular Badge */}
                            {isPopular && (
                                <div style={{
                                    position: 'absolute',
                                    top: -16 * scale,
                                    backgroundColor: plan.color,
                                    color: '#fff',
                                    padding: `${6 * scale}px ${16 * scale}px`,
                                    borderRadius: 20 * scale,
                                    fontSize: 14 * scale,
                                    fontWeight: 800,
                                    letterSpacing: '0.05em',
                                    textTransform: 'uppercase',
                                }}>
                                    MOST POPULAR
                                </div>
                            )}

                            {/* Plan Header */}
                            <div style={{ 
                                fontSize: 24 * scale, 
                                fontWeight: 700, 
                                color: plan.color,
                                marginBottom: 16 * scale,
                                textTransform: 'uppercase',
                                letterSpacing: '0.1em',
                            }}>
                                {plan.name}
                            </div>
                            
                            <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 30 * scale }}>
                                <span style={{ fontSize: (isPortrait ? 48 : 60) * scale, fontWeight: 900, fontFamily: montserratFont }}>
                                    {plan.price}
                                </span>
                                <span style={{ fontSize: 20 * scale, color: 'rgba(255,255,255,0.6)', marginLeft: 8 * scale }}>
                                    {plan.period}
                                </span>
                            </div>

                            <div style={{ width: '100%', height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginBottom: 30 * scale }} />

                            {/* Features List */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 * scale, width: '100%', flex: 1 }}>
                                {plan.features.map((feat, j) => {
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
                                            <svg width={20 * scale} height={20 * scale} viewBox="0 0 24 24" fill="none" stroke={plan.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="20 6 9 17 4 12"></polyline>
                                            </svg>
                                            <span style={{ fontSize: 18 * scale, fontWeight: 500, color: 'rgba(255,255,255,0.9)' }}>
                                                {feat}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* CTA Button */}
                            <div style={{
                                marginTop: 30 * scale,
                                width: '100%',
                                padding: `${16 * scale}px 0`,
                                backgroundColor: isPopular ? plan.color : 'rgba(255,255,255,0.1)',
                                borderRadius: 12 * scale,
                                textAlign: 'center',
                                fontSize: 18 * scale,
                                fontWeight: 700,
                                color: isPopular ? '#fff' : plan.color,
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
    id: 'pricing-comparison-01',
    name: 'Pricing Comparison Table',
    description: 'A responsive pricing tier graphic. Add as many plans as you need and it will auto-layout.',
    category: 'marketing-sales',
    durationInFrames: 210,
    fps: 30,
    component: PricingComparisonTable,
    schema: pricingComparisonSchema,
    defaultProps: pricingComparisonSchema.parse({}),
});
