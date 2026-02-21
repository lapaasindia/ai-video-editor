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

export const webinarAgendaSchema = z.object({
    title: z.string().default('Summit 2024'),
    subtitle: z.string().default('Day 1 Schedule'),
    sessions: z.array(z.object({
        time: z.string(),
        title: z.string(),
        speaker: z.string(),
    })).default([
        { time: '09:00 AM', title: 'Opening Keynote', speaker: 'CEO Jane Doe' },
        { time: '10:30 AM', title: 'The Future of AI', speaker: 'Dr. Alan Turing' },
        { time: '01:00 PM', title: 'Panel: Scaling Remote Teams', speaker: 'Founders Round Table' },
        { time: '03:15 PM', title: 'Product Deep Dive', speaker: 'Product Team' },
        { time: '05:00 PM', title: 'Closing Remarks', speaker: 'VP of Marketing' },
    ]),
    backgroundColor: z.string().default('#0f172a'),
    textColor: z.string().default('#ffffff'),
    accentColor: z.string().default('#facc15'),
});

type Props = z.infer<typeof webinarAgendaSchema>;

export const WebinarAgenda: React.FC<Props> = ({
    title,
    subtitle,
    sessions,
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

    const totalSessions = sessions.length;
    const paddingX = isPortrait ? 60 * scale : 120 * scale;
    const availableWidth = width - (paddingX * 2);

    return (
        <AbsoluteFill style={{ backgroundColor, fontFamily: interFont, color: textColor }}>
            {/* Header */}
            <div style={{
                position: 'absolute',
                top: isPortrait ? 100 * scale : 80 * scale,
                left: paddingX,
                width: availableWidth,
                textAlign: 'left',
                transform: `translateY(${(1 - titleY) * -30}px)`,
                opacity: titleOpacity,
            }}>
                <EditableText
                    text={title}
                    style={{
                        fontFamily: montserratFont,
                        fontWeight: 900,
                        fontSize: (isPortrait ? 80 : 96) * scale,
                        margin: 0,
                        letterSpacing: '-0.03em',
                        color: accentColor,
                        textTransform: 'uppercase',
                    }}
                />
                <EditableText
                    text={subtitle}
                    style={{
                        fontSize: (isPortrait ? 32 : 40) * scale,
                        fontWeight: 600,
                        opacity: 0.8,
                        marginTop: 10 * scale,
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                    }}
                />
                <div style={{ width: 100 * scale, height: 4 * scale, backgroundColor: accentColor, marginTop: 20 * scale }} />
            </div>

            {/* Agenda List */}
            <div style={{
                position: 'absolute',
                top: isPortrait ? 350 * scale : 280 * scale,
                left: paddingX,
                width: availableWidth,
                display: 'flex',
                flexDirection: 'column',
                gap: isPortrait ? 30 * scale : 20 * scale,
            }}>
                {sessions.map((session, i) => {
                    const delay = 20 + i * 12;
                    const slideX = spring({ frame: frame - delay, fps, config: { damping: 14 } });
                    const op = interpolate(frame - delay, [0, 10], [0, 1], { extrapolateRight: 'clamp' });

                    return (
                        <div key={i} style={{
                            display: 'flex',
                            flexDirection: isPortrait ? 'column' : 'row',
                            alignItems: isPortrait ? 'flex-start' : 'center',
                            gap: isPortrait ? 8 * scale : 40 * scale,
                            transform: `translateX(${(1 - slideX) * 100}px)`,
                            opacity: op,
                            padding: isPortrait ? `${16 * scale}px 0` : `${20 * scale}px 0`,
                            borderBottom: i < totalSessions - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none',
                        }}>
                            {/* Time */}
                            <div style={{
                                fontSize: 24 * scale,
                                fontWeight: 800,
                                fontFamily: montserratFont,
                                color: accentColor,
                                width: isPortrait ? 'auto' : 160 * scale,
                                flexShrink: 0,
                                letterSpacing: '0.05em',
                            }}>
                                {session.time}
                            </div>
                            
                            {/* Content */}
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 * scale }}>
                                <div style={{
                                    fontSize: (isPortrait ? 28 : 32) * scale,
                                    fontWeight: 700,
                                    color: '#fff',
                                }}>
                                    {session.title}
                                </div>
                                <div style={{
                                    fontSize: 20 * scale,
                                    color: 'rgba(255,255,255,0.6)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 12 * scale,
                                }}>
                                    <span>🎤</span> {session.speaker}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </AbsoluteFill>
    );
};

registerTemplate({
    id: 'webinar-agenda-01',
    name: 'Event Schedule/Agenda',
    description: 'A clean list of sessions or schedule items that animate in sequentially.',
    category: 'business-marketing',
    durationInFrames: 180,
    fps: 30,
    component: WebinarAgenda,
    schema: webinarAgendaSchema,
    defaultProps: webinarAgendaSchema.parse({}),
});
