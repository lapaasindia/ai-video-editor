import React from 'react';
import {
    AbsoluteFill,
    useCurrentFrame,
    useVideoConfig,
    Img,
    interpolate,
} from 'remotion';
import { z } from 'zod';
import { useIsPortrait, useResponsive, useScaleFactor } from "../../lib/responsive";
import { fadeIn, slideIn, scaleIn } from '../../lib/animations';
import { EditableText } from '../../components/EditableText';
import {
    resolveCanvasBackground,
    shouldRenderBackgroundLayer,
    useResolvedBackgroundControls,
} from '../../lib/background';

import { registerTemplate } from '../registry';
import { DEFAULT_DURATION_FRAMES, DEFAULT_FPS } from '../../lib/constants';
import { linearGradient } from '../../lib/colors';
import { interFont } from '../../lib/fonts';
import { COLORS, GRADIENTS } from '../../lib/theme';

// ─── Schema ──────────────────────────────────────────────────
export const techNewsLaunchSchema = z.object({
    badge: z.string().default('NEW LAUNCH'),
    headline: z.string().default('Apple Vision Pro 2 Unveiled with Revolutionary Spatial Computing'),
    subheadline: z.string().default('Next-gen mixed reality headset features 8K micro-OLED displays and M4 Ultra chip'),
    imageUrl: z.string().default('https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=800'),
    source: z.string().default('TechCrunch'),
    author: z.string().default('By Alex Rivera'),
    timestamp: z.string().default('2 hours ago'),
    category: z.string().default('HARDWARE'),
    primaryColor: z.string().default(COLORS.accent),
    accentColor: z.string().default(COLORS.accentLight),
    backgroundColor: z.string().default(COLORS.bg),
});

type Props = z.infer<typeof techNewsLaunchSchema>;

// ─── Component ───────────────────────────────────────────────
export const TechNewsLaunch01: React.FC<Props> = (props) => {
    const scale = useScaleFactor();
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
            {/* Tech grid background */}
            {renderBackgroundLayers && (
                <div
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundImage: `
linear-gradient(${props.primaryColor}08 1px, transparent 1px),
    linear-gradient(90deg, ${props.primaryColor}08 1px, transparent 1px)
        `,
                        backgroundSize: '60px 60px',
                        opacity: fadeIn(frame, 0, 30),
                    }}
                />
            )}

            {/* Content layout */}
            <div
                style={{
                    position: 'relative',
                    zIndex: 1,
                    display: 'flex',
                    flexDirection: isPortrait ? 'column' : 'row',
                    width: '100%',
                    height: '100%',
                }}
            >
                {/* Image section */}
                {renderBackgroundLayers && (
                    <div
                        style={{
                            flex: isPortrait ? undefined : 1,
                            height: isPortrait ? '42%' : '100%',
                            position: 'relative',
                            overflow: 'hidden',
                            opacity: fadeIn(frame, 5),
                        }}
                    >
                        <Img
                            src={props.imageUrl}
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                transform: `scale(${interpolate(frame, [0, 300], [1.1, 1], {
                                    extrapolateRight: 'clamp',
                                })})`,
                            }}
                        />
                        {/* Gradient overlay on image */}
                        <div
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                background: isPortrait
                                    ? linearGradient(180, 'transparent', props.backgroundColor)
                                    : linearGradient(90, 'transparent', props.backgroundColor),
                            }}
                        />

                        {/* Badge */}
                        <div
                            style={{
                                position: 'absolute',
                                top: isPortrait ? 30 : 40,
                                left: isPortrait ? 20 : 30,
                                padding: `${6 * scale}px ${16 * scale}px`,
                                borderRadius: 12 * scale,
                                background: COLORS.accentLight,
                                opacity: fadeIn(frame, 10),
                                transform: `scale(${scaleIn(frame, fps, 10)})`,
                            }}
                        >
                            <EditableText
                                text={props.badge}
                                fontSize={32 * scale}
                                fontFamily={interFont}
                                color={COLORS.textPrimary}
                                fontWeight={700}
                                letterSpacing={2}
                            />
                        </div>
                    </div>
                )}

                {/* Text section */}
                <div
                    style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        padding: isPortrait ? '130px 80px 100px' : '60px 60px',
                        gap: isPortrait ? 44 : 32,
                    }}
                >
                    {!renderBackgroundLayers && (
                        <div
                            style={{
                                display: 'inline-flex',
                                alignSelf: 'flex-start',
                                padding: `${6 * scale}px ${16 * scale}px`,
                                borderRadius: 12 * scale,
                                background: COLORS.accentLight,
                                opacity: fadeIn(frame, 10),
                            }}
                        >
                            <EditableText
                                text={props.badge}
                                fontSize={32 * scale}
                                fontFamily={interFont}
                                color={COLORS.textPrimary}
                                fontWeight={700}
                                letterSpacing={2}
                            />
                        </div>
                    )}

                    {/* Category */}
                    <div
                        style={{
                            display: 'inline-flex',
                            alignSelf: 'flex-start',
                            padding: `${4 * scale}px ${12 * scale}px`,
                            borderRadius: 4 * scale,
                            border: `2px solid ${props.primaryColor}44`,
                            opacity: fadeIn(frame, 20),
                        }}
                    >
                        <EditableText
                            text={props.category}
                            fontSize={28 * scale}
                            fontFamily={interFont}
                            color={COLORS.accent}
                            fontWeight={600}
                            letterSpacing={3}
                        />
                    </div>

                    {/* Headline */}
                    <EditableText
                        text={props.headline}
                        fontSize={isPortrait ? 92 : 112}
                        fontFamily={interFont}
                        color="#f0f6fc"
                        fontWeight={800}
                        lineHeight={1.15}
                        letterSpacing={-0.5}
                        maxLines={3}
                        style={{
                            opacity: fadeIn(frame, 25),
                            transform: slideIn(frame, 'up', 25, 25),
                        }}
                    />

                    {/* Subheadline */}
                    <EditableText
                        text={props.subheadline}
                        fontSize={isPortrait ? 46 : 52}
                        fontFamily={interFont}
                        color="#8b949e"
                        fontWeight={400}
                        lineHeight={1.5}
                        maxLines={2}
                        style={{ opacity: fadeIn(frame, 40) }}
                    />

                    {/* Author & source */}
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            flexWrap: isPortrait ? 'wrap' : 'nowrap',
                            gap: 24 * scale,
                            marginTop: 24 * scale,
                            opacity: fadeIn(frame, 50),
                        }}
                    >
                        <EditableText
                            text={props.source}
                            fontSize={36 * scale}
                            fontFamily={interFont}
                            color={COLORS.accent}
                            fontWeight={600}
                        />
                        <div
                            style={{
                                width: 1 * scale,
                                height: 16 * scale,
                                background: '#30363d',
                            }}
                        />
                        <EditableText
                            text={props.author}
                            fontSize={32 * scale}
                            fontFamily={interFont}
                            color="#8b949e"
                            fontWeight={400}
                        />
                        <div
                            style={{
                                width: 1 * scale,
                                height: 16 * scale,
                                background: '#30363d',
                            }}
                        />
                        <EditableText
                            text={props.timestamp}
                            fontSize={32 * scale}
                            fontFamily={interFont}
                            color="#484f58"
                            fontWeight={400}
                        />
                    </div>
                </div>
            </div>

            {/* Top accent line */}
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: `${interpolate(frame, [0, 50], [0, 100], {
                        extrapolateRight: 'clamp',
                    })
                        }% `,
                    height: 6 * scale,
                    background: GRADIENTS.bgMain,
                }}
            />
        </AbsoluteFill>
    );
};

// ─── Register ────────────────────────────────────────────────
registerTemplate({
    id: 'tech-news-launch-01',
    name: 'Tech News Product Launch',
    category: 'tech-news',
    description: 'Product launch announcement with hero image, tech grid background, and editorial layout',
    tags: ['launch', 'product', 'announcement', 'tech-news', 'gadget'],
    component: TechNewsLaunch01,
    schema: techNewsLaunchSchema,
    defaultProps: techNewsLaunchSchema.parse({}),
    durationInFrames: DEFAULT_DURATION_FRAMES,
    fps: DEFAULT_FPS,
});
