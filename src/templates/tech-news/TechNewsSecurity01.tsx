import React from 'react';
import {
    AbsoluteFill,
    useCurrentFrame,
    useVideoConfig,
    interpolate,
    spring,
} from 'remotion';
import { z } from 'zod';
import { useIsPortrait, useResponsive } from '../../lib/responsive';
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
import { COLORS } from '../../lib/theme';

// ─── Schema ──────────────────────────────────────────────────
export const techNewsSecuritySchema = z.object({
    badge: z.string().default('🔒 SECURITY ALERT'),
    headline: z.string().default('Critical Zero-Day Vulnerability Found in Popular Framework'),
    subheadline: z.string().default('Affects 40% of web applications worldwide — patches available now'),
    severity: z.string().default('Critical'),
    cvssScore: z.string().default('9.8 / 10'),
    affectedSystems: z.string().default('2.4M+ servers'),
    patchStatus: z.string().default('Available'),
    source: z.string().default('NIST / CVE'),
    timestamp: z.string().default('Feb 12, 2026 • Breaking'),
    primaryColor: z.string().default(COLORS.accent),
    accentColor: z.string().default(COLORS.accentLight),
    backgroundColor: z.string().default(COLORS.bg),
});

type Props = z.infer<typeof techNewsSecuritySchema>;

// ─── Component ───────────────────────────────────────────────
export const TechNewsSecurity01: React.FC<Props> = (props) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const isPortrait = useIsPortrait();
    const scale = useResponsive(1, 1);
    const backgroundControls = useResolvedBackgroundControls();
    const renderBackgroundLayers = shouldRenderBackgroundLayer(backgroundControls);

    const pulse = interpolate(Math.sin(frame * 0.1), [-1, 1], [0.6, 1]);

    const stats = [
        { label: 'Severity', value: props.severity },
        { label: 'CVSS', value: props.cvssScore },
        { label: 'Affected', value: props.affectedSystems },
        { label: 'Patch', value: props.patchStatus },
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
            {/* Danger pulse border */}
            {renderBackgroundLayers && (
                <div
                    style={{
                        position: 'absolute',
                        top: 0, left: 0, right: 0, bottom: 0,
                        border: `2px solid ${props.primaryColor}`,
                        opacity: pulse * 0.15,
                        borderRadius: 0,
                    }}
                />
            )}

            {/* Warning stripes top */}
            {renderBackgroundLayers && (
                <div
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 6,
                        background: `repeating-linear-gradient(
            90deg,
            ${props.primaryColor} 0px,
            ${props.primaryColor} 20px,
            ${props.accentColor} 20px,
            ${props.accentColor} 40px
          )`,
                        opacity: fadeIn(frame, 0, 15),
                    }}
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
                    padding: isPortrait ? '130px 80px 100px' : '70px 100px 60px',
                    gap: isPortrait ? 28 : 40,
                }}
            >
                {/* Badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 24, opacity: fadeIn(frame, 5) }}>
                    <div
                        style={{
                            padding: `${6 * scale}px ${14 * scale}px`,
                            borderRadius: 12,
                            background: `${props.primaryColor}20`,
                            border: `2px solid ${props.primaryColor}60`,
                        }}
                    >
                        <EditableText
                            text={props.badge}
                            fontSize={32 * scale}
                            fontFamily={interFont}
                            color={COLORS.accent}
                            fontWeight={800}
                            letterSpacing={2}
                        />
                    </div>
                </div>

                {/* Headline */}
                <EditableText
                    text={props.headline}
                    fontSize={isPortrait ? 84 : 104}
                    fontFamily={interFont}
                    color={COLORS.textPrimary}
                    fontWeight={800}
                    lineHeight={1.1}
                    letterSpacing={-1}
                    maxLines={3}
                    style={{ opacity: fadeIn(frame, 10), transform: slideIn(frame, 'up', 10, 25) }}
                />

                <EditableText
                    text={props.subheadline}
                    fontSize={isPortrait ? 44 : 52}
                    fontFamily={interFont}
                    color={COLORS.textSecondary}
                    fontWeight={400}
                    lineHeight={1.5}
                    maxLines={2}
                    style={{ opacity: fadeIn(frame, 22) }}
                />

                {/* Stat cards */}
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: isPortrait ? '1fr 1fr' : 'repeat(4, 1fr)',
                        gap: isPortrait ? 20 : 32,
                        marginTop: isPortrait ? 0 : 'auto',
                    }}
                >
                    {stats.map((stat, i) => {
                        const delay = 35 + staggerDelay(i, 8);
                        const cardSpring = spring({
                            frame: frame - delay,
                            fps,
                            config: { damping: 12, stiffness: 130, mass: 0.5 },
                        });

                        const isCritical = stat.value.toLowerCase().includes('critical') || stat.label === 'CVSS';

                        return (
                            <div
                                key={i}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    padding: `${14 * scale}px`,
                                    borderRadius: 24,
                                    background: `rgba(${isCritical ? '255,23,68' : '255,255,255'},0.04)`,
                                    border: `2px solid ${isCritical ? props.primaryColor + '30' : 'rgba(255,255,255,0.06)'}`,
                                    gap: 8,
                                    transform: `scale(${cardSpring})`,
                                    opacity: fadeIn(frame, delay),
                                }}
                            >
                                <EditableText
                                    text={stat.label}
                                    fontSize={28 * scale}
                                    fontFamily={interFont}
                                    color={COLORS.textSecondary}
                                    fontWeight={500}
                                    textTransform="uppercase"
                                    letterSpacing={2}
                                />
                                <EditableText
                                    text={stat.value}
                                    fontSize={48 * scale}
                                    fontFamily={interFont}
                                    color={isCritical ? props.primaryColor : '#ffffffdd'}
                                    fontWeight={700}
                                />
                            </div>
                        );
                    })}
                </div>

                {/* Source */}
                <div
                    style={{
                        display: 'flex',
                        gap: 24,
                        alignItems: 'center',
                        flexWrap: isPortrait ? 'wrap' : 'nowrap',
                        opacity: fadeIn(frame, 70),
                    }}
                >
                    <EditableText
                        text={props.source}
                        fontSize={32 * scale}
                        fontFamily={interFont}
                        color={COLORS.accent}
                        fontWeight={600}
                    />
                    <div style={{ width: 4, height: 8, borderRadius: '50%', background: '#ffffff33' }} />
                    <EditableText
                        text={props.timestamp}
                        fontSize={32 * scale}
                        fontFamily={interFont}
                        color={COLORS.textSecondary}
                        fontWeight={400}
                    />
                </div>
            </div>

            {/* Bottom danger stripe */}
            {renderBackgroundLayers && (
                <div
                    style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: 8,
                        background: `repeating-linear-gradient(
            90deg,
            ${props.primaryColor} 0px,
            ${props.primaryColor} 20px,
            ${props.accentColor} 20px,
            ${props.accentColor} 40px
          )`,
                        opacity: fadeIn(frame, 0, 15),
                    }}
                />
            )}
        </AbsoluteFill>
    );
};

// ─── Register ────────────────────────────────────────────────
registerTemplate({
    id: 'tech-news-security-01',
    name: 'Security Alert',
    category: 'tech-news',
    description: 'Critical security alert with warning stripes, pulsing border, severity cards, and danger theme',
    tags: ['security', 'vulnerability', 'alert', 'cyber', 'CVE'],
    component: TechNewsSecurity01,
    schema: techNewsSecuritySchema,
    defaultProps: techNewsSecuritySchema.parse({}),
    durationInFrames: DEFAULT_DURATION_FRAMES,
    fps: DEFAULT_FPS,
});
