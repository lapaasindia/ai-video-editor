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

export const multiLinkOutroSchema = z.object({
    title: z.string().default('Connect With Us'),
    links: z.array(z.object({
        platform: z.string(),
        handle: z.string(),
        url: z.string(),
        color: z.string(),
    })).default([
        { platform: 'Website', handle: 'lapaas.com', url: 'https://lapaas.com', color: '#10b981' },
        { platform: 'YouTube', handle: '@LapaasIndia', url: 'https://youtube.com/lapaasindia', color: '#ef4444' },
        { platform: 'Twitter', handle: '@SahilKhanna', url: 'https://twitter.com/sahilkhanna', color: '#3b82f6' },
        { platform: 'LinkedIn', handle: 'Lapaas India', url: 'https://linkedin.com/company/lapaas', color: '#0ea5e9' },
    ]),
    backgroundColor: z.string().default('#0f172a'),
    textColor: z.string().default('#ffffff'),
});

type Props = z.infer<typeof multiLinkOutroSchema>;

export const MultiLinkOutro: React.FC<Props> = ({
    title,
    links,
    backgroundColor,
    textColor,
}) => {
    const frame = useCurrentFrame();
    const { fps, width, height } = useVideoConfig();
    const scale = useScaleFactor();
    const isPortrait = useIsPortrait();

    const titleY = spring({ frame, fps, config: { damping: 12 } });
    const titleOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

    const totalLinks = links.length;
    const paddingX = isPortrait ? 60 * scale : 120 * scale;
    const availableWidth = width - (paddingX * 2);

    return (
        <AbsoluteFill style={{ backgroundColor, fontFamily: interFont, color: textColor, justifyContent: 'center', alignItems: 'center' }}>
            {/* Header */}
            <div style={{
                transform: `translateY(${(1 - titleY) * -50}px)`,
                opacity: titleOpacity,
                marginBottom: 60 * scale,
            }}>
                <EditableText
                    text={title}
                    style={{
                        fontFamily: montserratFont,
                        fontWeight: 800,
                        fontSize: (isPortrait ? 80 : 96) * scale,
                        margin: 0,
                        letterSpacing: '-0.02em',
                        textAlign: 'center',
                    }}
                />
            </div>

            {/* Links Stack */}
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 24 * scale,
                width: isPortrait ? availableWidth : 600 * scale,
            }}>
                {links.map((link, i) => {
                    const delay = 20 + i * 8;
                    const pop = spring({ frame: frame - delay, fps, config: { damping: 12, mass: 1.2 } });
                    const op = interpolate(frame - delay, [0, 10], [0, 1], { extrapolateRight: 'clamp' });

                    return (
                        <div key={i} style={{
                            backgroundColor: 'rgba(255,255,255,0.05)',
                            borderRadius: 16 * scale,
                            padding: `${20 * scale}px ${30 * scale}px`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            transform: `scale(${pop}) translateY(${(1 - pop) * 30}px)`,
                            opacity: op,
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderLeft: `6px solid ${link.color}`,
                            boxShadow: `0 10px 30px ${link.color}20`,
                        }}>
                            <div>
                                <div style={{ 
                                    fontSize: 16 * scale, 
                                    color: 'rgba(255,255,255,0.5)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.1em',
                                    marginBottom: 4 * scale,
                                    fontWeight: 600,
                                }}>
                                    {link.platform}
                                </div>
                                <div style={{ 
                                    fontSize: 28 * scale, 
                                    fontWeight: 700,
                                    color: '#fff',
                                }}>
                                    {link.handle}
                                </div>
                            </div>
                            
                            {/* Arrow icon */}
                            <div style={{
                                width: 40 * scale,
                                height: 40 * scale,
                                borderRadius: '50%',
                                backgroundColor: `${link.color}30`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: link.color,
                            }}>
                                <svg width={24 * scale} height={24 * scale} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="5" y1="12" x2="19" y2="12"></line>
                                    <polyline points="12 5 19 12 12 19"></polyline>
                                </svg>
                            </div>
                        </div>
                    );
                })}
            </div>
        </AbsoluteFill>
    );
};

registerTemplate({
    id: 'multi-link-outro-01',
    name: 'Multi-Link End Screen',
    description: 'An outro card displaying multiple calls to action and links neatly stacked.',
    category: 'social-hooks',
    durationInFrames: 150,
    fps: 30,
    component: MultiLinkOutro,
    schema: multiLinkOutroSchema,
    defaultProps: multiLinkOutroSchema.parse({}),
});
