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
import { EditableText } from '../../components/EditableText';
import { registerTemplate } from '../registry';
import { COLORS } from '../../lib/theme';
import {
    resolveCanvasBackground,
    useResolvedBackgroundControls,
} from '../../lib/background';
import { interFont } from '../../lib/fonts';

export const contactInfoCardSchema = z.object({
    title: z.string().default('Let\'s Talk'),
    subtitle: z.string().default('Ready to scale your business?'),
    contacts: z.array(z.object({
        type: z.string(),
        value: z.string(),
        icon: z.string(),
    backgroundColor: z.string().default(COLORS.bg),
    })).default([
        { type: 'Email', value: 'hello@lapaas.com', icon: '✉️' },
        { type: 'Phone', value: '+91 98765 43210', icon: '📞' },
        { type: 'Address', value: 'New Delhi, India', icon: '📍' },
    ]),
    backgroundColor: z.string().default(COLORS.bg),
    textColor: z.string().default(COLORS.textPrimary),
    cardBgColor: z.string().default(COLORS.surface),
    accentColor: z.string().default(COLORS.accent),
});

type Props = z.infer<typeof contactInfoCardSchema>;

export const ContactInfoCard: React.FC<Props> = ({
    title,
    subtitle,
    contacts,
    backgroundColor,
    textColor,
    cardBgColor,
    accentColor,
}) => {
    const frame = useCurrentFrame();
    const { fps, width } = useVideoConfig();
    
    const scale = useScaleFactor();
    const backgroundControls = useResolvedBackgroundControls();
    const isPortrait = useIsPortrait();

    const titleY = spring({ frame, fps, config: { damping: 12 } });
    const titleOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

    const paddingX = isPortrait ? 60 * scale : 120 * scale;
    const cardWidth = isPortrait ? width - (paddingX * 2) : 800 * scale;
    
    // Animation for the main card dropping in
    const cardPop = spring({ frame: frame - 15, fps, config: { damping: 14, mass: 1.2 } });

    return (
        <AbsoluteFill style={{ background: resolveCanvasBackground(backgroundColor, backgroundControls), fontFamily: interFont, color: textColor, justifyContent: 'center', alignItems: 'center' }}>
            {/* Header */}
            <div style={{
                position: 'absolute',
                top: isPortrait ? 150 * scale : 150 * scale,
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
                        fontWeight: 900,
                        fontSize: (isPortrait ? 80 : 96) * scale,
                        margin: 0,
                        letterSpacing: '-0.03em',
                    }}
                />
                <EditableText
                    text={subtitle}
                    style={{
                        fontSize: (isPortrait ? 32 : 40) * scale,
                        opacity: 0.6,
                        marginTop: 10 * scale,
                    }}
                />
            </div>

            {/* Contact Card */}
            <div style={{
                width: cardWidth,
                backgroundColor: cardBgColor,
                borderRadius: 32 * scale,
                padding: isPortrait ? 60 * scale : 80 * scale,
                transform: `scale(${interpolate(cardPop, [0, 1], [0.9, 1])}) translateY(${(1 - cardPop) * 50}px)`,
                opacity: interpolate(cardPop, [0, 1], [0, 1]),
                boxShadow: '0 30px 60px rgba(0,0,0,0.3)',
                borderTop: `6px solid ${accentColor}`,
                display: 'flex',
                flexDirection: 'column',
                gap: 40 * scale,
                position: 'relative',
                overflow: 'hidden',
                marginTop: isPortrait ? 100 * scale : 150 * scale,
            }}>
                {/* Accent Glow inside card */}
                <div style={{
                    position: 'absolute',
                    top: -50 * scale,
                    right: -50 * scale,
                    width: 200 * scale,
                    height: 200 * scale,
                    backgroundColor: accentColor,
                    filter: `blur(${80 * scale}px)`,
                    opacity: 0.2,
                    zIndex: 0,
                }} />

                {contacts.map((contact, i) => {
                    const delay = 30 + i * 10;
                    const itemPop = spring({ frame: frame - delay, fps, config: { damping: 12 } });
                    const op = interpolate(frame - delay, [0, 10], [0, 1], { extrapolateRight: 'clamp' });

                    return (
                        <div key={i} style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 30 * scale,
                            transform: `translateX(${(1 - itemPop) * -30}px)`,
                            opacity: op,
                            zIndex: 1,
                        }}>
                            <div style={{
                                width: 80 * scale,
                                height: 80 * scale,
                                borderRadius: '50%',
                                backgroundColor: `${accentColor}20`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 40 * scale,
                                color: accentColor,
                                flexShrink: 0,
                                border: `2px solid ${accentColor}40`,
                            }}>
                                {contact.icon}
                            </div>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 * scale }}>
                                <div style={{
                                    fontSize: 20 * scale,
                                    fontWeight: 600,
                                    color: COLORS.textMuted,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.1em',
                                }}>
                                    {contact.type}
                                </div>
                                <div style={{
                                    fontSize: (isPortrait ? 32 : 40) * scale,
                                    fontWeight: 800,
                                    fontFamily: interFont,
                                    color: '#fff',
                                    letterSpacing: '0.02em',
                                }}>
                                    {contact.value}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
            
            {/* Website / Domain at bottom */}
            <div style={{
                position: 'absolute',
                bottom: 80 * scale,
                left: 0,
                width: '100%',
                textAlign: 'center',
                opacity: interpolate(frame - 100, [0, 20], [0, 1], { extrapolateRight: 'clamp' }),
                fontSize: 24 * scale,
                fontWeight: 700,
                color: accentColor,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
            }}>
                www.lapaas.com
            </div>
        </AbsoluteFill>
    );
};

registerTemplate({
    tags: [],
    id: 'contact-info-card-01',
    name: 'Contact Information Card',
    description: 'A polished, modern contact card that sequentially reveals contact methods.',
    category: 'social-hooks',
    durationInFrames: 180,
    fps: 30,
    component: ContactInfoCard,
    schema: contactInfoCardSchema,
    defaultProps: contactInfoCardSchema.parse({}),
});
