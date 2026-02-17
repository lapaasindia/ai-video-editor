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
export const timelineStepsSchema = z.object({
    title: z.string().default('How it works'),
    step1Title: z.string().default('Step 1'),
    step1Desc: z.string().default('Initial setup'),
    step2Title: z.string().default('Step 2'),
    step2Desc: z.string().default('Configure settings'),
    step3Title: z.string().default('Step 3'),
    step3Desc: z.string().default('Launch & scale'),
    step4Title: z.string().default('Step 4'),
    step4Desc: z.string().default('See results'),
    recapText: z.string().default('Simple as that!'),
    primaryColor: z.string().default('#00D4FF'),
    accentColor: z.string().default('#FF6B35'),
    backgroundColor: z.string().default('#0A0A0F'),
});

type Props = z.infer<typeof timelineStepsSchema>;

// ─── Component ───────────────────────────────────────────────
export const TimelineSteps01: React.FC<Props> = (props) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const isPortrait = useIsPortrait();
    const s = useScaleFactor();
    const backgroundControls = useResolvedBackgroundControls();
    void shouldRenderBackgroundLayer(backgroundControls);

    const steps = [
        { title: props.step1Title, desc: props.step1Desc, delay: 30 },
        { title: props.step2Title, desc: props.step2Desc, delay: 105 },
        { title: props.step3Title, desc: props.step3Desc, delay: 180 },
        { title: props.step4Title, desc: props.step4Desc, delay: 255 },
    ];

    // ─── Title animation (f0-f30) ───
    const titleOpacity = fadeIn(frame, 30);
    const titleY = interpolate(frame, [0, 30], [30 * s, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    // ─── Recap banner (f330-f450) ───
    const recapX = interpolate(frame, [330, 380], [isPortrait ? 0 : -300 * s, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const recapOpacity = fadeIn(frame - 330, 30);

    const stepSize = (isPortrait ? 80 : 100) * s;

    return (
        <AbsoluteFill
            style={{
                background: resolveCanvasBackground(props.backgroundColor, backgroundControls),
                overflow: 'hidden',
            }}
        >
            <AnimatedGradient />

            {/* Title */}
            <div
                style={{
                    position: 'absolute',
                    top: (isPortrait ? 120 : 80) * s,
                    left: 0,
                    right: 0,
                    display: 'flex',
                    justifyContent: 'center',
                    opacity: titleOpacity,
                    transform: `translateY(${titleY}px)`,
                }}
            >
                <EditableText
                    text={props.title}
                    fontSize={(isPortrait ? 72 : 88) * s}
                    fontFamily={interFont}
                    color={COLORS.textPrimary}
                    fontWeight={800}
                />
            </div>

            {/* Steps */}
            <AbsoluteFill
                style={{
                    display: 'flex',
                    flexDirection: isPortrait ? 'column' : 'row',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: (isPortrait ? 40 : 60) * s,
                    padding: isPortrait ? `${156 * s}px ${56 * s}px` : `0 ${80 * s}px`,
                }}
            >
                {steps.map((step, i) => {
                    const stepSpring = spring({
                        frame: frame - step.delay,
                        fps,
                        config: { damping: 12, stiffness: 120, mass: 0.8 },
                    });
                    const stepScale = interpolate(stepSpring, [0, 1], [0.6, 1]);

                    // Connector line draw
                    const lineProgress = interpolate(frame, [step.delay + 20, step.delay + 50], [0, 1], {
                        extrapolateLeft: 'clamp',
                        extrapolateRight: 'clamp',
                    });

                    return (
                        <React.Fragment key={i}>
                            <div
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: 16 * s,
                                    transform: `scale(${stepScale})`,
                                    opacity: stepSpring,
                                }}
                            >
                                {/* Number badge */}
                                <div
                                    style={{
                                        width: stepSize,
                                        height: stepSize,
                                        borderRadius: '50%',
                                        background: `linear-gradient(135deg, ${props.primaryColor}, ${props.accentColor})`,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        boxShadow: `0 ${8 * s}px ${32 * s}px ${props.primaryColor}44`,
                                    }}
                                >
                                    <EditableText
                                        text={`${i + 1}`}
                                        fontSize={(isPortrait ? 40 : 48) * s}
                                        fontFamily={interFont}
                                        color="#FFFFFF"
                                        fontWeight={900}
                                    />
                                </div>

                                {/* Step content */}
                                <div style={{ textAlign: 'center' }}>
                                    <EditableText
                                        text={step.title}
                                        fontSize={(isPortrait ? 32 : 36) * s}
                                        fontFamily={interFont}
                                        color={props.primaryColor}
                                        fontWeight={700}
                                    />
                                    <EditableText
                                        text={step.desc}
                                        fontSize={(isPortrait ? 24 : 28) * s}
                                        fontFamily={interFont}
                                        color={COLORS.textSecondary}
                                        fontWeight={500}
                                        style={{ marginTop: 8 * s }}
                                    />
                                </div>
                            </div>

                            {/* Connector line (not after last step) */}
                            {i < steps.length - 1 && (
                                <div
                                    style={{
                                        width: (isPortrait ? 4 : 60) * s,
                                        height: (isPortrait ? 30 : 4) * s,
                                        background: `${props.primaryColor}40`,
                                        borderRadius: 2 * s,
                                        overflow: 'hidden',
                                    }}
                                >
                                    <div
                                        style={{
                                            width: isPortrait ? '100%' : `${lineProgress * 100}%`,
                                            height: isPortrait ? `${lineProgress * 100}%` : '100%',
                                            background: props.primaryColor,
                                        }}
                                    />
                                </div>
                            )}
                        </React.Fragment>
                    );
                })}
            </AbsoluteFill>

            {/* Recap banner (f330+) */}
            {frame >= 330 && (
                <AbsoluteFill
                    style={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'flex-end',
                        padding: isPortrait ? `0 ${60 * s}px ${120 * s}px` : `0 ${100 * s}px ${80 * s}px`,
                        opacity: recapOpacity,
                        transform: `translateX(${recapX}px)`,
                    }}
                >
                    <div
                        style={{
                            background: `linear-gradient(135deg, ${props.primaryColor}, ${props.accentColor})`,
                            padding: isPortrait ? `${20 * s}px ${48 * s}px` : `${24 * s}px ${56 * s}px`,
                            borderRadius: 100 * s,
                            boxShadow: `0 ${8 * s}px ${32 * s}px ${props.primaryColor}44`,
                        }}
                    >
                        <EditableText
                            text={props.recapText}
                            fontSize={(isPortrait ? 36 : 44) * s}
                            fontFamily={interFont}
                            color="#FFFFFF"
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
    id: 'timeline-steps-01',
    name: 'Timeline Steps with Numbers',
    category: 'social-hooks',
    description: 'Explain a process in 4 animated steps with numbered badges and connector lines.',
    tags: ['timeline', 'steps', 'process', 'flow', 'numbers', 'explainer'],
    component: TimelineSteps01,
    schema: timelineStepsSchema,
    defaultProps: timelineStepsSchema.parse({}),
    durationInFrames: 450, // 15s @ 30fps
    fps: 30,
});
