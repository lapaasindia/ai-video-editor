import React from 'react';
import {
    AbsoluteFill,
    useCurrentFrame,
    useVideoConfig,
    interpolate,
    random } from 'remotion';
import { z } from 'zod';
import { useIsPortrait } from '../../lib/responsive';
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
import { COLORS } from '../../lib/theme';

// ─── Schema ──────────────────────────────────────────────────
export const creativeStorySchema = z.object({
    title: z.string().default('OUR STORY'),
    subtitle: z.string().default('Crafted with passion'),
    imageUrl: z.string().default('https://images.unsplash.com/photo-1493863641943-9b68992a8d07?w=1600'),
    paperColor: z.string().default('#f4e4bc'), // Beige/Paper
    accentColor: z.string().default(COLORS.accentLight),
    showTexture: z.boolean().default(true),
    stopMotion: z.boolean().default(true) });

type Props = z.infer<typeof creativeStorySchema>;

// ─── Component ───────────────────────────────────────────────
export const CreativeStory01: React.FC<Props> = (props) => {
    const rawFrame = useCurrentFrame();
    useVideoConfig();
    const isPortrait = useIsPortrait();
    const backgroundControls = useResolvedBackgroundControls();
    const renderBackgroundLayers = shouldRenderBackgroundLayer(backgroundControls);

    // Stop Motion Effect (12fps feel)
    const frame = props.stopMotion ? Math.floor(rawFrame / 3) * 3 : rawFrame;

    // Wiggle effect for cutout look
    const wiggleX = (random(frame) - 0.5) * 4;
    const wiggleY = (random(frame + 10) - 0.5) * 4;
    const rotate = (random(frame + 20) - 0.5) * 2;

    const paperTexture = `
        repeating-linear-gradient(
            45deg,
            #00000005,
            #00000005 2px,
            transparent 2px,
            transparent 4px
        )
    `;

    return (
        <AbsoluteFill
            style={{
                background: resolveCanvasBackground(props.paperColor, backgroundControls),
                overflow: 'hidden',
            }}
        >
            {/* Paper Texture Background */}
            {renderBackgroundLayers && props.showTexture && (
                <AbsoluteFill style={{
                    background: paperTexture,
                    opacity: 0.5 }} />
            )}

            {/* Cutout Image */}
            <AbsoluteFill style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center' }}>
                <div style={{
                    width: isPortrait ? '80%' : '60%',
                    height: isPortrait ? '50%' : '70%',
                    position: 'relative',
                    transform: `translate(${wiggleX}px, ${wiggleY}px) rotate(${rotate}deg)`,
                    boxShadow: '10px 10px 20px rgba(0,0,0,0.2)',
                    background: '#fff',
                    padding: 20 }}>
                    <AnimatedImage src={props.imageUrl} />
                    {/* Tape Effect */}
                    <div style={{
                        position: 'absolute',
                        top: -15, left: '50%', transform: 'translateX(-50%) rotate(-2deg)',
                        width: 100, height: 30,
                        background: 'rgba(255,255,255,0.6)',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} />
                </div>
            </AbsoluteFill>

            {/* Torn Paper Overlay Bottom */}
            <div style={{
                position: 'absolute',
                bottom: 0, left: 0, right: 0,
                height: '30%',
                background: COLORS.accentLight,
                clipPath: 'polygon(0% 20%, 5% 5%, 10% 20%, 15% 5%, 20% 20%, 25% 5%, 30% 20%, 35% 5%, 40% 20%, 45% 5%, 50% 20%, 55% 5%, 60% 20%, 65% 5%, 70% 20%, 75% 5%, 80% 20%, 85% 5%, 90% 20%, 95% 5%, 100% 20%, 100% 100%, 0% 100%)',
                transform: `translateY(${interpolate(frame, [0, 30], [100, 0], { extrapolateRight: 'clamp' })}%)` }}>
                <AbsoluteFill style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    color: props.paperColor,
                    paddingTop: 40 }}>
                    <EditableText
                        text={props.title}
                        fontSize={isPortrait ? 108 : 176}
                        fontFamily={interFont}
                        color={props.paperColor}
                        fontWeight={900}
                    />
                    <EditableText
                        text={props.subtitle}
                        fontSize={isPortrait ? 40 : 60}
                        fontFamily={interFont}
                        color={props.paperColor}
                        fontWeight={400}
                        letterSpacing={4}
                    />
                </AbsoluteFill>
            </div>

            {/* Noise Overlay */}
            {renderBackgroundLayers && props.showTexture && (
                <AbsoluteFill style={{
                    filter: 'url(#noise)',
                    opacity: 0.1,
                    pointerEvents: 'none',
                    background: 'url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScxMDAlJyBoZWlnaHQ9JzEwMCUnPjxmaWx0ZXIgaWQ9J25vaXNlJz48ZmVUdXJidWxlbmNlIHR5cGU9J2ZyYWN0YWxOb2lzZScgYmFzZUZyZXF1ZW5jeT0nMC41JyB1bURvdD0nMS41JyBzdGl0Y2hUaWxlcz0nc3RpdGNoJy8+PC9maWx0ZXI+PHJlY3Qgd2lkdGg9JzEwMCUnIGhlaWdodD0nMTAwJScgZmlsdGVyPSd1cmwoI25vaXNlKScgb3BhY2l0eT0nMC41Jy8+PC9zdmc+")' }} />
            )}
        </AbsoluteFill>
    );
};

// ─── Register ────────────────────────────────────────────────
registerTemplate({
    id: 'creative-story-01',
    name: 'Creative Brand Story',
    category: 'startup-showcase',
    description: 'Artistic stop-motion style for telling unique brand origin stories.',
    tags: ['story', 'brand', 'creative', 'origin', 'startup'],
    component: CreativeStory01,
    schema: creativeStorySchema,
    defaultProps: creativeStorySchema.parse({}),
    durationInFrames: DEFAULT_DURATION_FRAMES,
    fps: DEFAULT_FPS });
