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

export const redditThreadMockupSchema = z.object({
    subreddit: z.string().default('r/marketing'),
    author: z.string().default('u/GrowthHacker99'),
    time: z.string().default('4h ago'),
    title: z.string().default('What’s your unfair advantage in 2024?'),
    content: z.string().default('I’ll start: We completely automated our video editing pipeline using AI. What used to take our team a full week now takes about 2 hours on a Tuesday morning. Our output is up 10x and CAC is down 40%.\n\nWhat’s working for you right now?'),
    upvotes: z.string().default('3.2k'),
    commentsCount: z.string().default('428'),
    awardsCount: z.number().default(4),
    darkMode: z.boolean().default(true),
});

type Props = z.infer<typeof redditThreadMockupSchema>;

export const RedditThreadMockup: React.FC<Props> = ({
    subreddit,
    author,
    time,
    title,
    content,
    upvotes,
    commentsCount,
    awardsCount,
    darkMode,
}) => {
    const frame = useCurrentFrame();
    const { fps, width, height } = useVideoConfig();
    const scale = useScaleFactor();
    const isPortrait = useIsPortrait();

    const pop = spring({ frame: frame - 10, fps, config: { damping: 14, mass: 1.2 } });
    const op = interpolate(frame - 10, [0, 10], [0, 1], { extrapolateRight: 'clamp' });

    // Mockup Dimensions
    const cardWidth = isPortrait ? width * 0.95 : 750 * scale;

    const bg = darkMode ? '#1a1a1b' : '#ffffff';
    const canvasBg = darkMode ? '#030303' : '#dae0e6';
    const textPrimary = darkMode ? '#d7dadc' : '#1c1c1c';
    const textSecondary = darkMode ? '#818384' : '#787c7e';
    const borderCol = darkMode ? '#343536' : '#cccccc';
    const hoverBg = darkMode ? '#272729' : '#f6f7f8';

    return (
        <AbsoluteFill style={{ backgroundColor: canvasBg, fontFamily: interFont, alignItems: 'center', justifyContent: 'center' }}>
            <div style={{
                width: cardWidth,
                backgroundColor: bg,
                borderRadius: 8 * scale,
                border: `1px solid ${borderCol}`,
                display: 'flex',
                boxShadow: darkMode ? '0 10px 30px rgba(0,0,0,0.8)' : '0 4px 12px rgba(0,0,0,0.05)',
                transform: `scale(${interpolate(pop, [0, 1], [0.95, 1])}) translateY(${(1 - pop) * 30}px)`,
                opacity: op,
                overflow: 'hidden',
            }}>
                {/* Left Vote Column */}
                <div style={{
                    width: 48 * scale,
                    backgroundColor: darkMode ? '#1a1a1b' : '#f8f9fa',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    paddingTop: 12 * scale,
                    borderRight: isPortrait ? 'none' : `1px solid ${borderCol}`,
                }}>
                    {/* Upvote Arrow (Animated) */}
                    <div style={{ color: frame > 30 ? '#ff4500' : textSecondary, transform: `scale(${frame > 30 ? spring({ frame: frame - 30, fps, config: { damping: 10 } }) : 1})` }}>
                        <svg viewBox="0 0 24 24" width={24 * scale} height={24 * scale} fill="currentColor">
                            <path d="M12 4l-8 8h5v8h6v-8h5z" />
                        </svg>
                    </div>
                    <div style={{ fontSize: 14 * scale, fontWeight: 700, color: frame > 30 ? '#ff4500' : textPrimary, margin: `${4 * scale}px 0` }}>
                        {upvotes}
                    </div>
                    {/* Downvote Arrow */}
                    <div style={{ color: textSecondary }}>
                        <svg viewBox="0 0 24 24" width={24 * scale} height={24 * scale} fill="currentColor">
                            <path d="M12 20l8-8h-5v-8h-6v8h-5z" />
                        </svg>
                    </div>
                </div>

                {/* Main Content Area */}
                <div style={{ flex: 1, padding: `${12 * scale}px ${16 * scale}px`, display: 'flex', flexDirection: 'column' }}>
                    
                    {/* Post Meta Header */}
                    <div style={{ display: 'flex', alignItems: 'center', fontSize: 13 * scale, marginBottom: 8 * scale }}>
                        <Img src="https://www.redditstatic.com/desktop2x/img/favicon/apple-icon-57x57.png" style={{ width: 20 * scale, height: 20 * scale, borderRadius: '50%', marginRight: 8 * scale }} />
                        <span style={{ fontWeight: 700, color: textPrimary, marginRight: 8 * scale }}>{subreddit}</span>
                        <span style={{ color: textSecondary, marginRight: 8 * scale }}>•</span>
                        <span style={{ color: textSecondary, marginRight: 8 * scale }}>Posted by {author}</span>
                        <span style={{ color: textSecondary }}>{time}</span>
                        
                        {/* Awards (Mock) */}
                        {awardsCount > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 * scale, marginLeft: 12 * scale }}>
                                <span style={{ fontSize: 14 * scale }}>🏆</span>
                                <span style={{ fontSize: 14 * scale }}>🔥</span>
                                <span style={{ fontSize: 14 * scale }}>🚀</span>
                            </div>
                        )}
                    </div>

                    {/* Title */}
                    <div style={{
                        fontSize: 20 * scale,
                        fontWeight: 600,
                        color: textPrimary,
                        marginBottom: 12 * scale,
                        lineHeight: 1.2,
                    }}>
                        {title}
                    </div>

                    {/* Body Text */}
                    <div style={{
                        fontSize: 15 * scale,
                        lineHeight: 1.5,
                        color: textPrimary,
                        whiteSpace: 'pre-wrap',
                        marginBottom: 16 * scale,
                    }}>
                        {content}
                    </div>

                    {/* Action Bar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 * scale, marginTop: 'auto' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 * scale, padding: `${6 * scale}px ${8 * scale}px`, borderRadius: 4 * scale, color: textSecondary, fontSize: 13 * scale, fontWeight: 700, backgroundColor: hoverBg }}>
                            <svg viewBox="0 0 24 24" width={20 * scale} height={20 * scale} fill="currentColor"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>
                            {commentsCount} Comments
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 * scale, padding: `${6 * scale}px ${8 * scale}px`, borderRadius: 4 * scale, color: textSecondary, fontSize: 13 * scale, fontWeight: 700 }}>
                            <svg viewBox="0 0 24 24" width={20 * scale} height={20 * scale} fill="currentColor"><path d="M20 18v-2h-2v2h2zm-2-8h2v6h-2v-6zm-4-4h2v12h-2V6zm-4 4h2v8h-2v-8zm-4 4h2v4H6v-4z" /></svg>
                            Share
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 * scale, padding: `${6 * scale}px ${8 * scale}px`, borderRadius: 4 * scale, color: textSecondary, fontSize: 13 * scale, fontWeight: 700 }}>
                            <svg viewBox="0 0 24 24" width={20 * scale} height={20 * scale} fill="currentColor"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>
                            Save
                        </div>
                    </div>
                </div>
            </div>
        </AbsoluteFill>
    );
};

registerTemplate({
    id: 'reddit-thread-mockup-01',
    name: 'Reddit Thread Mockup',
    description: 'A pixel-perfect Reddit post simulation complete with upvote animations.',
    category: 'platform-mockups',
    durationInFrames: 150,
    fps: 30,
    component: RedditThreadMockup,
    schema: redditThreadMockupSchema,
    defaultProps: redditThreadMockupSchema.parse({}),
});
