import React from 'react';
import {
    AbsoluteFill,
    useCurrentFrame,
    useVideoConfig,
    interpolate } from 'remotion';
import { z } from 'zod';
import { useIsPortrait } from '../../lib/responsive';
import { fadeIn, slideIn, scaleIn } from '../../lib/animations';
import { EditableText } from '../../components/EditableText';
import { AnimatedImage } from '../../components/AnimatedImage';
import {
    resolveCanvasBackground,
    shouldRenderBackgroundLayer,
    useResolvedBackgroundControls,
} from '../../lib/background';
import { registerTemplate } from '../registry';
import { DEFAULT_DURATION_FRAMES, DEFAULT_FPS } from '../../lib/constants';
import { interFont } from '../../lib/fonts';
import { COLORS, FONT, SPACING, RADIUS, GRADIENTS, pSize, pPad } from '../../lib/theme';

// ─── Schema ──────────────────────────────────────────────────
export const caseStudyHeroSchema = z.object({
    companyName: z.string().default('Acme Corp'),
    headline: z.string().default('How Acme Corp Increased Revenue by 340%'),
    subheadline: z.string().default('A deep dive into their digital transformation strategy'),
    industry: z.string().default('Technology'),
    metric: z.string().default('340%'),
    metricLabel: z.string().default('Revenue Growth'),
    imageUrl: z.string().default('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800'),
    logoUrl: z.string().default(''),
    primaryColor: z.string().default(COLORS.accent),
    accentColor: z.string().default(COLORS.accentLight) });

type Props = z.infer<typeof caseStudyHeroSchema>;

// ─── Component ───────────────────────────────────────────────
export const CaseStudyHero01: React.FC<Props> = (props) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const isPortrait = useIsPortrait();
    const backgroundControls = useResolvedBackgroundControls();
    const renderBackgroundLayers = shouldRenderBackgroundLayer(backgroundControls);
    const metricValueSize = pSize(isPortrait ? 168 : 176, isPortrait);
    const metricLabelSize = pSize(FONT.bodySmall, isPortrait);

    return (
        <AbsoluteFill
            style={{
                background: resolveCanvasBackground(GRADIENTS.bgMain, backgroundControls),
                overflow: 'hidden' }}
        >
            {/* Background image with overlay */}
            {renderBackgroundLayers && (
                <div
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        opacity: fadeIn(frame, 0, 30) * 0.3 }}
                >
                    <AnimatedImage src={props.imageUrl} />
                </div>
            )}

            {/* Gradient overlay */}
            {renderBackgroundLayers && (
                <div
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'linear-gradient(180deg, rgba(0,0,0,0.78), rgba(0,0,0,0.9), var(--template-bg, #0F0F0F))' }}
                />
            )}

            {/* Content container */}
            <div
                style={{
                    position: 'relative',
                    zIndex: 1,
                    display: 'flex',
                    flexDirection: isPortrait ? 'column' : 'row',
                    alignItems: isPortrait ? 'stretch' : 'center',
                    justifyContent: isPortrait ? 'flex-end' : 'center',
                    width: '100%',
                    height: '100%',
                    padding: pPad(isPortrait),
                    gap: isPortrait ? SPACING.xl : SPACING.xxl }}
            >
                {/* Left: Text content */}
                <div
                    style={{
                        flex: isPortrait ? undefined : 1,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: isPortrait ? SPACING.lg : SPACING.md,
                        opacity: fadeIn(frame, 5),
                        transform: slideIn(frame, 'left', 5, 60) }}
                >
                    {/* Industry badge */}
                    <div
                        style={{
                            display: 'inline-flex',
                            alignSelf: 'flex-start',
                            padding: `${SPACING.xs}px ${SPACING.md}px`,
                            borderRadius: RADIUS.pill,
                            background: COLORS.accentMuted,
                            border: `2px solid ${COLORS.accentBorder}`,
                            opacity: fadeIn(frame, 15) }}
                    >
                        <EditableText
                            text={`CASE STUDY • ${props.industry.toUpperCase()} `}
                            fontSize={FONT.label}
                            fontFamily={interFont}
                            color={COLORS.accent}
                            fontWeight={FONT.semibold}
                            letterSpacing={FONT.wide}
                        />
                    </div>

                    {/* Company name */}
                    <EditableText
                        text={props.companyName}
                        fontSize={FONT.h4}
                        fontFamily={interFont}
                        color={COLORS.textMuted}
                        fontWeight={FONT.medium}
                        textTransform="uppercase"
                        letterSpacing={FONT.wide}
                        style={{ opacity: fadeIn(frame, 20) }}
                    />

                    {/* Headline */}
                    <EditableText
                        text={props.headline}
                        fontSize={pSize(FONT.hero, isPortrait)}
                        fontFamily={interFont}
                        color={COLORS.textPrimary}
                        fontWeight={FONT.black}
                        lineHeight={FONT.tight}
                        letterSpacing={FONT.tighter}
                        maxLines={3}
                        style={{
                            opacity: fadeIn(frame, 25),
                            transform: slideIn(frame, 'up', 25, 30) }}
                    />

                    {/* Subheadline */}
                    <EditableText
                        text={props.subheadline}
                        fontSize={pSize(FONT.body, isPortrait)}
                        fontFamily={interFont}
                        color={COLORS.textSecondary}
                        fontWeight={FONT.regular}
                        lineHeight={FONT.relaxed}
                        maxLines={2}
                        style={{ opacity: fadeIn(frame, 35) }}
                    />
                </div>

                {/* Right: Metric card */}
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: isPortrait ? '100%' : 650,
                        height: isPortrait ? 'auto' : 650,
                        padding: isPortrait ? SPACING.xxl : 0,
                        borderRadius: RADIUS.xl,
                        background: COLORS.surface,
                        backdropFilter: 'blur(20px)',
                        border: `2px solid ${COLORS.borderLight}`,
                        boxShadow: `0 0 120px ${COLORS.glow}`,
                        transform: `scale(${scaleIn(frame, fps, 40)})`,
                        gap: 24 }}
                >
                    <EditableText
                        text={props.metric}
                        fontSize={metricValueSize}
                        fontFamily={interFont}
                        color={COLORS.accent}
                        fontWeight={FONT.black}
                        letterSpacing={FONT.tighter}
                    />
                    <EditableText
                        text={props.metricLabel}
                        fontSize={metricLabelSize}
                        fontFamily={interFont}
                        color={COLORS.textSecondary}
                        fontWeight={FONT.medium}
                        textTransform="uppercase"
                        letterSpacing={FONT.wide}
                    />
                </div>
            </div>

            {/* Bottom accent line */}
            <div
                style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    width: `${interpolate(frame, [0, 60], [0, 100], {
                        extrapolateRight: 'clamp' })
                        }% `,
                    height: 6,
                    background: GRADIENTS.accentLine }}
            />
        </AbsoluteFill>
    );
};

// ─── Register ────────────────────────────────────────────────
registerTemplate({
    id: 'case-study-hero-01',
    name: 'Case Study Hero',
    category: 'case-study',
    description: 'Bold hero intro with company name, headline, and a prominent metric card',
    tags: ['hero', 'intro', 'metric', 'case-study', 'business'],
    component: CaseStudyHero01,
    schema: caseStudyHeroSchema,
    defaultProps: caseStudyHeroSchema.parse({}),
    durationInFrames: DEFAULT_DURATION_FRAMES,
    fps: DEFAULT_FPS });
