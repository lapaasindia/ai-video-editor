import React from 'react';
import {
    AbsoluteFill,
    useCurrentFrame,
    useVideoConfig,
    interpolate,
    spring,
} from 'remotion';
import { z } from 'zod';
import { useIsPortrait, useResponsive } from '../../lib/responsive';
import { fadeIn, slideIn, staggerDelay } from '../../lib/animations';
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
import { COLORS, GRADIENTS } from '../../lib/theme';

// ─── Schema ──────────────────────────────────────────────────
export const caseStudyProcessSchema = z.object({
    companyName: z.string().default('CloudOps'),
    headline: z.string().default('Our Implementation Process'),
    step1Number: z.string().default('01'),
    step1Title: z.string().default('Discovery & Audit'),
    step1Desc: z.string().default('Deep-dive into existing infrastructure, identify bottlenecks, set KPIs'),
    step2Number: z.string().default('02'),
    step2Title: z.string().default('Architecture Design'),
    step2Desc: z.string().default('Design scalable cloud-native architecture with failover redundancy'),
    step3Number: z.string().default('03'),
    step3Title: z.string().default('Phased Migration'),
    step3Desc: z.string().default('Zero-downtime migration with rollback testing at each milestone'),
    step4Number: z.string().default('04'),
    step4Title: z.string().default('Optimize & Scale'),
    step4Desc: z.string().default('Continuous monitoring, auto-scaling rules, and cost optimization'),
    primaryColor: z.string().default(COLORS.accent),
    accentColor: z.string().default(COLORS.accentLight),
    backgroundColor: z.string().default(COLORS.bg),
});

type Props = z.infer<typeof caseStudyProcessSchema>;

// ─── Component ───────────────────────────────────────────────
export const CaseStudyProcess01: React.FC<Props> = (props) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const isPortrait = useIsPortrait();
    const scale = useResponsive(1, 1);
    const backgroundControls = useResolvedBackgroundControls();
    const renderBackgroundLayers = shouldRenderBackgroundLayer(backgroundControls);

    const steps = [
        { num: props.step1Number, title: props.step1Title, desc: props.step1Desc },
        { num: props.step2Number, title: props.step2Title, desc: props.step2Desc },
        { num: props.step3Number, title: props.step3Title, desc: props.step3Desc },
        { num: props.step4Number, title: props.step4Title, desc: props.step4Desc },
    ];

    return (
        <AbsoluteFill
            style={{
                background: resolveCanvasBackground(COLORS.bg, backgroundControls),
                overflow: 'hidden',
            }}
        >
            {/* Animated background */}
            <AnimatedGradient />
            {/* Glow */}
            {renderBackgroundLayers && (
            <div
                style={{
                    position: 'absolute',
                    top: '40%',
                    left: '-10%',
                    width: 500 * scale,
                    height: 500 * scale,
                    borderRadius: '50%',
                    background: `${props.primaryColor}08`,
                    filter: 'blur(120px)',
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
                    justifyContent: 'center',
                    padding: isPortrait ? '150px 80px' : '60px 100px',
                    gap: isPortrait ? 40 : 64,
                }}
            >
                {/* Header */}
                <div style={{ opacity: fadeIn(frame, 0), transform: slideIn(frame, 'down', 0, 20) }}>
                    <EditableText
                        text={props.companyName}
                        fontSize={isPortrait ? 40 : 36 * scale}
                        fontFamily={interFont}
                        color={COLORS.accent}
                        fontWeight={600}
                        textTransform="uppercase"
                        letterSpacing={4}
                    />
                </div>
                <EditableText
                    text={props.headline}
                    fontSize={isPortrait ? 92 : 112}
                    fontFamily={interFont}
                    color={COLORS.textPrimary}
                    fontWeight={800}
                    lineHeight={1.1}
                    letterSpacing={-1}
                    style={{
                        opacity: fadeIn(frame, 8),
                        transform: slideIn(frame, 'up', 8, 20),
                    }}
                />

                {/* Steps */}
                <div
                    style={{
                        flex: isPortrait ? undefined : 1,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        gap: isPortrait ? 32 : 40,
                    }}
                >
                    {steps.map((step, i) => {
                        const delay = 20 + staggerDelay(i, 12);
                        const stepSpring = spring({
                            frame: frame - delay,
                            fps,
                            config: { damping: 14, stiffness: 100, mass: 0.6 },
                        });

                        // Progress line between steps
                        const lineProgress = spring({
                            frame: frame - delay - 5,
                            fps,
                            config: { damping: 20, stiffness: 80, mass: 0.5 },
                        });

                        return (
                            <React.Fragment key={i}>
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: isPortrait ? 32 : 48,
                                        opacity: fadeIn(frame, delay),
                                        transform: `translateX(${interpolate(stepSpring, [0, 1], [40, 0])}px)`,
                                    }}
                                >
                                    {/* Step number */}
                                    <div
                                        style={{
                                            width: 72 * scale,
                                            height: 72 * scale,
                                            borderRadius: 28 * scale,
                                            background: linearGradient(135, `${props.primaryColor}20`, `${props.accentColor}10`),
                                            border: `2px solid ${props.primaryColor}40`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0,
                                            transform: `scale(${stepSpring})`,
                                        }}
                                    >
                                        <EditableText
                                            text={step.num}
                                            fontSize={34 * scale}
                                            fontFamily={interFont}
                                            color={COLORS.accent}
                                            fontWeight={900}
                                        />
                                    </div>

                                    {/* Content */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 * scale, paddingTop: 4 * scale }}>
                                        <EditableText
                                            text={step.title}
                                            fontSize={isPortrait ? 50 : 44 * scale}
                                            fontFamily={interFont}
                                            color={COLORS.textSecondary}
                                            fontWeight={700}
                                        />
                                        <EditableText
                                            text={step.desc}
                                            fontSize={isPortrait ? 40 : 36 * scale}
                                            fontFamily={interFont}
                                            color={COLORS.textSecondary}
                                            fontWeight={400}
                                            lineHeight={1.4}
                                            maxLines={2}
                                        />
                                    </div>
                                </div>

                                {/* Connector line */}
                                {i < steps.length - 1 && (
                                    <div
                                        style={{
                                            width: 2 * scale,
                                            height: isPortrait ? 12 : 20,
                                            marginLeft: 36 * scale,
                                            background: `${props.primaryColor}30`,
                                            borderRadius: 1 * scale,
                                            transform: `scaleY(${lineProgress})`,
                                            transformOrigin: 'top',
                                        }}
                                    />
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>
            </div>

            {/* Bottom accent */}
            {renderBackgroundLayers && (
            <div
                style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    width: `${interpolate(frame, [0, 90], [0, 100], { extrapolateRight: 'clamp' })}%`,
                    height: 6 * scale,
                    background: GRADIENTS.bgMain,
                }}
            />
            )}
        </AbsoluteFill>
    );
};

// ─── Register ────────────────────────────────────────────────
registerTemplate({
    id: 'case-study-process-01',
    name: 'Case Study Process Steps',
    category: 'case-study',
    description: 'Numbered process flow with 4 steps, connector lines, and staggered spring entry',
    tags: ['process', 'steps', 'methodology', 'case-study', 'workflow'],
    component: CaseStudyProcess01,
    schema: caseStudyProcessSchema,
    defaultProps: caseStudyProcessSchema.parse({}),
    durationInFrames: DEFAULT_DURATION_FRAMES,
    fps: DEFAULT_FPS,
});
