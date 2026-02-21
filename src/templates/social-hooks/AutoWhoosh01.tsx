import React from 'react';
import {
    AbsoluteFill,
    useCurrentFrame,
    Img,
    interpolate,
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
export const autoWhooshSchema = z.object({
    scene1Url: z.string().default('https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1920'),
    scene2Url: z.string().default('https://images.unsplash.com/photo-1553877522-43269d4ea984?w=1920'),
    scene3Url: z.string().default('https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1920'),
    ctaText: z.string().default('Follow for more'),
    transitionColor: z.string().default('#00D4FF'),
    backgroundColor: z.string().default(COLORS.bg),
});

type Props = z.infer<typeof autoWhooshSchema>;

// ─── Component ───────────────────────────────────────────────
export const AutoWhoosh01: React.FC<Props> = (props) => {
    const frame = useCurrentFrame();
    const isPortrait = useIsPortrait();
    const s = useScaleFactor();
    const backgroundControls = useResolvedBackgroundControls();
    const renderBackgroundLayers = shouldRenderBackgroundLayer(backgroundControls);

    // Scene timings
    // Scene A: f0-f110
    // Transition 1: f110-f140
    // Scene B: f140-f250
    // Transition 2: f250-f280
    // Scene C: f280-f360

    // ─── Scene A (f0-f110) ───
    const scene1Zoom = interpolate(frame, [0, 110], [1.0, 1.05], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const scene1Opacity = frame < 125 ? 1 : 0;

    // ─── Transition 1 (f110-f140) ───
    const trans1Progress = interpolate(frame, [110, 140], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const trans1X = interpolate(trans1Progress, [0, 0.5, 1], [100, 0, -100]);
    const trans1Opacity = interpolate(trans1Progress, [0, 0.3, 0.7, 1], [0, 1, 1, 0]);

    // ─── Scene B (f140-f250) ───
    const scene2Zoom = interpolate(frame, [140, 250], [1.0, 1.04], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const scene2Opacity = frame >= 125 && frame < 265 ? 1 : 0;

    // ─── Transition 2 (f250-f280) ───
    const trans2Progress = interpolate(frame, [250, 280], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const trans2X = interpolate(trans2Progress, [0, 0.5, 1], [100, 0, -100]);
    const trans2Opacity = interpolate(trans2Progress, [0, 0.3, 0.7, 1], [0, 1, 1, 0]);

    // ─── Scene C (f280-f360) ───
    const scene3Zoom = interpolate(frame, [280, 360], [1.0, 1.03], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const scene3Opacity = frame >= 265 ? 1 : 0;

    // ─── CTA (f300-f360) ───
    const ctaOpacity = fadeIn(frame - 300, 20);
    const ctaY = interpolate(frame, [300, 330], [40 * s, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.back(1.5)),
    });

    return (
        <AbsoluteFill
            style={{
                background: resolveCanvasBackground(props.backgroundColor, backgroundControls),
                overflow: 'hidden',
            }}
        >
            <AnimatedGradient />

            {/* Scene A */}
            {scene1Opacity > 0 && (
                <AbsoluteFill
                    style={{
                        transform: `scale(${scene1Zoom})`,
                        opacity: scene1Opacity,
                    }}
                >
                    <Img
                        src={props.scene1Url}
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                        }}
                    />
                </AbsoluteFill>
            )}

            {/* Scene B */}
            {scene2Opacity > 0 && (
                <AbsoluteFill
                    style={{
                        transform: `scale(${scene2Zoom})`,
                        opacity: scene2Opacity,
                    }}
                >
                    <Img
                        src={props.scene2Url}
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                        }}
                    />
                </AbsoluteFill>
            )}

            {/* Scene C */}
            {scene3Opacity > 0 && (
                <AbsoluteFill
                    style={{
                        transform: `scale(${scene3Zoom})`,
                        opacity: scene3Opacity,
                    }}
                >
                    <Img
                        src={props.scene3Url}
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                        }}
                    />
                </AbsoluteFill>
            )}

            {/* Transition 1 wipe */}
            {renderBackgroundLayers && trans1Opacity > 0 && (
                <AbsoluteFill
                    style={{
                        background: `linear-gradient(90deg, transparent, ${props.transitionColor}ee, ${props.transitionColor}, ${props.transitionColor}ee, transparent)`,
                        transform: `translateX(${trans1X}%)`,
                        opacity: trans1Opacity,
                    }}
                />
            )}

            {/* Transition 2 wipe */}
            {renderBackgroundLayers && trans2Opacity > 0 && (
                <AbsoluteFill
                    style={{
                        background: `linear-gradient(90deg, transparent, ${props.transitionColor}ee, ${props.transitionColor}, ${props.transitionColor}ee, transparent)`,
                        transform: `translateX(${trans2X}%)`,
                        opacity: trans2Opacity,
                    }}
                />
            )}

            {/* CTA (f300+) */}
            {frame >= 300 && (
                <AbsoluteFill
                    style={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'flex-end',
                        paddingBottom: (isPortrait ? 136 : 92) * s,
                        opacity: ctaOpacity,
                        transform: `translateY(${ctaY}px)`,
                    }}
                >
                    <div
                        style={{
                            background: COLORS.surface,
                            border: `${2 * s}px solid ${props.transitionColor}`,
                            padding: isPortrait ? `${16 * s}px ${40 * s}px` : `${20 * s}px ${48 * s}px`,
                            borderRadius: 100 * s,
                            boxShadow: `0 ${8 * s}px ${32 * s}px ${props.transitionColor}44`,
                        }}
                    >
                        <EditableText
                            text={props.ctaText}
                            fontSize={(isPortrait ? 32 : 40) * s}
                            fontFamily={interFont}
                            color={props.transitionColor}
                            fontWeight={700}
                        />
                    </div>
                </AbsoluteFill>
            )}
        </AbsoluteFill>
    );
};

// ─── Register ────────────────────────────────────────────────
registerTemplate({
    id: 'auto-whoosh-01',
    name: 'Auto-Whoosh Scene Cuts',
    category: 'social-hooks',
    description: 'Drop 3 clips with automatic whoosh transitions and CTA ending.',
    tags: ['whoosh', 'transition', 'cuts', 'auto', 'b-roll', 'scenes'],
    component: AutoWhoosh01,
    schema: autoWhooshSchema,
    defaultProps: autoWhooshSchema.parse({}),
    durationInFrames: 360, // 12s @ 30fps
    fps: 30,
});
