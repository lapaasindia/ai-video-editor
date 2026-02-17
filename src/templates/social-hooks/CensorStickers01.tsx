import React from 'react';
import {
    AbsoluteFill,
    useCurrentFrame,
    Img,
    interpolate,
    Easing,
    random,
} from 'remotion';
import { z } from 'zod';
import { useIsPortrait, useScaleFactor } from '../../lib/responsive';
import { AnimatedGradient } from '../../components/AnimatedGradient';
import {
    resolveCanvasBackground,
    shouldRenderBackgroundLayer,
    useResolvedBackgroundControls,
} from '../../lib/background';
import { registerTemplate } from '../registry';
import { EditableText } from '../../components/EditableText';
import { interFont } from '../../lib/fonts';

// ─── Schema ──────────────────────────────────────────────────
export const censorStickersSchema = z.object({
    backgroundImageUrl: z.string().default('https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1920'),
    stickerText: z.string().default('???'),
    stickerEmoji: z.string().default('🤫'),
    sticker1X: z.number().default(0.3),
    sticker1Y: z.number().default(0.35),
    sticker2X: z.number().default(0.7),
    sticker2Y: z.number().default(0.4),
    sticker3X: z.number().default(0.5),
    sticker3Y: z.number().default(0.55),
    primaryColor: z.string().default('#FF6B35'),
    backgroundColor: z.string().default('#0A0A0F'),
    showScanlines: z.boolean().default(true),
});

type Props = z.infer<typeof censorStickersSchema>;

// ─── Component ───────────────────────────────────────────────
export const CensorStickers01: React.FC<Props> = (props) => {
    const frame = useCurrentFrame();
    const isPortrait = useIsPortrait();
    const s = useScaleFactor();
    const backgroundControls = useResolvedBackgroundControls();
    const renderBackgroundLayers = shouldRenderBackgroundLayer(backgroundControls);

    const stickers = [
        { x: props.sticker1X, y: props.sticker1Y, delay: 30 },
        { x: props.sticker2X, y: props.sticker2Y, delay: 36 },
        { x: props.sticker3X, y: props.sticker3Y, delay: 42 },
    ];

    const stickerSize = (isPortrait ? 140 : 180) * s;
    const stickerEmojiSize = (isPortrait ? 56 : 74) * s;
    const stickerTextSize = (isPortrait ? 24 : 34) * s;

    return (
        <AbsoluteFill
            style={{
                background: resolveCanvasBackground(props.backgroundColor, backgroundControls),
                overflow: 'hidden',
            }}
        >
            <AnimatedGradient />

            {/* Background image */}
            {renderBackgroundLayers && (
                <AbsoluteFill>
                    <Img
                        src={props.backgroundImageUrl}
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            filter: 'brightness(0.7)',
                        }}
                    />
                </AbsoluteFill>
            )}

            {/* Scanlines */}
            {renderBackgroundLayers && props.showScanlines && (
                <AbsoluteFill
                    style={{
                        backgroundImage: `repeating-linear-gradient(
                            0deg,
                            transparent,
                            transparent 2px,
                            rgba(0,0,0,0.08) 2px,
                            rgba(0,0,0,0.08) 4px
                        )`,
                    }}
                />
            )}

            {/* Stickers */}
            {stickers.map((sticker, i) => {
                // Entry animation (f30-f55)
                const entryY = interpolate(frame, [sticker.delay, sticker.delay + 12], [300 * s, 0], {
                    extrapolateLeft: 'clamp',
                    extrapolateRight: 'clamp',
                    easing: Easing.out(Easing.back(1.6)),
                });
                const entryScale = interpolate(frame, [sticker.delay, sticker.delay + 12], [0.5, 1], {
                    extrapolateLeft: 'clamp',
                    extrapolateRight: 'clamp',
                    easing: Easing.out(Easing.back(1.6)),
                });
                const entryBlur = interpolate(frame, [sticker.delay, sticker.delay + 8], [6 * s, 0], {
                    extrapolateLeft: 'clamp',
                    extrapolateRight: 'clamp',
                });
                const entryOpacity = interpolate(frame, [sticker.delay, sticker.delay + 6], [0, 1], {
                    extrapolateLeft: 'clamp',
                    extrapolateRight: 'clamp',
                });

                // Overshoot bounce (f42-f55)
                const bounceY = interpolate(frame, [sticker.delay + 12, sticker.delay + 18, sticker.delay + 25], [0, -15 * s, 0], {
                    extrapolateLeft: 'clamp',
                    extrapolateRight: 'clamp',
                });

                // Hold jitter (f55-f240)
                const jitterX = frame >= 55 && frame < 240 ? (random(`jx${i}${Math.floor(frame / 3)}`) - 0.5) * 2 : 0;
                const jitterY = frame >= 55 && frame < 240 ? (random(`jy${i}${Math.floor(frame / 3)}`) - 0.5) * 2 : 0;
                const jitterRotate = frame >= 55 && frame < 240 ? (random(`jr${i}${Math.floor(frame / 4)}`) - 0.5) * 2 : 0;

                // Peel-off exit (f240-f300)
                const exitRotate = interpolate(frame, [240, 280], [0, 45], {
                    extrapolateLeft: 'clamp',
                    extrapolateRight: 'clamp',
                    easing: Easing.in(Easing.cubic),
                });
                const exitX = interpolate(frame, [240, 300], [0, 200 * s * (i % 2 === 0 ? 1 : -1)], {
                    extrapolateLeft: 'clamp',
                    extrapolateRight: 'clamp',
                });
                const exitOpacity = interpolate(frame, [260, 300], [1, 0], {
                    extrapolateLeft: 'clamp',
                    extrapolateRight: 'clamp',
                });

                const isVisible = frame >= sticker.delay;

                return isVisible ? (
                    <div
                        key={i}
                        style={{
                            position: 'absolute',
                            left: `${sticker.x * 100}%`,
                            top: `${sticker.y * 100}%`,
                            transform: `
                                translate(-50%, -50%)
                                translateY(${entryY + bounceY + jitterY}px)
                                translateX(${jitterX + exitX}px)
                                scale(${entryScale})
                                rotate(${jitterRotate + exitRotate}deg)
                            `,
                            filter: `blur(${entryBlur}px)`,
                            opacity: entryOpacity * exitOpacity,
                        }}
                    >
                        <div
                            style={{
                                width: stickerSize,
                                height: stickerSize,
                                borderRadius: '50%',
                                background: `linear-gradient(135deg, ${props.primaryColor}, ${props.primaryColor}cc)`,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: `0 ${8 * s}px ${32 * s}px ${props.primaryColor}66`,
                                border: `${4 * s}px solid rgba(255,255,255,0.3)`,
                            }}
                        >
                            <span style={{ fontSize: stickerEmojiSize }}>{props.stickerEmoji}</span>
                            <EditableText
                                text={props.stickerText}
                                fontSize={stickerTextSize}
                                fontFamily={interFont}
                                color="#FFFFFF"
                                fontWeight={800}
                            />
                        </div>
                    </div>
                ) : null;
            })}
        </AbsoluteFill>
    );
};

// ─── Register ────────────────────────────────────────────────
registerTemplate({
    id: 'censor-stickers-01',
    name: 'Censor Stickers Face Cover',
    category: 'social-hooks',
    description: 'Branded circular stickers fly in to cover faces with motion blur and stick effect.',
    tags: ['censor', 'sticker', 'privacy', 'face-cover', 'gag', 'secret'],
    component: CensorStickers01,
    schema: censorStickersSchema,
    defaultProps: censorStickersSchema.parse({}),
    durationInFrames: 300, // 10s @ 30fps
    fps: 30,
});
