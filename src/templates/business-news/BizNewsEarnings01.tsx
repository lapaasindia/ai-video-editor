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
import { fadeIn, slideIn } from '../../lib/animations';
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
export const bizNewsEarningsSchema = z.object({
    companyName: z.string().default('Tesla Inc.'),
    tickerSymbol: z.string().default('TSLA'),
    quarter: z.string().default('Q4 2025'),
    headline: z.string().default('Tesla Beats Q4 Estimates with Record Deliveries'),
    revenueValue: z.string().default('$25.7B'),
    revenueLabel: z.string().default('Revenue'),
    revenueChange: z.string().default('+12.3% YoY'),
    epsValue: z.string().default('$1.24'),
    epsLabel: z.string().default('EPS'),
    epsChange: z.string().default('vs $1.08 est.'),
    guidanceText: z.string().default('FY2026 guidance raised to $105-110B revenue'),
    source: z.string().default('Bloomberg'),
    timestamp: z.string().default('After Hours • Feb 12, 2026'),
    primaryColor: z.string().default(COLORS.accent),
    accentColor: z.string().default(COLORS.accentLight),
    backgroundColor: z.string().default(COLORS.bg),
});

type Props = z.infer<typeof bizNewsEarningsSchema>;

// ─── Component ───────────────────────────────────────────────
export const BizNewsEarnings01: React.FC<Props> = (props) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    
    const isPortrait = useIsPortrait();
    const scale = useResponsive(1, 1);
    const backgroundControls = useResolvedBackgroundControls();
    const renderBackgroundLayers = shouldRenderBackgroundLayer(backgroundControls);

    return (
        <AbsoluteFill
            style={{
                background: resolveCanvasBackground(props.backgroundColor, backgroundControls),
                overflow: 'hidden',
            }}
        >
            {/* Animated background */}
            <AnimatedGradient />
            {/* Subtle gradient */}
            {renderBackgroundLayers && (
                <div
                    style={{
                        position: 'absolute',
                        top: 0, left: 0, right: 0, bottom: 0,
                        background: GRADIENTS.bgMain,
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
                    gap: isPortrait ? 80 : 60,
                }}
            >
                {/* Top bar: Ticker + Quarter */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 32,
                        opacity: fadeIn(frame, 0),
                    }}
                >
                    <div
                        style={{
                            padding: `${6 * scale}px ${16 * scale}px`,
                            borderRadius: 12,
                            background: COLORS.accent,
                            display: 'flex',
                            gap: 16,
                            alignItems: 'center',
                        }}
                    >
                        <EditableText
                            text={props.tickerSymbol}
                            fontSize={36 * scale}
                            fontFamily={interFont}
                            color={COLORS.textPrimary}
                            fontWeight={800}
                            letterSpacing={1}
                        />
                    </div>
                    <EditableText
                        text={`EARNINGS • ${props.quarter}`}
                        fontSize={32 * scale}
                        fontFamily={interFont}
                        color={COLORS.textSecondary}
                        fontWeight={600}
                        letterSpacing={2}
                    />
                </div>

                {/* Company name */}
                <EditableText
                    text={props.companyName}
                    fontSize={isPortrait ? 48 : 64}
                    fontFamily={interFont}
                    color={COLORS.textSecondary}
                    fontWeight={500}
                    style={{ opacity: fadeIn(frame, 5), transform: slideIn(frame, 'left', 5, 20) }}
                />

                {/* Headline */}
                <EditableText
                    text={props.headline}
                    fontSize={isPortrait ? 92 : 112}
                    fontFamily={interFont}
                    color={COLORS.textPrimary}
                    fontWeight={800}
                    lineHeight={1.1}
                    letterSpacing={-1}
                    maxLines={3}
                    style={{
                        opacity: fadeIn(frame, 10),
                        transform: slideIn(frame, 'up', 10, 25),
                    }}
                />

                {/* Metrics cards */}
                <div
                    style={{
                        display: 'flex',
                        flexDirection: isPortrait ? 'column' : 'row',
                        gap: isPortrait ? 24 : 48,
                        marginTop: isPortrait ? 0 : 'auto',
                    }}
                >
                    {/* Revenue card */}
                    <div
                        style={{
                            flex: isPortrait ? undefined : 1,
                            padding: `${24 * scale}px`,
                            borderRadius: 32,
                            background: 'rgba(255,255,255,0.03)',
                            border: '2px solid rgba(255,255,255,0.08)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 16,
                            opacity: fadeIn(frame, 30),
                            transform: `scale(${spring({ frame: frame - 30, fps, config: { damping: 12, stiffness: 150, mass: 0.5 } })})`,
                        }}
                    >
                        <EditableText
                            text={props.revenueLabel}
                            fontSize={32 * scale}
                            fontFamily={interFont}
                            color={COLORS.textSecondary}
                            fontWeight={600}
                            textTransform="uppercase"
                            letterSpacing={2}
                        />
                        <EditableText
                            text={props.revenueValue}
                            fontSize={96 * scale}
                            fontFamily={interFont}
                            color={COLORS.textSecondary}
                            fontWeight={800}
                        />
                        <EditableText
                            text={props.revenueChange}
                            fontSize={36 * scale}
                            fontFamily={interFont}
                            color={COLORS.accentLight}
                            fontWeight={600}
                        />
                    </div>

                    {/* EPS card */}
                    <div
                        style={{
                            flex: isPortrait ? undefined : 1,
                            padding: `${24 * scale}px`,
                            borderRadius: 32,
                            background: 'rgba(255,255,255,0.03)',
                            border: '2px solid rgba(255,255,255,0.08)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 16,
                            opacity: fadeIn(frame, 40),
                            transform: `scale(${spring({ frame: frame - 40, fps, config: { damping: 12, stiffness: 150, mass: 0.5 } })})`,
                        }}
                    >
                        <EditableText
                            text={props.epsLabel}
                            fontSize={32 * scale}
                            fontFamily={interFont}
                            color={COLORS.textSecondary}
                            fontWeight={600}
                            textTransform="uppercase"
                            letterSpacing={2}
                        />
                        <EditableText
                            text={props.epsValue}
                            fontSize={96 * scale}
                            fontFamily={interFont}
                            color={COLORS.textSecondary}
                            fontWeight={800}
                        />
                        <EditableText
                            text={props.epsChange}
                            fontSize={36 * scale}
                            fontFamily={interFont}
                            color={COLORS.accentLight}
                            fontWeight={600}
                        />
                    </div>
                </div>

                {/* Guidance bar */}
                <div
                    style={{
                        padding: `${14 * scale}px ${24 * scale}px`,
                        borderRadius: 20,
                        background: `${props.accentColor}10`,
                        border: `2px solid ${props.accentColor}25`,
                        opacity: fadeIn(frame, 60),
                        transform: slideIn(frame, 'up', 60, 15),
                    }}
                >
                    <EditableText
                        text={`📊 ${props.guidanceText}`}
                        fontSize={40 * scale}
                        fontFamily={interFont}
                        color={COLORS.textSecondary}
                        fontWeight={500}
                    />
                </div>

                {/* Source */}
                <div
                    style={{
                        display: 'flex',
                        gap: 24,
                        alignItems: 'center',
                        flexWrap: isPortrait ? 'wrap' : 'nowrap',
                        opacity: fadeIn(frame, 70),
                    }}
                >
                    <EditableText
                        text={props.source}
                        fontSize={32 * scale}
                        fontFamily={interFont}
                        color={COLORS.accent}
                        fontWeight={600}
                    />
                    <div style={{ width: 4, height: 8, borderRadius: '50%', background: '#ffffff33' }} />
                    <EditableText
                        text={props.timestamp}
                        fontSize={32 * scale}
                        fontFamily={interFont}
                        color={COLORS.textSecondary}
                        fontWeight={400}
                    />
                </div>
            </div>

            {/* Bottom accent */}
            <div
                style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    width: `${interpolate(frame, [0, 80], [0, 100], { extrapolateRight: 'clamp' })}%`,
                    height: 6,
                    background: GRADIENTS.bgMain,
                }}
            />
        </AbsoluteFill>
    );
};

// ─── Register ────────────────────────────────────────────────
registerTemplate({
    id: 'biz-news-earnings-01',
    name: 'Earnings Report',
    category: 'business-news',
    description: 'Quarterly earnings report with revenue/EPS cards, guidance bar, and editorial layout',
    tags: ['earnings', 'quarterly', 'revenue', 'business-news', 'finance'],
    component: BizNewsEarnings01,
    schema: bizNewsEarningsSchema,
    defaultProps: bizNewsEarningsSchema.parse({}),
    durationInFrames: DEFAULT_DURATION_FRAMES,
    fps: DEFAULT_FPS,
});
