import React from 'react';
import {
    AbsoluteFill,
    useCurrentFrame,
    useVideoConfig,
    interpolate,
    spring,
    } from 'remotion';
import { z } from 'zod';
import { useIsPortrait, useScaleFactor } from '../../lib/responsive';
import {
    resolveCanvasBackground,
    useResolvedBackgroundControls,
} from '../../lib/background';
import { registerTemplate } from '../registry';
import { interFont } from '../../lib/fonts';

export const googleSearchMockupSchema = z.object({
    searchQuery: z.string().default('best ai video editor for marketing'),
    results: z.array(z.object({
        title: z.string(),
        url: z.string(),
        description: z.string(),
        isAd: z.boolean().default(false),
    })).default([
        { title: 'Lapaas AI Editor | The #1 Marketing Video Tool', url: 'https://lapaas.com/ai-editor', description: 'Create viral short-form content 10x faster. Automated B-roll, smart captions, and dynamic templates built for marketers.', isAd: true },
        { title: 'Top 10 AI Video Editors in 2024 - Reviews', url: 'https://techradar.com/reviews/best-ai-video-editors', description: 'We tested the top AI video editing software. See why Lapaas ranked #1 for agencies and marketing teams.', isAd: false },
        { title: 'How to automate your video marketing with AI', url: 'https://blog.hubspot.com/marketing/ai-video', description: 'Learn how modern marketing teams are using AI to scale their video production without increasing headcount.', isAd: false },
    ]),
    backgroundColor: z.string().default('#ffffff'),
    textColor: z.string().default('#202124'),
});

type Props = z.infer<typeof googleSearchMockupSchema>;

export const GoogleSearchMockup: React.FC<Props> = ({
    searchQuery,
    results,
    backgroundColor,
    textColor,
}) => {
    const frame = useCurrentFrame();
    const { fps, width, height } = useVideoConfig();
    
    const scale = useScaleFactor();
    const isPortrait = useIsPortrait();
    const backgroundControls = useResolvedBackgroundControls();

    const paddingX = isPortrait ? 40 * scale : 120 * scale;
    const availableWidth = width - (paddingX * 2);
    
    // Typing animation for search bar
    const charsToShow = Math.floor(interpolate(frame, [15, 60], [0, searchQuery.length], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }));
    const currentQuery = searchQuery.slice(0, charsToShow);
    
    // Search progress
    const isSearchComplete = frame > 75; // "Enter" pressed at frame 75
    const resultsPop = spring({ frame: frame - 80, fps, config: { damping: 14 } });

    return (
        <AbsoluteFill style={{ backgroundColor, fontFamily: interFont, color: textColor }}>
            {/* Top Bar / Search Header */}
            <div style={{
                position: 'absolute',
                top: 0, left: 0, right: 0,
                background: resolveCanvasBackground('#ffffff', backgroundControls),
                borderBottom: isSearchComplete ? '1px solid #dfe1e5' : 'none',
                padding: isPortrait ? `${40 * scale}px ${paddingX}px ${20 * scale}px` : `${30 * scale}px ${paddingX}px`,
                display: 'flex',
                flexDirection: isPortrait ? 'column' : 'row',
                alignItems: isPortrait ? 'flex-start' : 'center',
                gap: 30 * scale,
                boxShadow: isSearchComplete ? '0 1px 6px rgba(32,33,36,0.1)' : 'none',
                transform: `translateY(${isSearchComplete ? 0 : (height / 2 - 150 * scale)}px)`,
                transition: 'transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)',
                zIndex: 10,
            }}>
                {/* Fake Google Logo */}
                <div style={{
                    fontSize: 40 * scale,
                    fontWeight: 700,
                    letterSpacing: '-2px',
                    display: 'flex',
                    transform: isSearchComplete ? 'scale(0.8)' : (isPortrait ? 'scale(1.5) translateX(30px)' : 'scale(2) translateX(40px)'),
                    transition: 'transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)',
                    marginBottom: isPortrait && !isSearchComplete ? 60 * scale : 0,
                }}>
                    <span style={{ color: '#4285f4' }}>G</span>
                    <span style={{ color: '#ea4335' }}>o</span>
                    <span style={{ color: '#fbbc05' }}>o</span>
                    <span style={{ color: '#4285f4' }}>g</span>
                    <span style={{ color: '#34a853' }}>l</span>
                    <span style={{ color: '#ea4335' }}>e</span>
                </div>

                {/* Search Bar */}
                <div style={{
                    flex: 1,
                    maxWidth: 800 * scale,
                    height: 60 * scale,
                    borderRadius: 30 * scale,
                    border: '1px solid #dfe1e5',
                    backgroundColor: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    padding: `0 ${20 * scale}px`,
                    boxShadow: '0 1px 6px rgba(32,33,36,0.2)',
                    fontSize: 20 * scale,
                }}>
                    <svg width={24 * scale} height={24 * scale} viewBox="0 0 24 24" fill="none" stroke="#9aa0a6" strokeWidth="2">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                    <div style={{ marginLeft: 16 * scale, color: '#202124', flex: 1, display: 'flex' }}>
                        {currentQuery}
                        {/* Blinking Cursor */}
                        {!isSearchComplete && frame % 20 < 10 && (
                            <div style={{ width: 2 * scale, height: 24 * scale, backgroundColor: '#000', marginLeft: 2 * scale }} />
                        )}
                    </div>
                </div>
            </div>

            {/* Search Results */}
            {isSearchComplete && (
                <div style={{
                    position: 'absolute',
                    top: isPortrait ? 220 * scale : 150 * scale,
                    left: paddingX,
                    width: availableWidth,
                    maxWidth: 800 * scale, // Google results max width roughly
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 40 * scale,
                    paddingBottom: 100 * scale,
                }}>
                    <div style={{ color: '#70757a', fontSize: 16 * scale, opacity: resultsPop }}>
                        About {Math.floor(Math.random() * 900 + 100).toLocaleString()},000,000 results (0.42 seconds)
                    </div>

                    {results.map((result, i) => {
                        const delay = 85 + i * 10;
                        const resPop = spring({ frame: frame - delay, fps, config: { damping: 14 } });
                        const op = interpolate(frame - delay, [0, 10], [0, 1], { extrapolateRight: 'clamp' });

                        return (
                            <div key={i} style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 6 * scale,
                                transform: `translateY(${(1 - resPop) * 20}px)`,
                                opacity: op,
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 * scale }}>
                                    {/* Favicon Fake */}
                                    <div style={{ width: 28 * scale, height: 28 * scale, borderRadius: '50%', backgroundColor: '#f1f3f4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 * scale }}>
                                        🌐
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <div style={{ fontSize: 16 * scale, color: '#202124' }}>
                                            {result.url.split('/')[2]}
                                        </div>
                                        <div style={{ fontSize: 14 * scale, color: '#4d5156' }}>
                                            {result.url}
                                        </div>
                                    </div>
                                </div>
                                
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 * scale, marginTop: 4 * scale }}>
                                    {result.isAd && (
                                        <span style={{ fontWeight: 700, fontSize: 16 * scale, color: '#202124' }}>Sponsored</span>
                                    )}
                                    <div style={{
                                        fontSize: 24 * scale,
                                        color: '#1a0dab',
                                        textDecoration: 'none',
                                        cursor: 'pointer',
                                    }}>
                                        {result.title}
                                    </div>
                                </div>
                                
                                <div style={{
                                    fontSize: 18 * scale,
                                    color: '#4d5156',
                                    lineHeight: 1.5,
                                    marginTop: 4 * scale,
                                }}>
                                    {result.description}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </AbsoluteFill>
    );
};

registerTemplate({
    tags: [],
    id: 'google-search-mockup-01',
    name: 'Google Search Mockup',
    description: 'Simulates typing a query into Google and returning a list of search results or ads.',
    category: 'platform-mockups',
    durationInFrames: 240,
    fps: 30,
    component: GoogleSearchMockup,
    schema: googleSearchMockupSchema,
    defaultProps: googleSearchMockupSchema.parse({}),
});
