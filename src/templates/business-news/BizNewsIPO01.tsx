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
export const bizNewsIPOSchema = z.object({
    badge: z.string().default('IPO WATCH'),
    headline: z.string().default('Stripe Files for Long-Awaited IPO'),
    subheadline: z.string().default('Payments giant targets $70B+ valuation in Q2 2026 listing'),
    expectedValuation: z.string().default('$70B+'),
    lastPrivateVal: z.string().default('$50B'),
    exchange: z.string().default('NYSE'),
    expectedDate: z.string().default('Q2 2026'),
    revenue: z.string().default('$18.6B'),
    employees: z.string().default('10,000+'),
    source: z.string().default('Wall Street Journal'),
    timestamp: z.string().default('Exclusive • Feb 12, 2026'),
    primaryColor: z.string().default(COLORS.accent),
    accentColor: z.string().default(COLORS.accentLight),
    backgroundColor: z.string().default(COLORS.bg),
});

type Props = z.infer<typeof bizNewsIPOSchema>;

// ─── Component ───────────────────────────────────────────────
export const BizNewsIPO01: React.FC<Props> = (props) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const isPortrait = useIsPortrait();
    const scale = useResponsive(1, 1);
    const backgroundControls = useResolvedBackgroundControls();
    const renderBackgroundLayers = shouldRenderBackgroundLayer(backgroundControls);

    const stats = [
        { label: 'Target', value: props.expectedValuation },
        { label: 'Last Round', value: props.lastPrivateVal },
        { label: 'Exchange', value: props.exchange },
        { label: 'Timeline', value: props.expectedDate },
        { label: 'Revenue', value: props.revenue },
        { label: 'Team', value: props.employees },
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
            {/* Upward arrow pattern */}
            {renderBackgroundLayers && (
                <svg
                    viewBox="0 0 1920 1080"
                    style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.03 }}
                >
                    {Array.from({ length: 8 }).map((_, i) => (
                        <path
                            key={i}
                            d={`M${240 * i},1080 L${240 * i + 120},${600 - i * 50} L${240 * (i + 1)},1080`}
                            fill={props.primaryColor}
                            opacity={interpolate(frame, [i * 8, i * 8 + 40], [0, 0.5], {
                                extrapolateLeft: 'clamp',
                                extrapolateRight: 'clamp',
                            })}
                        />
                    ))}
                </svg>
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
                    gap: isPortrait ? 32 : 48,
                }}
            >
                {/* Badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 24, opacity: fadeIn(frame, 0) }}>
                    <div
                        style={{
                            padding: `${5 * scale}px ${14 * scale}px`,
                            borderRadius: 12,
                            background: COLORS.accent,
                        }}
                    >
                        <EditableText
                            text={props.badge}
                            fontSize={32 * scale}
                            fontFamily={interFont}
                            color={COLORS.textPrimary}
                            fontWeight={800}
                            letterSpacing={2}
                        />
                    </div>
                </div>

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
                    style={{ opacity: fadeIn(frame, 8), transform: slideIn(frame, 'up', 8, 25) }}
                />

                <EditableText
                    text={props.subheadline}
                    fontSize={isPortrait ? 44 : 56}
                    fontFamily={interFont}
                    color={COLORS.textSecondary}
                    fontWeight={400}
                    lineHeight={1.5}
                    maxLines={2}
                    style={{ opacity: fadeIn(frame, 18) }}
                />

                {/* Stats grid */}
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: isPortrait ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
                        gap: isPortrait ? 20 : 32,
                        marginTop: isPortrait ? 0 : 'auto',
                        marginBottom: isPortrait ? 0 : 16,
                    }}
                >
                    {stats.map((stat, i) => {
                        const delay = 30 + staggerDelay(i, 8);
                        const cardScale = spring({
                            frame: frame - delay,
                            fps,
                            config: { damping: 12, stiffness: 130, mass: 0.5 },
                        });

                        return (
                            <div
                                key={i}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    padding: `${14 * scale}px`,
                                    borderRadius: 24,
                                    background: 'rgba(255,255,255,0.03)',
                                    border: '2px solid rgba(255,255,255,0.06)',
                                    transform: `scale(${cardScale})`,
                                    opacity: fadeIn(frame, delay),
                                    gap: 8,
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
                                    fontSize={52 * scale}
                                    fontFamily={interFont}
                                    color={COLORS.accentLight}
                                    fontWeight={700}
                                />
                            </div>
                        );
                    })}
                </div>

                {/* Source */}
                <div
                    style={{
                        display: 'flex',
                        gap: 24,
                        alignItems: 'center',
                        flexWrap: isPortrait ? 'wrap' : 'nowrap',
                        opacity: fadeIn(frame, 75),
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
    id: 'biz-news-ipo-01',
    name: 'IPO Watch',
    category: 'business-news',
    description: 'IPO filing announcement with 6-stat grid, upward arrow SVG pattern, and editorial layout',
    tags: ['IPO', 'listing', 'stock', 'business-news', 'public'],
    component: BizNewsIPO01,
    schema: bizNewsIPOSchema,
    defaultProps: bizNewsIPOSchema.parse({}),
    durationInFrames: DEFAULT_DURATION_FRAMES,
    fps: DEFAULT_FPS,
});
