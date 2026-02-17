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
import { COLORS } from '../../lib/theme';

// ─── Schema ──────────────────────────────────────────────────
export const companyHistorySchema = z.object({
    title: z.string().default('ORIGIN STORY'),
    date: z.string().default('EST 2015'),
    time: z.string().default('DAY 01'),
    videoUrl: z.string().default('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4'),
    showTracking: z.boolean().default(true),
    showDate: z.boolean().default(true),
    showScanlines: z.boolean().default(true),
});

type Props = z.infer<typeof companyHistorySchema>;

// ─── Component ───────────────────────────────────────────────
export const CompanyHistory01: React.FC<Props> = (props) => {
    const frame = useCurrentFrame();
    useVideoConfig();
    const isPortrait = useIsPortrait();
    const backgroundControls = useResolvedBackgroundControls();
    const renderBackgroundLayers = shouldRenderBackgroundLayer(backgroundControls);

    // Tracking noise (vertical jitter)
    const trackingY = props.showTracking ? (random(Math.floor(frame / 5)) - 0.5) * 10 : 0;

    // Color bleed (RGB shift)
    const bleedX = Math.sin(frame * 0.2) * 2;

    return (
        <AbsoluteFill
            style={{
                background: resolveCanvasBackground(COLORS.bg, backgroundControls),
                overflow: 'hidden',
            }}
        >
            {/* Animated background */}
            <AnimatedGradient />
            {/* Main Video Layer with RGB Split */}
            {renderBackgroundLayers && (
            <AbsoluteFill style={{ mixBlendMode: 'screen', transform: `translate(${bleedX}px, ${trackingY}px)`, opacity: 0.8 }}>
                <Video
                    src={props.videoUrl}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'sepia(0.4) contrast(1.2) hue-rotate(-10deg)' }}
                />
            </AbsoluteFill>
            )}
            {renderBackgroundLayers && (
            <AbsoluteFill style={{ mixBlendMode: 'screen', transform: `translate(${-bleedX}px, ${trackingY}px)`, opacity: 0.8 }}>
                <Video
                    src={props.videoUrl}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'sepia(0.4) contrast(1.2) hue-rotate(10deg)' }}
                />
            </AbsoluteFill>
            )}

            {/* Scanlines */}
            {renderBackgroundLayers && props.showScanlines && (
                <AbsoluteFill style={{
                    background: `repeating-linear-gradient(
                        0deg,
                        transparent,
                        transparent 2px,
                        #000000 3px,
                        #000000 4px
                    )`,
                    opacity: 0.2,
                    pointerEvents: 'none',
                    zIndex: 10,
                }} />
            )}

            {/* Tracking Bar (White Noise Line) */}
            {renderBackgroundLayers && props.showTracking && frame % 120 < 10 && (
                <div style={{
                    position: 'absolute',
                    top: `${interpolate(frame % 120, [0, 10], [10, 100])}%`,
                    left: 0,
                    width: '100%',
                    height: 50,
                    background: 'rgba(255,255,255,0.2)',
                    backdropFilter: 'blur(4px) invert(0.8)',
                    transform: 'translateY(-50%)',
                    zIndex: 20,
                }} />
            )}

            {/* OSD (On Screen Display) */}
            <AbsoluteFill style={{ zIndex: 30, padding: isPortrait ? 56 : 80, fontFamily: interFont }}>
                {/* Play Indicator */}
                <div style={{ position: 'absolute', top: isPortrait ? 56 : 80, left: isPortrait ? 56 : 80, display: 'flex', alignItems: 'center', gap: 24 }}>
                    <div style={{ fontSize: isPortrait ? 52 : 64, color: '#fff', textShadow: '2px 2px 0px #000' }}>▶ PLAY</div>
                    {frame % 60 < 30 && <div style={{ fontSize: isPortrait ? 52 : 64, color: '#fff', textShadow: '2px 2px 0px #000' }}>SP</div>}
                </div>

                {/* Date/Time */}
                {props.showDate && (
                    <div style={{ position: 'absolute', bottom: isPortrait ? 56 : 80, right: isPortrait ? 56 : 80, textAlign: 'right' }}>
                        <div style={{ fontSize: isPortrait ? 52 : 64, color: '#fff', textShadow: '2px 2px 0px #000', marginBottom: 8 }}>{props.date}</div>
                        <div style={{ fontSize: isPortrait ? 52 : 64, color: '#fff', textShadow: '2px 2px 0px #000' }}>{props.time}</div>
                    </div>
                )}

                {/* Center Title */}
                <AbsoluteFill style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <EditableText
                        text={props.title}
                        fontSize={isPortrait ? 112 : 172}
                        fontFamily={interFont}
                        color={COLORS.textPrimary}
                        style={{
                            textShadow: '4px 4px 0px #0000ff',
                            filter: 'blur(0.5px)',
                            opacity: interpolate(frame, [0, 30], [0, 0.8]),
                        }}
                    />
                </AbsoluteFill>
            </AbsoluteFill>

            {/* Vignette */}
            {renderBackgroundLayers && (
            <AbsoluteFill style={{
                background: 'radial-gradient(circle, transparent 60%, black 100%)',
                opacity: 0.6,
                zIndex: 40,
                pointerEvents: 'none',
            }} />
            )}
        </AbsoluteFill>
    );
};

// ─── Register ────────────────────────────────────────────────
registerTemplate({
    id: 'company-history-01',
    name: 'Company History Archive',
    category: 'startup-showcase',
    description: 'Nostalgic archive style for showcasing company history and milestones.',
    tags: ['history', 'timeline', 'archive', 'startup', 'journey'],
    component: CompanyHistory01,
    schema: companyHistorySchema,
    defaultProps: companyHistorySchema.parse({}),
    durationInFrames: DEFAULT_DURATION_FRAMES,
    fps: DEFAULT_FPS,
});
