import React from 'react';
import {
    AbsoluteFill,
    useCurrentFrame,
    interpolate,
} from 'remotion';
import { z } from 'zod';
import { useIsPortrait, useScaleFactor } from "../../lib/responsive";
import { fadeIn, typewriter } from '../../lib/animations';
import { AnimatedGradient } from '../../components/AnimatedGradient';
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
export const textAnimTypewriterSchema = z.object({
    line1: z.string().default('We build software'),
    line2: z.string().default('that changes the world.'),
    cursorColor: z.string().default('#536DFE'),
    primaryColor: z.string().default(COLORS.accent),
    accentColor: z.string().default(COLORS.accentLight),
    backgroundColor: z.string().default(COLORS.bg),
    textColor: z.string().default(COLORS.textPrimary),
});

type Props = z.infer<typeof textAnimTypewriterSchema>;

// ─── Component ───────────────────────────────────────────────
export const TextAnimTypewriter01: React.FC<Props> = (props) => {
    const scale = useScaleFactor();
    const frame = useCurrentFrame();
    const isPortrait = useIsPortrait();
    const backgroundControls = useResolvedBackgroundControls();
    const renderBackgroundLayers = shouldRenderBackgroundLayer(backgroundControls);

    const line1Text = typewriter(frame, props.line1, 0.5, 0);
    const line2Text = typewriter(frame, props.line2, 0.5, props.line1.length * 2 + 15);
    const cursorBlink = Math.sin(frame * 0.2) > 0 ? 1 : 0;

    const isDoneLine1 = line1Text.length >= props.line1.length;
    const isDoneLine2 = line2Text.length >= props.line2.length;

    return (
        <AbsoluteFill
            style={{
                background: resolveCanvasBackground(props.backgroundColor, backgroundControls),
                overflow: 'hidden',
            }}
        >
            {/* Animated background */}
            <AnimatedGradient />
            {/* Subtle grid */}
            {renderBackgroundLayers && (
                <div
                    style={{
                        position: 'absolute',
                        top: 0, left: 0, right: 0, bottom: 0,
                        backgroundImage: `
            linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)
          `,
                        backgroundSize: '80px 80px',
                        opacity: fadeIn(frame, 0, 30),
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
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: isPortrait ? '140px 80px' : '60px 120px',
                    gap: 16 * scale,
                    textAlign: 'center',
                }}
            >
                {/* Line 1 */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', maxWidth: isPortrait ? '100%' : 2600 }}>
                    <span
                        style={{
                            fontSize: isPortrait ? 56 : 76,
                            fontFamily: interFont,
                            fontWeight: 900,
                            color: props.textColor,
                            letterSpacing: -2,
                            lineHeight: 1.2,
                        }}
                    >
                        {line1Text}
                    </span>
                    {!isDoneLine1 && (
                        <span
                            style={{
                                display: 'inline-block',
                                width: isPortrait ? 3 : 4,
                                height: isPortrait ? 62 : 94,
                                background: props.cursorColor,
                                marginLeft: 4 * scale,
                                opacity: cursorBlink,
                                borderRadius: 2 * scale,
                                boxShadow: `0 0 12px ${props.cursorColor}88`,
                            }}
                        />
                    )}
                </div>

                {/* Line 2 — gradient */}
                {isDoneLine1 && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', maxWidth: isPortrait ? '100%' : 2600 }}>
                        <span
                            style={{
                                fontSize: isPortrait ? 102 : 146,
                                fontFamily: interFont,
                                fontWeight: 900,
                                letterSpacing: -2,
                                lineHeight: 1.2,
                                backgroundImage: linearGradient(135, props.primaryColor, props.accentColor),
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text',
                            }}
                        >
                            {line2Text}
                        </span>
                        {!isDoneLine2 && (
                            <span
                                style={{
                                    display: 'inline-block',
                                    width: isPortrait ? 3 : 4,
                                    height: isPortrait ? 62 : 94,
                                    background: props.cursorColor,
                                    marginLeft: 4 * scale,
                                    opacity: cursorBlink,
                                    borderRadius: 2 * scale,
                                    boxShadow: `0 0 12px ${props.cursorColor}88`,
                                }}
                            />
                        )}
                    </div>
                )}
            </div>

            {/* Bottom accent */}
            <div
                style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    width: `${interpolate(frame, [0, 80], [0, 100], { extrapolateRight: 'clamp' })}%`,
                    height: 6 * scale,
                    background: GRADIENTS.bgMain,
                }}
            />
        </AbsoluteFill>
    );
};

// ─── Register ────────────────────────────────────────────────
registerTemplate({
    id: 'text-anim-typewriter-01',
    name: 'Typewriter Effect',
    category: 'text-animation',
    description: 'Two-line typewriter text with blinking cursor, gradient second line, and grid background',
    tags: ['text', 'typewriter', 'animation', 'cursor', 'typing'],
    component: TextAnimTypewriter01,
    schema: textAnimTypewriterSchema,
    defaultProps: textAnimTypewriterSchema.parse({}),
    durationInFrames: DEFAULT_DURATION_FRAMES,
    fps: DEFAULT_FPS,
});
