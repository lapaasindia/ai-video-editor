import React from 'react';
import {
    AbsoluteFill,
    useCurrentFrame,
    interpolate } from 'remotion';
import { z } from 'zod';
import { useIsPortrait, useResponsive, useScaleFactor } from "../../lib/responsive";
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
export const bizNewsBreakingSchema = z.object({
    breakingLabel: z.string().default('BREAKING NEWS'),
    headline: z.string().default('Major Tech Acquisition: Company X to Buy Startup Y for $3.2B'),
    subheadline: z.string().default('The deal marks the largest acquisition in the sector this year, signaling a shift in market dynamics'),
    source: z.string().default('Business Wire'),
    timestamp: z.string().default('Feb 11, 2026 • 10:30 AM IST'),
    imageUrl: z.string().default('https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800'),
    category: z.string().default('MERGERS & ACQUISITIONS'),
    primaryColor: z.string().default(COLORS.accent),
    accentColor: z.string().default(COLORS.accentLight) });

type Props = z.infer<typeof bizNewsBreakingSchema>;

// ─── Component ───────────────────────────────────────────────
export const BizNewsBreaking01: React.FC<Props> = (props) => {
    const scale = useScaleFactor();
    const frame = useCurrentFrame();
    const isPortrait = useIsPortrait();
    const backgroundControls = useResolvedBackgroundControls();
    const renderBackgroundLayers = shouldRenderBackgroundLayer(backgroundControls);

    // Pulsing red dot for "LIVE"
    const pulseOpacity = 0.5 + Math.sin(frame * 0.15) * 0.5;

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
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        opacity: fadeIn(frame, 0, 20) * 0.25 }}
                >
                    <AnimatedImage src={props.imageUrl} />
                </div>
            )}

            {/* Dark gradient */}
            {renderBackgroundLayers && (
                <div
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: linearGradient(180, 'rgba(10,10,10,0.3)', 'rgba(10,10,10,0.95)') }}
                />
            )}

            {/* Breaking bar at top */}
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: isPortrait ? 56 : 60,
                    background: COLORS.accent,
                    display: 'flex',
                    alignItems: 'center',
                    paddingLeft: isPortrait ? 20 : 40,
                    gap: 24 * scale,
                    transform: slideIn(frame, 'down', 0, 20, 10),
                    opacity: fadeIn(frame, 0, 10) }}
            >
                {/* Pulsing dot */}
                <div
                    style={{
                        width: 12 * scale,
                        height: 12 * scale,
                        borderRadius: '50%',
                        background: '#fff',
                        opacity: pulseOpacity,
                        boxShadow: '0 0 8px rgba(255,255,255,0.8)' }}
                />
                <EditableText
                    text={props.breakingLabel}
                    fontSize={48 * scale}
                    fontFamily={interFont}
                    color={COLORS.textPrimary}
                    fontWeight={900}
                    letterSpacing={4}
                />
            </div>

            {/* Content */}
            <div
                style={{
                    position: 'relative',
                    zIndex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: isPortrait ? 'center' : 'flex-end',
                    width: '100%',
                    height: '100%',
                    padding: isPortrait ? '120px 80px 90px' : '0 80px 80px',
                    gap: 32 * scale }}
            >
                {/* Category pill */}
                <div
                    style={{
                        display: 'inline-flex',
                        alignSelf: 'flex-start',
                        padding: `${6 * scale}px ${16 * scale}px`,
                        borderRadius: 4 * scale,
                        background: COLORS.accentLight,
                        opacity: fadeIn(frame, 15) }}
                >
                    <EditableText
                        text={props.category}
                        fontSize={36 * scale}
                        fontFamily={interFont}
                        color={COLORS.textPrimary}
                        fontWeight={700}
                        letterSpacing={2}
                    />
                </div>

                {/* Headline */}
                <EditableText
                    text={props.headline}
                    fontSize={isPortrait ? 104 : 128}
                    fontFamily={interFont}
                    color={COLORS.textPrimary}
                    fontWeight={800}
                    lineHeight={1.1}
                    letterSpacing={-1}
                    maxLines={3}
                    style={{
                        opacity: fadeIn(frame, 20),
                        transform: slideIn(frame, 'up', 20, 30) }}
                />

                {/* Subheadline */}
                <EditableText
                    text={props.subheadline}
                    fontSize={isPortrait ? 52 : 64}
                    fontFamily={interFont}
                    color={COLORS.textSecondary}
                    fontWeight={400}
                    lineHeight={1.5}
                    maxLines={2}
                    style={{ opacity: fadeIn(frame, 35) }}
                />

                {/* Source + timestamp */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 32 * scale,
                        marginTop: 16 * scale,
                        opacity: fadeIn(frame, 45) }}
                >
                    <EditableText
                        text={props.source}
                        fontSize={40 * scale}
                        fontFamily={interFont}
                        color={COLORS.accentLight}
                        fontWeight={600}
                    />
                    <div
                        style={{
                            width: 4 * scale,
                            height: 8 * scale,
                            borderRadius: '50%',
                            background: '#ffffff44' }}
                    />
                    <EditableText
                        text={props.timestamp}
                        fontSize={40 * scale}
                        fontFamily={interFont}
                        color={COLORS.textSecondary}
                        fontWeight={400}
                    />
                </div>
            </div>

            {/* Bottom ticker line */}
            <div
                style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    width: `${interpolate(frame, [0, 60], [0, 100], {
                        extrapolateRight: 'clamp' })
                        }% `,
                    height: 8 * scale,
                    background: GRADIENTS.bgMain }}
            />
        </AbsoluteFill>
    );
};

// ─── Register ────────────────────────────────────────────────
registerTemplate({
    id: 'biz-news-breaking-01',
    name: 'Breaking Business News',
    category: 'business-news',
    description: 'Bold breaking news layout with red alert bar, pulsing live dot, and big headline',
    tags: ['breaking', 'alert', 'headline', 'business-news', 'urgent'],
    component: BizNewsBreaking01,
    schema: bizNewsBreakingSchema,
    defaultProps: bizNewsBreakingSchema.parse({}),
    durationInFrames: DEFAULT_DURATION_FRAMES,
    fps: DEFAULT_FPS });
