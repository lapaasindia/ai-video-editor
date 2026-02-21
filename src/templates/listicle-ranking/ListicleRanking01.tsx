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
    useResolvedBackgroundControls,
} from '../../lib/background';
import { registerTemplate } from '../registry';
import { DEFAULT_DURATION_FRAMES, DEFAULT_FPS } from '../../lib/constants';
import { linearGradient } from '../../lib/colors';
import { interFont } from '../../lib/fonts';
import { COLORS, GRADIENTS } from '../../lib/theme';

// ─── Schema ──────────────────────────────────────────────────
export const listicleRankingSchema = z.object({
    title: z.string().default('Top 5 AI Companies to Watch in 2026'),
    item1Rank: z.string().default('01'),
    item1Name: z.string().default('OpenAI'),
    item1Desc: z.string().default('GPT-5 launch, $100B+ valuation'),
    item2Rank: z.string().default('02'),
    item2Name: z.string().default('Anthropic'),
    item2Desc: z.string().default('Claude 4, enterprise safety platform'),
    item3Rank: z.string().default('03'),
    item3Name: z.string().default('Google DeepMind'),
    item3Desc: z.string().default('Gemini Ultra 2.0, AlphaFold 4'),
    item4Rank: z.string().default('04'),
    item4Name: z.string().default('xAI'),
    item4Desc: z.string().default('Grok-3, real-time data integration'),
    item5Rank: z.string().default('05'),
    item5Name: z.string().default('Mistral AI'),
    item5Desc: z.string().default('Open-weight leader, EU champion'),
    primaryColor: z.string().default(COLORS.accent),
    accentColor: z.string().default(COLORS.accentLight),
    backgroundColor: z.string().default(COLORS.bg),
});

type Props = z.infer<typeof listicleRankingSchema>;

// ─── Component ───────────────────────────────────────────────
export const ListicleRanking01: React.FC<Props> = (props) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    
    const isPortrait = useIsPortrait();
    const scale = useResponsive(1, 1);
    const backgroundControls = useResolvedBackgroundControls();

    const items = [
        { rank: props.item1Rank, name: props.item1Name, desc: props.item1Desc },
        { rank: props.item2Rank, name: props.item2Name, desc: props.item2Desc },
        { rank: props.item3Rank, name: props.item3Name, desc: props.item3Desc },
        { rank: props.item4Rank, name: props.item4Name, desc: props.item4Desc },
        { rank: props.item5Rank, name: props.item5Name, desc: props.item5Desc },
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
                {/* Title */}
                <EditableText
                    text={props.title}
                    fontSize={isPortrait ? 92 : 112}
                    fontFamily={interFont}
                    color={COLORS.textPrimary}
                    fontWeight={800}
                    lineHeight={1.1}
                    letterSpacing={-1}
                    maxLines={2}
                    style={{
                        opacity: fadeIn(frame, 0),
                        transform: slideIn(frame, 'down', 0, 25),
                    }}
                />

                {/* List items */}
                <div
                    style={{
                        flex: isPortrait ? undefined : 1,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        gap: isPortrait ? 16 : 28,
                    }}
                >
                    {items.map((item, i) => {
                        const delay = 12 + staggerDelay(i, 10);
                        const itemSpring = spring({
                            frame: frame - delay,
                            fps,
                            config: { damping: 14, stiffness: 120, mass: 0.5 },
                        });
                        const intensity = interpolate(i, [0, items.length - 1], [1, 0.4]);

                        return (
                            <div
                                key={i}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: isPortrait ? 24 : 32,
                                    padding: `${14 * scale}px ${20 * scale}px`,
                                    borderRadius: 28,
                                    background: `rgba(255,255,255,${0.01 + intensity * 0.03})`,
                                    border: `2px solid rgba(255,255,255,${0.04 + intensity * 0.04})`,
                                    opacity: fadeIn(frame, delay),
                                    transform: `translateX(${interpolate(itemSpring, [0, 1], [50, 0])}px)`,
                                }}
                            >
                                {/* Rank number */}
                                <div
                                    style={{
                                        width: 64 * scale,
                                        height: 64 * scale,
                                        borderRadius: 32,
                                        background: i === 0
                                            ? linearGradient(135, props.primaryColor, props.accentColor)
                                            : `${props.primaryColor}${Math.round(intensity * 30).toString(16).padStart(2, '0')}`,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0,
                                        boxShadow: i === 0 ? `0 0 20px ${props.primaryColor}44` : 'none',
                                    }}
                                >
                                    <EditableText
                                        text={item.rank}
                                        fontSize={34 * scale}
                                        fontFamily={interFont}
                                        color={i === 0 ? '#ffffff' : props.primaryColor}
                                        fontWeight={800}
                                    />
                                </div>

                                {/* Name + desc */}
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    <EditableText
                                        text={item.name}
                                        fontSize={44 * scale}
                                        fontFamily={interFont}
                                        color={COLORS.textSecondary}
                                        fontWeight={700}
                                    />
                                    <EditableText
                                        text={item.desc}
                                        fontSize={32 * scale}
                                        fontFamily={interFont}
                                        color={COLORS.textSecondary}
                                        fontWeight={400}
                                    />
                                </div>
                            </div>
                        );
                    })}
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
    id: 'listicle-ranking-01',
    name: 'Top 5 Ranking List',
    category: 'listicle-ranking',
    description: 'Ranked list with 5 items, gradient #1 badge, staggered slide-in entry',
    tags: ['list', 'ranking', 'top5', 'listicle'],
    component: ListicleRanking01,
    schema: listicleRankingSchema,
    defaultProps: listicleRankingSchema.parse({}),
    durationInFrames: DEFAULT_DURATION_FRAMES,
    fps: DEFAULT_FPS,
});
