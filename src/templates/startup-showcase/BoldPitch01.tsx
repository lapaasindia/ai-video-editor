import React from 'react';
import {
    AbsoluteFill,
    useCurrentFrame,
    useVideoConfig,
    interpolate,
    spring,
} from 'remotion';
import { z } from 'zod';
import { useIsPortrait } from '../../lib/responsive';
import { EditableText } from '../../components/EditableText';
import { AnimatedGradient } from '../../components/AnimatedGradient';
import {
    resolveCanvasBackground,
    shouldRenderBackgroundLayer,
    useResolvedBackgroundControls,
} from '../../lib/background';
import { registerTemplate } from '../registry';
import { DEFAULT_FPS } from '../../lib/constants';
import { interFont } from '../../lib/fonts';
import { COLORS } from '../../lib/theme';

// ─── Schema ──────────────────────────────────────────────────
export const boldPitchSchema = z.object({
    word1: z.string().default('PROBLEM'),
    word2: z.string().default('SOLUTION'),
    word3: z.string().default('MARKET'),
    word4: z.string().default('TRACTION'),
    primaryColor: z.string().default(COLORS.accent),
    accentColor: z.string().default(COLORS.accentLight),
    textColor: z.string().default(COLORS.textPrimary),
    showShapes: z.boolean().default(true),
});

type Props = z.infer<typeof boldPitchSchema>;

// ─── Component ───────────────────────────────────────────────
export const BoldPitch01: React.FC<Props> = (props) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    
    const isPortrait = useIsPortrait();
    const backgroundControls = useResolvedBackgroundControls();
    const renderBackgroundLayers = shouldRenderBackgroundLayer(backgroundControls);

    // Timings
    const t1 = 0;
    const t2 = 20;
    const t3 = 40;
    const t4 = 60;

    const springConfig = { damping: 10, stiffness: 200, mass: 0.5 };

    const scale1 = spring({ frame: frame - t1, fps, config: springConfig });
    const scale2 = spring({ frame: frame - t2, fps, config: springConfig });
    const scale3 = spring({ frame: frame - t3, fps, config: springConfig });
    const scale4 = spring({ frame: frame - t4, fps, config: springConfig });

    // Background color switching
    const bgColor = frame < t2 ? props.primaryColor :
        frame < t3 ? props.accentColor :
            frame < t4 ? props.primaryColor :
                props.accentColor;

    const textColor = frame < t2 ? props.textColor :
        frame < t3 ? props.primaryColor :
            frame < t4 ? props.textColor :
                props.primaryColor;

    return (
        <AbsoluteFill
            style={{
                background: resolveCanvasBackground(bgColor, backgroundControls),
                overflow: 'hidden',
            }}
        >
            {/* Animated background */}
            <AnimatedGradient />
            {/* Geometric Shapes Overlay */}
            {renderBackgroundLayers && props.showShapes && (
                <AbsoluteFill>
                    <div style={{
                        position: 'absolute',
                        top: '-50%',
                        left: '-50%',
                        width: '200%',
                        height: '200%',
                        background: `repeating-linear-gradient(
                            45deg,
                            transparent,
                            transparent 40px,
                            #ffffff10 40px,
                            #ffffff10 80px
                        )`,
                        transform: `rotate(${frame * 0.5}deg)`,
                    }} />
                    <div style={{
                        position: 'absolute',
                        right: -100, bottom: -100,
                        width: 400, height: 400,
                        borderRadius: '50%',
                        border: '20px solid #ffffff10',
                        transform: `scale(${interpolate(frame, [0, 100], [0.8, 1.2])})`,
                    }} />
                </AbsoluteFill>
            )}

            {/* Centered Content */}
            <AbsoluteFill style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
            }}>
                {frame >= t1 && frame < t2 && (
                    <div style={{ transform: `scale(${scale1}) rotate(${interpolate(scale1, [0, 1], [-10, 0])}deg)` }}>
                        <EditableText
                            text={props.word1}
                            fontSize={isPortrait ? 92 : 172}
                            fontFamily={interFont}
                            color={textColor}
                            fontWeight={900}
                        />
                    </div>
                )}
                {frame >= t2 && frame < t3 && (
                    <div style={{ transform: `scale(${scale2})` }}>
                        <EditableText
                            text={props.word2}
                            fontSize={isPortrait ? 92 : 172}
                            fontFamily={interFont}
                            color={textColor}
                            fontWeight={900}
                            fontStyle="italic"
                        />
                    </div>
                )}
                {frame >= t3 && frame < t4 && (
                    <div style={{ transform: `scale(${scale3}) rotate(${interpolate(scale3, [0, 1], [10, 0])}deg)` }}>
                        <EditableText
                            text={props.word3}
                            fontSize={isPortrait ? 92 : 172}
                            fontFamily={interFont}
                            color={textColor}
                            fontWeight={900}
                        />
                    </div>
                )}
                {frame >= t4 && (
                    <div style={{ transform: `scale(${scale4})` }}>
                        <EditableText
                            text={props.word4}
                            fontSize={isPortrait ? 110 : 180}
                            fontFamily={interFont}
                            color={textColor}
                            fontWeight={900}
                            style={{
                                textDecoration: 'underline',
                                textDecorationColor: props.primaryColor
                            }}
                        />
                    </div>
                )}
            </AbsoluteFill>
        </AbsoluteFill>
    );
};

// ─── Register ────────────────────────────────────────────────
registerTemplate({
    id: 'bold-pitch-01',
    name: 'Bold Elevator Pitch',
    category: 'startup-showcase',
    description: 'Fast-paced rhythmic text animation for elevator pitches and key value propositions.',
    tags: ['pitch', 'startup', 'investor', 'bold', 'text'],
    component: BoldPitch01,
    schema: boldPitchSchema,
    defaultProps: boldPitchSchema.parse({}),
    durationInFrames: 90,
    fps: DEFAULT_FPS,
});
