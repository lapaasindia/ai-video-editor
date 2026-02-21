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
import { registerTemplate } from '../registry';
import { interFont } from '../../lib/fonts';

export const facebookAdMockupSchema = z.object({
    pageName: z.string().default('Lapaas'),
    avatarUrl: z.string().default('https://images.unsplash.com/photo-1550525811-e5869dd03032?w=150'),
    time: z.string().default('Sponsored'),
    content: z.string().default('Struggling to edit videos consistently? 📹\n\nOur AI-powered editor cuts production time by 80%. Upload your raw footage and let the engine add B-roll, captions, and zoom effects automatically. 🚀'),
    imageUrl: z.string().default('https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800'),
    linkDomain: z.string().default('LAPAAS.COM'),
    linkTitle: z.string().default('The #1 AI Video Editor for Marketing Teams'),
    linkDesc: z.string().default('Start your 14-day free trial today.'),
    ctaText: z.string().default('Learn more'),
    likesCount: z.string().default('2.4K'),
    commentsCount: z.string().default('184 Comments'),
    sharesCount: z.string().default('89 Shares'),
    backgroundColor: z.string().default('#f0f2f5'),
    textColor: z.string().default('#050505'),
});

type Props = z.infer<typeof facebookAdMockupSchema>;

export const FacebookAdMockup: React.FC<Props> = ({
    pageName,
    avatarUrl,
    time,
    content,
    imageUrl,
    linkDomain,
    linkTitle,
    linkDesc,
    ctaText,
    likesCount,
    commentsCount,
    sharesCount,
    backgroundColor,
    textColor,
}) => {
    const frame = useCurrentFrame();
    const { fps, width } = useVideoConfig();
    
    const scale = useScaleFactor();
    const isPortrait = useIsPortrait();

    const pop = spring({ frame: frame - 10, fps, config: { damping: 14, mass: 1.2 } });
    const op = interpolate(frame - 10, [0, 10], [0, 1], { extrapolateRight: 'clamp' });

    // Mockup Dimensions
    const cardWidth = isPortrait ? width * 0.95 : 650 * scale;

    return (
        <AbsoluteFill style={{ backgroundColor, fontFamily: interFont, alignItems: 'center', justifyContent: 'center' }}>
            <div style={{
                width: cardWidth,
                backgroundColor: '#ffffff',
                borderRadius: 8 * scale,
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                transform: `scale(${interpolate(pop, [0, 1], [0.95, 1])}) translateY(${(1 - pop) * 30}px)`,
                opacity: op,
                overflow: 'hidden',
            }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `${12 * scale}px ${16 * scale}px` }}>
                    <div style={{ display: 'flex', gap: 10 * scale }}>
                        <Img src={avatarUrl} style={{ width: 40 * scale, height: 40 * scale, borderRadius: '50%', objectFit: 'cover' }} />
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <div style={{ fontSize: 15 * scale, fontWeight: 600, color: textColor, display: 'flex', alignItems: 'center', gap: 4 * scale }}>
                                {pageName}
                                {/* Verified Badge Fake */}
                                <svg viewBox="0 0 24 24" width={14 * scale} height={14 * scale} fill="#0866FF">
                                    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-1.9 14.7L6 12.6l1.5-1.5 2.6 2.6 6.4-6.4 1.5 1.5-7.9 7.9z" />
                                </svg>
                            </div>
                            <div style={{ fontSize: 13 * scale, color: '#65676B', display: 'flex', alignItems: 'center', gap: 4 * scale }}>
                                {time} 
                                <span>·</span>
                                <svg viewBox="0 0 16 16" width={12 * scale} height={12 * scale} fill="#65676B">
                                    <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm3.89 4.67a1.66 1.66 0 01-1.37.75h-5A1.66 1.66 0 014.11 5.67a6 6 0 017.78 0zM8 14A6 6 0 012.3 9h3.18a3.17 3.17 0 001.35 1.77A4.6 4.6 0 008 11.5a4.6 4.6 0 001.17-.73A3.17 3.17 0 0010.52 9h3.18A6 6 0 018 14z" />
                                </svg>
                            </div>
                        </div>
                    </div>
                    {/* More icon & X */}
                    <div style={{ display: 'flex', gap: 12 * scale, color: '#65676B' }}>
                        <svg viewBox="0 0 24 24" width={20 * scale} height={20 * scale} fill="currentColor">
                            <circle cx="12" cy="12" r="2"></circle>
                            <circle cx="20" cy="12" r="2"></circle>
                            <circle cx="4" cy="12" r="2"></circle>
                        </svg>
                        <svg viewBox="0 0 24 24" width={20 * scale} height={20 * scale} fill="currentColor">
                            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                        </svg>
                    </div>
                </div>

                {/* Text Content */}
                <div style={{
                    fontSize: 15 * scale,
                    lineHeight: 1.4,
                    color: textColor,
                    whiteSpace: 'pre-wrap',
                    padding: `0 ${16 * scale}px ${12 * scale}px`,
                }}>
                    {content}
                </div>

                {/* Ad Media */}
                <div style={{ width: '100%', aspectRatio: '1.91/1', backgroundColor: '#f0f2f5', position: 'relative' }}>
                    <Img src={imageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>

                {/* Link Preview Bar */}
                <div style={{
                    backgroundColor: '#F0F2F5',
                    padding: `${10 * scale}px ${16 * scale}px`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}>
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', paddingRight: 16 * scale }}>
                        <div style={{ fontSize: 12 * scale, color: '#65676B', textTransform: 'uppercase', marginBottom: 2 * scale }}>{linkDomain}</div>
                        <div style={{ fontSize: 16 * scale, fontWeight: 600, color: textColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{linkTitle}</div>
                        <div style={{ fontSize: 14 * scale, color: '#65676B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 * scale }}>{linkDesc}</div>
                    </div>
                    <div style={{
                        backgroundColor: '#E4E6EB',
                        padding: `${6 * scale}px ${12 * scale}px`,
                        borderRadius: 6 * scale,
                        fontSize: 15 * scale,
                        fontWeight: 600,
                        color: textColor,
                    }}>
                        {ctaText}
                    </div>
                </div>

                {/* Stats & Actions */}
                <div style={{ padding: `0 ${16 * scale}px` }}>
                    {/* Stats */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: `${10 * scale}px 0`,
                        borderBottom: '1px solid #CED0D4',
                        color: '#65676B',
                        fontSize: 15 * scale,
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 * scale }}>
                            {/* FB Reaction Icons Fake */}
                            <div style={{ display: 'flex' }}>
                                <div style={{ width: 18 * scale, height: 18 * scale, borderRadius: '50%', backgroundColor: '#0866FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10 * scale, zIndex: 2, border: '2px solid #fff' }}>👍</div>
                                <div style={{ width: 18 * scale, height: 18 * scale, borderRadius: '50%', backgroundColor: '#F7B125', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10 * scale, marginLeft: -4 * scale, zIndex: 1, border: '2px solid #fff' }}>❤️</div>
                            </div>
                            {likesCount}
                        </div>
                        <div style={{ display: 'flex', gap: 12 * scale }}>
                            <span>{commentsCount}</span>
                            <span>{sharesCount}</span>
                        </div>
                    </div>

                    {/* Buttons */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: `${4 * scale}px 0`,
                    }}>
                        {/* Animated Like Button */}
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 * scale, padding: `${8 * scale}px 0`, borderRadius: 4 * scale, color: frame > 40 ? '#0866FF' : '#65676B', fontWeight: 600, fontSize: 15 * scale, transform: `scale(${interpolate(spring({ frame: frame - 40, fps, config: { damping: 10 } }), [0, 0.5, 1], [1, 1.1, 1])})` }}>
                            {frame > 40 ? (
                                <svg viewBox="0 0 24 24" width={20 * scale} height={20 * scale} fill="currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 14H6V4h7v5h5v9z"/></svg>
                            ) : (
                                <svg viewBox="0 0 24 24" width={20 * scale} height={20 * scale} fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>
                            )}
                            Like
                        </div>
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 * scale, padding: `${8 * scale}px 0`, borderRadius: 4 * scale, color: '#65676B', fontWeight: 600, fontSize: 15 * scale }}>
                            <svg viewBox="0 0 24 24" width={20 * scale} height={20 * scale} fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                            Comment
                        </div>
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 * scale, padding: `${8 * scale}px 0`, borderRadius: 4 * scale, color: '#65676B', fontWeight: 600, fontSize: 15 * scale }}>
                            <svg viewBox="0 0 24 24" width={20 * scale} height={20 * scale} fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13"></path></svg>
                            Share
                        </div>
                    </div>
                </div>
            </div>
        </AbsoluteFill>
    );
};

registerTemplate({
    tags: [],
    id: 'facebook-ad-mockup-01',
    name: 'Facebook Ad Mockup',
    description: 'A realistic simulation of a Facebook Feed Ad, perfect for testing ad creative visually.',
    category: 'platform-mockups',
    durationInFrames: 150,
    fps: 30,
    component: FacebookAdMockup,
    schema: facebookAdMockupSchema,
    defaultProps: facebookAdMockupSchema.parse({}),
});
