import React from 'react';
import {
    AbsoluteFill,
    useCurrentFrame,
    useVideoConfig,
    interpolate,
    spring } from 'remotion';
import { z } from 'zod';
import { useIsPortrait, useResponsive } from '../../lib/responsive';
import { fadeIn, slideIn } from '../../lib/animations';
import { EditableText } from '../../components/EditableText';
import { AnimatedImage } from '../../components/AnimatedImage';
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
export const socialPromoSchema = z.object({
    headline: z.string().default('Flash Sale'),
    highlight: z.string().default('50% OFF'),
    description: z.string().default('Everything in our premium collection for a limited time only'),
    ctaText: z.string().default('SHOP NOW →'),
    imageUrl: z.string().default('https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800'),
    primaryColor: z.string().default(COLORS.accent),
    accentColor: z.string().default(COLORS.accentLight),
    backgroundColor: z.string().default(COLORS.bg) });

type Props = z.infer<typeof socialPromoSchema>;

// ─── Component ───────────────────────────────────────────────
export const SocialPromo01: React.FC<Props> = (props) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const isPortrait = useIsPortrait();
    const scale = useResponsive(1, 1);
    const backgroundControls = useResolvedBackgroundControls();
    const renderBackgroundLayers = shouldRenderBackgroundLayer(backgroundControls);

    const highlightScale = spring({
        frame: frame - 20,
        fps,
        config: { damping: 6, stiffness: 150, mass: 0.5 } });

    const ctaSpring = spring({
        frame: frame - 70,
        fps,
        config: { damping: 10, stiffness: 120, mass: 0.4 } });

    const pulse = interpolate(Math.sin(frame * 0.08), [-1, 1], [0.95, 1.05]);

    return (
        <AbsoluteFill
            style={{
                background: resolveCanvasBackground(COLORS.bg, backgroundControls),
                overflow: 'hidden',
            }}
        >
            {/* Background image */}
            {renderBackgroundLayers && (
                <div
                    style={{
                        position: 'absolute',
                        top: 0, left: 0, right: 0, bottom: 0,
                        opacity: fadeIn(frame, 0, 20) * 0.2 }}
                >
                    <AnimatedImage src={props.imageUrl} />
                </div>
            )}

            {/* Gradient overlays */}
            {renderBackgroundLayers && (
                <>
                    <div
                        style={{
                            position: 'absolute',
                            top: 0, left: 0, right: 0, bottom: 0,
                            background: linearGradient(180, `${props.backgroundColor}99`, `${props.backgroundColor}dd`, props.backgroundColor) }}
                    />
                    <div
                        style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            height: '50%',
                            background: linearGradient(0, 'transparent', `${props.primaryColor}08`) }}
                    />
                </>
            )}

            <div
                style={{
                    position: 'relative',
                    zIndex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '100%',
                    height: '100%',
                    padding: isPortrait ? '140px 80px' : '60px 100px',
                    gap: isPortrait ? 32 : 48,
                    textAlign: 'center' }}
            >
                {/* Headline */}
                <EditableText
                    text={props.headline}
                    fontSize={isPortrait ? 72 : 88}
                    fontFamily={interFont}
                    color={COLORS.textSecondary}
                    fontWeight={600}
                    textTransform="uppercase"
                    letterSpacing={6}
                    textAlign="center"
                    style={{
                        opacity: fadeIn(frame, 5),
                        transform: slideIn(frame, 'down', 5, 20) }}
                />

                {/* Big highlight */}
                <div
                    style={{
                        transform: `scale(${highlightScale * pulse})` }}
                >
                    <div
                        style={{
                            fontSize: isPortrait ? 72 : 110,
                            fontFamily: interFont,
                            fontWeight: 900,
                            letterSpacing: -3,
                            textAlign: 'center',
                            backgroundImage: linearGradient(135, props.primaryColor, props.accentColor),
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text',
                            filter: `drop-shadow(0 0 30px ${props.primaryColor}44)` }}
                    >
                        {props.highlight}
                    </div>
                </div>

                {/* Description */}
                <EditableText
                    text={props.description}
                    fontSize={isPortrait ? 52 : 64}
                    fontFamily={interFont}
                    color={COLORS.textSecondary}
                    fontWeight={400}
                    textAlign="center"
                    lineHeight={1.5}
                    maxLines={2}
                    style={{
                        opacity: fadeIn(frame, 40),
                        maxWidth: isPortrait ? 1100 : 1500 }}
                />

                {/* CTA */}
                <div
                    style={{
                        marginTop: 32 * scale,
                        padding: `${14 * scale}px ${40 * scale}px`,
                        borderRadius: 20 * scale,
                        background: GRADIENTS.bgMain,
                        transform: `scale(${ctaSpring})`,
                        boxShadow: `0 0 40px ${props.primaryColor}33` }}
                >
                    <EditableText
                        text={props.ctaText}
                        fontSize={40 * scale}
                        fontFamily={interFont}
                        color={COLORS.textPrimary}
                        fontWeight={800}
                        letterSpacing={3}
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
                    background: GRADIENTS.bgMain }}
            />
        </AbsoluteFill>
    );
};

// ─── Register ────────────────────────────────────────────────
registerTemplate({
    id: 'social-promo-01',
    name: 'Flash Sale Promo',
    category: 'social-media-promo',
    description: 'Bold flash sale with pulsing gradient highlight, background image, and CTA button',
    tags: ['sale', 'promo', 'social', 'discount', 'flash-sale'],
    component: SocialPromo01,
    schema: socialPromoSchema,
    defaultProps: socialPromoSchema.parse({}),
    durationInFrames: DEFAULT_DURATION_FRAMES,
    fps: DEFAULT_FPS });
