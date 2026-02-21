import React from 'react';
import {
    AbsoluteFill,
    useCurrentFrame,
    useVideoConfig,
    spring,
} from 'remotion';
import { z } from 'zod';
import { useIsPortrait, useScaleFactor } from "../../lib/responsive";
import { fadeIn, staggerDelay } from '../../lib/animations';
import { EditableText } from '../../components/EditableText';
import { AnimatedGradient } from '../../components/AnimatedGradient';
import {
    resolveCanvasBackground,
    useResolvedBackgroundControls,
} from '../../lib/background';
import { registerTemplate } from '../registry';
import { DEFAULT_DURATION_FRAMES, DEFAULT_FPS } from '../../lib/constants';
import { interFont } from '../../lib/fonts';
import { COLORS } from '../../lib/theme';

// ─── Schema ──────────────────────────────────────────────────
export const dataVizDonutSchema = z.object({
    title: z.string().default('Revenue by Category'),
    subtitle: z.string().default('FY 2025 Annual Breakdown'),
    centerLabel: z.string().default('Total'),
    centerValue: z.string().default('$12.4M'),
    seg1Label: z.string().default('SaaS'),
    seg1Pct: z.number().default(38),
    seg1Color: z.string().default('#536DFE'),
    seg2Label: z.string().default('Services'),
    seg2Pct: z.number().default(25),
    seg2Color: z.string().default('#FF4081'),
    seg3Label: z.string().default('Hardware'),
    seg3Pct: z.number().default(20),
    seg3Color: z.string().default('#FFD600'),
    seg4Label: z.string().default('Licensing'),
    seg4Pct: z.number().default(17),
    seg4Color: z.string().default('#00E5FF'),
    backgroundColor: z.string().default(COLORS.bg),
});

type Props = z.infer<typeof dataVizDonutSchema>;

// ─── Component ───────────────────────────────────────────────
export const DataVizDonut01: React.FC<Props> = (props) => {
    const scale = useScaleFactor();
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    
    const isPortrait = useIsPortrait();
    const backgroundControls = useResolvedBackgroundControls();

    const segments = [
        { label: props.seg1Label, pct: props.seg1Pct, color: props.seg1Color },
        { label: props.seg2Label, pct: props.seg2Pct, color: props.seg2Color },
        { label: props.seg3Label, pct: props.seg3Pct, color: props.seg3Color },
        { label: props.seg4Label, pct: props.seg4Pct, color: props.seg4Color },
    ];

    const total = segments.reduce((s, seg) => s + seg.pct, 0);
    const radius = isPortrait ? 200 : 140;
    const strokeWidth = isPortrait ? 40 : 36;
    const circumference = 2 * Math.PI * radius;

    const drawProgress = spring({
        frame: frame - 15,
        fps,
        config: { damping: 20, stiffness: 50, mass: 1 },
    });

    let cumulativeOffset = 0;

    return (
        <AbsoluteFill
            style={{
                background: resolveCanvasBackground(COLORS.bg, backgroundControls),
                overflow: 'hidden',
            }}
        >
            {/* Animated background */}
            <AnimatedGradient />
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
                    gap: isPortrait ? 80 : 48,
                }}
            >
                {/* Header */}
                <div style={{ opacity: fadeIn(frame, 0) }}>
                    <EditableText
                        text={props.title}
                        fontSize={isPortrait ? 92 : 112}
                        fontFamily={interFont}
                        color={COLORS.textPrimary}
                        fontWeight={800}
                        lineHeight={1.1}
                        letterSpacing={-1}
                    />
                    <EditableText
                        text={props.subtitle}
                        fontSize={isPortrait ? 44 : 52}
                        fontFamily={interFont}
                        color={COLORS.textSecondary}
                        fontWeight={400}
                        style={{ marginTop: 16 * scale }}
                    />
                </div>

                {/* Donut + Legend */}
                <div
                    style={{
                        flex: isPortrait ? undefined : 1,
                        display: 'flex',
                        flexDirection: isPortrait ? 'column' : 'row',
                        alignItems: isPortrait ? 'stretch' : 'center',
                        justifyContent: 'center',
                        gap: isPortrait ? 56 : 120,
                    }}
                >
                    {/* SVG Donut */}
                    <div style={{ position: 'relative' }}>
                        <svg
                            width={(radius + strokeWidth) * 2}
                            height={(radius + strokeWidth) * 2}
                            viewBox={`0 0 ${(radius + strokeWidth) * 2} ${(radius + strokeWidth) * 2}`}
                            style={{ transform: 'rotate(-90deg)' }}
                        >
                            {segments.map((seg, i) => {
                                const segLength = (seg.pct / total) * circumference;
                                const offset = cumulativeOffset;
                                cumulativeOffset += segLength;

                                return (
                                    <circle
                                        key={i}
                                        cx={radius + strokeWidth}
                                        cy={radius + strokeWidth}
                                        r={radius}
                                        fill="none"
                                        stroke={seg.color}
                                        strokeWidth={strokeWidth}
                                        strokeDasharray={`${segLength * drawProgress} ${circumference}`}
                                        strokeDashoffset={-offset * drawProgress}
                                        strokeLinecap="round"
                                        style={{ filter: `drop-shadow(0 0 8px ${seg.color}44)` }}
                                    />
                                );
                            })}
                        </svg>

                        {/* Center label */}
                        <div
                            style={{
                                position: 'absolute',
                                top: '50%',
                                left: '50%',
                                transform: 'translate(-50%, -50%)',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: 4 * scale,
                                opacity: fadeIn(frame, 40),
                            }}
                        >
                            <EditableText
                                text={props.centerLabel}
                                fontSize={32 * scale}
                                fontFamily={interFont}
                                color={COLORS.textSecondary}
                                fontWeight={500}
                                textTransform="uppercase"
                                letterSpacing={2}
                            />
                            <EditableText
                                text={props.centerValue}
                                fontSize={84 * scale}
                                fontFamily={interFont}
                                color={COLORS.textSecondary}
                                fontWeight={700}
                            />
                        </div>
                    </div>

                    {/* Legend */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: isPortrait ? 20 : 28 }}>
                        {segments.map((seg, i) => {
                            const delay = 45 + staggerDelay(i, 10);
                            return (
                                <div
                                    key={i}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 24 * scale,
                                        opacity: fadeIn(frame, delay),
                                    }}
                                >
                                    <div
                                        style={{
                                            width: 14 * scale,
                                            height: 14 * scale,
                                            borderRadius: 4 * scale,
                                            background: seg.color,
                                            flexShrink: 0,
                                            boxShadow: `0 0 8px ${seg.color}44`,
                                        }}
                                    />
                                    <EditableText
                                        text={seg.label}
                                        fontSize={36 * scale}
                                        fontFamily={interFont}
                                        color={COLORS.textSecondary}
                                        fontWeight={500}
                                    />
                                    <EditableText
                                        text={`${seg.pct}%`}
                                        fontSize={36 * scale}
                                        fontFamily={interFont}
                                        color={seg.color}
                                        fontWeight={700}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </AbsoluteFill>
    );
};

// ─── Register ────────────────────────────────────────────────
registerTemplate({
    id: 'data-viz-donut-01',
    name: 'Donut Chart Breakdown',
    category: 'data-visualization',
    description: 'Animated SVG donut chart with 4 segments, center total, and color legend',
    tags: ['chart', 'donut', 'pie', 'data', 'breakdown'],
    component: DataVizDonut01,
    schema: dataVizDonutSchema,
    defaultProps: dataVizDonutSchema.parse({}),
    durationInFrames: DEFAULT_DURATION_FRAMES,
    fps: DEFAULT_FPS,
});
