import React from 'react';
import {
    AbsoluteFill,
    useCurrentFrame,
    useVideoConfig,
    interpolate,
    random,
    Video,
} from 'remotion';
import { z } from 'zod';
import { useIsPortrait, useScaleFactor } from "../../lib/responsive";
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
export const dataInsightsSchema = z.object({
    title: z.string().default('MARKET DATA'),
    subtitle: z.string().default('Q3 Performance Analysis'),
    videoUrl: z.string().default('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'),
    primaryColor: z.string().default(COLORS.accent), // Hacker Green
    secondaryColor: z.string().default(COLORS.accentDark),
    showNumbers: z.boolean().default(true),
    showGrid: z.boolean().default(true),
});

type Props = z.infer<typeof dataInsightsSchema>;

// ─── Component ───────────────────────────────────────────────
export const DataInsights01: React.FC<Props> = (props) => {
    const scale = useScaleFactor();
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    
    const isPortrait = useIsPortrait();
    const backgroundControls = useResolvedBackgroundControls();
    const renderBackgroundLayers = shouldRenderBackgroundLayer(backgroundControls);

    // Random rolling numbers
    const rollingNum = Math.floor(random(frame) * 100000);
    const rollingHex = Math.floor(random(frame + 100) * 16777215).toString(16).toUpperCase();

    // Scanning Line
    const scanY = interpolate(frame % 150, [0, 150], [0, 100]);

    return (
        <AbsoluteFill
            style={{
                background: resolveCanvasBackground(COLORS.bg, backgroundControls),
                overflow: 'hidden',
                fontFamily: interFont,
            }}
        >
            {/* Animated background */}
            <AnimatedGradient />
            {/* Background Video */}
            {renderBackgroundLayers && (
            <AbsoluteFill style={{ opacity: 0.4 }}>
                <Video
                    src={props.videoUrl}
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        filter: `grayscale(100%) brightness(0.5) sepia(1) hue-rotate(80deg) saturate(3)`,
                    }}
                />
            </AbsoluteFill>
            )}

            {/* Grid Overlay */}
            {renderBackgroundLayers && props.showGrid && (
                <AbsoluteFill style={{
                    background: `
                        linear-gradient(90deg, ${props.secondaryColor}40 1px, transparent 1px),
                        linear-gradient(180deg, ${props.secondaryColor}40 1px, transparent 1px)
                    `,
                    backgroundSize: '50px 50px',
                    pointerEvents: 'none',
                    opacity: 0.5,
                }} />
            )}

            {/* Random Data Streams */}
            {props.showNumbers && (
                <>
                    <div style={{
                        position: 'absolute',
                        top: 48 * scale,
                        left: 36 * scale,
                        color: props.primaryColor,
                        fontSize: isPortrait ? 30 : 40,
                        lineHeight: 1.35,
                        background: '#00000080',
                        border: `2px solid ${props.primaryColor}55`,
                        borderRadius: 16 * scale,
                        padding: '14px 18px',
                    }}>
                        DATA_STREAM_01: {rollingNum}<br />
                        HEX_VAL: 0x{rollingHex}<br />
                        FPS: {fps}<br />
                        TIME: {frame}
                    </div>
                    <div style={{
                        position: 'absolute',
                        bottom: 48 * scale,
                        right: 36 * scale,
                        color: props.primaryColor,
                        fontSize: isPortrait ? 30 : 40,
                        lineHeight: 1.35,
                        textAlign: 'right',
                        background: '#00000080',
                        border: `2px solid ${props.primaryColor}55`,
                        borderRadius: 16 * scale,
                        padding: '14px 18px',
                    }}>
                        SYS_STATUS: OK<br />
                        MEM_USAGE: {Math.floor(interpolate(frame, [0, 100], [20, 80]))}%<br />
                        NET_SPEED: {Math.floor(random(frame) * 100)} MBps
                    </div>
                </>
            )}

            {/* Targeting Reticle */}
            <AbsoluteFill style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', pointerEvents: 'none' }}>
                <div style={{
                    width: isPortrait ? 300 : 600,
                    height: isPortrait ? 300 : 400,
                    border: `2px solid ${props.primaryColor}80`,
                    position: 'relative',
                }}>
                    <div style={{ position: 'absolute', top: -1, left: -1, width: 20 * scale, height: 20 * scale, borderTop: `2px solid ${props.primaryColor}`, borderLeft: `2px solid ${props.primaryColor}` }} />
                    <div style={{ position: 'absolute', top: -1, right: -1, width: 20 * scale, height: 20 * scale, borderTop: `2px solid ${props.primaryColor}`, borderRight: `2px solid ${props.primaryColor}` }} />
                    <div style={{ position: 'absolute', bottom: -1, left: -1, width: 20 * scale, height: 20 * scale, borderBottom: `2px solid ${props.primaryColor}`, borderLeft: `2px solid ${props.primaryColor}` }} />
                    <div style={{ position: 'absolute', bottom: -1, right: -1, width: 20 * scale, height: 20 * scale, borderBottom: `2px solid ${props.primaryColor}`, borderRight: `2px solid ${props.primaryColor}` }} />

                    {/* Crosshair */}
                    <div style={{ position: 'absolute', top: '50%', left: '50%', width: 20 * scale, height: 1 * scale, background: COLORS.accent, transform: 'translate(-50%, -50%)' }} />
                    <div style={{ position: 'absolute', top: '50%', left: '50%', width: 1 * scale, height: 20 * scale, background: COLORS.accent, transform: 'translate(-50%, -50%)' }} />
                </div>
            </AbsoluteFill>

            {/* Scanning Line */}
            <div style={{
                position: 'absolute',
                top: `${scanY}%`,
                left: 0,
                width: '100%',
                height: 2 * scale,
                background: COLORS.accent,
                opacity: 0.5,
                boxShadow: `0 0 10px ${props.primaryColor}`,
            }} />

            {/* Main Text */}
            <AbsoluteFill style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 10,
            }}>
                <div style={{ background: '#000000cc', padding: '30px 56px', border: `2px solid ${props.primaryColor}` }}>
                    <EditableText
                        text={props.title}
                        fontSize={isPortrait ? 92 : 136}
                        fontFamily={interFont}
                        color={COLORS.accent}
                        fontWeight={700}
                        letterSpacing={4}
                    />
                </div>
                <div style={{ marginTop: 20 * scale, opacity: frame % 20 < 10 ? 1 : 0.5 }}>
                    <EditableText
                        text={props.subtitle}
                        fontSize={isPortrait ? 42 : 58}
                        fontFamily={interFont}
                        color={COLORS.accent}
                        fontWeight={400}
                    />
                </div>
            </AbsoluteFill>
        </AbsoluteFill>
    );
};

// ─── Register ────────────────────────────────────────────────
registerTemplate({
    id: 'data-insights-01',
    name: 'Data Insights Dashboard',
    category: 'startup-showcase',
    description: 'Cybersecurity style interface for visualizing complex data, analytics, and metrics.',
    tags: ['data', 'fintech', 'analytics', 'startup', 'metrics'],
    component: DataInsights01,
    schema: dataInsightsSchema,
    defaultProps: dataInsightsSchema.parse({}),
    durationInFrames: DEFAULT_DURATION_FRAMES,
    fps: DEFAULT_FPS,
});
