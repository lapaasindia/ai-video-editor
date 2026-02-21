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

export const twitterPostMockupSchema = z.object({
    name: z.string().default('Sahil Khanna'),
    handle: z.string().default('@SahilKhanna'),
    avatarUrl: z.string().default('https://images.unsplash.com/photo-1550525811-e5869dd03032?w=150'),
    verified: z.boolean().default(true),
    content: z.string().default('Video editing used to take me 6 hours per video. Now with AI, it takes 15 minutes. The leverage here is absolutely insane. 🤯🎬'),
    time: z.string().default('10:42 AM · Oct 12, 2024'),
    views: z.string().default('1.2M'),
    retweets: z.string().default('4,291'),
    quotes: z.string().default('184'),
    likes: z.string().default('24.5K'),
    bookmarks: z.string().default('3,812'),
    darkMode: z.boolean().default(true),
});

type Props = z.infer<typeof twitterPostMockupSchema>;

export const TwitterPostMockup: React.FC<Props> = ({
    name,
    handle,
    avatarUrl,
    verified,
    content,
    time,
    views,
    retweets,
    quotes,
    likes,
    bookmarks,
    darkMode,
}) => {
    const frame = useCurrentFrame();
    const { fps, width } = useVideoConfig();
    
    const scale = useScaleFactor();
    const isPortrait = useIsPortrait();
    const backgroundControls = useResolvedBackgroundControls();

    const pop = spring({ frame: frame - 10, fps, config: { damping: 14, mass: 1.2 } });
    const op = interpolate(frame - 10, [0, 10], [0, 1], { extrapolateRight: 'clamp' });

    // Colors based on theme
    const bg = darkMode ? '#000000' : '#ffffff';
    const textPrimary = darkMode ? '#d9d9d9' : '#0f1419';
    const textSecondary = darkMode ? '#71767b' : '#536471';
    const borderCol = darkMode ? '#2f3336' : '#eff3f4';
    const accent = '#1d9bf0';

    // Mockup Dimensions
    const cardWidth = isPortrait ? width * 0.9 : 600 * scale;

    return (
        <AbsoluteFill style={{ background: resolveCanvasBackground(darkMode ? '#15202b' : '#f7f9f9', backgroundControls), fontFamily: interFont, alignItems: 'center', justifyContent: 'center' }}>
            <div style={{
                width: cardWidth,
                backgroundColor: bg,
                borderRadius: 16 * scale,
                border: `1px solid ${borderCol}`,
                padding: `${16 * scale}px ${16 * scale}px ${4 * scale}px`,
                display: 'flex',
                flexDirection: 'column',
                boxShadow: darkMode ? '0 20px 40px rgba(0,0,0,0.8)' : '0 10px 30px rgba(0,0,0,0.1)',
                transform: `scale(${interpolate(pop, [0, 1], [0.9, 1])}) translateY(${(1 - pop) * 40}px)`,
                opacity: op,
            }}>
                {/* Header (Avatar + Name) */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 * scale }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 * scale }}>
                        <Img src={avatarUrl} style={{ width: 48 * scale, height: 48 * scale, borderRadius: '50%', objectFit: 'cover' }} />
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <div style={{ fontSize: 16 * scale, fontWeight: 700, color: textPrimary, display: 'flex', alignItems: 'center', gap: 4 * scale }}>
                                {name}
                                {verified && (
                                    <svg viewBox="0 0 24 24" width={18 * scale} height={18 * scale} fill={accent}>
                                        <path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.918-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.337 2.25c-.416-.165-.866-.25-1.336-.25-2.21 0-3.918 1.792-3.918 4 0 .495.084.965.238 1.4-1.273.65-2.148 2.02-2.148 3.6 0 1.46.756 2.76 1.88 3.48-.066.36-.102.73-.102 1.12 0 2.21 1.71 4 3.918 4 .56 0 1.1-.13 1.593-.36.574 1.15 1.734 1.94 3.076 1.94s2.503-.79 3.076-1.94c.493.23 1.033.36 1.593.36 2.208 0 3.918-1.79 3.918-4 0-.39-.036-.76-.102-1.12 1.124-.72 1.88-2.02 1.88-3.48zm-10.46 3.88L7.1 11.43l1.83-1.83 2.76 2.77 6.07-6.07 1.83 1.83-7.55 8.25z" />
                                    </svg>
                                )}
                            </div>
                            <div style={{ fontSize: 15 * scale, color: textSecondary }}>
                                {handle}
                            </div>
                        </div>
                    </div>
                    {/* More icon */}
                    <svg viewBox="0 0 24 24" width={20 * scale} height={20 * scale} fill={textSecondary}>
                        <path d="M3 12c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2zm9 2c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm7 0c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z" />
                    </svg>
                </div>

                {/* Tweet Content */}
                <div style={{
                    fontSize: 20 * scale,
                    lineHeight: 1.4,
                    color: textPrimary,
                    whiteSpace: 'pre-wrap',
                    marginBottom: 16 * scale,
                }}>
                    {content}
                </div>

                {/* Timestamp & Views */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8 * scale,
                    fontSize: 15 * scale,
                    color: textSecondary,
                    paddingBottom: 16 * scale,
                    borderBottom: `1px solid ${borderCol}`,
                    marginBottom: 16 * scale,
                }}>
                    <span>{time}</span>
                    <span>·</span>
                    <span style={{ fontWeight: 700, color: textPrimary }}>{views}</span> Views
                </div>

                {/* Engagement Stats */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 20 * scale,
                    fontSize: 15 * scale,
                    color: textSecondary,
                    paddingBottom: 16 * scale,
                    borderBottom: `1px solid ${borderCol}`,
                    marginBottom: 4 * scale,
                }}>
                    <div><span style={{ fontWeight: 700, color: textPrimary }}>{retweets}</span> Retweets</div>
                    <div><span style={{ fontWeight: 700, color: textPrimary }}>{quotes}</span> Quotes</div>
                    <div><span style={{ fontWeight: 700, color: textPrimary }}>{likes}</span> Likes</div>
                    <div><span style={{ fontWeight: 700, color: textPrimary }}>{bookmarks}</span> Bookmarks</div>
                </div>

                {/* Action Buttons (Reply, Retweet, Like, Bookmark, Share) */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-around',
                    padding: `${8 * scale}px 0`,
                }}>
                    <svg viewBox="0 0 24 24" width={22 * scale} height={22 * scale} fill={textSecondary}><path d="M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01zm8.005-6c-3.317 0-6.005 2.69-6.005 6 0 3.37 2.77 6.08 6.138 6.01l.351-.01h1.761v2.3l5.087-2.81c1.951-1.08 3.163-3.13 3.163-5.36 0-3.39-2.744-6.13-6.129-6.13H9.756z"/></svg>
                    <svg viewBox="0 0 24 24" width={22 * scale} height={22 * scale} fill={textSecondary}><path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z"/></svg>
                    {/* Animated Like Heart */}
                    <svg 
                        viewBox="0 0 24 24" 
                        width={22 * scale} 
                        height={22 * scale} 
                        fill={frame > 30 ? "#f91880" : textSecondary}
                        style={{ transform: `scale(${interpolate(spring({ frame: frame - 30, fps, config: { damping: 10 } }), [0, 0.5, 1], [1, 1.4, 1])})` }}
                    >
                        {frame > 30 ? (
                            <path d="M20.884 13.19c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67z" />
                        ) : (
                            <path d="M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.129 6.61 3.87-2.34 6.052-4.64 7.126-6.61 1.111-2.04 1.03-3.7.477-4.82-.561-1.13-1.666-1.84-2.908-1.91zm4.187 7.69c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67z" />
                        )}
                    </svg>
                    <svg viewBox="0 0 24 24" width={22 * scale} height={22 * scale} fill={textSecondary}><path d="M4 4.5C4 3.12 5.119 2 6.5 2h11C18.881 2 20 3.12 20 4.5v18.44l-8-5.71-8 5.71V4.5zM6.5 4c-.276 0-.5.22-.5.5v14.56l6-4.29 6 4.29V4.5c0-.28-.224-.5-.5-.5h-11z"/></svg>
                    <svg viewBox="0 0 24 24" width={22 * scale} height={22 * scale} fill={textSecondary}><path d="M12 2.59l5.7 5.7-1.41 1.42L13 6.41V16h-2V6.41l-3.3 3.3-1.41-1.42L12 2.59zM21 15l-.02 3.51c0 1.38-1.12 2.49-2.5 2.49H5.5C4.11 21 3 19.88 3 18.5V15h2v3.5c0 .28.22.5.5.5h12.98c.28 0 .5-.22.5-.5L19 15h2z"/></svg>
                </div>
            </div>
        </AbsoluteFill>
    );
};

registerTemplate({
    tags: [],
    id: 'twitter-post-mockup-01',
    name: 'Twitter / X Post Mockup',
    description: 'A pixel-perfect simulation of a viral X post with animated like button.',
    category: 'platform-mockups',
    durationInFrames: 150,
    fps: 30,
    component: TwitterPostMockup,
    schema: twitterPostMockupSchema,
    defaultProps: twitterPostMockupSchema.parse({}),
});
