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

export const productShowcaseSchema = z.object({
    title: z.string().default('New Release'),
    productName: z.string().default('Lapaas Editor Pro'),
    description: z.string().default('The fastest way to create viral short-form content with AI. Now with automated B-roll and smart captions.'),
    productImageUrl: z.string().default('https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1000'),
    highlights: z.array(z.string()).default([
        '10x Faster Rendering',
        'Auto Silence Removal',
        'Dynamic B-Roll',
        '1-Click Export',
    ]),
    backgroundColor: z.string().default('#0f172a'),
    textColor: z.string().default('#ffffff'),
    primaryColor: z.string().default('#3b82f6'),
});

type Props = z.infer<typeof productShowcaseSchema>;

export const ProductShowcase: React.FC<Props> = ({
    title,
    productName,
    description,
    productImageUrl,
    highlights,
    backgroundColor,
    textColor,
    primaryColor,
}) => {
    const frame = useCurrentFrame();
    const { fps, width, height } = useVideoConfig();
    
    const scale = useScaleFactor();
    const isPortrait = useIsPortrait();

    const titleY = spring({ frame, fps, config: { damping: 12 } });
    const titleOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

    const paddingX = isPortrait ? 60 * scale : 120 * scale;
    const availableWidth = width - (paddingX * 2);
    
    // Split layout
    const imageWidth = isPortrait ? availableWidth : availableWidth * 0.45;
    const contentWidth = isPortrait ? availableWidth : availableWidth * 0.5;

    // Image Entrance
    const imageScale = spring({ frame: frame - 15, fps, config: { damping: 14, mass: 1.2 } });
    
    // Continuous slow zoom on image
    const slowZoom = interpolate(frame, [0, 300], [1, 1.1]);

    return (
        <AbsoluteFill style={{ backgroundColor, fontFamily: interFont, color: textColor }}>
            <div style={{
                position: 'absolute',
                top: isPortrait ? 100 * scale : '50%',
                left: paddingX,
                width: availableWidth,
                display: 'flex',
                flexDirection: isPortrait ? 'column' : 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                transform: isPortrait ? 'none' : 'translateY(-50%)',
                gap: isPortrait ? 40 * scale : 0,
            }}>
                {/* Content Side */}
                <div style={{
                    width: contentWidth,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isPortrait ? 'center' : 'flex-start',
                    textAlign: isPortrait ? 'center' : 'left',
                }}>
                    <div style={{
                        fontSize: 24 * scale,
                        fontWeight: 700,
                        color: primaryColor,
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        marginBottom: 16 * scale,
                        transform: `translateY(${(1 - titleY) * -20}px)`,
                        opacity: titleOpacity,
                    }}>
                        {title}
                    </div>
                    
                    <EditableText
                        text={productName}
                        style={{
                            fontFamily: montserratFont,
                            fontWeight: 900,
                            fontSize: (isPortrait ? 64 : 80) * scale,
                            margin: 0,
                            letterSpacing: '-0.03em',
                            lineHeight: 1.1,
                            marginBottom: 24 * scale,
                            transform: `translateY(${(1 - titleY) * -30}px)`,
                            opacity: titleOpacity,
                        }}
                    />

                    <div style={{
                        fontSize: 22 * scale,
                        color: 'rgba(255,255,255,0.7)',
                        lineHeight: 1.5,
                        marginBottom: 40 * scale,
                        maxWidth: 600 * scale,
                        transform: `translateY(${(1 - titleY) * -40}px)`,
                        opacity: titleOpacity,
                    }}>
                        {description}
                    </div>

                    {/* Highlights Grid */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, 1fr)',
                        gap: 20 * scale,
                        width: '100%',
                    }}>
                        {highlights.map((highlight, i) => {
                            const delay = 30 + i * 10;
                            const pop = spring({ frame: frame - delay, fps, config: { damping: 12 } });
                            const op = interpolate(frame - delay, [0, 10], [0, 1], { extrapolateRight: 'clamp' });

                            return (
                                <div key={i} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 12 * scale,
                                    transform: `translateX(${(1 - pop) * -20}px)`,
                                    opacity: op,
                                    backgroundColor: 'rgba(255,255,255,0.05)',
                                    padding: `${16 * scale}px ${20 * scale}px`,
                                    borderRadius: 12 * scale,
                                    border: '1px solid rgba(255,255,255,0.05)',
                                }}>
                                    <svg width={20 * scale} height={20 * scale} viewBox="0 0 24 24" fill="none" stroke={primaryColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12"></polyline>
                                    </svg>
                                    <span style={{ fontSize: 18 * scale, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
                                        {highlight}
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    {/* CTA */}
                    <div style={{
                        marginTop: 50 * scale,
                        backgroundColor: primaryColor,
                        padding: `${20 * scale}px ${40 * scale}px`,
                        borderRadius: 30 * scale,
                        fontSize: 24 * scale,
                        fontWeight: 800,
                        color: '#fff',
                        boxShadow: `0 10px 30px ${primaryColor}40`,
                        transform: `scale(${spring({ frame: frame - 70, fps, config: { damping: 10 } })})`,
                        opacity: interpolate(frame - 70, [0, 10], [0, 1], { extrapolateRight: 'clamp' }),
                    }}>
                        Learn More
                    </div>
                </div>

                {/* Image Side */}
                <div style={{
                    width: imageWidth,
                    height: isPortrait ? width * 0.8 : height * 0.6,
                    position: 'relative',
                    transform: `scale(${interpolate(imageScale, [0, 1], [0.8, 1])})`,
                    opacity: interpolate(imageScale, [0, 1], [0, 1]),
                }}>
                    {/* Decorative Background Blob */}
                    <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '80%',
                        height: '80%',
                        backgroundColor: primaryColor,
                        borderRadius: '50%',
                        filter: `blur(${80 * scale}px)`,
                        opacity: 0.3,
                        zIndex: 0,
                    }} />

                    {/* Main Image Container */}
                    <div style={{
                        position: 'absolute',
                        top: 0, left: 0, right: 0, bottom: 0,
                        borderRadius: 32 * scale,
                        overflow: 'hidden',
                        boxShadow: '0 30px 60px rgba(0,0,0,0.5)',
                        border: '2px solid rgba(255,255,255,0.1)',
                        zIndex: 1,
                    }}>
                        <Img 
                            src={productImageUrl} 
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                transform: `scale(${slowZoom})`,
                            }} 
                        />
                    </div>
                    
                    {/* Floating elements can be added here for more depth */}
                </div>
            </div>
        </AbsoluteFill>
    );
};

registerTemplate({
    tags: [],
    id: 'product-showcase-01',
    name: 'Product Feature Showcase',
    description: 'A split-screen product reveal showing a hero image alongside key highlights.',
    category: 'business-marketing',
    durationInFrames: 210,
    fps: 30,
    component: ProductShowcase,
    schema: productShowcaseSchema,
    defaultProps: productShowcaseSchema.parse({}),
});
