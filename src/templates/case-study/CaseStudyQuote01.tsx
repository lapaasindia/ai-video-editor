import React from 'react';
import {
    AbsoluteFill,
    useCurrentFrame,
    useVideoConfig,
    Img,
    interpolate,
} from 'remotion';
import { z } from 'zod';
import { useIsPortrait, useResponsive } from '../../lib/responsive';
import { fadeIn, slideIn, scaleIn } from '../../lib/animations';
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
export const caseStudyQuoteSchema = z.object({
    quote: z.string().default(
        '"Working with this team transformed our entire business model. The results exceeded every projection we had."',
    ),
    authorName: z.string().default('Sarah Chen'),
    authorTitle: z.string().default('CEO, NexGen Technologies'),
    authorImageUrl: z.string().default('https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400'),
    companyLogoUrl: z.string().default(''),
    metric: z.string().default('5x ROI'),
    metricLabel: z.string().default('Return on Investment'),
    primaryColor: z.string().default(COLORS.accent),
    backgroundColor: z.string().default(COLORS.bg),
});

type Props = z.infer<typeof caseStudyQuoteSchema>;

// ─── Component ───────────────────────────────────────────────
export const CaseStudyQuote01: React.FC<Props> = (props) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    
    const isPortrait = useIsPortrait();
    const scale = useResponsive(1, 1);
    const backgroundControls = useResolvedBackgroundControls();
    const renderBackgroundLayers = shouldRenderBackgroundLayer(backgroundControls);
    const decorativeQuoteSize = isPortrait ? 156 : 176;
    const metricValueSize = 88 * scale;
    const quoteBodySize = isPortrait ? 64 : 76;
    const authorNameSize = isPortrait ? 52 : 50 * scale;
    const authorTitleSize = isPortrait ? 38 : 36 * scale;

    return (
        <AbsoluteFill
            style={{
                background: resolveCanvasBackground(COLORS.bg, backgroundControls),
                overflow: 'hidden',
            }}
        >
            {/* Animated background */}
            <AnimatedGradient />

            {/* Decorative quote marks */}
            {renderBackgroundLayers && (
            <div
                style={{
                    position: 'absolute',
                    top: isPortrait ? 60 : 40,
                    left: isPortrait ? 30 : 80,
                    fontSize: decorativeQuoteSize,
                    fontFamily: 'Georgia, serif',
                    color: `${props.primaryColor}15`,
                    lineHeight: 1,
                    opacity: fadeIn(frame, 0, 40),
                }}
            >
                "
            </div>
            )}

            {/* Subtle side accent */}
            {renderBackgroundLayers && (
            <div
                style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: 6,
                    background: GRADIENTS.bgMain,
                    opacity: fadeIn(frame, 10),
                }}
            />
            )}

            {/* Main content */}
            <div
                style={{
                    position: 'relative',
                    zIndex: 1,
                    display: 'flex',
                    flexDirection: isPortrait ? 'column' : 'row',
                    alignItems: isPortrait ? 'stretch' : 'center',
                    justifyContent: 'center',
                    width: '100%',
                    height: '100%',
                    padding: isPortrait ? '140px 80px' : '80px 120px',
                    gap: isPortrait ? 72 : 120,
                }}
            >
                {/* Author image + metric */}
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 48,
                        opacity: fadeIn(frame, 10),
                        transform: `scale(${scaleIn(frame, fps, 10)})`,
                    }}
                >
                    {/* Author photo */}
                    <div
                        style={{
                            width: isPortrait ? 140 : 180,
                            height: isPortrait ? 140 : 180,
                            borderRadius: '50%',
                            overflow: 'hidden',
                            border: `3px solid ${props.primaryColor}`,
                            boxShadow: `0 0 40px ${props.primaryColor}33`,
                        }}
                    >
                        <Img
                            src={props.authorImageUrl}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                    </div>

                    {/* Metric badge */}
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            padding: `${16 * scale}px ${28 * scale}px`,
                            borderRadius: 32,
                            background: `${props.primaryColor}15`,
                            border: `2px solid ${props.primaryColor}33`,
                            opacity: fadeIn(frame, 40),
                        }}
                    >
                        <EditableText
                            text={props.metric}
                            fontSize={metricValueSize}
                            fontFamily={interFont}
                            color={COLORS.accent}
                            fontWeight={900}
                        />
                        <EditableText
                            text={props.metricLabel}
                            fontSize={32 * scale}
                            fontFamily={interFont}
                            color={COLORS.textSecondary}
                            fontWeight={500}
                            textTransform="uppercase"
                            letterSpacing={2}
                        />
                    </div>
                </div>

                {/* Quote text + author info */}
                <div
                    style={{
                        flex: isPortrait ? undefined : 1,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 48,
                    }}
                >
                    <EditableText
                        text={props.quote}
                        fontSize={quoteBodySize}
                        fontFamily={interFont}
                        color={COLORS.textSecondary}
                        fontWeight={400}
                        lineHeight={1.5}
                        letterSpacing={0}
                        style={{
                            fontStyle: 'italic',
                            opacity: fadeIn(frame, 20),
                            transform: slideIn(frame, 'right', 20, 40),
                        }}
                    />

                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 8,
                            opacity: fadeIn(frame, 50),
                        }}
                    >
                        <EditableText
                            text={props.authorName}
                            fontSize={authorNameSize}
                            fontFamily={interFont}
                            color={COLORS.accent}
                            fontWeight={700}
                        />
                        <EditableText
                            text={props.authorTitle}
                            fontSize={authorTitleSize}
                            fontFamily={interFont}
                            color={COLORS.textSecondary}
                            fontWeight={400}
                        />
                    </div>
                </div>
            </div>

            {/* Bottom accent line */}
            <div
                style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    width: `${interpolate(frame, [0, 90], [0, 100], {
                        extrapolateRight: 'clamp',
                    })
                        }% `,
                    height: 6,
                    background: COLORS.accent,
                }}
            />
        </AbsoluteFill>
    );
};

// ─── Register ────────────────────────────────────────────────
registerTemplate({
    id: 'case-study-quote-01',
    name: 'Case Study Client Quote',
    category: 'case-study',
    description: 'Elegant testimonial with author photo, italic quote, and ROI metric badge',
    tags: ['quote', 'testimonial', 'client', 'case-study', 'social-proof'],
    component: CaseStudyQuote01,
    schema: caseStudyQuoteSchema,
    defaultProps: caseStudyQuoteSchema.parse({}),
    durationInFrames: DEFAULT_DURATION_FRAMES,
    fps: DEFAULT_FPS,
});
