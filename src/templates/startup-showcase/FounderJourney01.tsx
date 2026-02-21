import React from 'react';
import {
    AbsoluteFill,
    useCurrentFrame,
    useVideoConfig,
    interpolate,
    Video,
} from 'remotion';
import { z } from 'zod';
import { useIsPortrait } from '../../lib/responsive';
import { fadeIn } from '../../lib/animations';
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
export const founderJourneySchema = z.object({
    title: z.string().default('THE FOUNDER'),
    subtitle: z.string().default('A vision realized'),
    videoUrlBG: z.string().default('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4'),
    videoUrlFG: z.string().default('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'),
    sihouetteUrl: z.string().default('https://remotion.dev/img/silhouette.png'), // Placeholder or use text mask
    primaryColor: z.string().default(COLORS.accent),
    enableGrayscale: z.boolean().default(true),
    showOverlay: z.boolean().default(true),
});

type Props = z.infer<typeof founderJourneySchema>;

// ─── Component ───────────────────────────────────────────────
export const FounderJourney01: React.FC<Props> = (props) => {
    const frame = useCurrentFrame();
    useVideoConfig();
    const isPortrait = useIsPortrait();
    const backgroundControls = useResolvedBackgroundControls();
    const renderBackgroundLayers = shouldRenderBackgroundLayer(backgroundControls);

    const grayscaleFilter = props.enableGrayscale ? 'grayscale(100%) contrast(1.2)' : 'none';

    return (
        <AbsoluteFill
            style={{
                background: resolveCanvasBackground(COLORS.bg, backgroundControls),
                overflow: 'hidden',
            }}
        >
            {/* Animated background */}
            <AnimatedGradient />
            {/* Background Video (Inside Text/Shape) */}
            {renderBackgroundLayers && (
            <AbsoluteFill>
                <Video
                    src={props.videoUrlBG}
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        opacity: 0.4,
                        filter: grayscaleFilter,
                    }}
                />
            </AbsoluteFill>
            )}

            {/* Foreground Video (Blended) */}
            {renderBackgroundLayers && (
            <AbsoluteFill style={{ mixBlendMode: 'screen' }}>
                <Video
                    src={props.videoUrlFG}
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        filter: `${grayscaleFilter} brightness(1.2)`,
                        transform: `scale(${interpolate(frame, [0, 300], [1, 1.2])})`,
                    }}
                />
            </AbsoluteFill>
            )}

            {/* Content Masking / Text */}
            <AbsoluteFill style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 10,
                // Using blend mode to make text "cut out" or "blend"
                mixBlendMode: renderBackgroundLayers ? 'overlay' : 'normal',
            }}>
                <div style={{ transform: `scale(${interpolate(frame, [0, 100], [0.9, 1])})` }}>
                    <EditableText
                        text={props.title}
                        fontSize={isPortrait ? 108 : 178}
                        fontFamily={interFont}
                        color={COLORS.textPrimary} // White text in overlay mode brightens the underlying layers
                        fontWeight={900}
                        letterSpacing={-5}
                        lineHeight={0.8}
                    />
                </div>
            </AbsoluteFill>

            {/* Subtitle (Solid on top) */}
            <AbsoluteFill style={{
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                paddingBottom: 100 * scale,
                flexDirection: 'column',
                zIndex: 20,
            }}>
                <div style={{ opacity: fadeIn(frame, 30) }}>
                    <EditableText
                        text={props.subtitle}
                        fontSize={isPortrait ? 40 : 60}
                        fontFamily={interFont}
                        color={COLORS.accent}
                        fontWeight={400}
                        letterSpacing={10}
                        textTransform="uppercase"
                    />
                </div>
            </AbsoluteFill>

            {/* Light Leak Overlay */}
            {renderBackgroundLayers && props.showOverlay && (
                <AbsoluteFill style={{
                    background: 'linear-gradient(45deg, rgba(255,100,0,0.2) 0%, transparent 70%)',
                    mixBlendMode: 'screen',
                    pointerEvents: 'none',
                    opacity: interpolate(Math.sin(frame * 0.05), [-1, 1], [0.3, 0.6]),
                }} />
            )}
        </AbsoluteFill>
    );
};

// ─── Register ────────────────────────────────────────────────
registerTemplate({
    id: 'founder-journey-01',
    name: 'Founder Journey',
    category: 'startup-showcase',
    description: 'Emotive double exposure effect ideal for telling the personal stories of founders and visionaries.',
    tags: ['founder', 'story', 'vision', 'startup', 'leadership'],
    component: FounderJourney01,
    schema: founderJourneySchema,
    defaultProps: founderJourneySchema.parse({}),
    durationInFrames: DEFAULT_DURATION_FRAMES,
    fps: DEFAULT_FPS,
});
