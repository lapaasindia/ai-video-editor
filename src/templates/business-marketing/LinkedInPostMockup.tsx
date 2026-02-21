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

export const linkedinPostMockupSchema = z.object({
    name: z.string().default('Sarah Jenkins'),
    headline: z.string().default('CMO at TechFlow | B2B Growth Strategy'),
    time: z.string().default('2h • Edited • 🌐'),
    avatarUrl: z.string().default('https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150'),
    content: z.string().default('I’m thrilled to announce that our marketing team has fully transitioned to AI-driven workflows.\n\nHere are 3 things we learned:\n1. Video production time dropped by 80%\n2. Team morale is at an all-time high\n3. Our ROI has doubled\n\nWhat tools are you using to scale your content? 👇'),
    likesCount: z.string().default('1,482'),
    commentsCount: z.string().default('342 comments'),
    repostsCount: z.string().default('184 reposts'),
    backgroundColor: z.string().default('#f3f2ef'),
    textColor: z.string().default('#000000'),
});

type Props = z.infer<typeof linkedinPostMockupSchema>;

export const LinkedInPostMockup: React.FC<Props> = ({
    name,
    headline,
    time,
    avatarUrl,
    content,
    likesCount,
    commentsCount,
    repostsCount,
    }) => {
    const frame = useCurrentFrame();
    const { fps, width } = useVideoConfig();
    
    const scale = useScaleFactor();
    const isPortrait = useIsPortrait();
    const backgroundControls = useResolvedBackgroundControls();

    const pop = spring({ frame: frame - 10, fps, config: { damping: 14, mass: 1.2 } });
    const op = interpolate(frame - 10, [0, 10], [0, 1], { extrapolateRight: 'clamp' });

    // Mockup Dimensions
    const cardWidth = isPortrait ? width * 0.9 : 700 * scale;

    return (
        <AbsoluteFill style={{ background: resolveCanvasBackground('#f3f2ef', backgroundControls), fontFamily: interFont, alignItems: 'center', justifyContent: 'center' }}>
            <div style={{
                width: cardWidth,
                backgroundColor: '#ffffff',
                borderRadius: 12 * scale,
                border: '1px solid #e0dfdc',
                padding: `${16 * scale}px`,
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                transform: `scale(${interpolate(pop, [0, 1], [0.95, 1])}) translateY(${(1 - pop) * 30}px)`,
                opacity: op,
            }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 * scale }}>
                    <div style={{ display: 'flex', gap: 12 * scale }}>
                        <Img src={avatarUrl} style={{ width: 48 * scale, height: 48 * scale, borderRadius: '50%', objectFit: 'cover' }} />
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <div style={{ fontSize: 16 * scale, fontWeight: 700, color: '#000000', display: 'flex', alignItems: 'center', gap: 6 * scale }}>
                                {name}
                                <span style={{ color: '#666666', fontSize: 14 * scale, fontWeight: 400 }}>• 1st</span>
                            </div>
                            <div style={{ fontSize: 14 * scale, color: '#666666', marginTop: 2 * scale, maxWidth: 450 * scale, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {headline}
                            </div>
                            <div style={{ fontSize: 12 * scale, color: '#666666', marginTop: 2 * scale }}>
                                {time}
                            </div>
                        </div>
                    </div>
                    {/* Plus / Follow button fake */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 * scale }}>
                        <div style={{ color: '#0a66c2', fontSize: 16 * scale, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 * scale }}>
                            <svg viewBox="0 0 24 24" width={16 * scale} height={16 * scale} fill="currentColor">
                                <path d="M14 12V8h-4v4H6v4h4v4h4v-4h4v-4h-4z" />
                            </svg>
                            Follow
                        </div>
                        <svg viewBox="0 0 24 24" width={24 * scale} height={24 * scale} fill="#666666">
                            <path d="M14 12a2 2 0 11-4 0 2 2 0 014 0zM7 12a2 2 0 11-4 0 2 2 0 014 0zm14 0a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                    </div>
                </div>

                {/* Content */}
                <div style={{
                    fontSize: 16 * scale,
                    lineHeight: 1.5,
                    color: '#000000',
                    whiteSpace: 'pre-wrap',
                    marginBottom: 16 * scale,
                }}>
                    {content}
                </div>

                {/* Stats */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: 12 * scale,
                    color: '#666666',
                    paddingBottom: 8 * scale,
                    borderBottom: '1px solid #e0dfdc',
                    marginBottom: 8 * scale,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 * scale }}>
                        {/* Reaction icons */}
                        <div style={{ display: 'flex' }}>
                            <div style={{ width: 16 * scale, height: 16 * scale, borderRadius: '50%', backgroundColor: '#0a66c2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10 * scale, zIndex: 3 }}>👍</div>
                            <div style={{ width: 16 * scale, height: 16 * scale, borderRadius: '50%', backgroundColor: '#df704d', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10 * scale, marginLeft: -6 * scale, zIndex: 2, border: '1px solid #fff' }}>💡</div>
                            <div style={{ width: 16 * scale, height: 16 * scale, borderRadius: '50%', backgroundColor: '#5fa453', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10 * scale, marginLeft: -6 * scale, zIndex: 1, border: '1px solid #fff' }}>👏</div>
                        </div>
                        <span style={{ marginLeft: 4 * scale }}>{likesCount}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8 * scale }}>
                        <span>{commentsCount}</span>
                        <span>•</span>
                        <span>{repostsCount}</span>
                    </div>
                </div>

                {/* Actions */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: 4 * scale,
                }}>
                    {/* Animated Like Button */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 * scale, color: frame > 40 ? '#0a66c2' : '#666666', fontWeight: 600, fontSize: 14 * scale, transform: `scale(${interpolate(spring({ frame: frame - 40, fps, config: { damping: 10 } }), [0, 0.5, 1], [1, 1.1, 1])})` }}>
                        {frame > 40 ? (
                            <svg viewBox="0 0 24 24" width={24 * scale} height={24 * scale} fill="currentColor"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm3.1 14.1l-4.1-4.1V7h2v4.2l3.5 3.5-1.4 1.4z"/></svg>
                        ) : (
                            <svg viewBox="0 0 24 24" width={24 * scale} height={24 * scale} fill="currentColor"><path d="M21 12v-1.12l-1.85-.26c-.16-.48-.38-.93-.66-1.34l1.1-1.48-2.12-2.12-1.48 1.1c-.41-.28-.86-.5-1.34-.66L14.39 4h-4.78l-.26 1.85c-.48.16-.93.38-1.34.66l-1.48-1.1-2.12 2.12 1.1 1.48c-.28.41-.5.86-.66 1.34L3 10.88V12h2v4l3.5 3.5 1.4-1.4L7.5 16h9l-2.4 2.1 1.4 1.4L19 16v-4h2zM7 11c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg>
                        )}
                        Like
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 * scale, color: '#666666', fontWeight: 600, fontSize: 14 * scale }}>
                        <svg viewBox="0 0 24 24" width={24 * scale} height={24 * scale} fill="currentColor"><path d="M7 9h10v1H7zm0 4h7v-1H7zm11-9H6a3 3 0 00-3 3v13.62l4.81-2.62H18a3 3 0 003-3V7a3 3 0 00-3-3zm1 10a1 1 0 01-1 1H7.39l-2.39 1.3V7a1 1 0 011-1h12a1 1 0 011 1z"/></svg>
                        Comment
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 * scale, color: '#666666', fontWeight: 600, fontSize: 14 * scale }}>
                        <svg viewBox="0 0 24 24" width={24 * scale} height={24 * scale} fill="currentColor"><path d="M23 12l-4.6 5.3v-3.8H12v-3h6.4V6.7zM6.4 13.5v3.8L1.8 12l4.6-5.3v3.8H13v3z"/></svg>
                        Repost
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 * scale, color: '#666666', fontWeight: 600, fontSize: 14 * scale }}>
                        <svg viewBox="0 0 24 24" width={24 * scale} height={24 * scale} fill="currentColor"><path d="M21 3L0 10l7.66 4.26L16 8l-6.26 8.34L14 24l7-21z"/></svg>
                        Send
                    </div>
                </div>
            </div>
        </AbsoluteFill>
    );
};

registerTemplate({
    tags: [],
    id: 'linkedin-post-mockup-01',
    name: 'LinkedIn Post Mockup',
    description: 'A professional B2B LinkedIn post mockup, perfect for business marketing.',
    category: 'platform-mockups',
    durationInFrames: 150,
    fps: 30,
    component: LinkedInPostMockup,
    schema: linkedinPostMockupSchema,
    defaultProps: linkedinPostMockupSchema.parse({}),
});
