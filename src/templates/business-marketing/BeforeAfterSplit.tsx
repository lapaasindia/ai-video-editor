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

export const beforeAfterSplitSchema = z.object({
    title: z.string().default('The Transformation'),
    beforeLabel: z.string().default('Before'),
    afterLabel: z.string().default('After'),
    beforeItems: z.array(z.string()).default([
        'Manual data entry',
        'Siloed communication',
        'Unpredictable revenue',
        'High churn rate',
    ]),
    afterItems: z.array(z.string()).default([
        'Automated workflows',
        'Unified team inbox',
        'Predictable MRR',
        '95% retention rate',
    ]),
    backgroundColor: z.string().default('#0f172a'),
    textColor: z.string().default('#ffffff'),
    beforeColor: z.string().default('#ef4444'),
    afterColor: z.string().default('#10b981'),
});

type Props = z.infer<typeof beforeAfterSplitSchema>;

export const BeforeAfterSplit: React.FC<Props> = ({
    title,
    beforeLabel,
    afterLabel,
    beforeItems,
    afterItems,
    backgroundColor,
    textColor,
    beforeColor,
    afterColor,
}) => {
    const frame = useCurrentFrame();
    const { fps, width, height } = useVideoConfig();
    
    const scale = useScaleFactor();
    const isPortrait = useIsPortrait();

    const titleY = spring({ frame, fps, config: { damping: 12 } });
    const titleOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

    // Slider animation
    const sliderProgress = spring({ frame: frame - 40, fps, config: { damping: 16, mass: 1.5 } }); // 0 to 1
    // We start with Before taking 90%, then sliding to 50%
    const splitPercent = interpolate(sliderProgress, [0, 1], [95, 50], { extrapolateRight: 'clamp' });

    const paddingX = isPortrait ? 60 * scale : 120 * scale;
    const availableWidth = width - (paddingX * 2);
    
    // We will lay this out vertically in portrait, and horizontally in landscape
    const flexDirection = isPortrait ? 'column' : 'row';

    return (
        <AbsoluteFill style={{ backgroundColor, fontFamily: interFont, color: textColor }}>
            {/* Header */}
            <div style={{
                position: 'absolute',
                top: isPortrait ? 100 * scale : 80 * scale,
                left: paddingX,
                width: availableWidth,
                textAlign: 'center',
                transform: `translateY(${(1 - titleY) * -30}px)`,
                opacity: titleOpacity,
                zIndex: 10,
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
            </div>

            {/* Split Container */}
            <div style={{
                position: 'absolute',
                top: isPortrait ? 250 * scale : 200 * scale,
                left: paddingX,
                width: availableWidth,
                height: isPortrait ? height * 0.6 : height * 0.65,
                borderRadius: 24 * scale,
                overflow: 'hidden',
                display: 'flex',
                flexDirection,
                boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
                border: '2px solid rgba(255,255,255,0.1)',
            }}>
                {/* BEFORE SIDE */}
                <div style={{
                    [isPortrait ? 'height' : 'width']: `${splitPercent}%`,
                    [isPortrait ? 'width' : 'height']: '100%',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    position: 'relative',
                    borderRight: isPortrait ? 'none' : `4px solid ${textColor}`,
                    borderBottom: isPortrait ? `4px solid ${textColor}` : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    padding: 40 * scale,
                    overflow: 'hidden',
                }}>
                    <div style={{ 
                        fontSize: 32 * scale, 
                        fontWeight: 800, 
                        color: beforeColor, 
                        fontFamily: montserratFont,
                        marginBottom: 30 * scale,
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                    }}>
                        {beforeLabel}
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 * scale }}>
                        {beforeItems.map((item, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16 * scale }}>
                                <div style={{ color: beforeColor, fontSize: 24 * scale }}>✖</div>
                                <div style={{ fontSize: 24 * scale, color: 'rgba(255,255,255,0.8)' }}>{item}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* AFTER SIDE */}
                <div style={{
                    [isPortrait ? 'height' : 'width']: `${100 - splitPercent}%`,
                    [isPortrait ? 'width' : 'height']: '100%',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    padding: 40 * scale,
                    overflow: 'hidden',
                }}>
                    <div style={{ 
                        fontSize: 32 * scale, 
                        fontWeight: 800, 
                        color: afterColor, 
                        fontFamily: montserratFont,
                        marginBottom: 30 * scale,
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                    }}>
                        {afterLabel}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 * scale }}>
                        {afterItems.map((item, i) => (
                            <div key={i} style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: 16 * scale,
                                opacity: interpolate(sliderProgress, [0.5, 1], [0, 1], { extrapolateRight: 'clamp' }),
                                transform: `translateX(${(1 - sliderProgress) * 50}px)`,
                            }}>
                                <div style={{ color: afterColor, fontSize: 24 * scale }}>✔</div>
                                <div style={{ fontSize: 24 * scale, color: '#fff', fontWeight: 600 }}>{item}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Slider Handle */}
                <div style={{
                    position: 'absolute',
                    [isPortrait ? 'top' : 'left']: `${splitPercent}%`,
                    [isPortrait ? 'left' : 'top']: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 60 * scale,
                    height: 60 * scale,
                    backgroundColor: textColor,
                    borderRadius: '50%',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#000',
                    zIndex: 20,
                }}>
                    <svg width={32 * scale} height={32 * scale} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        {isPortrait ? (
                            <>
                                <polyline points="18 15 12 21 6 15"></polyline>
                                <polyline points="6 9 12 3 18 9"></polyline>
                            </>
                        ) : (
                            <>
                                <polyline points="15 18 21 12 15 6"></polyline>
                                <polyline points="9 6 3 12 9 18"></polyline>
                            </>
                        )}
                    </svg>
                </div>
            </div>
        </AbsoluteFill>
    );
};

registerTemplate({
    tags: [],
    id: 'before-after-split-01',
    name: 'Before & After Slider',
    description: 'A dynamic split-screen slider comparing pain points to solutions.',
    category: 'business-marketing',
    durationInFrames: 180,
    fps: 30,
    component: BeforeAfterSplit,
    schema: beforeAfterSplitSchema,
    defaultProps: beforeAfterSplitSchema.parse({}),
});
