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

export const teamRosterSchema = z.object({
    title: z.string().default('Meet The Experts'),
    subtitle: z.string().default('Industry leaders ready to help you scale.'),
    members: z.array(z.object({
        name: z.string(),
        role: z.string(),
        avatarUrl: z.string(),
        color: z.string(),
    backgroundColor: z.string().default(COLORS.bg),
    })).default([
        { name: 'Sarah Jenkins', role: 'Chief Marketing Officer', avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300', color: '#3b82f6' },
        { name: 'Marcus Chen', role: 'Head of Growth', avatarUrl: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=300', color: '#10b981' },
        { name: 'Elena Rodriguez', role: 'VP of Product', avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=300', color: '#f43f5e' },
        { name: 'David Kim', role: 'Lead Data Scientist', avatarUrl: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=300', color: '#a855f7' },
    ]),
    backgroundColor: z.string().default(COLORS.bg),
    textColor: z.string().default(COLORS.textPrimary),
    cardBgColor: z.string().default(COLORS.surface),
});

type Props = z.infer<typeof teamRosterSchema>;

export const TeamRosterGrid: React.FC<Props> = ({
    title,
    subtitle,
    members,
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

    // Grid layout
    const totalMembers = members.length;
    // Auto calculate columns based on count and aspect ratio
    const cols = isPortrait ? 2 : Math.min(4, Math.ceil(Math.sqrt(totalMembers)));
    
    const paddingX = isPortrait ? 40 * scale : 120 * scale;
    const gap = isPortrait ? 20 * scale : 40 * scale;
    const availableWidth = width - (paddingX * 2);

    return (
        <AbsoluteFill style={{ background: resolveCanvasBackground(backgroundColor, backgroundControls), fontFamily: interFont, color: textColor }}>
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
                        fontFamily: interFont,
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
                {members.map((member, i) => {
                    // Staggered slide up
                    const delay = 15 + i * 5;
                    const pop = spring({ frame: frame - delay, fps, config: { damping: 14 } });
                    const op = interpolate(frame - delay, [0, 10], [0, 1], { extrapolateRight: 'clamp' });
                    
                    return (
                        <div key={i} style={{
                            backgroundColor: cardBgColor,
                            borderRadius: 24 * scale,
                            padding: isPortrait ? 20 * scale : 40 * scale,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            textAlign: 'center',
                            transform: `translateY(${(1 - pop) * 100}px)`,
                            opacity: op,
                            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
                            borderTop: `4px solid ${member.color}`,
                            position: 'relative',
                            overflow: 'hidden',
                        }}>
                            {/* Avatar */}
                            <div style={{
                                width: (isPortrait ? 100 : 160) * scale,
                                height: (isPortrait ? 100 : 160) * scale,
                                borderRadius: '50%',
                                marginBottom: 20 * scale,
                                padding: 4 * scale,
                                backgroundColor: member.color,
                                boxShadow: `0 10px 20px ${member.color}40`,
                            }}>
                                <Img 
                                    src={member.avatarUrl} 
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        borderRadius: '50%',
                                        objectFit: 'cover',
                                    }}
                                />
                            </div>

                            <div style={{
                                fontSize: (isPortrait ? 20 : 28) * scale,
                                fontWeight: 800,
                                fontFamily: interFont,
                                color: '#fff',
                                marginBottom: 8 * scale,
                            }}>
                                {member.name}
                            </div>
                            
                            <div style={{
                                fontSize: (isPortrait ? 14 : 18) * scale,
                                fontWeight: 500,
                                color: member.color,
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                            }}>
                                {member.role}
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
    id: 'team-roster-grid-01',
    name: 'Team Roster Grid',
    description: 'A responsive grid of team members with avatars, names, and roles.',
    category: 'business-news',
    durationInFrames: 150,
    fps: 30,
    component: TeamRosterGrid,
    schema: teamRosterSchema,
    defaultProps: teamRosterSchema.parse({}),
});
