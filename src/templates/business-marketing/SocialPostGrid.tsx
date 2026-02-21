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

export const socialPostGridSchema = z.object({
    title: z.string().default('Everyone is talking about it'),
    posts: z.array(z.object({
        username: z.string(),
        handle: z.string(),
        text: z.string(),
        avatarUrl: z.string(),
        likes: z.string(),
        platform: z.enum(['twitter', 'linkedin', 'threads']).default('twitter'),
    backgroundColor: z.string().default(COLORS.bg),
    })).default([
        { 
            username: 'Alex Hormozi', handle: '@AlexHormozi', platform: 'twitter', likes: '14.2K',
            text: 'Just tried the new Lapaas AI Editor. It cut our video production time by 80%. This is the future of content.',
            avatarUrl: 'https://images.unsplash.com/photo-1550525811-e5869dd03032?w=150',
        },
        { 
            username: 'Sarah Drasner', handle: '@swyx', platform: 'twitter', likes: '8,421',
            text: 'I cannot believe how good the timeline auto-cutting is. Worth every penny.',
            avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
        },
        { 
            username: 'Naval Ravikant', handle: '@naval', platform: 'threads', likes: '32K',
            text: 'The best tools give you leverage. This gives you leverage over time itself.',
            avatarUrl: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=150',
        }
    ]),
    backgroundColor: z.string().default(COLORS.bg),
    textColor: z.string().default(COLORS.textPrimary),
    cardBgColor: z.string().default(COLORS.surface),
});

type Props = z.infer<typeof socialPostGridSchema>;

export const SocialPostGrid: React.FC<Props> = ({
    title,
    posts,
    backgroundColor,
    textColor,
    cardBgColor,
}) => {
    const frame = useCurrentFrame();
    const { fps, width } = useVideoConfig();
    
    const scale = useScaleFactor();
    const backgroundControls = useResolvedBackgroundControls();
    const isPortrait = useIsPortrait();

    const titleY = spring({ frame, fps, config: { damping: 12 } });
    const titleOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

    const totalPosts = posts.length;
    // Layout logic: cascade them diagonally or just grid them
    const paddingX = isPortrait ? 60 * scale : 120 * scale;
    const availableWidth = width - (paddingX * 2);
    
    // For visual interest, we'll place them in a masonry/staggered column layout
    const colCount = isPortrait ? 1 : Math.min(3, totalPosts);
    
    return (
        <AbsoluteFill style={{ background: resolveCanvasBackground(backgroundColor, backgroundControls), fontFamily: interFont, color: textColor }}>
            {/* Header */}
            <div style={{
                position: 'absolute',
                top: isPortrait ? 100 * scale : 80 * scale,
                left: paddingX,
                width: availableWidth,
                textAlign: 'center',
                transform: `translateY(${(1 - titleY) * -30}px)`,
                opacity: titleOpacity,
                zIndex: 100,
            }}>
                <EditableText
                    text={title}
                    style={{
                        fontFamily: interFont,
                        fontWeight: 800,
                        fontSize: (isPortrait ? 60 : 72) * scale,
                        margin: 0,
                        letterSpacing: '-0.02em',
                        textShadow: '0 4px 20px rgba(0,0,0,0.5)',
                    }}
                />
            </div>

            {/* Posts Grid */}
            <div style={{
                position: 'absolute',
                top: isPortrait ? 250 * scale : 200 * scale,
                left: paddingX,
                width: availableWidth,
                display: 'grid',
                gridTemplateColumns: `repeat(${colCount}, 1fr)`,
                gap: 30 * scale,
                alignItems: 'start', // allows masonry stagger
            }}>
                {posts.map((post, i) => {
                    const delay = 20 + i * 15;
                    const pop = spring({ frame: frame - delay, fps, config: { damping: 14 } });
                    const op = interpolate(frame - delay, [0, 10], [0, 1], { extrapolateRight: 'clamp' });
                    
                    // Stagger the vertical start position for masonry look
                    const yOffset = !isPortrait && i % 2 !== 0 ? 80 * scale : 0;

                    return (
                        <div key={i} style={{
                            backgroundColor: cardBgColor,
                            borderRadius: 24 * scale,
                            padding: 30 * scale,
                            transform: `translateY(${(1 - pop) * 100 + yOffset}px) scale(${interpolate(pop, [0, 1], [0.9, 1])}) rotate(${(1-pop) * (i%2===0?2:-2)}deg)`,
                            opacity: op,
                            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
                            border: `1px solid ${COLORS.borderLight}`,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 20 * scale,
                        }}>
                            {/* Post Header */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 16 * scale }}>
                                <Img 
                                    src={post.avatarUrl} 
                                    style={{
                                        width: 60 * scale,
                                        height: 60 * scale,
                                        borderRadius: '50%',
                                        objectFit: 'cover',
                                    }}
                                />
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 20 * scale, fontWeight: 700, color: '#fff' }}>
                                        {post.username}
                                    </div>
                                    <div style={{ fontSize: 16 * scale, color: COLORS.textMuted }}>
                                        {post.handle}
                                    </div>
                                </div>
                                {/* Platform Icon (simplified string) */}
                                <div style={{ fontSize: 24 * scale, opacity: 0.5 }}>
                                    {post.platform === 'twitter' ? '𝕏' : post.platform === 'linkedin' ? 'in' : '🧵'}
                                </div>
                            </div>
                            
                            {/* Post Body */}
                            <div style={{ 
                                fontSize: 22 * scale, 
                                lineHeight: 1.5,
                                color: COLORS.textPrimary,
                            }}>
                                {post.text}
                            </div>
                            
                            {/* Post Footer */}
                            <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: 24 * scale,
                                color: COLORS.textMuted,
                                fontSize: 16 * scale,
                                marginTop: 10 * scale,
                            }}>
                                <span>💬 Reply</span>
                                <span>🔁 Repost</span>
                                <span style={{ color: '#ef4444' }}>❤️ {post.likes}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </AbsoluteFill>
    );
};

registerTemplate({
    tags: [],
    id: 'social-post-grid-01',
    name: 'Social Proof Post Grid',
    description: 'A staggered grid of simulated social media posts popping up to show viral traction.',
    category: 'business-marketing',
    durationInFrames: 180,
    fps: 30,
    component: SocialPostGrid,
    schema: socialPostGridSchema,
    defaultProps: socialPostGridSchema.parse({}),
});
