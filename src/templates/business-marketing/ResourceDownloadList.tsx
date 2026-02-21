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

export const resourceDownloadSchema = z.object({
    title: z.string().default('Free SEO Guide'),
    subtitle: z.string().default('Master the algorithms'),
    bullets: z.array(z.string()).default([
        'Keyword research mastery',
        'On-page optimization tips',
        'Backlink building strategy',
        'Technical SEO checklist',
    ]),
    bookTitle: z.string().default('SEO\n2024'),
    backgroundColor: z.string().default('#0f172a'),
    textColor: z.string().default('#ffffff'),
    primaryColor: z.string().default('#3b82f6'),
    secondaryColor: z.string().default('#1e293b'),
});

type Props = z.infer<typeof resourceDownloadSchema>;

export const ResourceDownloadList: React.FC<Props> = ({
    title,
    subtitle,
    bullets,
    bookTitle,
    backgroundColor,
    textColor,
    primaryColor,
    secondaryColor,
}) => {
    const frame = useCurrentFrame();
    const { fps, width, height } = useVideoConfig();
    const scale = useScaleFactor();
    const isPortrait = useIsPortrait();

    const titleY = spring({ frame, fps, config: { damping: 12 } });
    const titleOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

    const paddingX = isPortrait ? 60 * scale : 120 * scale;
    const availableWidth = width - (paddingX * 2);
    
    // Split layout in landscape, stacked in portrait
    const bookWidth = isPortrait ? availableWidth * 0.6 : availableWidth * 0.4;
    const listWidth = isPortrait ? availableWidth : availableWidth * 0.55;

    return (
        <AbsoluteFill style={{ backgroundColor, fontFamily: interFont, color: textColor }}>
            {/* Header */}
            <div style={{
                position: 'absolute',
                top: isPortrait ? 100 * scale : 80 * scale,
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
                <EditableText
                    text={subtitle}
                    style={{
                        fontSize: (isPortrait ? 30 : 36) * scale,
                        opacity: 0.6,
                        marginTop: 10 * scale,
                    }}
                />
            </div>

            {/* Container for Book and List */}
            <div style={{
                position: 'absolute',
                top: isPortrait ? 300 * scale : 250 * scale,
                left: paddingX,
                width: availableWidth,
                display: 'flex',
                flexDirection: isPortrait ? 'column' : 'row',
                alignItems: isPortrait ? 'center' : 'center',
                justifyContent: 'space-between',
                gap: 60 * scale,
            }}>
                {/* 3D Book Mockup */}
                <div style={{
                    width: bookWidth,
                    aspectRatio: '0.7', // typical book cover
                    perspective: '1000px',
                    transform: `translateY(${(1 - titleY) * 50}px)`,
                    opacity: titleOpacity,
                }}>
                    <div style={{
                        width: '100%',
                        height: '100%',
                        backgroundColor: primaryColor,
                        borderRadius: `0 ${20 * scale}px ${20 * scale}px 0`,
                        boxShadow: `
                            -10px 0 20px rgba(0,0,0,0.5) inset,
                            30px 20px 40px rgba(0,0,0,0.4)
                        `,
                        transform: 'rotateY(-20deg)',
                        transformStyle: 'preserve-3d',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 40 * scale,
                        position: 'relative',
                        borderLeft: '4px solid rgba(255,255,255,0.2)',
                    }}>
                        {/* Book Spine Fake */}
                        <div style={{
                            position: 'absolute',
                            left: -20 * scale,
                            top: 0,
                            bottom: 0,
                            width: 20 * scale,
                            backgroundColor: '#2563eb', // slightly darker
                            transformOrigin: 'right',
                            transform: 'rotateY(90deg)',
                        }} />
                        
                        <div style={{
                            fontSize: 48 * scale,
                            fontWeight: 900,
                            fontFamily: montserratFont,
                            color: '#fff',
                            textAlign: 'center',
                            lineHeight: 1.2,
                            whiteSpace: 'pre-wrap',
                            textShadow: '0 4px 10px rgba(0,0,0,0.3)',
                        }}>
                            {bookTitle}
                        </div>
                    </div>
                </div>

                {/* Bullets List */}
                <div style={{
                    width: listWidth,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 24 * scale,
                }}>
                    <div style={{
                        fontSize: 24 * scale,
                        fontWeight: 700,
                        color: 'rgba(255,255,255,0.5)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        marginBottom: 10 * scale,
                    }}>
                        What's Inside
                    </div>
                    {bullets.map((bullet, i) => {
                        const delay = 20 + i * 10;
                        const pop = spring({ frame: frame - delay, fps, config: { damping: 14 } });
                        const op = interpolate(frame - delay, [0, 10], [0, 1], { extrapolateRight: 'clamp' });

                        return (
                            <div key={i} style={{
                                backgroundColor: secondaryColor,
                                padding: 20 * scale,
                                borderRadius: 16 * scale,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 20 * scale,
                                transform: `translateX(${(1 - pop) * 40}px)`,
                                opacity: op,
                                border: '1px solid rgba(255,255,255,0.05)',
                                boxShadow: '0 10px 20px rgba(0,0,0,0.1)',
                            }}>
                                <div style={{
                                    width: 32 * scale,
                                    height: 32 * scale,
                                    borderRadius: '50%',
                                    backgroundColor: `${primaryColor}20`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: primaryColor,
                                    flexShrink: 0,
                                }}>
                                    <svg width={20 * scale} height={20 * scale} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12"></polyline>
                                    </svg>
                                </div>
                                <div style={{
                                    fontSize: 20 * scale,
                                    fontWeight: 500,
                                    color: 'rgba(255,255,255,0.9)',
                                }}>
                                    {bullet}
                                </div>
                            </div>
                        );
                    })}

                    {/* CTA Button */}
                    <div style={{
                        marginTop: 20 * scale,
                        backgroundColor: primaryColor,
                        padding: 20 * scale,
                        borderRadius: 16 * scale,
                        textAlign: 'center',
                        fontSize: 24 * scale,
                        fontWeight: 800,
                        color: '#fff',
                        boxShadow: `0 10px 30px ${primaryColor}40`,
                        transform: `scale(${spring({ frame: frame - (40 + bullets.length * 10), fps, config: { damping: 10 } })})`,
                        opacity: interpolate(frame - (40 + bullets.length * 10), [0, 10], [0, 1], { extrapolateRight: 'clamp' }),
                    }}>
                        Download Now ↓
                    </div>
                </div>
            </div>
        </AbsoluteFill>
    );
};

registerTemplate({
    id: 'resource-download-list-01',
    name: 'Resource Download CTA',
    description: 'A 3D book mockup paired with a dynamic list of bullet points detailing what is inside.',
    category: 'social-hooks',
    durationInFrames: 180,
    fps: 30,
    component: ResourceDownloadList,
    schema: resourceDownloadSchema,
    defaultProps: resourceDownloadSchema.parse({}),
});
