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

export const instagramAdMockupSchema = z.object({
    username: z.string().default('lapaasindia'),
    avatarUrl: z.string().default('https://images.unsplash.com/photo-1550525811-e5869dd03032?w=150'),
    location: z.string().default('Sponsored'),
    imageUrl: z.string().default('https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800'),
    likes: z.string().default('14,293'),
    caption: z.string().default('The fastest way to edit videos is finally here. Drop your footage and let AI do the rest. Link in bio to try it for free! ✨'),
    commentsCount: z.string().default('428'),
    ctaText: z.string().default('Learn More'),
});

type Props = z.infer<typeof instagramAdMockupSchema>;

export const InstagramAdMockup: React.FC<Props> = ({
    username,
    avatarUrl,
    location,
    imageUrl,
    likes,
    caption,
    commentsCount,
    ctaText,
}) => {
    const frame = useCurrentFrame();
    const { fps, width, height } = useVideoConfig();
    
    const scale = useScaleFactor();
    const isPortrait = useIsPortrait();
    const backgroundControls = useResolvedBackgroundControls();

    const pop = spring({ frame: frame - 10, fps, config: { damping: 14 } });
    const op = interpolate(frame - 10, [0, 10], [0, 1], { extrapolateRight: 'clamp' });

    // Mockup Dimensions
    const cardWidth = isPortrait ? width * 0.9 : 500 * scale;
    const cardHeight = isPortrait ? height * 0.8 : 800 * scale;

    return (
        <AbsoluteFill style={{ background: resolveCanvasBackground('#0f172a', backgroundControls), fontFamily: interFont, alignItems: 'center', justifyContent: 'center' }}>
            {/* Dark background blur for effect */}
            <div style={{
                position: 'absolute',
                top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                width: cardWidth, height: cardHeight,
                backgroundColor: '#fff',
                filter: `blur(${100 * scale}px)`,
                opacity: 0.1,
            }} />

            {/* Instagram UI Container */}
            <div style={{
                width: cardWidth,
                height: cardHeight,
                backgroundColor: '#fff',
                borderRadius: 24 * scale,
                boxShadow: '0 30px 60px rgba(0,0,0,0.5)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                transform: `scale(${interpolate(pop, [0, 1], [0.95, 1])}) translateY(${(1 - pop) * 50}px)`,
                opacity: op,
                position: 'relative',
            }}>
                {/* Header */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: `${16 * scale}px ${20 * scale}px`,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 * scale }}>
                        {/* Avatar */}
                        <div style={{
                            width: 44 * scale,
                            height: 44 * scale,
                            borderRadius: '50%',
                            background: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
                            padding: 2 * scale,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}>
                            <Img src={avatarUrl} style={{ width: '100%', height: '100%', borderRadius: '50%', border: `2px solid #fff`, objectFit: 'cover' }} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <div style={{ fontSize: 16 * scale, fontWeight: 700, color: '#262626', display: 'flex', alignItems: 'center', gap: 4 * scale }}>
                                {username}
                                {/* Verified Badge Fake */}
                                <svg width={14 * scale} height={14 * scale} viewBox="0 0 24 24" fill="#3897f0">
                                    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-1.9 14.7L6 12.6l1.5-1.5 2.6 2.6 6.4-6.4 1.5 1.5-7.9 7.9z" />
                                </svg>
                            </div>
                            <div style={{ fontSize: 13 * scale, color: '#262626' }}>{location}</div>
                        </div>
                    </div>
                    {/* More icon */}
                    <svg width={24 * scale} height={24 * scale} viewBox="0 0 24 24" fill="none" stroke="#262626" strokeWidth="2">
                        <circle cx="12" cy="12" r="1"></circle>
                        <circle cx="19" cy="12" r="1"></circle>
                        <circle cx="5" cy="12" r="1"></circle>
                    </svg>
                </div>

                {/* Main Media (Image/Video Placeholder) */}
                <div style={{
                    width: '100%',
                    flex: 1,
                    backgroundColor: '#fafafa',
                    position: 'relative',
                    overflow: 'hidden',
                }}>
                    <Img src={imageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    
                    {/* CTA Overlay Bar (Standard for IG Ads) */}
                    <div style={{
                        position: 'absolute',
                        bottom: 0, left: 0, right: 0,
                        backgroundColor: 'rgba(255,255,255,0.95)',
                        padding: `${16 * scale}px ${20 * scale}px`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderTop: '1px solid rgba(0,0,0,0.05)',
                    }}>
                        <div style={{ fontSize: 16 * scale, color: '#262626', fontWeight: 600 }}>
                            {ctaText}
                        </div>
                        <svg width={20 * scale} height={20 * scale} viewBox="0 0 24 24" fill="none" stroke="#262626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                    </div>
                </div>

                {/* Action Bar */}
                <div style={{ padding: `${16 * scale}px ${20 * scale}px ${8 * scale}px` }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 * scale }}>
                        <div style={{ display: 'flex', gap: 16 * scale }}>
                            {/* Like (Animated) */}
                            <svg 
                                width={28 * scale} height={28 * scale} 
                                viewBox="0 0 24 24" 
                                fill={frame > 40 ? "#ed4956" : "none"} 
                                stroke={frame > 40 ? "#ed4956" : "#262626"} 
                                strokeWidth="2"
                                style={{
                                    transform: `scale(${interpolate(spring({ frame: frame - 40, fps, config: { damping: 10 } }), [0, 0.5, 1], [1, 1.2, 1])})`
                                }}
                            >
                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                            </svg>
                            {/* Comment */}
                            <svg width={28 * scale} height={28 * scale} viewBox="0 0 24 24" fill="none" stroke="#262626" strokeWidth="2">
                                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                            </svg>
                            {/* Share */}
                            <svg width={28 * scale} height={28 * scale} viewBox="0 0 24 24" fill="none" stroke="#262626" strokeWidth="2">
                                <line x1="22" y1="2" x2="11" y2="13"></line>
                                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                            </svg>
                        </div>
                        {/* Save */}
                        <svg width={28 * scale} height={28 * scale} viewBox="0 0 24 24" fill="none" stroke="#262626" strokeWidth="2">
                            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                        </svg>
                    </div>

                    <div style={{ fontSize: 15 * scale, fontWeight: 700, color: '#262626', marginBottom: 8 * scale }}>
                        {frame > 40 ? parseInt(likes.replace(/,/g, '')) + 1 : likes} likes
                    </div>

                    <div style={{ fontSize: 15 * scale, color: '#262626', lineHeight: 1.4, marginBottom: 8 * scale }}>
                        <span style={{ fontWeight: 700, marginRight: 8 * scale }}>{username}</span>
                        {caption}
                    </div>

                    <div style={{ fontSize: 14 * scale, color: '#8e8e8e', marginBottom: 12 * scale }}>
                        View all {commentsCount} comments
                    </div>
                </div>
            </div>
        </AbsoluteFill>
    );
};

registerTemplate({
    tags: [],
    id: 'instagram-ad-mockup-01',
    name: 'Instagram Ad Mockup',
    description: 'A realistic simulation of an Instagram Feed Ad or post, complete with animated likes.',
    category: 'platform-mockups',
    durationInFrames: 150,
    fps: 30,
    component: InstagramAdMockup,
    schema: instagramAdMockupSchema,
    defaultProps: instagramAdMockupSchema.parse({}),
});
