import React from 'react';
import {
    AbsoluteFill,
    useCurrentFrame,
    useVideoConfig,
    interpolate,
    spring,
} from 'remotion';
import { z } from 'zod';
import { useIsPortrait, useResponsive, useScaleFactor } from "../../lib/responsive";
import { EditableText } from '../../components/EditableText';
import { AnimatedGradient } from '../../components/AnimatedGradient';
import {
    resolveCanvasBackground,
    useResolvedBackgroundControls,
} from '../../lib/background';
import { registerTemplate } from '../registry';
import { DEFAULT_DURATION_FRAMES, DEFAULT_FPS } from '../../lib/constants';
import { interFont } from '../../lib/fonts';
import { COLORS, GRADIENTS } from '../../lib/theme';

// ─── Schema ──────────────────────────────────────────────────
export const lowerThirdsTopicSchema = z.object({
    topicLabel: z.string().default('CHAPTER 3'),
    topicTitle: z.string().default('Scaling Infrastructure'),
    topicSubtitle: z.string().default('From 10K to 10M users'),
    primaryColor: z.string().default(COLORS.accent),
    accentColor: z.string().default(COLORS.accentLight),
    backgroundColor: z.string().default(COLORS.bg),
});

type Props = z.infer<typeof lowerThirdsTopicSchema>;

// ─── Component ───────────────────────────────────────────────
export const LowerThirdsTopic01: React.FC<Props> = (props) => {\n    const scale = useScaleFactor();
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const isPortrait = useIsPortrait();
    const scale = useResponsive(1, 1);
    const backgroundControls = useResolvedBackgroundControls();

    const barWidth = spring({
        frame: frame - 3,
        fps,
        config: { damping: 16, stiffness: 80, mass: 0.5 },
    });

    const contentReveal = spring({
        frame: frame - 12,
        fps,
        config: { damping: 12, stiffness: 120, mass: 0.5 },
    });

    const exitOpacity = interpolate(frame, [110, 130], [1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    return (
        <AbsoluteFill
            style={{
                background: resolveCanvasBackground(COLORS.bg, backgroundControls),
                overflow: 'hidden',
            }}
        >
            {/* Animated background */}
            <AnimatedGradient />
            {/* Bottom-left positioned */}
            <div
                style={{
                    position: 'absolute',
                    bottom: isPortrait ? 130 : 80,
                    left: isPortrait ? 80 : 80,
                    right: isPortrait ? 80 : 'auto',
                    opacity: exitOpacity,
                }}
            >
                {/* Accent bar */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 24 * scale,
                        marginBottom: 20 * scale,
                    }}
                >
                    <div
                        style={{
                            width: interpolate(barWidth, [0, 1], [0, 48]),
                            height: 8 * scale,
                            borderRadius: 2 * scale,
                            background: GRADIENTS.bgMain,
                            boxShadow: `0 0 12px ${props.primaryColor}44`,
                        }}
                    />
                    <EditableText
                        text={props.topicLabel}
                        fontSize={32 * scale}
                        fontFamily={interFont}
                        color={COLORS.accent}
                        fontWeight={800}
                        letterSpacing={3}
                        style={{ opacity: contentReveal }}
                    />
                </div>

                {/* Title */}
                <div
                    style={{
                        transform: `translateY(${interpolate(contentReveal, [0, 1], [15, 0])}px)`,
                        opacity: contentReveal,
                    }}
                >
                    <EditableText
                        text={props.topicTitle}
                        fontSize={isPortrait ? 76 : 84}
                        fontFamily={interFont}
                        color={COLORS.textPrimary}
                        fontWeight={800}
                        letterSpacing={-1}
                    />
                </div>

                {/* Subtitle */}
                <EditableText
                    text={props.topicSubtitle}
                    fontSize={isPortrait ? 44 : 52}
                    fontFamily={interFont}
                    color={COLORS.textSecondary}
                    fontWeight={400}
                    style={{
                        marginTop: 8 * scale,
                        opacity: interpolate(contentReveal, [0.3, 1], [0, 1], {
                            extrapolateLeft: 'clamp',
                            extrapolateRight: 'clamp',
                        }),
                    }}
                />
            </div>
        </AbsoluteFill>
    );
};

// ─── Register ────────────────────────────────────────────────
registerTemplate({
    id: 'lower-thirds-topic-01',
    name: 'Lower Third — Topic Card',
    category: 'lower-thirds',
    description: 'Chapter/topic card overlay with accent bar, label, title, and subtitle with exit fade',
    tags: ['lower-third', 'topic', 'chapter', 'overlay', 'presentation'],
    component: LowerThirdsTopic01,
    schema: lowerThirdsTopicSchema,
    defaultProps: lowerThirdsTopicSchema.parse({}),
    durationInFrames: DEFAULT_DURATION_FRAMES,
    fps: DEFAULT_FPS,
});
