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

export const clientLogoGridSchema = z.object({
    title: z.string().default('Trusted By Industry Leaders'),
    logos: z.array(z.string()).default([
        'https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg',
        'https://upload.wikimedia.org/wikipedia/commons/2/2f/Google_2015_logo.svg',
        'https://upload.wikimedia.org/wikipedia/commons/e/e8/Tesla_logo.png',
        'https://upload.wikimedia.org/wikipedia/commons/0/08/Netflix_2015_logo.svg',
        'https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg',
        'https://upload.wikimedia.org/wikipedia/commons/4/44/Microsoft_logo.svg',
    ]),
    backgroundColor: z.string().default('#ffffff'),
    textColor: z.string().default('#0f172a'),
    logoBgColor: z.string().default('#f8fafc'),
});

type Props = z.infer<typeof clientLogoGridSchema>;

export const ClientLogoGrid: React.FC<Props> = ({
    title,
    logos,
    backgroundColor,
    textColor,
    logoBgColor,
}) => {
    const frame = useCurrentFrame();
    const { fps, width, height } = useVideoConfig();
    const scale = useScaleFactor();
    const isPortrait = useIsPortrait();

    const titleY = spring({ frame, fps, config: { damping: 12 } });
    const titleOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

    // Grid math
    const totalLogos = logos.length;
    // Attempt to make a nice grid automatically
    const cols = isPortrait ? 2 : Math.min(4, Math.ceil(Math.sqrt(totalLogos)));
    
    const paddingX = isPortrait ? 60 * scale : 120 * scale;
    const gap = 30 * scale;
    const availableWidth = width - (paddingX * 2);
    
    // We center the grid vertically
    return (
        <AbsoluteFill style={{ backgroundColor, fontFamily: interFont, color: textColor }}>
            {/* Header */}
            <div style={{
                position: 'absolute',
                top: isPortrait ? 150 * scale : 120 * scale,
                left: paddingX,
                width: availableWidth,
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
                    }}
                />
            </div>

            {/* Logo Grid */}
            <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                display: 'grid',
                gridTemplateColumns: `repeat(${cols}, 1fr)`,
                gap: gap,
                width: availableWidth,
                maxWidth: 1200 * scale,
            }}>
                {logos.map((logoUrl, i) => {
                    // Staggered pop-in animation
                    const delay = 15 + i * 5;
                    const pop = spring({ frame: frame - delay, fps, config: { damping: 12, mass: 1.2 } });
                    
                    return (
                        <div key={i} style={{
                            backgroundColor: logoBgColor,
                            borderRadius: 20 * scale,
                            padding: 40 * scale,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            aspectRatio: '16/9',
                            transform: `scale(${pop})`,
                            opacity: interpolate(frame - delay, [0, 5], [0, 1], { extrapolateRight: 'clamp' }),
                            boxShadow: '0 10px 30px rgba(0,0,0,0.05)',
                            border: '1px solid rgba(0,0,0,0.05)',
                        }}>
                            <Img 
                                src={logoUrl} 
                                style={{
                                    maxWidth: '100%',
                                    maxHeight: '100%',
                                    objectFit: 'contain',
                                    // Convert to grayscale if it's a colorful logo for a cleaner B2B look
                                    // filter: 'grayscale(100%) opacity(0.7)',
                                }}
                            />
                        </div>
                    );
                })}
            </div>
        </AbsoluteFill>
    );
};

registerTemplate({
    id: 'client-logo-grid-01',
    name: 'Dynamic Client Logo Grid',
    description: 'A responsive grid of partner/client logos that stagger animate in. Auto-adjusts columns.',
    category: 'social-proof',
    durationInFrames: 120,
    fps: 30,
    component: ClientLogoGrid,
    schema: clientLogoGridSchema,
    defaultProps: clientLogoGridSchema.parse({}),
});
