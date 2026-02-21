import React from 'react';
import {
    AbsoluteFill,
    useCurrentFrame,
    useVideoConfig,
    interpolate,
    spring,
    Sequence,
} from 'remotion';
import { z } from 'zod';
import { useIsPortrait, useScaleFactor } from '../../lib/responsive';
import { EditableText } from '../../components/EditableText';
import { registerTemplate } from '../registry';
import { interFont, montserratFont } from '../../lib/fonts';

export const dynamicSalesFunnelSchema = z.object({
    title: z.string().default('Sales Funnel Breakdown'),
    subtitle: z.string().default('How we convert cold traffic into loyal customers'),
    stages: z.array(z.object({
        label: z.string(),
        value: z.string(),
        color: z.string(),
    })).default([
        { label: 'Awareness', value: '100k', color: '#3b82f6' },
        { label: 'Interest', value: '25k', color: '#8b5cf6' },
        { label: 'Decision', value: '5k', color: '#a855f7' },
        { label: 'Action', value: '1k', color: '#d946ef' },
    ]),
    backgroundColor: z.string().default('#0f172a'),
    textColor: z.string().default('#ffffff'),
});

type Props = z.infer<typeof dynamicSalesFunnelSchema>;

export const DynamicSalesFunnel: React.FC<Props> = ({
    title,
    subtitle,
    stages,
    backgroundColor,
    textColor,
}) => {
    const frame = useCurrentFrame();
    const { fps, width, height } = useVideoConfig();
    const scale = useScaleFactor();
    const isPortrait = useIsPortrait();

    const titleY = spring({ frame, fps, config: { damping: 12 } });
    const titleOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

    const totalStages = stages.length;
    const maxTopWidth = isPortrait ? width * 0.8 : width * 0.5;
    const minBottomWidth = isPortrait ? width * 0.3 : width * 0.15;
    
    // Total height allocated for the funnel
    const funnelHeight = isPortrait ? height * 0.5 : height * 0.6;
    const stageHeight = funnelHeight / totalStages;
    const gap = 10 * scale;

    return (
        <AbsoluteFill style={{ backgroundColor, padding: 60 * scale, fontFamily: interFont, color: textColor }}>
            {/* Header */}
            <div style={{
                position: 'absolute',
                top: isPortrait ? 100 * scale : 80 * scale,
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
                <EditableText
                    text={subtitle}
                    style={{
                        fontSize: (isPortrait ? 30 : 36) * scale,
                        opacity: 0.7,
                        marginTop: 20 * scale,
                    }}
                />
            </div>

            {/* Funnel Container */}
            <div style={{
                position: 'absolute',
                top: isPortrait ? height * 0.3 : height * 0.25,
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: gap,
            }}>
                {stages.map((stage, i) => {
                    // Animation: each stage drops in sequentially
                    const delay = 15 + i * 10;
                    const stageY = spring({ frame: frame - delay, fps, config: { damping: 12 } });
                    const stageOpacity = interpolate(frame - delay, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

                    // Calculate width for this trapezoid tier
                    // Top width is wider, bottom width is narrower
                    const t = i / Math.max(1, totalStages - 1);
                    const currentWidth = maxTopWidth - (maxTopWidth - minBottomWidth) * t;

                    return (
                        <div
                            key={i}
                            style={{
                                width: currentWidth,
                                height: stageHeight - gap,
                                backgroundColor: stage.color,
                                borderRadius: 12 * scale,
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: `0 ${30 * scale}px`,
                                transform: `translateY(${(1 - stageY) * -30}px) scale(${interpolate(stageY, [0, 1], [0.95, 1])})`,
                                opacity: stageOpacity,
                                boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
                                // Create a slight 3D perspective / trapezoid illusion using clip-path or perspective
                                // A simple rounded rect looks cleaner and more modern, but we can fake depth
                                borderTop: '2px solid rgba(255,255,255,0.2)',
                                overflow: 'hidden',
                                position: 'relative',
                            }}
                        >
                            <div style={{ 
                                position: 'absolute', 
                                top: 0, left: 0, right: 0, bottom: 0,
                                background: 'linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 50%, rgba(0,0,0,0.2) 100%)',
                                zIndex: 0
                            }} />

                            <span style={{ 
                                fontSize: Math.max(20, (currentWidth * 0.05)) * scale, 
                                fontWeight: 700, 
                                zIndex: 1,
                                textShadow: '0 2px 4px rgba(0,0,0,0.5)'
                            }}>
                                {stage.label}
                            </span>
                            <span style={{ 
                                fontSize: Math.max(24, (currentWidth * 0.06)) * scale, 
                                fontWeight: 900, 
                                zIndex: 1,
                                backgroundColor: 'rgba(0,0,0,0.2)',
                                padding: `${8 * scale}px ${16 * scale}px`,
                                borderRadius: 20 * scale,
                                textShadow: '0 2px 4px rgba(0,0,0,0.5)'
                            }}>
                                {stage.value}
                            </span>
                        </div>
                    );
                })}
            </div>
        </AbsoluteFill>
    );
};

registerTemplate({
    id: 'dynamic-sales-funnel-01',
    name: 'Dynamic Sales Funnel',
    description: 'A stacked, inverted pyramid funnel that dynamically adjusts to the number of stages provided.',
    category: 'marketing-sales',
    durationInFrames: 150,
    fps: 30,
    component: DynamicSalesFunnel,
    schema: dynamicSalesFunnelSchema,
    defaultProps: dynamicSalesFunnelSchema.parse({}),
});
