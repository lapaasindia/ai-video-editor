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
export const bizNewsMarketUpdateSchema = z.object({
    headline: z.string().default('Markets Rally on Strong Jobs Data'),
    subheadline: z.string().default('S&P 500 posts best weekly gain since November as employment numbers beat expectations'),
    ticker1Symbol: z.string().default('S&P 500'),
    ticker1Value: z.string().default('5,234.18'),
    ticker1Change: z.string().default('+1.82%'),
    ticker1Up: z.boolean().default(true),
    ticker2Symbol: z.string().default('NASDAQ'),
    ticker2Value: z.string().default('16,742.39'),
    ticker2Change: z.string().default('+2.14%'),
    ticker2Up: z.boolean().default(true),
    ticker3Symbol: z.string().default('DOW'),
    ticker3Value: z.string().default('39,131.53'),
    ticker3Change: z.string().default('+0.97%'),
    ticker3Up: z.boolean().default(true),
    source: z.string().default('MarketWatch'),
    timestamp: z.string().default('Market Close • Feb 12, 2026'),
    primaryColor: z.string().default(COLORS.accent),
    upColor: z.string().default('#4CAF50'),
    downColor: z.string().default('#F44336'),
    backgroundColor: z.string().default(COLORS.bg),
});

type Props = z.infer<typeof bizNewsMarketUpdateSchema>;

// ─── Component ───────────────────────────────────────────────
export const BizNewsMarketUpdate01: React.FC<Props> = (props) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const isPortrait = useIsPortrait();
    const scale = useResponsive(1, 1);
    const backgroundControls = useResolvedBackgroundControls();
    const renderBackgroundLayers = shouldRenderBackgroundLayer(backgroundControls);

    const tickers = [
        { symbol: props.ticker1Symbol, value: props.ticker1Value, change: props.ticker1Change, up: props.ticker1Up },
        { symbol: props.ticker2Symbol, value: props.ticker2Value, change: props.ticker2Change, up: props.ticker2Up },
        { symbol: props.ticker3Symbol, value: props.ticker3Value, change: props.ticker3Change, up: props.ticker3Up },
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
            {/* Grid background */}
            {renderBackgroundLayers && (
                <div
                    style={{
                        position: 'absolute',
                        top: 0, left: 0, right: 0, bottom: 0,
                        backgroundImage: `
            linear-gradient(${props.primaryColor}06 1px, transparent 1px),
            linear-gradient(90deg, ${props.primaryColor}06 1px, transparent 1px)
          `,
                        backgroundSize: '40px 40px',
                        opacity: fadeIn(frame, 0, 20),
                    }}
                />
            )}

            {/* Animated chart line decoration */}
            {renderBackgroundLayers && (
                <svg
                    viewBox="0 0 1920 200"
                    style={{
                        position: 'absolute',
                        bottom: isPortrait ? '30%' : '25%',
                        left: 0,
                        right: 0,
                        opacity: 0.08,
                    }}
                >
                    <path
                        d={`M0,150 Q200,${100 + Math.sin(frame * 0.03) * 40} 400,120 T800,${80 + Math.sin(frame * 0.05) * 30} T1200,${60 + Math.cos(frame * 0.04) * 20} T1600,40 T1920,${30 + Math.sin(frame * 0.06) * 15}`}
                        fill="none"
                        stroke={props.upColor}
                        strokeWidth="3"
                        strokeDasharray={`${interpolate(frame, [0, 120], [0, 2000], { extrapolateRight: 'clamp' })}`}
                    />
                </svg>
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
                    padding: isPortrait ? '140px 80px' : '60px 80px',
                    gap: isPortrait ? 48 : 72,
                }}
            >
                {/* Market label */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 24,
                        opacity: fadeIn(frame, 0),
                    }}
                >
                    <div
                        style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: props.upColor,
                            boxShadow: `0 0 8px ${props.upColor}`,
                        }}
                    />
                    <EditableText
                        text="MARKET UPDATE"
                        fontSize={32 * scale}
                        fontFamily={interFont}
                        color={COLORS.accent}
                        fontWeight={700}
                        letterSpacing={3}
                    />
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
                    maxLines={2}
                    style={{
                        opacity: fadeIn(frame, 8),
                        transform: slideIn(frame, 'up', 8, 25),
                    }}
                />

                <EditableText
                    text={props.subheadline}
                    fontSize={isPortrait ? 44 : 56}
                    fontFamily={interFont}
                    color={COLORS.textSecondary}
                    fontWeight={400}
                    lineHeight={1.5}
                    maxLines={2}
                    style={{ opacity: fadeIn(frame, 20) }}
                />

                {/* Ticker cards */}
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: isPortrait ? '1fr' : 'repeat(3, 1fr)',
                        gap: isPortrait ? 24 : 48,
                        flex: isPortrait ? undefined : 0,
                        marginTop: isPortrait ? 0 : 'auto',
                        marginBottom: isPortrait ? 0 : 20,
                    }}
                >
                    {tickers.map((ticker, i) => {
                        const delay = 30 + staggerDelay(i, 10);
                        const cardScale = spring({
                            frame: frame - delay,
                            fps,
                            config: { damping: 12, stiffness: 150, mass: 0.5 },
                        });
                        const changeColor = ticker.up ? props.upColor : props.downColor;

                        return (
                            <div
                                key={i}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    padding: `${20 * scale}px ${24 * scale}px`,
                                    borderRadius: 32,
                                    background: 'rgba(255,255,255,0.03)',
                                    border: `2px solid rgba(255,255,255,0.06)`,
                                    transform: `scale(${cardScale})`,
                                    opacity: fadeIn(frame, delay),
                                    gap: 16,
                                }}
                            >
                                <EditableText
                                    text={ticker.symbol}
                                    fontSize={32 * scale}
                                    fontFamily={interFont}
                                    color={COLORS.textSecondary}
                                    fontWeight={600}
                                    letterSpacing={1}
                                />
                                <EditableText
                                    text={ticker.value}
                                    fontSize={72 * scale}
                                    fontFamily={interFont}
                                    color={COLORS.textSecondary}
                                    fontWeight={700}
                                />
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <span style={{ fontSize: 36 * scale, color: changeColor }}>
                                        {ticker.up ? '▲' : '▼'}
                                    </span>
                                    <EditableText
                                        text={ticker.change}
                                        fontSize={40 * scale}
                                        fontFamily={interFont}
                                        color={changeColor}
                                        fontWeight={600}
                                    />
                                </div>
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
                        opacity: fadeIn(frame, 60),
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
    id: 'biz-news-market-update-01',
    name: 'Market Update',
    category: 'business-news',
    description: 'Stock market update with 3 ticker cards, animated chart line, and headline',
    tags: ['market', 'stocks', 'ticker', 'business-news', 'finance'],
    component: BizNewsMarketUpdate01,
    schema: bizNewsMarketUpdateSchema,
    defaultProps: bizNewsMarketUpdateSchema.parse({}),
    durationInFrames: DEFAULT_DURATION_FRAMES,
    fps: DEFAULT_FPS,
});
