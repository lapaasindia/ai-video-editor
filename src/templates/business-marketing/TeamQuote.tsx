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
import { interFont, montserratFont } from '../../lib/fonts';

export const teamQuoteSchema = z.object({
    quote: z.string().default('Innovation distinguishes between a leader and a follower.'),
    author: z.string().default('Steve Jobs'),
    role: z.string().default('Co-founder, Apple'),
    avatarUrl: z.string().default('https://images.unsplash.com/photo-1550525811-e5869dd03032?w=300'),
    backgroundColor: z.string().default('#0f172a'),
    textColor: z.string().default('#ffffff'),
    accentColor: z.string().default('#3b82f6'),
});

type Props = z.infer<typeof teamQuoteSchema>;

export const TeamQuote: React.FC<Props> = ({
    quote,
    author,
    role,
    avatarUrl,
    backgroundColor,
    textColor,
    accentColor,
}) => {
    const frame = useCurrentFrame();
    const { fps, width, height } = useVideoConfig();
    const scale = useScaleFactor();
    const isPortrait = useIsPortrait();

    const titleY = spring({ frame, fps, config: { damping: 12 } });
    const titleOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

    const paddingX = isPortrait ? 60 * scale : 120 * scale;
    const availableWidth = width - (paddingX * 2);

    return (
        <AbsoluteFill style={{ backgroundColor, fontFamily: interFont, color: textColor, justifyContent: 'center', alignItems: 'center' }}>
            <div style={{
                width: availableWidth,
                maxWidth: 1200 * scale,
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: isPortrait ? 'center' : 'flex-start',
                textAlign: isPortrait ? 'center' : 'left',
            }}>
                {/* Large Decorative Quote Icon */}
                <div style={{
                    position: 'absolute',
                    top: -60 * scale,
                    left: isPortrait ? '50%' : -60 * scale,
                    transform: isPortrait ? 'translateX(-50%)' : 'none',
                    fontSize: 200 * scale,
                    color: accentColor,
                    opacity: 0.1,
                    fontFamily: 'serif',
                    lineHeight: 1,
                    zIndex: 0,
                }}>
                    "
                </div>

                {/* The Quote */}
                <EditableText
                    text={`"${quote}"`}
                    style={{
                        fontFamily: montserratFont,
                        fontWeight: 800,
                        fontSize: (isPortrait ? 60 : 72) * scale,
                        lineHeight: 1.3,
                        margin: 0,
                        letterSpacing: '-0.02em',
                        color: textColor,
                        transform: `translateY(${(1 - titleY) * -30}px)`,
                        opacity: titleOpacity,
                        zIndex: 1,
                        marginBottom: 60 * scale,
                        textShadow: '0 4px 20px rgba(0,0,0,0.5)',
                    }}
                />

                {/* Author Info */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 30 * scale,
                    transform: `translateX(${(1 - spring({ frame: frame - 20, fps, config: { damping: 12 } })) * -50}px)`,
                    opacity: interpolate(frame - 20, [0, 10], [0, 1], { extrapolateRight: 'clamp' }),
                    zIndex: 1,
                }}>
                    <Img 
                        src={avatarUrl}
                        style={{
                            width: 100 * scale,
                            height: 100 * scale,
                            borderRadius: '50%',
                            objectFit: 'cover',
                            border: `3px solid ${accentColor}`,
                            boxShadow: `0 10px 30px ${accentColor}40`,
                        }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 * scale, textAlign: 'left' }}>
                        <div style={{
                            fontSize: 32 * scale,
                            fontWeight: 800,
                            fontFamily: montserratFont,
                            color: '#fff',
                        }}>
                            {author}
                        </div>
                        <div style={{
                            fontSize: 20 * scale,
                            color: accentColor,
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                        }}>
                            {role}
                        </div>
                    </div>
                </div>
            </div>
        </AbsoluteFill>
    );
};

registerTemplate({
    id: 'team-quote-01',
    name: 'Impactful Quote',
    description: 'A bold, cinematic quote layout with a prominent author avatar and role.',
    category: 'social-proof',
    durationInFrames: 180,
    fps: 30,
    component: TeamQuote,
    schema: teamQuoteSchema,
    defaultProps: teamQuoteSchema.parse({}),
});
