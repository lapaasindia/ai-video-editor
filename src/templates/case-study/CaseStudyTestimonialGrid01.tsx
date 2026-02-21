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
import { COLORS, GRADIENTS } from '../../lib/theme';

// ─── Schema ──────────────────────────────────────────────────
export const caseStudyTestimonialGridSchema = z.object({
    headline: z.string().default('What Our Clients Say'),
    quote1: z.string().default('"Reduced our deployment time by 80%. Absolutely game-changing."'),
    quote1Author: z.string().default('Sarah Chen, VP Engineering'),
    quote2: z.string().default('"The ROI was visible within the first month. Incredible product."'),
    quote2Author: z.string().default('James Wright, COO'),
    quote3: z.string().default('"Best decision our team made all year. Support is outstanding."'),
    quote3Author: z.string().default('Maria Lopez, CTO'),
    rating: z.string().default('4.9 / 5.0'),
    reviewCount: z.string().default('2,400+ reviews'),
    primaryColor: z.string().default(COLORS.accent),
    accentColor: z.string().default(COLORS.accentLight),
    backgroundColor: z.string().default(COLORS.bg),
});

type Props = z.infer<typeof caseStudyTestimonialGridSchema>;

// ─── Component ───────────────────────────────────────────────
export const CaseStudyTestimonialGrid01: React.FC<Props> = (props) => {
    const scale = useScaleFactor();
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    
    const isPortrait = useIsPortrait();
    const backgroundControls = useResolvedBackgroundControls();
    void shouldRenderBackgroundLayer; // Available for conditional rendering

    const quotes = [
        { text: props.quote1, author: props.quote1Author },
        { text: props.quote2, author: props.quote2Author },
        { text: props.quote3, author: props.quote3Author },
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
                    padding: isPortrait ? '120px 60px' : '60px 100px',
                    gap: isPortrait ? 32 : 48,
                }}
            >
                {/* Header */}
                <div style={{ opacity: fadeIn(frame, 0), transform: slideIn(frame, 'down', 0, 20) }}>
                    <EditableText
                        text={props.headline}
                        fontSize={isPortrait ? 84 : 112}
                        fontFamily={interFont}
                        color={COLORS.textPrimary}
                        fontWeight={800}
                        lineHeight={1.1}
                        letterSpacing={-1}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 24 * scale, marginTop: 20 * scale }}>
                        <EditableText
                            text={`⭐ ${props.rating}`}
                            fontSize={48 * scale}
                            fontFamily={interFont}
                            color={COLORS.accent}
                            fontWeight={700}
                        />
                        <EditableText
                            text={props.reviewCount}
                            fontSize={36 * scale}
                            fontFamily={interFont}
                            color={COLORS.textSecondary}
                            fontWeight={400}
                        />
                    </div>
                </div>

                {/* Quote cards */}
                <div
                    style={{
                        flex: isPortrait ? undefined : 1,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        gap: isPortrait ? 32 : 36,
                    }}
                >
                    {quotes.map((q, i) => {
                        const delay = 15 + staggerDelay(i, 12);
                        const cardSpring = spring({
                            frame: frame - delay,
                            fps,
                            config: { damping: 14, stiffness: 100, mass: 0.6 },
                        });

                        return (
                            <div
                                key={i}
                                style={{
                                    padding: `${20 * scale}px ${24 * scale}px`,
                                    borderRadius: 32 * scale,
                                    background: 'rgba(255,255,255,0.03)',
                                    borderLeft: `3px solid ${props.primaryColor}`,
                                    opacity: fadeIn(frame, delay),
                                    transform: `translateX(${interpolate(cardSpring, [0, 1], [40, 0])}px)`,
                                }}
                            >
                                <EditableText
                                    text={q.text}
                                    fontSize={isPortrait ? 44 : 48}
                                    fontFamily={interFont}
                                    color={COLORS.textSecondary}
                                    fontWeight={400}
                                    lineHeight={1.5}
                                    maxLines={2}
                                />
                                <EditableText
                                    text={`— ${q.author}`}
                                    fontSize={isPortrait ? 36 : 32 * scale}
                                    fontFamily={interFont}
                                    color={COLORS.accent}
                                    fontWeight={600}
                                    style={{ marginTop: 20 * scale }}
                                />
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
    id: 'case-study-testimonial-grid-01',
    name: 'Testimonial Grid',
    category: 'case-study',
    description: '3-quote testimonial grid with star rating, left accent border, and staggered slide-in',
    tags: ['testimonial', 'quote', 'client', 'review', 'social-proof'],
    component: CaseStudyTestimonialGrid01,
    schema: caseStudyTestimonialGridSchema,
    defaultProps: caseStudyTestimonialGridSchema.parse({}),
    durationInFrames: DEFAULT_DURATION_FRAMES,
    fps: DEFAULT_FPS,
});
