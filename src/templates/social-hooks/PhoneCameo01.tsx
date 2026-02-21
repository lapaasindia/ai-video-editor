import React from 'react';
import {
    AbsoluteFill,
    useCurrentFrame,
    useVideoConfig,
    Img,
    interpolate,
    spring,
} from 'remotion';
import { z } from 'zod';
import { useIsPortrait, useScaleFactor } from '../../lib/responsive';
import { fadeIn } from '../../lib/animations';
import { EditableText } from '../../components/EditableText';
import { AnimatedGradient } from '../../components/AnimatedGradient';
import {
    resolveCanvasBackground,
    shouldRenderBackgroundLayer,
    useResolvedBackgroundControls,
} from '../../lib/background';
import { registerTemplate } from '../registry';
import { interFont } from '../../lib/fonts';
import { COLORS } from '../../lib/theme';

// ─── Schema ──────────────────────────────────────────────────
export const phoneCameoSchema = z.object({
    phoneVideoUrl: z.string().default('https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800'),
    logoUrl: z.string().default(''),
    title: z.string().default('Creator spotlight'),
    subtitle: z.string().default('@username'),
    primaryColor: z.string().default(COLORS.accent),
    accentColor: z.string().default(COLORS.accent),
    backgroundColor: z.string().default(COLORS.bg),
});

type Props = z.infer<typeof phoneCameoSchema>;

// ─── Component ───────────────────────────────────────────────
export const PhoneCameo01: React.FC<Props> = (props) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    
    const isPortrait = useIsPortrait();
    const s = useScaleFactor();
    const backgroundControls = useResolvedBackgroundControls();
    const renderBackgroundLayers = shouldRenderBackgroundLayer(backgroundControls);

    // ─── Phone frame scale up (f0-f18) ───
    const phoneSpring = spring({
        frame,
        fps,
        config: { damping: 14, stiffness: 100, mass: 1 },
    });
    const phoneScale = interpolate(phoneSpring, [0, 1], [0.85, 1]);
    const shadowOpacity = interpolate(frame, [0, 18], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    // ─── Logo bug slide (f18-f48) ───
    const logoSpring = spring({
        frame: frame - 18,
        fps,
        config: { damping: 12, stiffness: 120, mass: 0.8 },
    });
    const logoY = interpolate(logoSpring, [0, 1], [60 * s, 0]);

    // ─── Title underline draw (f48-f70) ───
    const underlineWidth = interpolate(frame, [48, 70], [0, 100], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    // ─── Phone clip zoom (f70-f260) ───
    const clipZoom = interpolate(frame, [70, 260], [1.0, 1.03], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    // ─── Flash exit (f260-f315) ───
    const flashOpacity = interpolate(frame, [260, 275, 290, 315], [0, 0.8, 0.3, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const exitScale = interpolate(frame, [260, 315], [1, 0.9], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    const phoneSize = isPortrait 
        ? { width: 400 * s, height: 720 * s }
        : { width: 480 * s, height: 860 * s };

    return (
        <AbsoluteFill
            style={{
                background: resolveCanvasBackground(props.backgroundColor, backgroundControls),
                overflow: 'hidden',
            }}
        >
            <AnimatedGradient />

            {/* Phone card with rounded corners */}
            <AbsoluteFill
                style={{
                    display: 'flex',
                    justifyContent: isPortrait ? 'center' : 'flex-start',
                    alignItems: 'center',
                    padding: isPortrait ? `${136 * s}px 0` : `0 ${112 * s}px`,
                    transform: `scale(${phoneScale * exitScale})`,
                }}
            >
                <div
                    style={{
                        position: 'relative',
                        width: phoneSize.width,
                        height: phoneSize.height,
                        borderRadius: 48 * s,
                        overflow: 'hidden',
                        boxShadow: `0 ${30 * s}px ${80 * s}px rgba(0,0,0,${shadowOpacity * 0.45})`,
                        border: `${4 * s}px solid ${COLORS.surface}`,
                    }}
                >
                    <div style={{ transform: `scale(${clipZoom})`, width: '100%', height: '100%' }}>
                        <Img
                            src={props.phoneVideoUrl}
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                            }}
                        />
                    </div>
                </div>
            </AbsoluteFill>

            {/* Logo bug (f18+) */}
            {props.logoUrl && frame >= 18 && (
                <div
                    style={{
                        position: 'absolute',
                        bottom: (isPortrait ? 160 : 80) * s,
                        left: (isPortrait ? 60 : 80) * s,
                        transform: `translateY(${logoY}px)`,
                        opacity: logoSpring,
                    }}
                >
                    <Img
                        src={props.logoUrl}
                        style={{
                            width: (isPortrait ? 80 : 100) * s,
                            height: (isPortrait ? 80 : 100) * s,
                            objectFit: 'contain',
                        }}
                    />
                </div>
            )}

            {/* Title with scribble underline */}
            <AbsoluteFill
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: isPortrait ? 'flex-end' : 'center',
                    alignItems: isPortrait ? 'center' : 'flex-end',
                    padding: isPortrait ? `0 ${60 * s}px ${300 * s}px` : `0 ${120 * s}px 0 0`,
                }}
            >
                <div style={{ position: 'relative' }}>
                    <EditableText
                        text={props.title}
                        fontSize={(isPortrait ? 56 : 72) * s}
                        fontFamily={interFont}
                        color={COLORS.textPrimary}
                        fontWeight={800}
                    />
                    {/* Scribble underline SVG */}
                    <svg
                        width="100%"
                        height={16 * s}
                        viewBox="0 0 200 16"
                        preserveAspectRatio="none"
                        style={{
                            position: 'absolute',
                            bottom: -8 * s,
                            left: 0,
                        }}
                    >
                        <path
                            d="M 0 8 Q 50 2, 100 8 T 200 8"
                            fill="none"
                            stroke={props.primaryColor}
                            strokeWidth={4 * s}
                            strokeLinecap="round"
                            strokeDasharray="200"
                            strokeDashoffset={200 - underlineWidth * 2}
                        />
                    </svg>
                </div>
                
                <div style={{ marginTop: 16 * s, opacity: fadeIn(frame - 55, 15) }}>
                    <EditableText
                        text={props.subtitle}
                        fontSize={(isPortrait ? 32 : 40) * s}
                        fontFamily={interFont}
                        color={props.primaryColor}
                        fontWeight={600}
                    />
                </div>
            </AbsoluteFill>

            {/* Flash overlay */}
            {renderBackgroundLayers && (
                <AbsoluteFill
                    style={{
                        background: `linear-gradient(135deg, ${props.primaryColor}, #ffffff)`,
                        opacity: flashOpacity,
                        mixBlendMode: 'screen',
                    }}
                />
            )}
        </AbsoluteFill>
    );
};

// ─── Register ────────────────────────────────────────────────
registerTemplate({
    id: 'phone-cameo-01',
    name: 'Phone Cameo with Logo Bug',
    category: 'social-hooks',
    description: 'Rounded phone frame with creator clip, logo bug, and scribble title underline.',
    tags: ['phone', 'cameo', 'creator', 'frame', 'logo', 'clip'],
    component: PhoneCameo01,
    schema: phoneCameoSchema,
    defaultProps: phoneCameoSchema.parse({}),
    durationInFrames: 315, // 10.5s @ 30fps
    fps: 30,
});
