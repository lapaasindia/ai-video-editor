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
export const caseStudyResultsSchema = z.object({
    companyName: z.string().default('FinanceHub'),
    headline: z.string().default('Results That Speak for Themselves'),
    row1Icon: z.string().default('📈'),
    row1Label: z.string().default('Revenue Growth'),
    row1Value: z.string().default('+187%'),
    row2Icon: z.string().default('👥'),
    row2Label: z.string().default('Customer Acquisition'),
    row2Value: z.string().default('+12,400 users'),
    row3Icon: z.string().default('⚡'),
    row3Label: z.string().default('Processing Speed'),
    row3Value: z.string().default('3x faster'),
    row4Icon: z.string().default('💰'),
    row4Label: z.string().default('Cost Savings'),
    row4Value: z.string().default('$4.2M annually'),
    row5Icon: z.string().default('🎯'),
    row5Label: z.string().default('Accuracy Rate'),
    row5Value: z.string().default('99.8%'),
    primaryColor: z.string().default(COLORS.accent),
    accentColor: z.string().default(COLORS.accentLight),
    backgroundColor: z.string().default(COLORS.bg),
});

type Props = z.infer<typeof caseStudyResultsSchema>;

// ─── Component ───────────────────────────────────────────────
export const CaseStudyResults01: React.FC<Props> = (props) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    
    const isPortrait = useIsPortrait();
    const scale = useResponsive(1, 1);
    const backgroundControls = useResolvedBackgroundControls();
    const renderBackgroundLayers = shouldRenderBackgroundLayer(backgroundControls);

    const rows = [
        { icon: props.row1Icon, label: props.row1Label, value: props.row1Value },
        { icon: props.row2Icon, label: props.row2Label, value: props.row2Value },
        { icon: props.row3Icon, label: props.row3Label, value: props.row3Value },
        { icon: props.row4Icon, label: props.row4Label, value: props.row4Value },
        { icon: props.row5Icon, label: props.row5Label, value: props.row5Value },
    ];

    return (
        <AbsoluteFill
            style={{
                background: resolveCanvasBackground(props.backgroundColor, backgroundControls),
                overflow: 'hidden',
            }}
        >
            {/* Animated background */}
            <AnimatedGradient />
            {/* Decorative gradient orb */}
            {renderBackgroundLayers && (
            <div
                style={{
                    position: 'absolute',
                    top: '-15%',
                    right: '-15%',
                    width: 700,
                    height: 700,
                    borderRadius: '50%',
                    background: `${props.primaryColor}08`,
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
                    justifyContent: 'center',
                    padding: isPortrait ? '120px 60px' : '60px 100px',
                    gap: isPortrait ? 48 : 72,
                }}
            >
                {/* Header */}
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 20,
                        opacity: fadeIn(frame, 0),
                        transform: slideIn(frame, 'down', 0, 25),
                    }}
                >
                    <EditableText
                        text={props.companyName}
                        fontSize={36 * scale}
                        fontFamily={interFont}
                        color={COLORS.accent}
                        fontWeight={600}
                        textTransform="uppercase"
                        letterSpacing={4}
                    />
                    <EditableText
                        text={props.headline}
                        fontSize={isPortrait ? 84 : 112}
                        fontFamily={interFont}
                        color={COLORS.textPrimary}
                        fontWeight={800}
                        lineHeight={1.1}
                        letterSpacing={-1}
                    />
                </div>

                {/* Results rows */}
                <div
                    style={{
                        flex: isPortrait ? undefined : 1,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        gap: isPortrait ? 28 : 32,
                    }}
                >
                    {rows.map((row, i) => {
                        const delay = 20 + staggerDelay(i, 10);
                        const barWidth = spring({
                            frame: frame - delay,
                            fps,
                            config: { damping: 15, stiffness: 80, mass: 0.6 },
                        });

                        return (
                            <div
                                key={i}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: isPortrait ? 24 : 40,
                                    padding: `${14 * scale}px ${20 * scale}px`,
                                    borderRadius: 28,
                                    background: 'rgba(255,255,255,0.03)',
                                    border: '2px solid rgba(255,255,255,0.06)',
                                    opacity: fadeIn(frame, delay),
                                    transform: slideIn(frame, 'left', delay, 30),
                                }}
                            >
                                {/* Icon */}
                                <div
                                    style={{
                                        fontSize: 56 * scale,
                                        width: 44 * scale,
                                        height: 44 * scale,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        borderRadius: 20,
                                        background: `${props.primaryColor}15`,
                                        flexShrink: 0,
                                    }}
                                >
                                    {row.icon}
                                </div>

                                {/* Label */}
                                <div style={{ flex: 1 }}>
                                    <EditableText
                                        text={row.label}
                                        fontSize={isPortrait ? 46 : 40 * scale}
                                        fontFamily={interFont}
                                        color={COLORS.textSecondary}
                                        fontWeight={500}
                                    />
                                </div>

                                {/* Progress bar */}
                                <div
                                    style={{
                                        flex: isPortrait ? 0 : 1,
                                        height: 6,
                                        borderRadius: 3,
                                        background: 'rgba(255,255,255,0.06)',
                                        overflow: 'hidden',
                                        display: isPortrait ? 'none' : 'block',
                                    }}
                                >
                                    <div
                                        style={{
                                            width: `${barWidth * 100}%`,
                                            height: '100%',
                                            borderRadius: 3,
                                            background: GRADIENTS.bgMain,
                                        }}
                                    />
                                </div>

                                {/* Value */}
                                <EditableText
                                    text={row.value}
                                    fontSize={isPortrait ? 50 : 44 * scale}
                                    fontFamily={interFont}
                                    color={COLORS.accentLight}
                                    fontWeight={700}
                                    style={{ flexShrink: 0 }}
                                />
                            </div>
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
                    height: 6,
                    background: GRADIENTS.bgMain,
                }}
            />
            )}
        </AbsoluteFill>
    );
};

// ─── Register ────────────────────────────────────────────────
registerTemplate({
    id: 'case-study-results-01',
    name: 'Case Study Results List',
    category: 'case-study',
    description: 'Stacked results rows with emoji icons, progress bars, and animated values',
    tags: ['results', 'metrics', 'list', 'case-study', 'outcomes'],
    component: CaseStudyResults01,
    schema: caseStudyResultsSchema,
    defaultProps: caseStudyResultsSchema.parse({}),
    durationInFrames: DEFAULT_DURATION_FRAMES,
    fps: DEFAULT_FPS,
});
