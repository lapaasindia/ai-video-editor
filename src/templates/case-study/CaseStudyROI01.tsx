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
import { COLORS, GRADIENTS } from '../../lib/theme';

// ─── Schema ──────────────────────────────────────────────────
export const caseStudyROISchema = z.object({
    companyName: z.string().default('LogiFlow'),
    headline: z.string().default('Return on Investment'),
    investmentLabel: z.string().default('Total Investment'),
    investmentValue: z.string().default('$340K'),
    returnsLabel: z.string().default('Annual Returns'),
    returnsValue: z.string().default('$2.1M'),
    roiLabel: z.string().default('ROI'),
    roiValue: z.string().default('517%'),
    paybackLabel: z.string().default('Payback Period'),
    paybackValue: z.string().default('2.3 months'),
    savingsLabel: z.string().default('Cost Savings'),
    savingsValue: z.string().default('$1.76M/yr'),
    quote: z.string().default('"Best investment we\'ve made in 10 years" — CTO, LogiFlow'),
    primaryColor: z.string().default(COLORS.accent),
    accentColor: z.string().default(COLORS.accentLight),
    backgroundColor: z.string().default(COLORS.bg),
});

type Props = z.infer<typeof caseStudyROISchema>;

// ─── Component ───────────────────────────────────────────────
export const CaseStudyROI01: React.FC<Props> = (props) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const isPortrait = useIsPortrait();
    const scale = useResponsive(1, 1);
    const backgroundControls = useResolvedBackgroundControls();
    const renderBackgroundLayers = shouldRenderBackgroundLayer(backgroundControls);
    const roiValueSize = isPortrait ? 148 : 172;
    const headlineSize = isPortrait ? 78 : 102;
    const statValueSize = isPortrait ? 58 : 52 * scale;

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
                    top: '30%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 500,
                    height: 500,
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
                    padding: isPortrait ? '140px 80px' : '60px 100px',
                    gap: isPortrait ? 48 : 48,
                }}
            >
                {/* Header */}
                <div style={{ opacity: fadeIn(frame, 0), transform: slideIn(frame, 'down', 0, 20) }}>
                    <EditableText
                        text={props.companyName}
                        fontSize={isPortrait ? 36 : 30 * scale}
                        fontFamily={interFont}
                        color={COLORS.accent}
                        fontWeight={600}
                        textTransform="uppercase"
                        letterSpacing={4}
                    />
                </div>
                <EditableText
                    text={props.headline}
                    fontSize={headlineSize}
                    fontFamily={interFont}
                    color={COLORS.textPrimary}
                    fontWeight={800}
                    lineHeight={1.1}
                    letterSpacing={-1}
                    style={{ opacity: fadeIn(frame, 8), transform: slideIn(frame, 'up', 8, 20) }}
                />

                {/* Big ROI center card */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginTop: isPortrait ? 8 : 16,
                    }}
                >
                    <div
                        style={{
                            padding: `${28 * scale}px ${48 * scale}px`,
                            borderRadius: 48,
                            background: `${props.primaryColor}10`,
                            border: `2px solid ${props.primaryColor}30`,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 12,
                            transform: `scale(${spring({ frame: frame - 20, fps, config: { damping: 8, stiffness: 100, mass: 0.6 } })})`,
                            opacity: fadeIn(frame, 20),
                            boxShadow: `0 0 60px ${props.primaryColor}15`,
                        }}
                    >
                        <EditableText
                            text={props.roiValue}
                            fontSize={roiValueSize}
                            fontFamily={interFont}
                            color={COLORS.accent}
                            fontWeight={900}
                            letterSpacing={-2}
                        />
                        <EditableText
                            text={props.roiLabel}
                            fontSize={36 * scale}
                            fontFamily={interFont}
                            color={COLORS.textSecondary}
                            fontWeight={600}
                            textTransform="uppercase"
                            letterSpacing={4}
                        />
                    </div>
                </div>

                {/* Supporting stats row */}
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: isPortrait ? '1fr 1fr' : 'repeat(4, 1fr)',
                        gap: isPortrait ? 20 : 32,
                        marginTop: isPortrait ? 0 : 'auto',
                    }}
                >
                    {[
                        { label: props.investmentLabel, value: props.investmentValue },
                        { label: props.returnsLabel, value: props.returnsValue },
                        { label: props.paybackLabel, value: props.paybackValue },
                        { label: props.savingsLabel, value: props.savingsValue },
                    ].map((stat, i) => {
                        const delay = 40 + staggerDelay(i, 8);
                        return (
                            <div
                                key={i}
                                style={{
                                    textAlign: 'center',
                                    padding: `${14 * scale}px`,
                                    borderRadius: 24,
                                    background: 'rgba(255,255,255,0.03)',
                                    border: '2px solid rgba(255,255,255,0.06)',
                                    opacity: fadeIn(frame, delay),
                                    transform: slideIn(frame, 'up', delay, 15),
                                }}
                            >
                                <EditableText
                                    text={stat.label}
                                    fontSize={28 * scale}
                                    fontFamily={interFont}
                                    color={COLORS.textSecondary}
                                    fontWeight={500}
                                    textTransform="uppercase"
                                    letterSpacing={2}
                                />
                                <EditableText
                                    text={stat.value}
                                    fontSize={statValueSize}
                                    fontFamily={interFont}
                                    color={COLORS.textSecondary}
                                    fontWeight={700}
                                />
                            </div>
                        );
                    })}
                </div>

                {/* Quote */}
                <EditableText
                    text={props.quote}
                    fontSize={isPortrait ? 44 : 40 * scale}
                    fontFamily={interFont}
                    color={COLORS.textSecondary}
                    fontWeight={400}
                    textAlign={isPortrait ? 'center' : 'left'}
                    style={{ opacity: fadeIn(frame, 80), fontStyle: 'italic' as const }}
                />
            </div>

            {/* Bottom accent */}
            <div
                style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    width: `${interpolate(frame, [0, 60], [0, 100], { extrapolateRight: 'clamp' })}%`,
                    height: 6,
                    background: GRADIENTS.bgMain,
                }}
            />
        </AbsoluteFill>
    );
};

// ─── Register ────────────────────────────────────────────────
registerTemplate({
    id: 'case-study-roi-01',
    name: 'Case Study ROI',
    category: 'case-study',
    description: 'ROI showcase with giant percentage center card, 4 supporting stats, and testimonial quote',
    tags: ['ROI', 'return', 'investment', 'case-study', 'metrics'],
    component: CaseStudyROI01,
    schema: caseStudyROISchema,
    defaultProps: caseStudyROISchema.parse({}),
    durationInFrames: DEFAULT_DURATION_FRAMES,
    fps: DEFAULT_FPS,
});
