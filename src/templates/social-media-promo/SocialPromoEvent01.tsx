import React from 'react';
import {
    AbsoluteFill,
    useCurrentFrame,
    useVideoConfig,
    interpolate,
    spring } from 'remotion';
import { z } from 'zod';
import { useIsPortrait, useScaleFactor } from "../../lib/responsive";
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
export const socialPromoEventSchema = z.object({
    badge: z.string().default('LIVE EVENT'),
    headline: z.string().default('Design Summit 2026'),
    subtitle: z.string().default('The future of product design is here'),
    date: z.string().default('March 15–17, 2026'),
    location: z.string().default('San Francisco, CA'),
    ctaText: z.string().default('GET TICKETS →'),
    speakers: z.string().default('50+ Speakers'),
    imageUrl: z.string().default('https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800'),
    primaryColor: z.string().default(COLORS.accent),
    accentColor: z.string().default(COLORS.accentLight),
    backgroundColor: z.string().default(COLORS.bg) });

type Props = z.infer<typeof socialPromoEventSchema>;

// ─── Component ───────────────────────────────────────────────
export const SocialPromoEvent01: React.FC<Props> = (props) => {
    const scale = useScaleFactor();
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    
    const isPortrait = useIsPortrait();
    const backgroundControls = useResolvedBackgroundControls();
    const renderBackgroundLayers = shouldRenderBackgroundLayer(backgroundControls);

    const ctaSpring = spring({
        frame: frame - 65,
        fps,
        config: { damping: 10, stiffness: 120, mass: 0.4 } });

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
                        opacity: fadeIn(frame, 0, 25) * 0.25 }}
                >
                    <AnimatedImage src={props.imageUrl} />
                </div>
            )}

            {renderBackgroundLayers && (
                <div
                    style={{
                        position: 'absolute',
                        top: 0, left: 0, right: 0, bottom: 0,
                        background: linearGradient(180, `${props.backgroundColor}88`, `${props.backgroundColor}ee`, props.backgroundColor) }}
                />
            )}

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
                    gap: isPortrait ? 28 : 40 }}
            >
                {/* Badge */}
                <div style={{ opacity: fadeIn(frame, 0) }}>
                    <div
                        style={{
                            display: 'inline-flex',
                            padding: `${5 * scale}px ${14 * scale}px`,
                            borderRadius: 12 * scale,
                            background: `${props.primaryColor}25`,
                            border: `2px solid ${props.primaryColor}50` }}
                    >
                        <EditableText
                            text={props.badge}
                            fontSize={32 * scale}
                            fontFamily={interFont}
                            color={COLORS.accent}
                            fontWeight={800}
                            letterSpacing={3}
                        />
                    </div>
                </div>

                {/* Headline */}
                <EditableText
                    text={props.headline}
                    fontSize={isPortrait ? 92 : 128}
                    fontFamily={interFont}
                    color={COLORS.textPrimary}
                    fontWeight={900}
                    lineHeight={1.05}
                    letterSpacing={-2}
                    maxLines={3}
                    style={{ opacity: fadeIn(frame, 8), transform: slideIn(frame, 'up', 8, 25) }}
                />

                <EditableText
                    text={props.subtitle}
                    fontSize={isPortrait ? 44 : 52}
                    fontFamily={interFont}
                    color={COLORS.textSecondary}
                    fontWeight={400}
                    lineHeight={1.4}
                    maxLines={2}
                    style={{ opacity: fadeIn(frame, 20) }}
                />

                {/* Info pills */}
                <div
                    style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 20 * scale,
                        marginTop: 16 * scale,
                        opacity: fadeIn(frame, 35) }}
                >
                    {[props.date, props.location, props.speakers].map((info, i) => (
                        <div
                            key={i}
                            style={{
                                padding: `${8 * scale}px ${16 * scale}px`,
                                borderRadius: 16 * scale,
                                background: 'rgba(255,255,255,0.06)',
                                border: '2px solid rgba(255,255,255,0.08)' }}
                        >
                            <EditableText
                                text={info}
                                fontSize={32 * scale}
                                fontFamily={interFont}
                                color={COLORS.textSecondary}
                                fontWeight={500}
                            />
                        </div>
                    ))}
                </div>

                {/* CTA */}
                <div
                    style={{
                        marginTop: isPortrait ? 18 : 30,
                        alignSelf: isPortrait ? 'stretch' : 'flex-start',
                        padding: `${16 * scale}px ${40 * scale}px`,
                        borderRadius: 24 * scale,
                        background: GRADIENTS.bgMain,
                        transform: `scale(${ctaSpring})`,
                        boxShadow: `0 0 40px ${props.primaryColor}33`,
                        textAlign: 'center' }}
                >
                    <EditableText
                        text={props.ctaText}
                        fontSize={40 * scale}
                        fontFamily={interFont}
                        color={COLORS.textPrimary}
                        fontWeight={800}
                        letterSpacing={2}
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
    id: 'social-promo-event-01',
    name: 'Event Promo',
    category: 'social-media-promo',
    description: 'Event promotion with background image, info pills, date/location, and CTA button',
    tags: ['event', 'conference', 'promo', 'social', 'tickets'],
    component: SocialPromoEvent01,
    schema: socialPromoEventSchema,
    defaultProps: socialPromoEventSchema.parse({}),
    durationInFrames: DEFAULT_DURATION_FRAMES,
    fps: DEFAULT_FPS });
