import React from 'react';
import {
    AbsoluteFill,
    useCurrentFrame,
    useVideoConfig,
    Img,
    interpolate,
    spring,
} from 'remotion';
import { z } from 'zod';
import { useIsPortrait, useScaleFactor } from '../../lib/responsive';
import { EditableText } from '../../components/EditableText';
import { AnimatedGradient } from '../../components/AnimatedGradient';
import {
    resolveCanvasBackground,
    shouldRenderBackgroundLayer,
    useResolvedBackgroundControls,
} from '../../lib/background';
import { registerTemplate } from '../registry';
import { interFont } from '../../lib/fonts';
import { COLORS } from '../../lib/theme';

// ─── Schema ──────────────────────────────────────────────────
export const articleHighlightSchema = z.object({
    screenshotUrl: z.string().default('https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=1200'),
    highlightText1: z.string().default('Key finding #1'),
    highlightText2: z.string().default('Important stat here'),
    callout1: z.string().default('This proves the point'),
    callout2: z.string().default('Look at this number'),
    highlightColor: z.string().default('#FFE135'),
    arrowColor: z.string().default('#FF6B35'),
    backgroundColor: z.string().default(COLORS.bg),
});

type Props = z.infer<typeof articleHighlightSchema>;

// ─── Component ───────────────────────────────────────────────
export const ArticleHighlight01: React.FC<Props> = (props) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    
    const isPortrait = useIsPortrait();
    const s = useScaleFactor();
    const backgroundControls = useResolvedBackgroundControls();
    void shouldRenderBackgroundLayer(backgroundControls);

    // ─── Screenshot drop in (f0-f24) ───
    const screenshotSpring = spring({
        frame,
        fps,
        config: { damping: 14, stiffness: 100, mass: 1 },
    });
    const screenshotScale = interpolate(screenshotSpring, [0, 1], [1.1, 1]);

    // ─── Highlight wipe 1 (f24-f72) ───
    const highlight1Width = interpolate(frame, [24, 72], [0, 100], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    // ─── Arrow callout 1 (f72-f120) ───
    const arrow1Spring = spring({
        frame: frame - 72,
        fps,
        config: { damping: 12, stiffness: 140, mass: 0.6 },
    });
    const arrow1StrokeDash = interpolate(frame, [72, 100], [100, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    // ─── Highlight wipe 2 (f120-f180) ───
    const highlight2Width = interpolate(frame, [120, 180], [0, 100], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    // ─── Arrow callout 2 (f180-f240) ───
    const arrow2Spring = spring({
        frame: frame - 180,
        fps,
        config: { damping: 12, stiffness: 140, mass: 0.6 },
    });
    const arrow2StrokeDash = interpolate(frame, [180, 210], [100, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    // ─── Parallax drift (f240-f390) ───
    const driftX = interpolate(frame, [240, 390], [0, 15 * s], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const driftY = interpolate(frame, [240, 390], [0, 8 * s], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const headingSpring = spring({
        frame: frame - 8,
        fps,
        config: { damping: 15, stiffness: 120, mass: 0.9 },
    });
    const headingY = interpolate(headingSpring, [0, 1], [28 * s, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const headingOpacity = interpolate(frame, [8, 32], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    const screenshotSize = isPortrait 
        ? { width: '90%', height: 'auto' }
        : { width: '60%', height: 'auto' };
    const highlightHeadlineSize = (isPortrait ? 56 : 68) * s;
    const highlightSublineSize = (isPortrait ? 34 : 40) * s;
    const calloutTextSize = (isPortrait ? 28 : 34) * s;

    return (
        <AbsoluteFill
            style={{
                background: resolveCanvasBackground(props.backgroundColor, backgroundControls),
                overflow: 'hidden',
            }}
        >
            <AnimatedGradient />

            {/* Screenshot */}
            <AbsoluteFill
                style={{
                    display: 'flex',
                    justifyContent: isPortrait ? 'center' : 'flex-start',
                    alignItems: 'center',
                    padding: isPortrait ? `${112 * s}px ${36 * s}px ${96 * s}px` : `0 ${72 * s}px`,
                    transform: `scale(${screenshotScale}) translate(${driftX}px, ${driftY}px)`,
                }}
            >
                <div style={{ position: 'relative' }}>
                    <Img
                        src={props.screenshotUrl}
                        style={{
                            ...screenshotSize,
                            borderRadius: 16 * s,
                            boxShadow: `0 ${20 * s}px ${60 * s}px rgba(0,0,0,0.5)`,
                        }}
                    />

                    {/* Highlight bar 1 */}
                    {frame >= 24 && (
                        <div
                            style={{
                                position: 'absolute',
                                top: isPortrait ? '25%' : '30%',
                                left: '5%',
                                width: `${highlight1Width * 0.6}%`,
                                height: isPortrait ? 32 : 40,
                                background: `${props.highlightColor}88`,
                                borderRadius: 4,
                            }}
                        />
                    )}

                    {/* Highlight bar 2 */}
                    {frame >= 120 && (
                        <div
                            style={{
                                position: 'absolute',
                                top: isPortrait ? '55%' : '60%',
                                left: '5%',
                                width: `${highlight2Width * 0.5}%`,
                                height: isPortrait ? 32 : 40,
                                background: `${props.highlightColor}88`,
                                borderRadius: 4,
                            }}
                        />
                    )}
                </div>
            </AbsoluteFill>

            <div
                style={{
                    position: 'absolute',
                    top: isPortrait ? `${6 + driftY * 0.02}%` : '8%',
                    right: isPortrait ? '6%' : '7%',
                    maxWidth: isPortrait ? '88%' : '34%',
                    opacity: headingOpacity,
                    transform: `translateY(${headingY}px)`,
                    textAlign: isPortrait ? 'left' : 'right',
                }}
            >
                <EditableText
                    text={props.highlightText1}
                    fontSize={highlightHeadlineSize}
                    fontFamily={interFont}
                    color={COLORS.textPrimary}
                    fontWeight={800}
                    lineHeight={1.14}
                />
                <div style={{ marginTop: 10 * s }}>
                    <EditableText
                        text={props.highlightText2}
                        fontSize={highlightSublineSize}
                        fontFamily={interFont}
                        color={props.highlightColor}
                        fontWeight={700}
                        lineHeight={1.24}
                    />
                </div>
            </div>

            {/* Arrow callout 1 */}
            {frame >= 72 && (
                <div
                    style={{
                        position: 'absolute',
                        top: isPortrait ? '35%' : '25%',
                        right: isPortrait ? '10%' : '25%',
                        opacity: arrow1Spring,
                        transform: `scale(${arrow1Spring})`,
                    }}
                >
                    <svg width="80" height="60" viewBox="0 0 80 60">
                        <path
                            d="M 70 50 Q 40 30 10 10"
                            fill="none"
                            stroke={props.arrowColor}
                            strokeWidth="4"
                            strokeLinecap="round"
                            strokeDasharray="100"
                            strokeDashoffset={arrow1StrokeDash}
                        />
                        <polygon
                            points="0,15 15,10 10,25"
                            fill={props.arrowColor}
                            style={{ opacity: frame >= 100 ? 1 : 0 }}
                        />
                    </svg>
                    <div
                        style={{
                            background: COLORS.surface,
                            border: `2px solid ${props.arrowColor}`,
                            borderRadius: 12 * s,
                            padding: `${12 * s}px ${20 * s}px`,
                            marginTop: -10 * s,
                        }}
                    >
                        <EditableText
                            text={props.callout1}
                            fontSize={calloutTextSize}
                            fontFamily={interFont}
                            color={COLORS.textPrimary}
                            fontWeight={600}
                        />
                    </div>
                </div>
            )}

            {/* Arrow callout 2 */}
            {frame >= 180 && (
                <div
                    style={{
                        position: 'absolute',
                        bottom: isPortrait ? '25%' : '20%',
                        right: isPortrait ? '10%' : '20%',
                        opacity: arrow2Spring,
                        transform: `scale(${arrow2Spring})`,
                    }}
                >
                    <svg width="80" height="60" viewBox="0 0 80 60">
                        <path
                            d="M 70 10 Q 40 30 10 50"
                            fill="none"
                            stroke={props.arrowColor}
                            strokeWidth="4"
                            strokeLinecap="round"
                            strokeDasharray="100"
                            strokeDashoffset={arrow2StrokeDash}
                        />
                        <polygon
                            points="0,45 15,50 10,35"
                            fill={props.arrowColor}
                            style={{ opacity: frame >= 210 ? 1 : 0 }}
                        />
                    </svg>
                    <div
                        style={{
                            background: COLORS.surface,
                            border: `2px solid ${props.arrowColor}`,
                            borderRadius: 12,
                            padding: '12px 20px',
                        }}
                    >
                        <EditableText
                            text={props.callout2}
                            fontSize={calloutTextSize}
                            fontFamily={interFont}
                            color={COLORS.textPrimary}
                            fontWeight={600}
                        />
                    </div>
                </div>
            )}
        </AbsoluteFill>
    );
};

// ─── Register ────────────────────────────────────────────────
registerTemplate({
    id: 'article-highlight-01',
    name: 'Article Screenshot Highlight',
    category: 'social-hooks',
    description: 'Screenshot with animated highlight bars and arrow callouts for proof segments.',
    tags: ['screenshot', 'highlight', 'proof', 'article', 'callout', 'arrow'],
    component: ArticleHighlight01,
    schema: articleHighlightSchema,
    defaultProps: articleHighlightSchema.parse({}),
    durationInFrames: 390, // 13s @ 30fps
    fps: 30,
});
