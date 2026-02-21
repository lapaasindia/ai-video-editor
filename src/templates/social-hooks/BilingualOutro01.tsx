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
export const bilingualOutroSchema = z.object({
    presenterImageUrl: z.string().default('https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800'),
    line1: z.string().default('क्या सच में'),
    keywordLine: z.string().default('PERSONALITY'),
    amountLine: z.string().default('₹47 LAKH'),
    ctaText: z.string().default('Follow for part 2'),
    keywordColor: z.string().default('#FFE135'),
    highlightColor: z.string().default('#00E676'),
    backgroundColor: z.string().default('#0A0A0F'),
    showGrain: z.boolean().default(true),
});

type Props = z.infer<typeof bilingualOutroSchema>;

// ─── Component ───────────────────────────────────────────────
export const BilingualOutro01: React.FC<Props> = (props) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    
    const isPortrait = useIsPortrait();
    const s = useScaleFactor();
    const backgroundControls = useResolvedBackgroundControls();
    const renderBackgroundLayers = shouldRenderBackgroundLayer(backgroundControls);

    // ─── Background dim (f0-f30) ───
    const dimOpacity = interpolate(frame, [0, 30], [0, 0.55], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const presenterOpacity = fadeIn(frame, 30);

    // ─── Line 1 slide (f30-f70) ───
    const line1X = interpolate(frame, [30, 70], [-200 * s, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
    });
    const line1Opacity = fadeIn(frame - 30, 20);

    // ─── Keyword slam (f50-f90) ───
    const keywordSpring = spring({
        frame: frame - 50,
        fps,
        config: { damping: 10, stiffness: 180, mass: 0.6 },
    });
    const keywordScale = interpolate(keywordSpring, [0, 1], [1.3, 1]);

    // ─── Highlight bar grow (f80-f120) ───
    const highlightScaleX = interpolate(frame, [80, 120], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    // ─── CTA fade (f250-f360) ───
    const ctaOpacity = fadeIn(frame - 250, 30);
    const ctaBounce = spring({
        frame: frame - 280,
        fps,
        config: { damping: 12, stiffness: 100, mass: 0.8 },
    });

    const presenterHeight = (isPortrait ? 800 : 600) * s;

    return (
        <AbsoluteFill
            style={{
                background: resolveCanvasBackground(props.backgroundColor, backgroundControls),
                overflow: 'hidden',
            }}
        >
            <AnimatedGradient />

            {/* Dim overlay */}
            {renderBackgroundLayers && (
                <AbsoluteFill
                    style={{
                        background: '#000000',
                        opacity: dimOpacity,
                    }}
                />
            )}

            {/* Presenter cut-out */}
            <AbsoluteFill
                style={{
                    display: 'flex',
                    justifyContent: isPortrait ? 'center' : 'flex-end',
                    alignItems: 'flex-end',
                    opacity: presenterOpacity,
                }}
            >
                <Img
                    src={props.presenterImageUrl}
                    style={{
                        height: presenterHeight,
                        width: 'auto',
                        objectFit: 'contain',
                        filter: `drop-shadow(0 ${20 * s}px ${40 * s}px rgba(0,0,0,0.5))`,
                    }}
                />
            </AbsoluteFill>

            {/* Text content */}
            <AbsoluteFill
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: isPortrait ? 'flex-start' : 'center',
                    alignItems: isPortrait ? 'center' : 'flex-start',
                    padding: isPortrait ? `${136 * s}px ${56 * s}px` : `0 ${92 * s}px`,
                    gap: 24 * s,
                }}
            >
                {/* Line 1 (Hindi/other language) */}
                <div
                    style={{
                        transform: `translateX(${line1X}px)`,
                        opacity: line1Opacity,
                    }}
                >
                    <EditableText
                        text={props.line1}
                        fontSize={(isPortrait ? 56 : 64) * s}
                        fontFamily={interFont}
                        color={COLORS.textSecondary}
                        fontWeight={600}
                    />
                </div>

                {/* Keyword with shadow */}
                {frame >= 50 && (
                    <div
                        style={{
                            position: 'relative',
                            transform: `scale(${keywordScale})`,
                        }}
                    >
                        {/* Shadow layer */}
                        <EditableText
                            text={props.keywordLine}
                            fontSize={(isPortrait ? 96 : 120) * s}
                            fontFamily={interFont}
                            color="#000000"
                            fontWeight={900}
                            style={{
                                position: 'absolute',
                                left: 4 * s,
                                top: 4 * s,
                                opacity: 0.6,
                            }}
                        />
                        <EditableText
                            text={props.keywordLine}
                            fontSize={(isPortrait ? 96 : 120) * s}
                            fontFamily={interFont}
                            color={props.keywordColor}
                            fontWeight={900}
                            style={{
                                textShadow: `0 0 ${40 * s}px ${props.keywordColor}66`,
                            }}
                        />
                    </div>
                )}

                {/* Amount with highlight bar */}
                {frame >= 80 && (
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                        {/* Highlight bar */}
                        <div
                            style={{
                                position: 'absolute',
                                left: -16 * s,
                                right: -16 * s,
                                top: '50%',
                                height: '70%',
                                transform: `translateY(-50%) scaleX(${highlightScaleX})`,
                                transformOrigin: 'left',
                                background: props.highlightColor,
                                borderRadius: 8 * s,
                                zIndex: 0,
                            }}
                        />
                        <EditableText
                            text={props.amountLine}
                            fontSize={(isPortrait ? 80 : 96) * s}
                            fontFamily={interFont}
                            color="#FFFFFF"
                            fontWeight={900}
                            style={{ position: 'relative', zIndex: 1 }}
                        />
                    </div>
                )}
            </AbsoluteFill>

            {/* CTA (f250+) */}
            {frame >= 250 && (
                <AbsoluteFill
                    style={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'flex-end',
                        paddingBottom: (isPortrait ? 150 : 80) * s,
                        opacity: ctaOpacity,
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12 * s,
                            background: COLORS.surface,
                            border: `${2 * s}px solid ${COLORS.border}`,
                            padding: `${12 * s}px ${28 * s}px`,
                            borderRadius: 100 * s,
                            transform: `scale(${ctaBounce})`,
                        }}
                    >
                        <span style={{ fontSize: 24 * s }}>👆</span>
                        <EditableText
                            text={props.ctaText}
                            fontSize={(isPortrait ? 28 : 32) * s}
                            fontFamily={interFont}
                            color={COLORS.textPrimary}
                            fontWeight={600}
                        />
                    </div>
                </AbsoluteFill>
            )}

            {/* Grain */}
            {renderBackgroundLayers && props.showGrain && (
                <AbsoluteFill
                    style={{
                        background: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' /%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
                        opacity: 0.05,
                        mixBlendMode: 'overlay',
                    }}
                />
            )}

            {/* Vignette */}
            {renderBackgroundLayers && (
                <AbsoluteFill
                    style={{
                        background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.5) 100%)',
                    }}
                />
            )}
        </AbsoluteFill>
    );
};

// ─── Register ────────────────────────────────────────────────
registerTemplate({
    id: 'bilingual-outro-01',
    name: 'Bilingual Outro Question Card',
    category: 'social-hooks',
    description: 'End card with provocative question, bilingual text, and currency highlight bar.',
    tags: ['outro', 'bilingual', 'question', 'currency', 'highlight', 'cta'],
    component: BilingualOutro01,
    schema: bilingualOutroSchema,
    defaultProps: bilingualOutroSchema.parse({}),
    durationInFrames: 360, // 12s @ 30fps
    fps: 30,
});
