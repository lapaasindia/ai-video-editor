import React from 'react';
import {
    AbsoluteFill,
    useCurrentFrame,
    useVideoConfig,
    Img,
    interpolate,
    spring,
    Easing,
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
export const stampVerdictSchema = z.object({
    backgroundImageUrl: z.string().default('https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1920'),
    subtitleLine: z.string().default('Is this actually legal?'),
    stampText: z.string().default('NOT LEGAL'),
    followupLine: z.string().default('Here\'s why it matters'),
    stampColor: z.string().default('#FF4444'),
    stampRotation: z.number().default(-6),
    backgroundColor: z.string().default(COLORS.bg),
    showDistress: z.boolean().default(true),
});

type Props = z.infer<typeof stampVerdictSchema>;

// ─── Component ───────────────────────────────────────────────
export const StampVerdict01: React.FC<Props> = (props) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    
    const isPortrait = useIsPortrait();
    const s = useScaleFactor();
    const backgroundControls = useResolvedBackgroundControls();
    const renderBackgroundLayers = shouldRenderBackgroundLayer(backgroundControls);

    // ─── Subtitle appears (f0-f40) ───
    const subtitleOpacity = fadeIn(frame, 40);
    const subtitleY = interpolate(frame, [0, 40], [30 * s, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
    });

    // ─── Stamp slam (f40-f55) ───
    const stampSpring = spring({
        frame: frame - 40,
        fps,
        config: { damping: 8, stiffness: 200, mass: 0.6 },
    });
    const stampScale = interpolate(stampSpring, [0, 1], [1.6, 1]);
    const stampRotation = interpolate(stampSpring, [0, 1], [-12, props.stampRotation]);

    // ─── Stamp pulse at f120 ───
    const pulseScale = frame >= 120 && frame < 135
        ? 1 + Math.sin((frame - 120) * Math.PI / 15) * 0.08
        : 1;

    // ─── Stamp exit (f200-f260) ───
    const stampExitX = interpolate(frame, [200, 260], [0, isPortrait ? 0 : -300 * s], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.in(Easing.cubic),
    });
    const stampExitY = interpolate(frame, [200, 260], [0, isPortrait ? -200 * s : 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.in(Easing.cubic),
    });
    const stampExitOpacity = interpolate(frame, [200, 260], [1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    // ─── Followup line (f200-f345) ───
    const followupOpacity = fadeIn(frame - 220, 30);
    const followupY = interpolate(frame, [220, 260], [40 * s, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
    });

    return (
        <AbsoluteFill
            style={{
                background: resolveCanvasBackground(props.backgroundColor, backgroundControls),
                overflow: 'hidden',
            }}
        >
            <AnimatedGradient />

            {/* Background */}
            {renderBackgroundLayers && (
                <AbsoluteFill>
                    <Img
                        src={props.backgroundImageUrl}
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            filter: 'brightness(0.5)',
                        }}
                    />
                </AbsoluteFill>
            )}

            {/* Subtitle line */}
            <AbsoluteFill
                style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: isPortrait ? 'flex-start' : 'flex-end',
                    padding: isPortrait ? `${136 * s}px ${56 * s}px` : `0 ${100 * s}px ${136 * s}px`,
                    opacity: subtitleOpacity,
                    transform: `translateY(${subtitleY}px)`,
                }}
            >
                <EditableText
                    text={props.subtitleLine}
                    fontSize={(isPortrait ? 48 : 56) * s}
                    fontFamily={interFont}
                    color={COLORS.textSecondary}
                    fontWeight={600}
                    textAlign="center"
                />
            </AbsoluteFill>

            {/* Stamp */}
            {frame >= 40 && (
                <AbsoluteFill
                    style={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                    }}
                >
                    <div
                        style={{
                            transform: `
                                rotate(${stampRotation}deg)
                                scale(${stampScale * pulseScale})
                                translate(${stampExitX}px, ${stampExitY}px)
                            `,
                            opacity: stampExitOpacity,
                            position: 'relative',
                        }}
                    >
                        {/* Stamp border */}
                        <div
                            style={{
                                border: `${8 * s}px solid ${props.stampColor}`,
                                borderRadius: 16 * s,
                                padding: isPortrait ? `${24 * s}px ${48 * s}px` : `${32 * s}px ${64 * s}px`,
                                background: 'transparent',
                            }}
                        >
                            <EditableText
                                text={props.stampText}
                                fontSize={(isPortrait ? 72 : 96) * s}
                                fontFamily={interFont}
                                color={props.stampColor}
                                fontWeight={900}
                                letterSpacing={8 * s}
                            />
                        </div>

                        {/* Distress texture overlay */}
                        {props.showDistress && (
                            <div
                                style={{
                                    position: 'absolute',
                                    inset: 0,
                                    background: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.5' numOctaves='3' /%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
                                    opacity: 0.2,
                                    mixBlendMode: 'multiply',
                                    borderRadius: 16,
                                }}
                            />
                        )}
                    </div>
                </AbsoluteFill>
            )}

            {/* Followup line */}
            {frame >= 220 && (
                <AbsoluteFill
                    style={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: isPortrait ? 'flex-end' : 'center',
                        padding: isPortrait ? `0 ${56 * s}px ${136 * s}px` : `0 ${100 * s}px`,
                        opacity: followupOpacity,
                        transform: `translateY(${followupY}px)`,
                    }}
                >
                    <EditableText
                        text={props.followupLine}
                        fontSize={(isPortrait ? 56 : 72) * s}
                        fontFamily={interFont}
                        color={COLORS.textPrimary}
                        fontWeight={800}
                        textAlign="center"
                    />
                </AbsoluteFill>
            )}
        </AbsoluteFill>
    );
};

// ─── Register ────────────────────────────────────────────────
registerTemplate({
    id: 'stamp-verdict-01',
    name: 'Stamp Verdict Explainer',
    category: 'social-hooks',
    description: 'Bold verdict stamp (LEGAL/NOT LEGAL/SMART/DUMB) slams over footage for punchy editorial moments.',
    tags: ['stamp', 'verdict', 'legal', 'editorial', 'meme', 'bold'],
    component: StampVerdict01,
    schema: stampVerdictSchema,
    defaultProps: stampVerdictSchema.parse({}),
    durationInFrames: 345, // 11.5s @ 30fps
    fps: 30,
});
