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
export const bizNewsPolicySchema = z.object({
    badge: z.string().default('POLICY UPDATE'),
    headline: z.string().default('EU Approves Comprehensive AI Regulation Framework'),
    subheadline: z.string().default('New rules set global precedent for artificial intelligence governance'),
    detail1Icon: z.string().default('📋'),
    detail1Label: z.string().default('Scope'),
    detail1Value: z.string().default('All AI systems in EU market'),
    detail2Icon: z.string().default('📅'),
    detail2Label: z.string().default('Effective'),
    detail2Value: z.string().default('January 2027'),
    detail3Icon: z.string().default('💰'),
    detail3Label: z.string().default('Max Fine'),
    detail3Value: z.string().default('€35M or 7% revenue'),
    detail4Icon: z.string().default('🌍'),
    detail4Label: z.string().default('Impact'),
    detail4Value: z.string().default('Global tech companies'),
    source: z.string().default('European Commission'),
    timestamp: z.string().default('Feb 12, 2026 • Official'),
    primaryColor: z.string().default(COLORS.accent),
    accentColor: z.string().default(COLORS.accentLight),
    backgroundColor: z.string().default(COLORS.bg),
});

type Props = z.infer<typeof bizNewsPolicySchema>;

// ─── Component ───────────────────────────────────────────────
export const BizNewsPolicy01: React.FC<Props> = (props) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    
    const isPortrait = useIsPortrait();
    const scale = useResponsive(1, 1);
    const backgroundControls = useResolvedBackgroundControls();
    const renderBackgroundLayers = shouldRenderBackgroundLayer(backgroundControls);

    const details = [
        { icon: props.detail1Icon, label: props.detail1Label, value: props.detail1Value },
        { icon: props.detail2Icon, label: props.detail2Label, value: props.detail2Value },
        { icon: props.detail3Icon, label: props.detail3Label, value: props.detail3Value },
        { icon: props.detail4Icon, label: props.detail4Label, value: props.detail4Value },
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
            {/* Grid background */}
            {renderBackgroundLayers && (
                <div
                    style={{
                        position: 'absolute',
                        top: 0, left: 0, right: 0, bottom: 0,
                        backgroundImage: `
            linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)
          `,
                        backgroundSize: '60px 60px',
                        opacity: fadeIn(frame, 0, 20),
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
                    gap: isPortrait ? 28 : 40,
                }}
            >
                {/* Badge */}
                <div style={{ opacity: fadeIn(frame, 0) }}>
                    <div
                        style={{
                            display: 'inline-flex',
                            padding: `${5 * scale}px ${14 * scale}px`,
                            borderRadius: 12,
                            background: `${props.primaryColor}20`,
                            border: `2px solid ${props.primaryColor}40`,
                        }}
                    >
                        <EditableText
                            text={props.badge}
                            fontSize={32 * scale}
                            fontFamily={interFont}
                            color={COLORS.accent}
                            fontWeight={800}
                            letterSpacing={2}
                        />
                    </div>
                </div>

                {/* Headline */}
                <EditableText
                    text={props.headline}
                    fontSize={isPortrait ? 88 : 112}
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
                    style={{ opacity: fadeIn(frame, 20) }}
                />

                {/* Detail cards */}
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: isPortrait ? '1fr' : '1fr 1fr',
                        gap: isPortrait ? 20 : 32,
                        marginTop: isPortrait ? 0 : 'auto',
                        marginBottom: isPortrait ? 0 : 16,
                    }}
                >
                    {details.map((detail, i) => {
                        const delay = 30 + staggerDelay(i, 10);
                        const cardSpring = spring({
                            frame: frame - delay,
                            fps,
                            config: { damping: 14, stiffness: 120, mass: 0.5 },
                        });

                        return (
                            <div
                                key={i}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 28,
                                    padding: `${14 * scale}px ${18 * scale}px`,
                                    borderRadius: 24,
                                    background: 'rgba(255,255,255,0.03)',
                                    border: '2px solid rgba(255,255,255,0.06)',
                                    transform: `translateX(${interpolate(cardSpring, [0, 1], [30, 0])}px)`,
                                    opacity: fadeIn(frame, delay),
                                }}
                            >
                                <span style={{ fontSize: 64 * scale }}>{detail.icon}</span>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    <EditableText
                                        text={detail.label}
                                        fontSize={28 * scale}
                                        fontFamily={interFont}
                                        color={COLORS.textSecondary}
                                        fontWeight={500}
                                        textTransform="uppercase"
                                        letterSpacing={2}
                                    />
                                    <EditableText
                                        text={detail.value}
                                        fontSize={40 * scale}
                                        fontFamily={interFont}
                                        color={COLORS.textSecondary}
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
    id: 'biz-news-policy-01',
    name: 'Policy & Regulation Update',
    category: 'business-news',
    description: 'Policy update with 4 detail cards with emoji icons, grid background, and editorial layout',
    tags: ['policy', 'regulation', 'government', 'compliance', 'law'],
    component: BizNewsPolicy01,
    schema: bizNewsPolicySchema,
    defaultProps: bizNewsPolicySchema.parse({}),
    durationInFrames: DEFAULT_DURATION_FRAMES,
    fps: DEFAULT_FPS,
});
