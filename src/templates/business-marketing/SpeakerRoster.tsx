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

export const speakerRosterSchema = z.object({
    title: z.string().default('Hosted By'),
    subtitle: z.string().default('Industry Experts & Thought Leaders'),
    speakers: z.array(z.object({
        name: z.string(),
        title: z.string(),
        company: z.string(),
        avatarUrl: z.string(),
        color: z.string(),
    })).default([
        { name: 'Dr. Emily Chen', title: 'Chief AI Officer', company: 'TechNova', avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300', color: '#3b82f6' },
        { name: 'James Wilson', title: 'VP of Engineering', company: 'GlobalData', avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300', color: '#10b981' },
        { name: 'Sarah Patel', title: 'Director of Product', company: 'InnovateInc', avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=300', color: '#f59e0b' },
    ]),
    backgroundColor: z.string().default('#0f172a'),
    textColor: z.string().default('#ffffff'),
    cardBgColor: z.string().default('#1e293b'),
});

type Props = z.infer<typeof speakerRosterSchema>;

export const SpeakerRoster: React.FC<Props> = ({
    title,
    subtitle,
    speakers,
    backgroundColor,
    textColor,
    cardBgColor,
}) => {
    const frame = useCurrentFrame();
    const { fps, width, height } = useVideoConfig();
    const scale = useScaleFactor();
    const isPortrait = useIsPortrait();

    const titleY = spring({ frame, fps, config: { damping: 12 } });
    const titleOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

    // Grid layout
    const totalSpeakers = speakers.length;
    // Auto calculate columns based on count and aspect ratio
    const cols = isPortrait ? 1 : Math.min(3, totalSpeakers);
    
    const paddingX = isPortrait ? 60 * scale : 120 * scale;
    const gap = isPortrait ? 30 * scale : 60 * scale;
    const availableWidth = width - (paddingX * 2);

    return (
        <AbsoluteFill style={{ backgroundColor, fontFamily: interFont, color: textColor }}>
            {/* Header */}
            <div style={{
                position: 'absolute',
                top: isPortrait ? 100 * scale : 80 * scale,
                left: 0,
                width: '100%',
                textAlign: 'center',
                transform: `translateY(${(1 - titleY) * -30}px)`,
                opacity: titleOpacity,
            }}>
                <EditableText
                    text={title}
                    style={{
                        fontFamily: montserratFont,
                        fontWeight: 800,
                        fontSize: (isPortrait ? 60 : 72) * scale,
                        margin: 0,
                        letterSpacing: '-0.02em',
                        color: textColor,
                    }}
                />
                <EditableText
                    text={subtitle}
                    style={{
                        fontSize: (isPortrait ? 24 : 32) * scale,
                        opacity: 0.6,
                        marginTop: 10 * scale,
                    }}
                />
            </div>

            {/* Grid */}
            <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -40%)',
                display: 'grid',
                gridTemplateColumns: `repeat(${cols}, 1fr)`,
                gap: gap,
                width: availableWidth,
                maxWidth: 1400 * scale,
            }}>
                {speakers.map((speaker, i) => {
                    // Staggered slide up
                    const delay = 15 + i * 10;
                    const pop = spring({ frame: frame - delay, fps, config: { damping: 14 } });
                    const op = interpolate(frame - delay, [0, 10], [0, 1], { extrapolateRight: 'clamp' });
                    
                    return (
                        <div key={i} style={{
                            backgroundColor: cardBgColor,
                            borderRadius: 24 * scale,
                            padding: isPortrait ? 30 * scale : 40 * scale,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            textAlign: 'center',
                            transform: `translateY(${(1 - pop) * 100}px)`,
                            opacity: op,
                            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
                            position: 'relative',
                            overflow: 'hidden',
                        }}>
                            {/* Color Accent Top Bar */}
                            <div style={{
                                position: 'absolute',
                                top: 0, left: 0, right: 0,
                                height: 8 * scale,
                                backgroundColor: speaker.color,
                            }} />

                            {/* Avatar */}
                            <div style={{
                                width: (isPortrait ? 120 : 160) * scale,
                                height: (isPortrait ? 120 : 160) * scale,
                                borderRadius: '50%',
                                marginBottom: 24 * scale,
                                padding: 6 * scale,
                                border: `2px dashed ${speaker.color}40`,
                                position: 'relative',
                            }}>
                                <Img 
                                    src={speaker.avatarUrl} 
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        borderRadius: '50%',
                                        objectFit: 'cover',
                                        backgroundColor: '#fff',
                                    }}
                                />
                                {/* Small floating icon/badge */}
                                <div style={{
                                    position: 'absolute',
                                    bottom: 0,
                                    right: 0,
                                    width: 40 * scale,
                                    height: 40 * scale,
                                    backgroundColor: speaker.color,
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#fff',
                                    fontSize: 20 * scale,
                                    boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
                                }}>
                                    🎤
                                </div>
                            </div>

                            <div style={{
                                fontSize: (isPortrait ? 28 : 32) * scale,
                                fontWeight: 800,
                                fontFamily: montserratFont,
                                color: '#fff',
                                marginBottom: 12 * scale,
                            }}>
                                {speaker.name}
                            </div>
                            
                            <div style={{
                                fontSize: (isPortrait ? 18 : 20) * scale,
                                fontWeight: 600,
                                color: speaker.color,
                                marginBottom: 4 * scale,
                            }}>
                                {speaker.title}
                            </div>

                            <div style={{
                                fontSize: (isPortrait ? 16 : 18) * scale,
                                color: 'rgba(255,255,255,0.6)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                            }}>
                                {speaker.company}
                            </div>
                        </div>
                    );
                })}
            </div>
        </AbsoluteFill>
    );
};

registerTemplate({
    id: 'speaker-roster-01',
    name: 'Event Speaker Roster',
    description: 'A dynamic grid of speaker profiles with avatars, names, titles, and companies.',
    category: 'business-marketing',
    durationInFrames: 180,
    fps: 30,
    component: SpeakerRoster,
    schema: speakerRosterSchema,
    defaultProps: speakerRosterSchema.parse({}),
});
