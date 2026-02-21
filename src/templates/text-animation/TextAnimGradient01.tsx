import React from 'react';
import {
    AbsoluteFill,
    useCurrentFrame,
    useVideoConfig,
    interpolate,
    spring,
} from 'remotion';
import { z } from 'zod';
import { useIsPortrait } from '../../lib/responsive';
import { fadeIn } from '../../lib/animations';
import { EditableText } from '../../components/EditableText';
import { AnimatedGradient } from '../../components/AnimatedGradient';
import {
    resolveCanvasBackground,
    shouldRenderBackgroundLayer,
    useResolvedBackgroundControls,
} from '../../lib/background';
import { registerTemplate } from '../registry';
import { DEFAULT_DURATION_FRAMES, DEFAULT_FPS } from '../../lib/constants';
import { linearGradient } from '../../lib/colors';
import { interFont } from '../../lib/fonts';
import { COLORS } from '../../lib/theme';

// ─── Schema ──────────────────────────────────────────────────
export const textAnimGradientSchema = z.object({
    line1: z.string().default('Think'),
    line2: z.string().default('Bigger.'),
    subtitle: z.string().default('Your brand deserves more than ordinary'),
    gradientStart: z.string().default('#FF6B6B'),
    gradientMid: z.string().default('#FECA57'),
    gradientEnd: z.string().default('#48DBFB'),
    backgroundColor: z.string().default(COLORS.bg),
});

type Props = z.infer<typeof textAnimGradientSchema>;

// ─── Component ───────────────────────────────────────────────
export const TextAnimGradient01: React.FC<Props> = (props) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const isPortrait = useIsPortrait();
    const backgroundControls = useResolvedBackgroundControls();
    const renderBackgroundLayers = shouldRenderBackgroundLayer(backgroundControls);

    // Gradients shift over time
    const gradientAngle = interpolate(frame, [0, 150], [135, 315], { extrapolateRight: 'extend' });

    const line1Scale = spring({
        frame: frame - 5,
        fps,
        config: { damping: 8, stiffness: 120, mass: 0.6 },
    });

    const line2Scale = spring({
        frame: frame - 20,
        fps,
        config: { damping: 8, stiffness: 120, mass: 0.6 },
    });

    const subtitleOpacity = fadeIn(frame, 50, 20);

    return (
        <AbsoluteFill
            style={{
                background: resolveCanvasBackground(COLORS.bg, backgroundControls),
                overflow: 'hidden',
            }}
        >
            {/* Animated background */}
            <AnimatedGradient />
            {/* Full-bleed gradient glow */}
            {renderBackgroundLayers && (
                <div
                    style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '60%',
                        height: '60%',
                        borderRadius: '50%',
                        background: linearGradient(
                            gradientAngle,
                            `${props.gradientStart}15`,
                            `${props.gradientMid}10`,
                            `${props.gradientEnd}15`
                        ),
                        filter: 'blur(100px)',
                    }}
                />
            )}

            <div
                style={{
                    position: 'relative',
                    zIndex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    width: '100%',
                    height: '100%',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: isPortrait ? '140px 80px' : undefined,
                    gap: 0,
                }}
            >
                {/* Line 1 */}
                <div
                    style={{
                        overflow: 'hidden',
                        transform: `scale(${line1Scale})`,
                    }}
                >
                    <EditableText
                        text={props.line1}
                        fontSize={isPortrait ? 120 : 176}
                        fontFamily={interFont}
                        color={COLORS.textPrimary}
                        fontWeight={900}
                        textAlign="center"
                        letterSpacing={-4}
                        lineHeight={1.1}
                    />
                </div>

                {/* Line 2 — gradient text */}
                <div
                    style={{
                        overflow: 'hidden',
                        transform: `scale(${line2Scale})`,
                    }}
                >
                    <div
                        style={{
                            fontSize: isPortrait ? 90 : 150,
                            fontFamily: interFont,
                            fontWeight: 900,
                            letterSpacing: -4,
                            lineHeight: 1.1,
                            textAlign: 'center',
                            backgroundImage: linearGradient(gradientAngle, props.gradientStart, props.gradientMid, props.gradientEnd),
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text',
                        }}
                    >
                        {props.line2}
                    </div>
                </div>

                {/* Subtitle */}
                <EditableText
                    text={props.subtitle}
                    fontSize={isPortrait ? 52 : 68}
                    fontFamily={interFont}
                    color={COLORS.textSecondary}
                    fontWeight={400}
                    textAlign="center"
                    style={{ marginTop: 48 * scale, opacity: subtitleOpacity }}
                />
            </div>

            {/* Bottom accent */}
            <div
                style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    width: `${interpolate(frame, [0, 60], [0, 100], { extrapolateRight: 'clamp' })}%`,
                    height: 6 * scale,
                    background: linearGradient(90, props.gradientStart, props.gradientMid, props.gradientEnd),
                }}
            />
        </AbsoluteFill>
    );
};

// ─── Register ────────────────────────────────────────────────
registerTemplate({
    id: 'text-anim-gradient-01',
    name: 'Gradient Text Reveal',
    category: 'text-animation',
    description: 'Bold two-line text with animated gradient fill, spring entry, and shifting colors',
    tags: ['text', 'gradient', 'animation', 'typography', 'bold'],
    component: TextAnimGradient01,
    schema: textAnimGradientSchema,
    defaultProps: textAnimGradientSchema.parse({}),
    durationInFrames: DEFAULT_DURATION_FRAMES,
    fps: DEFAULT_FPS,
});
