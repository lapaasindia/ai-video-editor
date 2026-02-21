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

export const youtubePlayerMockupSchema = z.object({
    videoTitle: z.string().default('How I Built a $1M ARR Business with AI'),
    channelName: z.string().default('Lapaas'),
    avatarUrl: z.string().default('https://images.unsplash.com/photo-1550525811-e5869dd03032?w=150'),
    views: z.string().default('1.2M views'),
    timeAgo: z.string().default('2 weeks ago'),
    subscribers: z.string().default('450K'),
    likes: z.string().default('124K'),
    thumbnailUrl: z.string().default('https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1000'),
    duration: z.string().default('14:28'),
    backgroundColor: z.string().default('#0f0f0f'),
    textColor: z.string().default('#ffffff'),
    darkMode: z.boolean().default(true),
});

type Props = z.infer<typeof youtubePlayerMockupSchema>;

export const YouTubePlayerMockup: React.FC<Props> = ({
    videoTitle,
    channelName,
    avatarUrl,
    views,
    timeAgo,
    subscribers,
    likes,
    thumbnailUrl,
    duration,
    backgroundColor,
    textColor,
    darkMode,
}) => {
    const frame = useCurrentFrame();
    const { fps, width, height } = useVideoConfig();
    const scale = useScaleFactor();
    const isPortrait = useIsPortrait();

    const pop = spring({ frame: frame - 10, fps, config: { damping: 14, mass: 1.2 } });
    const op = interpolate(frame - 10, [0, 10], [0, 1], { extrapolateRight: 'clamp' });

    // Mockup Dimensions
    const cardWidth = isPortrait ? width : 800 * scale;
    
    const bg = darkMode ? '#0f0f0f' : '#ffffff';
    const textPrimary = darkMode ? '#f1f1f1' : '#0f0f0f';
    const textSecondary = darkMode ? '#aaaaaa' : '#606060';
    const buttonBg = darkMode ? '#272727' : '#0000000d';

    return (
        <AbsoluteFill style={{ backgroundColor, fontFamily: interFont, alignItems: 'center', justifyContent: 'center' }}>
            <div style={{
                width: cardWidth,
                backgroundColor: bg,
                display: 'flex',
                flexDirection: 'column',
                transform: isPortrait ? 'none' : `scale(${interpolate(pop, [0, 1], [0.95, 1])}) translateY(${(1 - pop) * 40}px)`,
                opacity: isPortrait ? 1 : op,
                boxShadow: isPortrait ? 'none' : '0 30px 60px rgba(0,0,0,0.5)',
                borderRadius: isPortrait ? 0 : 16 * scale,
                overflow: 'hidden',
                border: isPortrait ? 'none' : `1px solid ${darkMode ? '#272727' : '#e5e5e5'}`,
            }}>
                {/* Video Player Area (Thumbnail with play button) */}
                <div style={{
                    width: '100%',
                    aspectRatio: '16/9',
                    backgroundColor: '#000',
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                    <Img src={thumbnailUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }} />
                    
                    {/* Fake YouTube Player Controls */}
                    <div style={{
                        position: 'absolute',
                        top: 0, left: 0, right: 0, bottom: 0,
                        background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 20%)',
                    }} />

                    {/* Big Play Button (animates in) */}
                    <div style={{
                        position: 'absolute',
                        width: 68 * scale, height: 48 * scale,
                        backgroundColor: 'rgba(0,0,0,0.7)',
                        borderRadius: 12 * scale,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transform: `scale(${interpolate(spring({ frame: frame - 30, fps, config: { damping: 10 } }), [0, 0.5, 1], [1, 1.2, 1])})`,
                    }}>
                        <svg viewBox="0 0 24 24" width={24 * scale} height={24 * scale} fill="#fff">
                            <path d="M8 5v14l11-7z" />
                        </svg>
                    </div>

                    {/* Progress Bar & Controls */}
                    <div style={{ position: 'absolute', bottom: 10 * scale, left: 16 * scale, right: 16 * scale }}>
                        {/* Red Scrubber */}
                        <div style={{ width: '100%', height: 4 * scale, backgroundColor: 'rgba(255,255,255,0.2)', marginBottom: 12 * scale }}>
                            <div style={{ width: '35%', height: '100%', backgroundColor: '#ff0000', position: 'relative' }}>
                                <div style={{ position: 'absolute', right: -6 * scale, top: '50%', transform: 'translateY(-50%)', width: 12 * scale, height: 12 * scale, borderRadius: '50%', backgroundColor: '#ff0000' }} />
                            </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#fff', fontSize: 13 * scale }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 16 * scale }}>
                                <svg viewBox="0 0 24 24" width={20 * scale} height={20 * scale} fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                                <svg viewBox="0 0 24 24" width={20 * scale} height={20 * scale} fill="currentColor"><path d="M16 21c3.527-1.547 5.999-4.909 5.999-9S19.527 4.547 16 3v2c2.387 1.386 3.999 4.047 3.999 7S18.387 10.614 16 12v2zM12 21V3H8L3 8v8h5l4 5z"/></svg>
                                <span>04:12 / {duration}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 16 * scale }}>
                                <svg viewBox="0 0 24 24" width={20 * scale} height={20 * scale} fill="currentColor"><path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z" /></svg>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Video Meta Info */}
                <div style={{ padding: `${16 * scale}px ${16 * scale}px ${24 * scale}px` }}>
                    <div style={{ fontSize: 22 * scale, fontWeight: 700, color: textPrimary, marginBottom: 12 * scale, lineHeight: 1.4 }}>
                        {videoTitle}
                    </div>

                    {/* View Count & Buttons Row */}
                    <div style={{ display: 'flex', flexDirection: isPortrait ? 'column' : 'row', justifyContent: 'space-between', alignItems: isPortrait ? 'flex-start' : 'center', gap: 16 * scale, marginBottom: 16 * scale }}>
                        
                        {/* Avatar & Sub count */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 * scale }}>
                            <Img src={avatarUrl} style={{ width: 40 * scale, height: 40 * scale, borderRadius: '50%', objectFit: 'cover' }} />
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <div style={{ fontSize: 16 * scale, fontWeight: 700, color: textPrimary }}>{channelName}</div>
                                <div style={{ fontSize: 13 * scale, color: textSecondary }}>{subscribers} subscribers</div>
                            </div>
                            {/* Subscribe Button */}
                            <div style={{
                                backgroundColor: textPrimary,
                                color: bg,
                                padding: `${8 * scale}px ${16 * scale}px`,
                                borderRadius: 18 * scale,
                                fontSize: 14 * scale,
                                fontWeight: 600,
                                marginLeft: 12 * scale,
                            }}>
                                Subscribe
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div style={{ display: 'flex', gap: 8 * scale, overflowX: isPortrait ? 'auto' : 'visible', width: isPortrait ? '100%' : 'auto', paddingBottom: isPortrait ? 4 * scale : 0 }}>
                            {/* Like / Dislike */}
                            <div style={{ display: 'flex', backgroundColor: buttonBg, borderRadius: 18 * scale, overflow: 'hidden' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 * scale, padding: `${8 * scale}px ${16 * scale}px`, color: textPrimary, fontSize: 14 * scale, fontWeight: 600, borderRight: `1px solid ${darkMode ? '#3f3f3f' : '#d3d3d3'}` }}>
                                    <svg viewBox="0 0 24 24" width={20 * scale} height={20 * scale} fill="currentColor"><path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z" /></svg>
                                    {likes}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', padding: `${8 * scale}px ${16 * scale}px`, color: textPrimary }}>
                                    <svg viewBox="0 0 24 24" width={20 * scale} height={20 * scale} fill="currentColor"><path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z" /></svg>
                                </div>
                            </div>
                            
                            {/* Share */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 * scale, backgroundColor: buttonBg, padding: `${8 * scale}px ${16 * scale}px`, borderRadius: 18 * scale, color: textPrimary, fontSize: 14 * scale, fontWeight: 600 }}>
                                <svg viewBox="0 0 24 24" width={20 * scale} height={20 * scale} fill="currentColor"><path d="M11 7.141V4l9 7.828-9 7.828v-3.328c-4.995 0-8.243 1.343-11 4.672 1.332-5.334 4.537-8.995 11-9.859z" /></svg>
                                Share
                            </div>

                            {/* Download */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 * scale, backgroundColor: buttonBg, padding: `${8 * scale}px ${16 * scale}px`, borderRadius: 18 * scale, color: textPrimary, fontSize: 14 * scale, fontWeight: 600 }}>
                                <svg viewBox="0 0 24 24" width={20 * scale} height={20 * scale} fill="currentColor"><path d="M17 18V19H6V18H17ZM16.5 11.4L15.8 10.7L12 14.4V4H11V14.4L7.2 10.6L6.5 11.3L11.5 16.3L16.5 11.4Z" /></svg>
                                Download
                            </div>
                        </div>
                    </div>

                    {/* Description Box */}
                    <div style={{
                        backgroundColor: buttonBg,
                        borderRadius: 12 * scale,
                        padding: 12 * scale,
                        fontSize: 14 * scale,
                        color: textPrimary,
                        lineHeight: 1.5,
                    }}>
                        <div style={{ fontWeight: 600, marginBottom: 4 * scale }}>{views} • {timeAgo}</div>
                        In this video, I break down the exact strategies and AI tools we used to scale Lapaas to $1M ARR in under 12 months. 
                        <br/><br/>
                        Get the tool here: https://lapaas.com
                    </div>
                </div>
            </div>
        </AbsoluteFill>
    );
};

registerTemplate({
    id: 'youtube-player-mockup-01',
    name: 'YouTube Player Mockup',
    description: 'A pixel-perfect YouTube video player and description layout.',
    category: 'platform-mockups',
    durationInFrames: 180,
    fps: 30,
    component: YouTubePlayerMockup,
    schema: youtubePlayerMockupSchema,
    defaultProps: youtubePlayerMockupSchema.parse({}),
});
