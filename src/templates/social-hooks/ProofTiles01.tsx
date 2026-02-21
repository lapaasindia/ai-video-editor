import React from 'react';
import {
    AbsoluteFill,
    useCurrentFrame,
    useVideoConfig,
    Img,
    interpolate,
    spring,
    Easing,
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
export const proofTilesSchema = z.object({
    presenterImageUrl: z.string().default('https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800'),
    tile1Url: z.string().default('https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600'),
    tile1Tag: z.string().default('Revenue +240%'),
    tile2Url: z.string().default('https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600'),
    tile2Tag: z.string().default('Users 10M+'),
    tile3Url: z.string().default('https://images.unsplash.com/photo-1553877522-43269d4ea984?w=600'),
    tile3Tag: z.string().default('5-Star Rating'),
    primaryColor: z.string().default(COLORS.accent),
    accentColor: z.string().default(COLORS.accent),
    backgroundColor: z.string().default(COLORS.bg),
});

type Props = z.infer<typeof proofTilesSchema>;

// ─── Component ───────────────────────────────────────────────
export const ProofTiles01: React.FC<Props> = (props) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    
    const isPortrait = useIsPortrait();
    const s = useScaleFactor();
    const backgroundControls = useResolvedBackgroundControls();
    void shouldRenderBackgroundLayer(backgroundControls);

    const tiles = [
        { url: props.tile1Url, tag: props.tile1Tag, delay: 20 },
        { url: props.tile2Url, tag: props.tile2Tag, delay: 44 },
        { url: props.tile3Url, tag: props.tile3Tag, delay: 68 },
    ];

    const tileTilts = [-8, 5, -6];
    const tileOffsets = isPortrait 
        ? [{ x: -100 * s, y: -180 * s }, { x: 80 * s, y: 0 }, { x: -60 * s, y: 180 * s }]
        : [{ x: -250 * s, y: -80 * s }, { x: 0, y: 40 * s }, { x: 250 * s, y: -60 * s }];

    // ─── Presenter pop-in (f0-f20) ───
    const presenterSpring = spring({
        frame,
        fps,
        config: { damping: 14, stiffness: 120, mass: 1 },
    });

    // ─── Tag bounce intervals ───
    const getTagBounce = (tileIndex: number) => {
        const interval = 60;
        const offset = tileIndex * 20;
        const cycleFrame = ((frame - 90 - offset) % interval);
        if (frame < 90 || cycleFrame < 0 || cycleFrame > 15) return 1;
        return 1 + Math.sin(cycleFrame * Math.PI / 15) * 0.1;
    };

    // ─── Exit animation (f300-f420) ───
    const getExitTransform = (tileIndex: number) => {
        const exitStart = 300 + tileIndex * 15;
        const rotation = interpolate(frame, [exitStart, exitStart + 60], [0, tileTilts[tileIndex] * 3], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.in(Easing.cubic),
        });
        const scale = interpolate(frame, [exitStart, exitStart + 60], [1, 0.3], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
        });
        const opacity = interpolate(frame, [exitStart + 30, exitStart + 60], [1, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
        });
        return { rotation, scale, opacity };
    };

    const tileSize = isPortrait ? { w: 220 * s, h: 280 * s } : { w: 280 * s, h: 360 * s };
    const presenterHeight = (isPortrait ? 600 : 500) * s;

    return (
        <AbsoluteFill
            style={{
                background: resolveCanvasBackground(props.backgroundColor, backgroundControls),
                overflow: 'hidden',
            }}
        >
            <AnimatedGradient />

            {/* Tiles layer (behind presenter) */}
            <AbsoluteFill
                style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                }}
            >
                {tiles.map((tile, i) => {
                    const tileSpring = spring({
                        frame: frame - tile.delay,
                        fps,
                        config: { damping: 12, stiffness: 100, mass: 0.8 },
                    });
                    const tileScale = interpolate(tileSpring, [0, 1], [0.6, 1]);
                    const tileRotation = interpolate(tileSpring, [0, 1], [tileTilts[i] * 2, tileTilts[i]]);
                    const exit = getExitTransform(i);
                    const tagBounce = getTagBounce(i);

                    return (
                        <div
                            key={i}
                            style={{
                                position: 'absolute',
                                transform: `
                                    translate(${tileOffsets[i].x}px, ${tileOffsets[i].y}px)
                                    rotate(${tileRotation + exit.rotation}deg)
                                    scale(${tileScale * exit.scale})
                                `,
                                opacity: tileSpring * exit.opacity,
                            }}
                        >
                            <Img
                                src={tile.url}
                                style={{
                                    width: tileSize.w,
                                    height: tileSize.h,
                                    objectFit: 'cover',
                                    borderRadius: 20 * s,
                                    boxShadow: `0 ${30 * s}px ${100 * s}px rgba(0,0,0,0.5)`,
                                    border: `${3 * s}px solid ${COLORS.surface}`,
                                }}
                            />
                            {/* Tag */}
                            {frame >= tile.delay + 50 && (
                                <div
                                    style={{
                                        position: 'absolute',
                                        bottom: (isPortrait ? -16 : -16) * s,
                                        left: '50%',
                                        transform: `translateX(-50%) scale(${tagBounce})`,
                                        padding: `${8 * s}px ${20 * s}px`,
                                        background: props.primaryColor,
                                        borderRadius: 100,
                                        boxShadow: `0 ${4 * s}px ${16 * s}px ${props.primaryColor}66`,
                                    }}
                                >
                                    <EditableText
                                        text={tile.tag}
                                        fontSize={(isPortrait ? 26 : 32) * s}
                                        fontFamily={interFont}
                                        color="#FFFFFF"
                                        fontWeight={700}
                                    />
                                </div>
                            )}
                        </div>
                    );
                })}
            </AbsoluteFill>

            {/* Presenter (foreground) */}
            <AbsoluteFill
                style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'flex-end',
                    transform: `scale(${presenterSpring})`,
                }}
            >
                <Img
                    src={props.presenterImageUrl}
                    style={{
                        height: presenterHeight,
                        width: 'auto',
                        objectFit: 'contain',
                        filter: `drop-shadow(0 ${30 * s}px ${100 * s}px rgba(0,0,0,0.5))`,
                    }}
                />
            </AbsoluteFill>
        </AbsoluteFill>
    );
};

// ─── Register ────────────────────────────────────────────────
registerTemplate({
    id: 'proof-tiles-01',
    name: 'Presenter + 3 Proof Tiles',
    category: 'social-hooks',
    description: 'Mid-video proof montage with 3 tiles slamming in around presenter with bouncing keyword tags.',
    tags: ['proof', 'tiles', 'presenter', 'montage', 'tags', 'carousel'],
    component: ProofTiles01,
    schema: proofTilesSchema,
    defaultProps: proofTilesSchema.parse({}),
    durationInFrames: 420, // 14s @ 30fps
    fps: 30,
});
