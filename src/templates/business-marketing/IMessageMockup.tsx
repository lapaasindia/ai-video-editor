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

export const imessageMockupSchema = z.object({
    contactName: z.string().default('Sarah (Marketing)'),
    contactAvatarUrl: z.string().default('https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150'),
    messages: z.array(z.object({
        text: z.string(),
        isMe: z.boolean(),
        hasTail: z.boolean().default(true),
    })).default([
        { text: 'Hey, did you see the new campaign metrics?', isMe: false },
        { text: 'Yes! The new video ads are converting at 4x the usual rate. 🚀', isMe: true },
        { text: 'How did you edit them so fast? We used to take days for that.', isMe: false },
        { text: 'Found this new AI tool called Lapaas. It literally does the B-roll and captions for you. 🤫', isMe: true },
    ]),
    backgroundColor: z.string().default('#000000'),
    textColor: z.string().default('#ffffff'),
    bubbleColorMe: z.string().default('#0A84FF'), // iMessage Blue
    bubbleColorThem: z.string().default('#3A3A3C'), // Dark mode gray
    textMe: z.string().default('#ffffff'),
    textThem: z.string().default('#ffffff'),
});

type Props = z.infer<typeof imessageMockupSchema>;

export const IMessageMockup: React.FC<Props> = ({
    contactName,
    contactAvatarUrl,
    messages,
    backgroundColor,
    textColor,
    bubbleColorMe,
    bubbleColorThem,
    textMe,
    textThem,
}) => {
    const frame = useCurrentFrame();
    const { fps, width, height } = useVideoConfig();
    const scale = useScaleFactor();
    const isPortrait = useIsPortrait();

    const paddingX = isPortrait ? 20 * scale : 120 * scale;
    const phoneWidth = isPortrait ? width : 450 * scale;
    const phoneHeight = isPortrait ? height : 850 * scale;

    // Pop in animation for the whole phone
    const phonePop = spring({ frame: frame - 10, fps, config: { damping: 14 } });

    return (
        <AbsoluteFill style={{ backgroundColor, fontFamily: interFont, alignItems: 'center', justifyContent: 'center' }}>
            <div style={{
                width: phoneWidth,
                height: phoneHeight,
                backgroundColor: '#000000',
                borderRadius: isPortrait ? 0 : 40 * scale,
                border: isPortrait ? 'none' : `12px solid #1a1a1a`,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                position: 'relative',
                transform: isPortrait ? 'none' : `scale(${interpolate(phonePop, [0, 1], [0.9, 1])}) translateY(${(1 - phonePop) * 50}px)`,
                opacity: isPortrait ? 1 : interpolate(phonePop, [0, 1], [0, 1]),
                boxShadow: isPortrait ? 'none' : '0 30px 60px rgba(0,0,0,0.8)',
            }}>
                {/* Header */}
                <div style={{
                    backgroundColor: 'rgba(30,30,30,0.85)',
                    backdropFilter: 'blur(20px)',
                    padding: `${isPortrait ? 60 * scale : 40 * scale}px ${20 * scale}px ${16 * scale}px`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                    zIndex: 10,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', color: '#0A84FF', fontSize: 18 * scale, gap: 4 * scale }}>
                        <svg viewBox="0 0 24 24" width={24 * scale} height={24 * scale} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="15 18 9 12 15 6"></polyline>
                        </svg>
                        <span style={{ marginTop: 2 * scale }}>44</span>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 * scale }}>
                        <Img src={contactAvatarUrl} style={{ width: 44 * scale, height: 44 * scale, borderRadius: '50%', objectFit: 'cover' }} />
                        <div style={{ fontSize: 12 * scale, fontWeight: 500, color: '#fff' }}>
                            {contactName}
                            <span style={{ color: '#8e8e93', fontSize: 16 * scale, marginLeft: 2 * scale }}>›</span>
                        </div>
                    </div>
                    
                    <div style={{ width: 40 * scale }} /> {/* Spacer for centering */}
                </div>

                {/* Messages Area */}
                <div style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    padding: `${20 * scale}px`,
                    gap: 16 * scale,
                    // Auto-scroll logic: move the container up as new messages arrive
                    transform: `translateY(${interpolate(frame, [100, 200], [0, messages.length > 3 ? -100 * scale : 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}px)`,
                }}>
                    {/* Timestamp */}
                    <div style={{ textAlign: 'center', fontSize: 12 * scale, color: '#8e8e93', fontWeight: 600, marginBottom: 8 * scale }}>
                        Today 9:41 AM
                    </div>

                    {messages.map((msg, i) => {
                        // Sequential pop in for each message
                        const delay = 30 + i * 40;
                        const msgPop = spring({ frame: frame - delay, fps, config: { damping: 14, mass: 0.8 } });
                        const op = interpolate(frame - delay, [0, 5], [0, 1], { extrapolateRight: 'clamp' });
                        
                        // Typing indicator logic (show for 20 frames before message pops)
                        const isTyping = frame >= delay - 20 && frame < delay;

                        return (
                            <React.Fragment key={i}>
                                {/* Typing Indicator (Them only) */}
                                {!msg.isMe && isTyping && (
                                    <div style={{
                                        alignSelf: 'flex-start',
                                        backgroundColor: bubbleColorThem,
                                        padding: `${12 * scale}px ${16 * scale}px`,
                                        borderRadius: 20 * scale,
                                        display: 'flex',
                                        gap: 4 * scale,
                                        opacity: interpolate(frame - (delay - 20), [0, 5], [0, 1], { extrapolateRight: 'clamp' }),
                                    }}>
                                        {[0, 1, 2].map(dot => (
                                            <div key={dot} style={{
                                                width: 8 * scale, height: 8 * scale, borderRadius: '50%', backgroundColor: '#8e8e93',
                                                opacity: interpolate(frame % 30, [dot * 10, dot * 10 + 5, dot * 10 + 10], [0.4, 1, 0.4], { extrapolateRight: 'extend' }),
                                            }} />
                                        ))}
                                    </div>
                                )}

                                {/* Actual Message */}
                                <div style={{
                                    alignSelf: msg.isMe ? 'flex-end' : 'flex-start',
                                    maxWidth: '75%',
                                    backgroundColor: msg.isMe ? bubbleColorMe : bubbleColorThem,
                                    color: msg.isMe ? textMe : textThem,
                                    padding: `${10 * scale}px ${16 * scale}px`,
                                    fontSize: 17 * scale,
                                    lineHeight: 1.35,
                                    borderRadius: 20 * scale,
                                    // iMessage Tail logic
                                    borderBottomRightRadius: msg.isMe && msg.hasTail ? 4 * scale : 20 * scale,
                                    borderBottomLeftRadius: !msg.isMe && msg.hasTail ? 4 * scale : 20 * scale,
                                    transform: `scale(${msgPop})`,
                                    transformOrigin: msg.isMe ? 'bottom right' : 'bottom left',
                                    opacity: op,
                                    position: 'relative',
                                }}>
                                    {msg.text}
                                    
                                    {/* Tail SVGs */}
                                    {msg.hasTail && (
                                        <svg viewBox="0 0 20 20" width={16 * scale} height={16 * scale} 
                                            style={{
                                                position: 'absolute',
                                                bottom: 0,
                                                [msg.isMe ? 'right' : 'left']: -8 * scale,
                                                fill: msg.isMe ? bubbleColorMe : bubbleColorThem,
                                                transform: msg.isMe ? 'none' : 'scaleX(-1)',
                                            }}
                                        >
                                            <path d="M19.5 20c-2.5 0-5.5-1.5-7.5-3.5L12 16h-2c-5.5 0-10-4.5-10-10S4.5 0 10 0s10 4.5 10 10c0 4.5-2.5 8-5.5 9.5l-2.5 1c3.5 0 6.5-1.5 7.5-3.5v3z" />
                                        </svg>
                                    )}
                                </div>
                            </React.Fragment>
                        );
                    })}
                </div>

                {/* Keyboard / Input Area Fake */}
                <div style={{
                    backgroundColor: '#1a1a1a',
                    padding: `${12 * scale}px ${16 * scale}px ${isPortrait ? 40 * scale : 24 * scale}px`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12 * scale,
                    borderTop: '1px solid rgba(255,255,255,0.1)',
                }}>
                    <div style={{ width: 32 * scale, height: 32 * scale, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8e8e93', fontSize: 20 * scale }}>+</div>
                    <div style={{
                        flex: 1,
                        height: 36 * scale,
                        borderRadius: 18 * scale,
                        border: '1px solid rgba(255,255,255,0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: `0 ${12 * scale}px`,
                    }}>
                        <span style={{ color: '#8e8e93', fontSize: 16 * scale }}>iMessage</span>
                        <div style={{ width: 24 * scale, height: 24 * scale, borderRadius: '50%', backgroundColor: '#0A84FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                            <svg viewBox="0 0 24 24" width={14 * scale} height={14 * scale} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="19" x2="12" y2="5"></line>
                                <polyline points="5 12 12 5 19 12"></polyline>
                            </svg>
                        </div>
                    </div>
                </div>
            </div>
        </AbsoluteFill>
    );
};

registerTemplate({
    id: 'imessage-chat-mockup-01',
    name: 'iMessage Chat Mockup',
    description: 'A realistic iOS text message conversation with typing indicators and animated bubbles.',
    category: 'platform-mockups',
    durationInFrames: 240,
    fps: 30,
    component: IMessageMockup,
    schema: imessageMockupSchema,
    defaultProps: imessageMockupSchema.parse({}),
});
