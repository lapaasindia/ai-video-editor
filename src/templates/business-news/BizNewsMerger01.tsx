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
export const bizNewsMergerSchema = z.object({
    badge: z.string().default('M&A ALERT'),
    headline: z.string().default('Adobe to Acquire Figma in Landmark $20B Deal'),
    subheadline: z.string().default('Largest design-tool acquisition creates end-to-end creative platform'),
    acquirerName: z.string().default('Adobe'),
    acquirerTicker: z.string().default('ADBE'),
    targetName: z.string().default('Figma'),
    dealValue: z.string().default('$20B'),
    dealType: z.string().default('Cash & Stock'),
    expectedClose: z.string().default('Q2 2026'),
    premium: z.string().default('+42% premium'),
    source: z.string().default('Reuters'),
    timestamp: z.string().default('Breaking • Feb 12, 2026'),
    primaryColor: z.string().default(COLORS.accent),
    accentColor: z.string().default(COLORS.accentLight),
    backgroundColor: z.string().default(COLORS.bg),
});

type Props = z.infer<typeof bizNewsMergerSchema>;

// ─── Component ───────────────────────────────────────────────
export const BizNewsMerger01: React.FC<Props> = (props) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const isPortrait = useIsPortrait();
    const scale = useResponsive(1, 1);
    const backgroundControls = useResolvedBackgroundControls();
    const renderBackgroundLayers = shouldRenderBackgroundLayer(backgroundControls);

    const mergeAnimation = spring({
        frame: frame - 40,
        fps,
        config: { damping: 10, stiffness: 80, mass: 0.8 },
    });

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
                        top: '20%',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: 500 * scale,
                        height: 500 * scale,
                        borderRadius: '50%',
                        background: `${props.primaryColor}0a`,
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
                    gap: isPortrait ? 40 : 56,
                }}
            >
                {/* Alert badge */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 24 * scale,
                        opacity: fadeIn(frame, 0),
                    }}
                >
                    <div
                        style={{
                            padding: `${6 * scale}px ${16 * scale}px`,
                            borderRadius: 12 * scale,
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
                    style={{ opacity: fadeIn(frame, 18) }}
                />

                {/* Merger visual */}
                <div
                    style={{
                        display: 'flex',
                        flexDirection: isPortrait ? 'column' : 'row',
                        alignItems: isPortrait ? 'stretch' : 'center',
                        justifyContent: 'center',
                        gap: isPortrait ? 32 : 80,
                        marginTop: isPortrait ? 0 : 'auto',
                        marginBottom: isPortrait ? 0 : 16,
                    }}
                >
                    {/* Acquirer */}
                    <div
                        style={{
                            flex: isPortrait ? undefined : 1,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            padding: `${24 * scale}px`,
                            borderRadius: 32 * scale,
                            background: 'rgba(255,255,255,0.04)',
                            border: '2px solid rgba(255,255,255,0.08)',
                            opacity: fadeIn(frame, 25),
                            transform: `translateX(${interpolate(mergeAnimation, [0, 1], [isPortrait ? 0 : -30, 0])}px)`,
                            gap: 16 * scale,
                        }}
                    >
                        <EditableText
                            text={props.acquirerTicker}
                            fontSize={32 * scale}
                            fontFamily={interFont}
                            color={COLORS.textSecondary}
                            fontWeight={700}
                            letterSpacing={2}
                        />
                        <EditableText
                            text={props.acquirerName}
                            fontSize={64 * scale}
                            fontFamily={interFont}
                            color={COLORS.textSecondary}
                            fontWeight={800}
                        />
                    </div>

                    {/* Plus / merge icon */}
                    <div
                        style={{
                            width: 56 * scale,
                            height: 56 * scale,
                            borderRadius: '50%',
                            background: GRADIENTS.bgMain,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 48 * scale,
                            color: '#fff',
                            fontWeight: 800,
                            transform: `scale(${mergeAnimation}) rotate(${mergeAnimation * 180}deg)`,
                            boxShadow: `0 0 40px ${props.primaryColor}44`,
                        }}
                    >
                        +
                    </div>

                    {/* Target */}
                    <div
                        style={{
                            flex: isPortrait ? undefined : 1,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            padding: `${24 * scale}px`,
                            borderRadius: 32 * scale,
                            background: 'rgba(255,255,255,0.04)',
                            border: '2px solid rgba(255,255,255,0.08)',
                            opacity: fadeIn(frame, 30),
                            transform: `translateX(${interpolate(mergeAnimation, [0, 1], [isPortrait ? 0 : 30, 0])}px)`,
                            gap: 16 * scale,
                        }}
                    >
                        <EditableText
                            text="PRIVATE"
                            fontSize={32 * scale}
                            fontFamily={interFont}
                            color={COLORS.textSecondary}
                            fontWeight={700}
                            letterSpacing={2}
                        />
                        <EditableText
                            text={props.targetName}
                            fontSize={64 * scale}
                            fontFamily={interFont}
                            color={COLORS.textSecondary}
                            fontWeight={800}
                        />
                    </div>
                </div>

                {/* Deal details bar */}
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: isPortrait ? '1fr 1fr' : 'repeat(4, 1fr)',
                        gap: isPortrait ? 16 : 32,
                        opacity: fadeIn(frame, 60),
                        transform: slideIn(frame, 'up', 60, 15),
                    }}
                >
                    {[
                        { label: 'Deal Value', value: props.dealValue },
                        { label: 'Structure', value: props.dealType },
                        { label: 'Premium', value: props.premium },
                        { label: 'Close', value: props.expectedClose },
                    ].map((item, i) => (
                        <div
                            key={i}
                            style={{
                                textAlign: 'center',
                                padding: `${12 * scale}px`,
                                borderRadius: 20 * scale,
                                background: 'rgba(255,255,255,0.03)',
                                border: '2px solid rgba(255,255,255,0.06)',
                            }}
                        >
                            <EditableText
                                text={item.label}
                                fontSize={28 * scale}
                                fontFamily={interFont}
                                color={COLORS.textSecondary}
                                fontWeight={500}
                                textTransform="uppercase"
                                letterSpacing={2}
                            />
                            <EditableText
                                text={item.value}
                                fontSize={40 * scale}
                                fontFamily={interFont}
                                color={COLORS.accentLight}
                                fontWeight={700}
                            />
                        </div>
                    ))}
                </div>

                {/* Source */}
                <div
                    style={{
                        display: 'flex',
                        gap: 24 * scale,
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
                    <div style={{ width: 4 * scale, height: 8 * scale, borderRadius: '50%', background: '#ffffff33' }} />
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
                    height: 6 * scale,
                    background: GRADIENTS.bgMain,
                }}
            />
        </AbsoluteFill>
    );
};

// ─── Register ────────────────────────────────────────────────
registerTemplate({
    id: 'biz-news-merger-01',
    name: 'M&A / Merger Alert',
    category: 'business-news',
    description: 'Merger & acquisition alert with animated company merge visual and deal details grid',
    tags: ['merger', 'acquisition', 'deal', 'business-news', 'M&A'],
    component: BizNewsMerger01,
    schema: bizNewsMergerSchema,
    defaultProps: bizNewsMergerSchema.parse({}),
    durationInFrames: DEFAULT_DURATION_FRAMES,
    fps: DEFAULT_FPS,
});
