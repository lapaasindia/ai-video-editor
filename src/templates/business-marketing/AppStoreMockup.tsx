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
import {
    resolveCanvasBackground,
    useResolvedBackgroundControls,
} from '../../lib/background';
import { registerTemplate } from '../registry';
import { interFont } from '../../lib/fonts';

export const appStoreMockupSchema = z.object({
    appName: z.string().default('Lapaas Video Editor'),
    developer: z.string().default('Lapaas India'),
    iconUrl: z.string().default('https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=150'),
    rating: z.number().default(4.9),
    ratingCount: z.string().default('12.4K Ratings'),
    ranking: z.string().default('#1 in Photo & Video'),
    age: z.string().default('4+'),
    description: z.string().default('The most powerful AI video editor in your pocket. Edit 10x faster with automated tools, smart captions, and premium B-roll. Download now and join 1M+ creators.'),
    buttonText: z.string().default('GET'),
    backgroundColor: z.string().default('#000000'),
    textColor: z.string().default('#ffffff'),
    accentColor: z.string().default('#007aff'), // Apple blue
});

type Props = z.infer<typeof appStoreMockupSchema>;

export const AppStoreMockup: React.FC<Props> = ({
    appName,
    developer,
    iconUrl,
    rating,
    ratingCount,
    ranking,
    age,
    description,
    buttonText,
        accentColor,
}) => {
    const frame = useCurrentFrame();
    const { fps, width } = useVideoConfig();
    
    const scale = useScaleFactor();
    const isPortrait = useIsPortrait();
    const backgroundControls = useResolvedBackgroundControls();

    const pop = spring({ frame: frame - 10, fps, config: { damping: 14, mass: 1.2 } });
    const op = interpolate(frame - 10, [0, 10], [0, 1], { extrapolateRight: 'clamp' });

    // Mockup Dimensions
    const cardWidth = isPortrait ? width : 450 * scale;
    const cardHeight = isPortrait ? 1920 : 800 * scale;

    const bg = '#000'; // App Store Dark Mode
    const textPrimary = '#fff';
    const textSecondary = '#8e8e93';

    return (
        <AbsoluteFill style={{ background: resolveCanvasBackground('#000000', backgroundControls), fontFamily: interFont, alignItems: 'center', justifyContent: 'center' }}>
            <div style={{
                width: cardWidth,
                height: cardHeight,
                backgroundColor: bg,
                borderRadius: isPortrait ? 0 : 40 * scale,
                border: isPortrait ? 'none' : `8px solid #1a1a1a`,
                padding: `${isPortrait ? 80 * scale : 40 * scale}px ${20 * scale}px ${20 * scale}px`,
                display: 'flex',
                flexDirection: 'column',
                boxShadow: isPortrait ? 'none' : '0 30px 60px rgba(0,0,0,0.8)',
                transform: isPortrait ? 'none' : `scale(${interpolate(pop, [0, 1], [0.95, 1])}) translateY(${(1 - pop) * 40}px)`,
                opacity: isPortrait ? 1 : op,
                overflow: 'hidden',
                position: 'relative',
            }}>
                {/* Header App Info */}
                <div style={{ display: 'flex', gap: 16 * scale, marginBottom: 24 * scale }}>
                    {/* App Icon */}
                    <div style={{
                        width: 120 * scale,
                        height: 120 * scale,
                        borderRadius: 24 * scale,
                        overflow: 'hidden',
                        boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
                        flexShrink: 0,
                    }}>
                        <Img src={iconUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1 }}>
                        <div style={{ fontSize: 24 * scale, fontWeight: 700, color: textPrimary, lineHeight: 1.2, marginBottom: 4 * scale }}>
                            {appName}
                        </div>
                        <div style={{ fontSize: 16 * scale, color: textSecondary, marginBottom: 'auto' }}>
                            {developer}
                        </div>
                        {/* Get Button & Share */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 * scale }}>
                            {/* Animated Get Button */}
                            <div style={{
                                backgroundColor: accentColor,
                                color: '#fff',
                                padding: `${6 * scale}px ${24 * scale}px`,
                                borderRadius: 16 * scale,
                                fontSize: 15 * scale,
                                fontWeight: 700,
                                transform: `scale(${interpolate(spring({ frame: frame - 30, fps, config: { damping: 10 } }), [0, 0.5, 1], [1, 1.1, 1])})`,
                            }}>
                                {buttonText}
                            </div>
                            <svg viewBox="0 0 24 24" width={24 * scale} height={24 * scale} fill="none" stroke={accentColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="18" cy="5" r="3"></circle>
                                <circle cx="6" cy="12" r="3"></circle>
                                <circle cx="18" cy="19" r="3"></circle>
                                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                            </svg>
                        </div>
                    </div>
                </div>

                {/* Stats Row */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: `${16 * scale}px 0`,
                    borderTop: `1px solid #333`,
                    borderBottom: `1px solid #333`,
                    marginBottom: 24 * scale,
                    overflowX: 'hidden',
                }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, borderRight: '1px solid #333' }}>
                        <div style={{ fontSize: 12 * scale, color: textSecondary, fontWeight: 600, marginBottom: 4 * scale }}>{ratingCount}</div>
                        <div style={{ fontSize: 22 * scale, fontWeight: 700, color: textPrimary, display: 'flex', alignItems: 'baseline', gap: 4 * scale }}>
                            {rating}
                            <div style={{ display: 'flex', gap: 1 * scale }}>
                                {[1, 2, 3, 4, 5].map(star => (
                                    <svg key={star} viewBox="0 0 24 24" width={10 * scale} height={10 * scale} fill={textSecondary}>
                                        <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                                    </svg>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, borderRight: '1px solid #333' }}>
                        <div style={{ fontSize: 12 * scale, color: textSecondary, fontWeight: 600, marginBottom: 4 * scale }}>CHART</div>
                        <div style={{ fontSize: 22 * scale, fontWeight: 700, color: textPrimary }}>{ranking.split(' ')[0]}</div>
                        <div style={{ fontSize: 10 * scale, color: textSecondary, marginTop: 4 * scale }}>{ranking.split(' ').slice(1).join(' ')}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                        <div style={{ fontSize: 12 * scale, color: textSecondary, fontWeight: 600, marginBottom: 4 * scale }}>AGE</div>
                        <div style={{ fontSize: 22 * scale, fontWeight: 700, color: textPrimary }}>{age}</div>
                        <div style={{ fontSize: 10 * scale, color: textSecondary, marginTop: 4 * scale }}>Years Old</div>
                    </div>
                </div>

                {/* What's New */}
                <div style={{ marginBottom: 24 * scale }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 * scale }}>
                        <div style={{ fontSize: 22 * scale, fontWeight: 700, color: textPrimary }}>What's New</div>
                        <div style={{ fontSize: 16 * scale, color: accentColor }}>Version History</div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 * scale }}>
                        <div style={{ fontSize: 15 * scale, color: textSecondary }}>Version 2.4.1</div>
                        <div style={{ fontSize: 15 * scale, color: textSecondary }}>2d ago</div>
                    </div>
                    <div style={{ fontSize: 15 * scale, color: textPrimary, lineHeight: 1.4 }}>
                        - Added AI Auto-B-roll feature.<br/>
                        - Performance improvements and bug fixes.
                    </div>
                </div>

                {/* Description */}
                <div>
                    <div style={{ fontSize: 16 * scale, color: textPrimary, lineHeight: 1.5 }}>
                        {description}
                    </div>
                    <div style={{ color: accentColor, fontSize: 16 * scale, marginTop: 4 * scale, textAlign: 'right' }}>
                        more
                    </div>
                </div>
            </div>
        </AbsoluteFill>
    );
};

registerTemplate({
    tags: [],
    id: 'app-store-mockup-01',
    name: 'App Store Profile Mockup',
    description: 'A realistic iOS App Store page simulation, great for app marketing videos.',
    category: 'platform-mockups',
    durationInFrames: 150,
    fps: 30,
    component: AppStoreMockup,
    schema: appStoreMockupSchema,
    defaultProps: appStoreMockupSchema.parse({}),
});
