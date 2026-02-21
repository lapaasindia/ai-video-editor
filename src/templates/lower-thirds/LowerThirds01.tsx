import React from 'react';
import {
    AbsoluteFill,
    useCurrentFrame,
    useVideoConfig,
    interpolate,
    spring,
} from 'remotion';
import { z } from 'zod';
import { useIsPortrait, useResponsive, useScaleFactor } from "../../lib/responsive";

import { EditableText } from '../../components/EditableText';
import { AnimatedGradient } from '../../components/AnimatedGradient';
import {
    resolveCanvasBackground,
    useResolvedBackgroundControls,
} from '../../lib/background';
import { registerTemplate } from '../registry';
import { DEFAULT_DURATION_FRAMES, DEFAULT_FPS } from '../../lib/constants';
import { interFont } from '../../lib/fonts';
import { COLORS, GRADIENTS } from '../../lib/theme';

// ─── Schema ──────────────────────────────────────────────────
export const lowerThirdsSchema = z.object({
    name: z.string().default('Sarah Chen'),
    title: z.string().default('VP of Engineering, NovaTech'),
    accentEmoji: z.string().default(''),
    primaryColor: z.string().default(COLORS.accent),
    accentColor: z.string().default(COLORS.accentLight),
    backgroundColor: z.string().default(COLORS.bg),
    textColor: z.string().default('#ffffff'),
});

type Props = z.infer<typeof lowerThirdsSchema>;

// ─── Component ───────────────────────────────────────────────
export const LowerThirds01: React.FC<Props> = (props) => {
    const scale = useScaleFactor();
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const isPortrait = useIsPortrait();
    const backgroundControls = useResolvedBackgroundControls();

    const barReveal = spring({
        frame: frame - 5,
        fps,
        config: { damping: 14, stiffness: 100, mass: 0.6 },
    });

    const textReveal = spring({
        frame: frame - 15,
        fps,
        config: { damping: 12, stiffness: 120, mass: 0.5 },
    });

    const exitOpacity = interpolate(frame, [120, 140], [1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    return (
        <AbsoluteFill
            style={{
                background: resolveCanvasBackground(COLORS.bg, backgroundControls),
                overflow: 'hidden',
            }}
        >
            {/* Animated background */}
            <AnimatedGradient />
            {/* Lower third positioned at bottom */}
            <div
                style={{
                    position: 'absolute',
                    bottom: isPortrait ? 120 : 60,
                    left: isPortrait ? 80 : 80,
                    right: isPortrait ? 80 : 'auto',
                    opacity: exitOpacity,
                }}
            >
                {/* Accent bar */}
                <div
                    style={{
                        width: interpolate(barReveal, [0, 1], [0, isPortrait ? 260 : 360]),
                        height: 6 * scale,
                        borderRadius: 2 * scale,
                        background: GRADIENTS.bgMain,
                        marginBottom: 24 * scale,
                        boxShadow: `0 0 12px ${props.primaryColor}44`,
                    }}
                />

                {/* Card */}
                <div
                    style={{
                        display: 'inline-flex',
                        flexDirection: 'column',
                        padding: `${14 * scale}px ${24 * scale}px`,
                        borderRadius: 24 * scale,
                        background: 'rgba(0,0,0,0.7)',
                        backdropFilter: 'blur(20px)',
                        border: `2px solid ${props.primaryColor}30`,
                        gap: 8 * scale,
                        transform: `translateY(${interpolate(textReveal, [0, 1], [20, 0])}px)`,
                        opacity: textReveal,
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 * scale }}>
                        {props.accentEmoji && (
                            <span style={{ fontSize: 48 * scale }}>{props.accentEmoji}</span>
                        )}
                        <EditableText
                            text={props.name}
                            fontSize={isPortrait ? 72 : 64 * scale}
                            fontFamily={interFont}
                            color={props.textColor}
                            fontWeight={700}
                        />
                    </div>
                    <EditableText
                        text={props.title}
                        fontSize={isPortrait ? 40 : 36 * scale}
                        fontFamily={interFont}
                        color={COLORS.accent}
                        fontWeight={500}
                    />
                </div>
            </div>
        </AbsoluteFill>
    );
};

// ─── Register ────────────────────────────────────────────────
registerTemplate({
    id: 'lower-thirds-01',
    name: 'Lower Third — Name Card',
    category: 'lower-thirds',
    description: 'Clean lower-third name card with gradient accent bar, glass background, and exit fade',
    tags: ['lower-third', 'name', 'title', 'overlay', 'interview'],
    component: LowerThirds01,
    schema: lowerThirdsSchema,
    defaultProps: lowerThirdsSchema.parse({}),
    durationInFrames: DEFAULT_DURATION_FRAMES,
    fps: DEFAULT_FPS,
});
