import React from 'react';
import {
    AbsoluteFill,
    useCurrentFrame,
    useVideoConfig,
    interpolate,
    spring,
} from 'remotion';
import { z } from 'zod';
import { useIsPortrait, useScaleFactor } from "../../lib/responsive";
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
import { COLORS, FONT, SPACING, RADIUS, GRADIENTS, pSize, pPad, pGap } from '../../lib/theme';

// ─── Schema ──────────────────────────────────────────────────
export const caseStudyStatsSchema = z.object({
    companyName: z.string().default('TechFlow Inc.'),
    headline: z.string().default('The Numbers That Tell The Story'),
    stat1Value: z.string().default('2.4M'),
    stat1Label: z.string().default('Users Acquired'),
    stat2Value: z.string().default('98%'),
    stat2Label: z.string().default('Customer Retention'),
    stat3Value: z.string().default('$12M'),
    stat3Label: z.string().default('Revenue Generated'),
    stat4Value: z.string().default('45'),
    stat4Label: z.string().default('Countries Reached'),
    primaryColor: z.string().default(COLORS.accent),
    accentColor: z.string().default(COLORS.accentLight),
    backgroundColor: z.string().default(COLORS.bg),
});

type Props = z.infer<typeof caseStudyStatsSchema>;

// ─── Component ───────────────────────────────────────────────
const StatCard: React.FC<{
    value: string;
    label: string;
    delay: number;
    color: string;
    frame: number;
    fps: number;
    scale: number;
}> = ({ value, label, delay, color, frame, fps, scale }) => {
    const statValueSize = 96;
    const statLabelSize = 30;

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 96 * scale,
                borderRadius: RADIUS.lg,
                background: COLORS.surface,
                border: `2px solid ${COLORS.border}`,
                backdropFilter: 'blur(10px)',
                opacity: fadeIn(frame, delay),
                transform: `scale(${spring({
                    frame: frame - delay,
                    fps,
                    config: { damping: 12, stiffness: 150, mass: 0.5 },
                })})`,
                minWidth: 468 * scale,
            }}
        >
            <EditableText
                text={value}
                fontSize={statValueSize * scale}
                fontFamily={interFont}
                color={color}
                fontWeight={FONT.black}
                letterSpacing={FONT.tight_ls}
            />
            <EditableText
                text={label}
                fontSize={statLabelSize * scale}
                fontFamily={interFont}
                color={COLORS.textSecondary}
                fontWeight={FONT.medium}
                textTransform="uppercase"
                letterSpacing={FONT.wide}
                textAlign="center"
                style={{ marginTop: 16 * scale }}
            />
        </div>
    );
};

export const CaseStudyStats01: React.FC<Props> = (props) => {
    const scale = useScaleFactor();
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    
    const isPortrait = useIsPortrait();
    const backgroundControls = useResolvedBackgroundControls();
    const renderBackgroundLayers = shouldRenderBackgroundLayer(backgroundControls);

    const stats = [
        { value: props.stat1Value, label: props.stat1Label },
        { value: props.stat2Value, label: props.stat2Label },
        { value: props.stat3Value, label: props.stat3Label },
        { value: props.stat4Value, label: props.stat4Label },
    ];

    return (
        <AbsoluteFill
            style={{
                background: resolveCanvasBackground(GRADIENTS.bgMain, backgroundControls),
                overflow: 'hidden',
            }}
        >
            {/* Animated background */}
            <AnimatedGradient />
            {/* Decorative circles */}
            {renderBackgroundLayers && (
            <>
            <div
                style={{
                    position: 'absolute',
                    top: '-20%',
                    right: '-10%',
                    width: 1200 * scale,
                    height: 1200 * scale,
                    borderRadius: '50%',
                    background: `${COLORS.accent}15`,
                    filter: 'blur(120px)',
                }}
            />
            <div
                style={{
                    position: 'absolute',
                    bottom: '-20%',
                    left: '-10%',
                    width: 1000 * scale,
                    height: 1000 * scale,
                    borderRadius: '50%',
                    background: `${COLORS.accent}10`,
                    filter: 'blur(120px)',
                }}
            />
            </>
            )}

            {/* Content */}
            <div
                style={{
                    position: 'relative',
                    zIndex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: isPortrait ? 'flex-end' : 'center',
                    width: '100%',
                    height: '100%',
                    padding: pPad(isPortrait),
                    gap: pGap(SPACING.xl, isPortrait),
                }}
            >
                {/* Header */}
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: SPACING.sm,
                        opacity: fadeIn(frame, 0),
                        transform: slideIn(frame, 'down', 0, 30),
                    }}
                >
                    <EditableText
                        text={props.companyName}
                        fontSize={FONT.label}
                        fontFamily={interFont}
                        color={COLORS.accent}
                        fontWeight={FONT.semibold}
                        textTransform="uppercase"
                        letterSpacing={FONT.wide}
                    />
                    <EditableText
                        text={props.headline}
                        fontSize={pSize(FONT.h1, isPortrait)}
                        fontFamily={interFont}
                        color={COLORS.textPrimary}
                        fontWeight={FONT.black}
                        textAlign="center"
                        lineHeight={1.1}
                        letterSpacing={-1}
                        maxLines={2}
                    />
                </div>

                {/* Stats grid */}
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: isPortrait ? '1fr 1fr' : 'repeat(4, 1fr)',
                        gap: pGap(SPACING.md, isPortrait),
                        width: '100%',
                        maxWidth: isPortrait ? '100%' : 2400,
                    }}
                >
                    {stats.map((stat, i) => (
                        <StatCard
                            key={i}
                            value={stat.value}
                            label={stat.label}
                            delay={20 + staggerDelay(i, 8)}
                            color={i % 2 === 0 ? props.primaryColor : props.accentColor}
                            frame={frame}
                            fps={fps}
                            scale={scale}
                        />
                    ))}
                </div>
            </div>

            {/* Bottom accent */}
            <div
                style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    width: `${interpolate(frame, [0, 90], [0, 100], {
                        extrapolateRight: 'clamp',
                    })}%`,
                    height: 6 * scale,
                    background: GRADIENTS.accentLine,
                }}
            />
        </AbsoluteFill>
    );
};

// ─── Register ────────────────────────────────────────────────
registerTemplate({
    id: 'case-study-stats-01',
    name: 'Case Study Stats Dashboard',
    category: 'case-study',
    description: '4-card stats dashboard with staggered spring animations and glassmorphism',
    tags: ['stats', 'metrics', 'dashboard', 'case-study', 'numbers'],
    component: CaseStudyStats01,
    schema: caseStudyStatsSchema,
    defaultProps: caseStudyStatsSchema.parse({}),
    durationInFrames: DEFAULT_DURATION_FRAMES,
    fps: DEFAULT_FPS,
});
