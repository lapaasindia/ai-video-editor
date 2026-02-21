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
export const techNewsFundingSchema = z.object({
    badge: z.string().default('FUNDING'),
    companyName: z.string().default('Anthropic'),
    headline: z.string().default('Anthropic Raises $2B Series D at $18B Valuation'),
    subheadline: z.string().default('AI safety company accelerates compute scaling and research partnerships'),
    amount: z.string().default('$2B'),
    amountLabel: z.string().default('Series D'),
    valuation: z.string().default('$18B'),
    valuationLabel: z.string().default('Valuation'),
    investors: z.string().default('Led by Google, Spark Capital, with participation from Salesforce Ventures'),
    imageUrl: z.string().default('https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=800'),
    source: z.string().default('TechCrunch'),
    timestamp: z.string().default('3 hours ago'),
    primaryColor: z.string().default(COLORS.accent),
    accentColor: z.string().default(COLORS.accentLight),
    backgroundColor: z.string().default(COLORS.bg),
});

type Props = z.infer<typeof techNewsFundingSchema>;

// ─── Component ───────────────────────────────────────────────
export const TechNewsFunding01: React.FC<Props> = (props) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    
    const isPortrait = useIsPortrait();
    const scale = useResponsive(1, 1);
    const backgroundControls = useResolvedBackgroundControls();
    const renderBackgroundLayers = shouldRenderBackgroundLayer(backgroundControls);

    return (
        <AbsoluteFill
            style={{
                background: resolveCanvasBackground(COLORS.bg, backgroundControls),
                overflow: 'hidden',
            }}
        >
            {/* Animated background */}
            <AnimatedGradient />
            {/* Decorative gradient orbs */}
            {renderBackgroundLayers && (
                <>
                    <div
                        style={{
                            position: 'absolute',
                            top: '-20%',
                            left: '60%',
                            width: 600,
                            height: 600,
                            borderRadius: '50%',
                            background: `${props.primaryColor}0c`,
                            filter: 'blur(120px)',
                        }}
                    />
                    <div
                        style={{
                            position: 'absolute',
                            bottom: '-20%',
                            right: '60%',
                            width: 500,
                            height: 500,
                            borderRadius: '50%',
                            background: `${props.accentColor}08`,
                            filter: 'blur(100px)',
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
                    width: '100%',
                    height: '100%',
                    justifyContent: 'center',
                    padding: isPortrait ? '140px 80px' : '60px 100px',
                    gap: isPortrait ? 40 : 56,
                }}
            >
                {/* Badge + category */}
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
                            padding: `${5 * scale}px ${14 * scale}px`,
                            borderRadius: 12,
                            background: COLORS.accentLight,
                        }}
                    >
                        <EditableText
                            text={props.badge}
                            fontSize={32 * scale}
                            fontFamily={interFont}
                            color="#000000"
                            fontWeight={800}
                            letterSpacing={2}
                        />
                    </div>
                    <EditableText
                        text={props.companyName}
                        fontSize={40 * scale}
                        fontFamily={interFont}
                        color={COLORS.textSecondary}
                        fontWeight={600}
                    />
                </div>

                {/* Headline */}
                <EditableText
                    text={props.headline}
                    fontSize={isPortrait ? 84 : 112}
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

                {/* Subheadline */}
                <EditableText
                    text={props.subheadline}
                    fontSize={isPortrait ? 48 : 60}
                    fontFamily={interFont}
                    color={COLORS.textSecondary}
                    fontWeight={400}
                    lineHeight={1.5}
                    maxLines={2}
                    style={{ opacity: fadeIn(frame, 20) }}
                />

                {/* Big metric cards */}
                <div
                    style={{
                        display: 'flex',
                        flexDirection: isPortrait ? 'column' : 'row',
                        gap: isPortrait ? 24 : 48,
                        marginTop: isPortrait ? 8 : 'auto',
                    }}
                >
                    {/* Amount card */}
                    <div
                        style={{
                            flex: isPortrait ? undefined : 1,
                            padding: `${28 * scale}px`,
                            borderRadius: 40,
                            background: `${props.primaryColor}10`,
                            border: `2px solid ${props.primaryColor}30`,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: isPortrait ? 'flex-end' : 'center',
                            gap: 16,
                            transform: `scale(${spring({ frame: frame - 30, fps, config: { damping: 12, stiffness: 120, mass: 0.6 } })})`,
                            opacity: fadeIn(frame, 30),
                        }}
                    >
                        <EditableText
                            text={props.amount}
                            fontSize={isPortrait ? 128 : 160}
                            fontFamily={interFont}
                            color={COLORS.accent}
                            fontWeight={900}
                            letterSpacing={-2}
                        />
                        <EditableText
                            text={props.amountLabel}
                            fontSize={36 * scale}
                            fontFamily={interFont}
                            color={COLORS.textSecondary}
                            fontWeight={600}
                            textTransform="uppercase"
                            letterSpacing={3}
                        />
                    </div>

                    {/* Valuation card */}
                    <div
                        style={{
                            flex: isPortrait ? undefined : 1,
                            padding: `${28 * scale}px`,
                            borderRadius: 40,
                            background: `${props.accentColor}08`,
                            border: `2px solid ${props.accentColor}25`,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 16,
                            transform: `scale(${spring({ frame: frame - 40, fps, config: { damping: 12, stiffness: 120, mass: 0.6 } })})`,
                            opacity: fadeIn(frame, 40),
                        }}
                    >
                        <EditableText
                            text={props.valuation}
                            fontSize={isPortrait ? 128 : 160}
                            fontFamily={interFont}
                            color={COLORS.accentLight}
                            fontWeight={900}
                            letterSpacing={-2}
                        />
                        <EditableText
                            text={props.valuationLabel}
                            fontSize={36 * scale}
                            fontFamily={interFont}
                            color={COLORS.textSecondary}
                            fontWeight={600}
                            textTransform="uppercase"
                            letterSpacing={3}
                        />
                    </div>
                </div>

                {/* Investors */}
                <div
                    style={{
                        padding: `${14 * scale}px ${20 * scale}px`,
                        borderRadius: 20,
                        background: 'rgba(255,255,255,0.03)',
                        border: '2px solid rgba(255,255,255,0.06)',
                        opacity: fadeIn(frame, 60),
                        transform: slideIn(frame, 'up', 60, 15),
                    }}
                >
                    <EditableText
                        text={props.investors}
                        fontSize={36 * scale}
                        fontFamily={interFont}
                        color={COLORS.textSecondary}
                        fontWeight={400}
                        lineHeight={1.4}
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
    id: 'tech-news-funding-01',
    name: 'Startup Funding Announcement',
    category: 'tech-news',
    description: 'Startup funding round with amount/valuation metric cards, investors, and editorial layout',
    tags: ['funding', 'startup', 'investment', 'tech-news', 'venture-capital'],
    component: TechNewsFunding01,
    schema: techNewsFundingSchema,
    defaultProps: techNewsFundingSchema.parse({}),
    durationInFrames: DEFAULT_DURATION_FRAMES,
    fps: DEFAULT_FPS,
});
