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
import { EditableText } from '../../components/EditableText';
import { AnimatedGradient } from '../../components/AnimatedGradient';
import {
    resolveCanvasBackground,
    shouldRenderBackgroundLayer,
    useResolvedBackgroundControls,
} from '../../lib/background';
import { registerTemplate } from '../registry';
import { COLORS } from '../../lib/theme';
import { interFont } from '../../lib/fonts';

// ─── Schema ──────────────────────────────────────────────────
export const splitCompareSchema = z.object({
    leftImageUrl: z.string().default('https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1920'),
    rightImageUrl: z.string().default('https://images.unsplash.com/photo-1553877522-43269d4ea984?w=1920'),
    leftLabel: z.string().default('BEFORE'),
    rightLabel: z.string().default('AFTER'),
    leftColor: z.string().default('#FF4444'),
    rightColor: z.string().default('#00E676'),
    backgroundColor: z.string().default(COLORS.bg),
});

type Props = z.infer<typeof splitCompareSchema>;

// ─── Component ───────────────────────────────────────────────
export const SplitCompare01: React.FC<Props> = (props) => {
    const frame = useCurrentFrame();
    const isPortrait = useIsPortrait();
    const s = useScaleFactor();
    const backgroundControls = useResolvedBackgroundControls();
    const renderBackgroundLayers = shouldRenderBackgroundLayer(backgroundControls);

    // ─── Initial blur (f0-f24) ───
    const initialBlur = interpolate(frame, [0, 24], [8, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    // ─── Divider slide to center (f24-f60) ───
    const dividerPosition = interpolate(frame, [24, 60], [isPortrait ? 0 : 0, 50], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.inOut(Easing.cubic),
    });

    // ─── Label snap (f50-f70) ───
    const labelOpacity = interpolate(frame, [50, 70], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const labelScale = interpolate(frame, [50, 65, 70], [0.8, 1.1, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    // ─── Label bounces at f120 and f180 ───
    const getBounce = (bounceFrame: number) => {
        const elapsed = frame - bounceFrame;
        if (elapsed < 0 || elapsed > 20) return 1;
        return 1 + Math.sin(elapsed * Math.PI / 20) * 0.1;
    };
    const bounce1 = getBounce(120);
    const bounce2 = getBounce(180);
    const currentBounce = bounce1 * bounce2;

    // ─── Flash exit (f240-f300) ───
    const flashOpacity = interpolate(frame, [240, 255, 270, 300], [0, 0.9, 0.4, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    // In portrait mode, use top/bottom split
    const splitDirection = isPortrait ? 'vertical' : 'horizontal';

    return (
        <AbsoluteFill
            style={{
                background: resolveCanvasBackground(props.backgroundColor, backgroundControls),
                overflow: 'hidden',
            }}
        >
            <AnimatedGradient />

            {/* Left/Top side */}
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: splitDirection === 'horizontal' ? `${dividerPosition}%` : '100%',
                    height: splitDirection === 'horizontal' ? '100%' : `${dividerPosition}%`,
                    overflow: 'hidden',
                }}
            >
                <Img
                    src={props.leftImageUrl}
                    style={{
                        width: splitDirection === 'horizontal' ? `${100 / (dividerPosition / 100)}%` : '100%',
                        height: splitDirection === 'horizontal' ? '100%' : `${100 / (dividerPosition / 100)}%`,
                        objectFit: 'cover',
                        filter: `blur(${initialBlur}px) brightness(0.8)`,
                    }}
                />
                {/* Left label */}
                {frame >= 50 && (
                    <div
                        style={{
                            position: 'absolute',
                            top: splitDirection === 'horizontal' ? '50%' : '30%',
                            left: '50%',
                            transform: `translate(-50%, -50%) scale(${labelScale * currentBounce})`,
                            opacity: labelOpacity,
                        }}
                    >
                        <div
                            style={{
                                background: props.leftColor,
                                padding: isPortrait ? `${16 * s}px ${40 * s}px` : `${20 * s}px ${48 * s}px`,
                                borderRadius: 12 * s,
                                boxShadow: `0 ${8 * s}px ${32 * s}px ${props.leftColor}66`,
                            }}
                        >
                            <EditableText
                                text={props.leftLabel}
                                fontSize={(isPortrait ? 44 : 96) * s}
                                fontFamily={interFont}
                                color="#FFFFFF"
                                fontWeight={900}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Right/Bottom side */}
            <div
                style={{
                    position: 'absolute',
                    top: splitDirection === 'horizontal' ? 0 : `${dividerPosition}%`,
                    left: splitDirection === 'horizontal' ? `${dividerPosition}%` : 0,
                    width: splitDirection === 'horizontal' ? `${100 - dividerPosition}%` : '100%',
                    height: splitDirection === 'horizontal' ? '100%' : `${100 - dividerPosition}%`,
                    overflow: 'hidden',
                }}
            >
                <Img
                    src={props.rightImageUrl}
                    style={{
                        width: splitDirection === 'horizontal' ? `${100 / ((100 - dividerPosition) / 100)}%` : '100%',
                        height: splitDirection === 'horizontal' ? '100%' : `${100 / ((100 - dividerPosition) / 100)}%`,
                        objectFit: 'cover',
                        objectPosition: splitDirection === 'horizontal' ? 'right center' : 'center bottom',
                        marginLeft: splitDirection === 'horizontal' ? 'auto' : 0,
                        filter: `blur(${initialBlur}px) brightness(0.8)`,
                    }}
                />
                {/* Right label */}
                {frame >= 50 && (
                    <div
                        style={{
                            position: 'absolute',
                            top: splitDirection === 'horizontal' ? '50%' : '70%',
                            left: '50%',
                            transform: `translate(-50%, -50%) scale(${labelScale * currentBounce})`,
                            opacity: labelOpacity,
                        }}
                    >
                        <div
                            style={{
                                background: props.rightColor,
                                padding: isPortrait ? `${16 * s}px ${40 * s}px` : `${20 * s}px ${48 * s}px`,
                                borderRadius: 12 * s,
                                boxShadow: `0 ${8 * s}px ${32 * s}px ${props.rightColor}66`,
                            }}
                        >
                            <EditableText
                                text={props.rightLabel}
                                fontSize={(isPortrait ? 44 : 96) * s}
                                fontFamily={interFont}
                                color="#FFFFFF"
                                fontWeight={900}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Divider line */}
            <div
                style={{
                    position: 'absolute',
                    top: splitDirection === 'horizontal' ? 0 : `${dividerPosition}%`,
                    left: splitDirection === 'horizontal' ? `${dividerPosition}%` : 0,
                    width: splitDirection === 'horizontal' ? 6 * s : '100%',
                    height: splitDirection === 'horizontal' ? '100%' : 6 * s,
                    background: '#FFFFFF',
                    boxShadow: `0 0 ${20 * s}px rgba(0,0,0,0.5)`,
                    transform: splitDirection === 'horizontal' ? 'translateX(-50%)' : 'translateY(-50%)',
                }}
            />

            {/* Flash overlay */}
            {renderBackgroundLayers && (
                <AbsoluteFill
                    style={{
                        background: '#FFFFFF',
                        opacity: flashOpacity,
                    }}
                />
            )}
        </AbsoluteFill>
    );
};

// ─── Register ────────────────────────────────────────────────
registerTemplate({
    id: 'split-compare-01',
    name: 'Before/After Split Compare',
    category: 'social-hooks',
    description: 'Split screen comparison with sliding divider for before/after, budget/profit, myth/reality contrasts.',
    tags: ['split', 'compare', 'before-after', 'contrast', 'divider'],
    component: SplitCompare01,
    schema: splitCompareSchema,
    defaultProps: splitCompareSchema.parse({}),
    durationInFrames: 300, // 10s @ 30fps
    fps: 30,
});
