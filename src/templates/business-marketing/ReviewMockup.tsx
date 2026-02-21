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

export const reviewMockupSchema = z.object({
    platform: z.enum(['trustpilot', 'g2', 'capterra']).default('trustpilot'),
    reviewerName: z.string().default('Michael R.'),
    reviewerRole: z.string().default('Marketing Director'),
    rating: z.number().min(1).max(5).default(5),
    title: z.string().default('Literally changed how we work.'),
    content: z.string().default('Before Lapaas, we struggled to keep up with the demand for video content across all our social channels. Now, a single editor can produce 10x the output without sacrificing quality. The AI auto-B-roll feature is actual magic.'),
    date: z.string().default('2 days ago'),
    backgroundColor: z.string().default('#f4f4f5'), // Light gray bg
    textColor: z.string().default('#1c1c1f'),
});

type Props = z.infer<typeof reviewMockupSchema>;

export const ReviewMockup: React.FC<Props> = ({
    platform,
    reviewerName,
    reviewerRole,
    rating,
    title,
    content,
    date,
    backgroundColor,
    textColor,
}) => {
    const frame = useCurrentFrame();
    const { fps, width, height } = useVideoConfig();
    const scale = useScaleFactor();
    const isPortrait = useIsPortrait();

    const pop = spring({ frame: frame - 15, fps, config: { damping: 14, mass: 1.2 } });
    const op = interpolate(frame - 15, [0, 10], [0, 1], { extrapolateRight: 'clamp' });

    // Mockup Dimensions
    const cardWidth = isPortrait ? width * 0.9 : 800 * scale;

    // Platform specific colors/styling
    let platformColor = '#00b67a'; // Trustpilot green
    let platformLogoText = 'Trustpilot';
    if (platform === 'g2') {
        platformColor = '#ff492c'; // G2 red
        platformLogoText = 'G2';
    } else if (platform === 'capterra') {
        platformColor = '#0033cc'; // Capterra blue
        platformLogoText = 'Capterra';
    }

    return (
        <AbsoluteFill style={{ backgroundColor, fontFamily: interFont, alignItems: 'center', justifyContent: 'center' }}>
            <div style={{
                width: cardWidth,
                backgroundColor: '#ffffff',
                borderRadius: 16 * scale,
                padding: `${40 * scale}px`,
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 20px 40px rgba(0,0,0,0.08)',
                border: '1px solid rgba(0,0,0,0.05)',
                transform: `scale(${interpolate(pop, [0, 1], [0.95, 1])}) translateY(${(1 - pop) * 40}px)`,
                opacity: op,
                position: 'relative',
                overflow: 'hidden',
            }}>
                {/* Platform Top Accent */}
                <div style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0,
                    height: 6 * scale,
                    backgroundColor: platformColor,
                }} />

                {/* Header (Platform Logo + Date) */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 * scale }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 * scale }}>
                        {platform === 'trustpilot' && (
                            <svg viewBox="0 0 512 512" width={32 * scale} height={32 * scale} fill={platformColor}>
                                <path d="M256,12.2l76.7,155.3l171.3,24.9L380.1,313.2l29.2,170.6L256,403.3l-153.3,80.6L132,313.2L8.1,192.4 l171.3-24.9L256,12.2z" />
                            </svg>
                        )}
                        <span style={{ fontSize: 24 * scale, fontWeight: 800, color: textColor, letterSpacing: '-0.5px' }}>
                            {platformLogoText}
                        </span>
                    </div>
                    <div style={{ fontSize: 16 * scale, color: '#6b7280' }}>
                        {date}
                    </div>
                </div>

                {/* Reviewer Info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 * scale, marginBottom: 24 * scale }}>
                    <div style={{
                        width: 56 * scale,
                        height: 56 * scale,
                        borderRadius: '50%',
                        backgroundColor: '#f3f4f6',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 24 * scale,
                        fontWeight: 700,
                        color: platformColor,
                        border: `2px solid ${platformColor}20`,
                    }}>
                        {reviewerName.charAt(0)}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <div style={{ fontSize: 20 * scale, fontWeight: 700, color: textColor }}>
                            {reviewerName}
                        </div>
                        <div style={{ fontSize: 16 * scale, color: '#6b7280' }}>
                            {reviewerRole}
                        </div>
                    </div>
                    {/* Verified check */}
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 * scale, color: '#6b7280', fontSize: 14 * scale, fontWeight: 600 }}>
                        <svg width={18 * scale} height={18 * scale} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        Verified User
                    </div>
                </div>

                {/* Stars */}
                <div style={{ display: 'flex', gap: 4 * scale, marginBottom: 20 * scale }}>
                    {[1, 2, 3, 4, 5].map(star => {
                        const starDelay = 25 + star * 5;
                        const starPop = spring({ frame: frame - starDelay, fps, config: { damping: 12 } });
                        return (
                            <div key={star} style={{
                                width: 36 * scale,
                                height: 36 * scale,
                                backgroundColor: star <= rating ? platformColor : '#e5e7eb',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: 4 * scale, // Trustpilot style blocks
                                transform: `scale(${interpolate(starPop, [0, 1], [0.5, 1])})`,
                                opacity: interpolate(frame - starDelay, [0, 5], [0, 1], { extrapolateRight: 'clamp' }),
                            }}>
                                <svg viewBox="0 0 24 24" width={24 * scale} height={24 * scale} fill="#ffffff">
                                    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                                </svg>
                            </div>
                        );
                    })}
                </div>

                {/* Title */}
                <div style={{
                    fontSize: 28 * scale,
                    fontWeight: 800,
                    color: textColor,
                    marginBottom: 16 * scale,
                    lineHeight: 1.3,
                }}>
                    "{title}"
                </div>

                {/* Content */}
                <div style={{
                    fontSize: 20 * scale,
                    color: '#374151',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                }}>
                    {content}
                </div>
            </div>
        </AbsoluteFill>
    );
};

registerTemplate({
    id: 'review-mockup-01',
    name: 'Trustpilot/G2 Review Card',
    description: 'A realistic review card simulating Trustpilot, G2, or Capterra to build instant credibility.',
    category: 'platform-mockups',
    durationInFrames: 180,
    fps: 30,
    component: ReviewMockup,
    schema: reviewMockupSchema,
    defaultProps: reviewMockupSchema.parse({}),
});
