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
import { COLORS } from '../../lib/theme';
import {
    resolveCanvasBackground,
    useResolvedBackgroundControls,
} from '../../lib/background';
import { interFont } from '../../lib/fonts';

export const sponsorBannerSchema = z.object({
    title: z.string().default('Sponsored By'),
    sponsors: z.array(z.string()).default([
        'https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg',
        'https://upload.wikimedia.org/wikipedia/commons/2/2f/Google_2015_logo.svg',
        'https://upload.wikimedia.org/wikipedia/commons/e/e8/Tesla_logo.png',
        'https://upload.wikimedia.org/wikipedia/commons/0/08/Netflix_2015_logo.svg',
        'https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg',
        'https://upload.wikimedia.org/wikipedia/commons/4/44/Microsoft_logo.svg',
    ]),
    backgroundColor: z.string().default(COLORS.bg),
    textColor: z.string().default(COLORS.textPrimary),
    bannerBgColor: z.string().default('#1e293b'),
    speed: z.number().min(1).max(10).default(3),
});

type Props = z.infer<typeof sponsorBannerSchema>;

export const SponsorBanner: React.FC<Props> = ({
    title,
    sponsors,
    backgroundColor,
    textColor,
    bannerBgColor,
    speed,
}) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    
    const scale = useScaleFactor();
    const backgroundControls = useResolvedBackgroundControls();
    const isPortrait = useIsPortrait();

    const titleY = spring({ frame, fps, config: { damping: 12 } });
    const titleOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

    // Scrolling logic
    // We duplicate the array to create a seamless loop
    const duplicatedSponsors = [...sponsors, ...sponsors, ...sponsors, ...sponsors];
    
    // Calculate the total width of one set of logos
    const logoWidth = isPortrait ? 200 * scale : 300 * scale;
    const gap = isPortrait ? 60 * scale : 100 * scale;
    const setWidth = sponsors.length * (logoWidth + gap);
    
    // Calculate scroll offset based on frame and speed
    const scrollPixelsPerFrame = speed * scale * 2;
    const currentOffset = (frame * scrollPixelsPerFrame) % setWidth;

    return (
        <AbsoluteFill style={{ background: resolveCanvasBackground(backgroundColor, backgroundControls), fontFamily: interFont, color: textColor, justifyContent: 'center' }}>
            {/* Header */}
            <div style={{
                position: 'absolute',
                top: isPortrait ? 200 * scale : 250 * scale,
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
                        fontSize: (isPortrait ? 48 : 60) * scale,
                        margin: 0,
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        color: COLORS.textSecondary,
                    }}
                />
            </div>

            {/* Banner Track */}
            <div style={{
                width: '100%',
                height: isPortrait ? 250 * scale : 300 * scale,
                backgroundColor: bannerBgColor,
                borderTop: '2px solid rgba(255,255,255,0.1)',
                borderBottom: '2px solid rgba(255,255,255,0.1)',
                boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
                display: 'flex',
                alignItems: 'center',
                overflow: 'hidden',
                position: 'relative',
                opacity: interpolate(frame, [15, 30], [0, 1], { extrapolateRight: 'clamp' }),
                transform: `scaleY(${interpolate(spring({ frame: frame - 15, fps, config: { damping: 14 } }), [0, 1], [0, 1])})`,
            }}>
                {/* Scrolling Inner Container */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: gap,
                    transform: `translateX(${-currentOffset}px)`,
                    // We start the container slightly offset to the right so it begins offscreen if needed,
                    // but since we duplicated it, we just start at 0 and let it scroll continuously.
                    paddingLeft: gap,
                }}>
                    {duplicatedSponsors.map((logoUrl, i) => (
                        <div key={i} style={{
                            width: logoWidth,
                            height: (isPortrait ? 100 : 150) * scale,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                        }}>
                            <Img 
                                src={logoUrl} 
                                style={{
                                    maxWidth: '100%',
                                    maxHeight: '100%',
                                    objectFit: 'contain',
                                    filter: 'grayscale(100%) opacity(0.7)',
                                }}
                            />
                        </div>
                    ))}
                </div>
                
                {/* Edge Fades (Vignette) */}
                <div style={{
                    position: 'absolute',
                    top: 0, left: 0, bottom: 0, width: 200 * scale,
                    background: `linear-gradient(90deg, ${bannerBgColor} 0%, transparent 100%)`,
                    zIndex: 10,
                }} />
                <div style={{
                    position: 'absolute',
                    top: 0, right: 0, bottom: 0, width: 200 * scale,
                    background: `linear-gradient(-90deg, ${bannerBgColor} 0%, transparent 100%)`,
                    zIndex: 10,
                }} />
            </div>
        </AbsoluteFill>
    );
};

registerTemplate({
    tags: [],
    id: 'sponsor-banner-01',
    name: 'Infinite Scrolling Sponsor Banner',
    description: 'A seamless, continuously scrolling ticker tape of sponsor or partner logos.',
    category: 'business-marketing',
    durationInFrames: 300,
    fps: 30,
    component: SponsorBanner,
    schema: sponsorBannerSchema,
    defaultProps: sponsorBannerSchema.parse({}),
});
