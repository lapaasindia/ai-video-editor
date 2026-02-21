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
import { interFont } from '../../lib/fonts';
import { COLORS, FONT, SPACING, GRADIENTS, pPad, pGap } from '../../lib/theme';

// ─── Schema ──────────────────────────────────────────────────
export const caseStudyTimelineSchema = z.object({
    companyName: z.string().default('CloudScale'),
    headline: z.string().default('The Journey to 10x Growth'),
    step1Title: z.string().default('Q1 2024'),
    step1Desc: z.string().default('Identified key market opportunities and gaps'),
    step2Title: z.string().default('Q2 2024'),
    step2Desc: z.string().default('Launched new digital platform & onboarded 500 users'),
    step3Title: z.string().default('Q3 2024'),
    step3Desc: z.string().default('Scaled operations to 5 new markets'),
    step4Title: z.string().default('Q4 2024'),
    step4Desc: z.string().default('Achieved 10x revenue growth target'),
    primaryColor: z.string().default(COLORS.accent),
    accentColor: z.string().default(COLORS.accentLight),
    backgroundColor: z.string().default(COLORS.bg),
});

type Props = z.infer<typeof caseStudyTimelineSchema>;

// ─── Component ───────────────────────────────────────────────
export const CaseStudyTimeline01: React.FC<Props> = (props) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    
    const isPortrait = useIsPortrait();
    const scale = useResponsive(1, 1);
    const backgroundControls = useResolvedBackgroundControls();
    const renderBackgroundLayers = shouldRenderBackgroundLayer(backgroundControls);

    const steps = [
        { title: props.step1Title, desc: props.step1Desc },
        { title: props.step2Title, desc: props.step2Desc },
        { title: props.step3Title, desc: props.step3Desc },
        { title: props.step4Title, desc: props.step4Desc },
    ];
    const companyLabelSize = 30;
    const headlineSize = isPortrait ? 96 : 116;
    const timelineStepTitleSize = 56;
    const timelineStepBodySize = 30;

    return (
        <AbsoluteFill
            style={{
                background: resolveCanvasBackground(COLORS.bg, backgroundControls),
                overflow: 'hidden',
            }}
        >
            {/* Animated background */}
            <AnimatedGradient />
            {/* Background glow */}
            {renderBackgroundLayers && (
            <div
                style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 1600,
                    height: 1600,
                    borderRadius: '50%',
                    background: `${COLORS.accent}08`,
                    filter: 'blur(160px)',
                }}
            />
            )}

            {/* Content */}
            <div
                style={{
                    position: 'relative',
                    zIndex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    width: '100%',
                    height: '100%',
                    justifyContent: 'center',
                    padding: pPad(isPortrait),
                    gap: pGap(SPACING.lg, isPortrait),
                }}
            >
                {/* Header */}
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: SPACING.sm,
                        opacity: fadeIn(frame, 0),
                        transform: slideIn(frame, 'down', 0, 30),
                    }}
                >
                    <EditableText
                        text={props.companyName}
                        fontSize={companyLabelSize}
                        fontFamily={interFont}
                        color={COLORS.accent}
                        fontWeight={FONT.semibold}
                        textTransform="uppercase"
                        letterSpacing={FONT.wide}
                    />
                    <EditableText
                        text={props.headline}
                        fontSize={headlineSize * scale}
                        fontFamily={interFont}
                        color={COLORS.textPrimary}
                        fontWeight={FONT.black}
                        lineHeight={1.1}
                        letterSpacing={-1}
                    />
                </div>

                {/* Timeline */}
                <div
                    style={{
                        flex: isPortrait ? undefined : 1,
                        display: 'flex',
                        flexDirection: isPortrait ? 'column' : 'row',
                        alignItems: isPortrait ? 'flex-start' : 'center',
                        gap: isPortrait ? 80 : 0,
                        position: 'relative',
                    }}
                >
                    {/* Connecting line */}
                    <div
                        style={{
                            position: 'absolute',
                            ...(isPortrait
                                ? {
                                    left: 20,
                                    top: 0,
                                    bottom: 0,
                                    width: 2,
                                }
                                : {
                                    top: '50%',
                                    left: 0,
                                    right: 0,
                                    height: 2,
                                    transform: 'translateY(-50%)',
                                }),
                            background: `${COLORS.accent}33`,
                        }}
                    >
                        {/* Animated progress */}
                        <div
                            style={{
                                ...(isPortrait
                                    ? {
                                        width: '100%',
                                        height: `${interpolate(frame, [15, 120], [0, 100], {
                                            extrapolateLeft: 'clamp',
                                            extrapolateRight: 'clamp',
                                        })
                                            }% `,
                                    }
                                    : {
                                        height: '100%',
                                        width: `${interpolate(frame, [15, 120], [0, 100], {
                                            extrapolateLeft: 'clamp',
                                            extrapolateRight: 'clamp',
                                        })
                                            }% `,
                                    }),
                                background: GRADIENTS.accentLine,
                                borderRadius: 2,
                            }}
                        />
                    </div>

                    {/* Steps */}
                    {steps.map((step, i) => {
                        const delay = 20 + staggerDelay(i, 18);
                        const dotScale = spring({
                            frame: frame - delay,
                            fps,
                            config: { damping: 10, stiffness: 200, mass: 0.3 },
                        });

                        return (
                            <div
                                key={i}
                                style={{
                                    flex: isPortrait ? undefined : 1,
                                    display: 'flex',
                                    flexDirection: isPortrait ? 'row' : 'column',
                                    alignItems: isPortrait ? 'flex-start' : 'center',
                                    gap: pGap(SPACING.sm, isPortrait),
                                    opacity: fadeIn(frame, delay),
                                    paddingLeft: isPortrait ? 0 : 0,
                                    paddingTop: isPortrait ? 12 : 0,
                                }}
                            >
                                {/* Dot */}
                                <div
                                    style={{
                                        width: 80 * scale,
                                        height: 80 * scale,
                                        borderRadius: '50%',
                                        background: COLORS.accent,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: isPortrait ? 'flex-end' : 'center',
                                        transform: `scale(${dotScale})`,
                                        boxShadow: `0 0 30px ${COLORS.glow}`,
                                        flexShrink: 0,
                                        zIndex: 2,
                                    }}
                                >
                                    <span
                                        style={{
                                            color: '#fff',
                                            fontSize: FONT.label * scale,
                                            fontWeight: FONT.bold,
                                            fontFamily: interFont,
                                        }}
                                    >
                                        {i + 1}
                                    </span>
                                </div>

                                {/* Text */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xs }}>
                                    <EditableText
                                        text={step.title}
                                        fontSize={timelineStepTitleSize * scale}
                                        fontFamily={interFont}
                                        color={COLORS.accent}
                                        fontWeight={FONT.bold}
                                    />
                                    <EditableText
                                        text={step.desc}
                                        fontSize={timelineStepBodySize * scale}
                                        fontFamily={interFont}
                                        color={COLORS.textSecondary}
                                        fontWeight={FONT.regular}
                                        lineHeight={FONT.normal}
                                        maxLines={2}
                                        style={{ maxWidth: isPortrait ? '100%' : 400 }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </AbsoluteFill>
    );
};

// ─── Register ────────────────────────────────────────────────
registerTemplate({
    id: 'case-study-timeline-01',
    name: 'Case Study Timeline',
    category: 'case-study',
    description: 'Animated 4-step timeline with connecting line, numbered dots, and staggered reveals',
    tags: ['timeline', 'process', 'steps', 'case-study', 'journey'],
    component: CaseStudyTimeline01,
    schema: caseStudyTimelineSchema,
    defaultProps: caseStudyTimelineSchema.parse({}),
    durationInFrames: DEFAULT_DURATION_FRAMES,
    fps: DEFAULT_FPS,
});
