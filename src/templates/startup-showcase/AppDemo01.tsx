import React from 'react';
import {
    AbsoluteFill,
    useCurrentFrame,
    useVideoConfig,
    spring,
    random,
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
import { DEFAULT_DURATION_FRAMES, DEFAULT_FPS } from '../../lib/constants';
import { interFont } from '../../lib/fonts';

// ─── Schema ──────────────────────────────────────────────────
export const appDemoSchema = z.object({
    title: z.string().default('APP LAUNCH'),
    subtitle: z.string().default('Available on all stores'),
    color1: z.string().default('#FF9A9E'),
    color2: z.string().default('#FECFEF'),
    color3: z.string().default('#A18CD1'),
    showBubbles: z.boolean().default(true),
    darkTheme: z.boolean().default(false),
});

type Props = z.infer<typeof appDemoSchema>;

// ─── Component ───────────────────────────────────────────────
export const AppDemo01: React.FC<Props> = (props) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const isPortrait = useIsPortrait();
    const backgroundControls = useResolvedBackgroundControls();
    const renderBackgroundLayers = shouldRenderBackgroundLayer(backgroundControls);

    // Gradient Animation
    const t = frame * 0.02;
    const x1 = Math.sin(t) * 50 + 50;
    const y1 = Math.cos(t * 0.8) * 50 + 50;
    const x2 = Math.cos(t * 1.2) * 50 + 50;
    const y2 = Math.sin(t * 0.9) * 50 + 50;

    // Bubbles
    const bubbles = React.useMemo(() => new Array(10).fill(0).map((_, i) => ({
        size: random(i) * 200 + 100,
        x: random(i + 10) * 100,
        y: random(i + 20) * 100,
        speed: random(i + 30) * 0.2 + 0.1,
    })), []);

    const textColor = props.darkTheme ? '#fff' : '#000';
    const glassBg = props.darkTheme ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.3)';

    return (
        <AbsoluteFill
            style={{
                background: resolveCanvasBackground(props.color1, backgroundControls),
                overflow: 'hidden',
            }}
        >
            {/* Animated background */}
            <AnimatedGradient />
            {/* Animated Mesh Gradients */}
            {renderBackgroundLayers && (
            <div style={{
                position: 'absolute',
                top: '-50%', left: '-50%',
                width: '200%', height: '200%',
                background: `
                    radial-gradient(circle at ${x1}% ${y1}%, ${props.color2}, transparent 50%),
                    radial-gradient(circle at ${x2}% ${y2}%, ${props.color3}, transparent 50%)
                `,
                filter: 'blur(60px)',
                opacity: 0.8,
            }} />
            )}

            {/* Floating Glass Bubbles */}
            {renderBackgroundLayers && props.showBubbles && bubbles.map((b, i) => (
                <div
                    key={i}
                    style={{
                        position: 'absolute',
                        left: `${b.x}%`,
                        top: `${(b.y - frame * b.speed) % 120 - 20}%`,
                        width: b.size,
                        height: b.size,
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, rgba(255,255,255,0.4), rgba(255,255,255,0.1))',
                        border: '2px solid rgba(255,255,255,0.2)',
                        backdropFilter: 'blur(4px)',
                        boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.1)',
                    }}
                />
            ))}

            {/* Glass Card Content */}
            <AbsoluteFill style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 10,
                padding: isPortrait ? '140px 80px' : undefined,
            }}>
                <div style={{
                    padding: isPortrait ? '40px 20px' : '60px 100px',
                    background: glassBg,
                    backdropFilter: 'blur(16px)',
                    borderRadius: 48,
                    border: '2px solid rgba(255,255,255,0.3)',
                    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.1)',
                    transform: `scale(${spring({ frame, fps, config: { damping: 12 } })})`,
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 32,
                }}>
                    <EditableText
                        text={props.title}
                        fontSize={isPortrait ? 100 : 160}
                        fontFamily={interFont}
                        color={textColor}
                        fontWeight={800}
                        letterSpacing={-2}
                    />
                    <EditableText
                        text={props.subtitle}
                        fontSize={isPortrait ? 40 : 60}
                        fontFamily={interFont}
                        color={props.darkTheme ? '#ffffffcc' : '#00000099'}
                        fontWeight={500}
                    />
                </div>
            </AbsoluteFill>
        </AbsoluteFill>
    );
};

// ─── Register ────────────────────────────────────────────────
registerTemplate({
    id: 'app-demo-01',
    name: 'Mobile App Demo',
    category: 'startup-showcase',
    description: 'Modern abstract gradient background perfect for app demos and software showcases.',
    tags: ['app', 'mobile', 'tech', 'startup', 'demo'],
    component: AppDemo01,
    schema: appDemoSchema,
    defaultProps: appDemoSchema.parse({}),
    durationInFrames: DEFAULT_DURATION_FRAMES,
    fps: DEFAULT_FPS,
});
