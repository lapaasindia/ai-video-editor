import React from 'react';
import {
    AbsoluteFill,
    useCurrentFrame,
    interpolate,
} from 'remotion';
import { z } from 'zod';
import { useIsPortrait, useResponsive } from '../../lib/responsive';
import { fadeIn, slideIn } from '../../lib/animations';
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
export const caseStudyBeforeAfterSchema = z.object({
    companyName: z.string().default('BrightPath'),
    headline: z.string().default('Digital Transformation Results'),
    beforeTitle: z.string().default('BEFORE'),
    beforeItems: z.string().default('Manual processes\nSlow customer response\nHigh operational costs\nLimited reach'),
    afterTitle: z.string().default('AFTER'),
    afterItems: z.string().default('Fully automated workflows\n<2hr response time\n60% cost reduction\nGlobal market presence'),
    imageUrl: z.string().default('https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800'),
    primaryColor: z.string().default(COLORS.accent),
    successColor: z.string().default('#00E676'),
    backgroundColor: z.string().default(COLORS.bg),
});

type Props = z.infer<typeof caseStudyBeforeAfterSchema>;

// ─── Component ───────────────────────────────────────────────
export const CaseStudyBeforeAfter01: React.FC<Props> = (props) => {
    const frame = useCurrentFrame();
    const isPortrait = useIsPortrait();
    const scale = useResponsive(1, 1);
    const backgroundControls = useResolvedBackgroundControls();

    const beforeItems = props.beforeItems.split('\n').filter(Boolean);
    const afterItems = props.afterItems.split('\n').filter(Boolean);

    const dividerProgress = interpolate(frame, [60, 90], [0, 1], {
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
            {/* Header */}
            <div
                style={{
                    position: 'absolute',
                    top: isPortrait ? 40 : 50,
                    left: 0,
                    right: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 24,
                    opacity: fadeIn(frame, 0),
                    transform: slideIn(frame, 'down', 0, 20),
                    zIndex: 2,
                }}
            >
                <EditableText
                    text={props.companyName}
                    fontSize={40 * scale}
                    fontFamily={interFont}
                    color={COLORS.accent}
                    fontWeight={600}
                    textTransform="uppercase"
                    letterSpacing={4}
                />
                <EditableText
                    text={props.headline}
                    fontSize={isPortrait ? 84 : 112}
                    fontFamily={interFont}
                    color={COLORS.textPrimary}
                    fontWeight={800}
                    textAlign="center"
                    letterSpacing={-1}
                    style={{ padding: '0 40px' }}
                />
            </div>

            {/* Before / After panels */}
            <div
                style={{
                    position: 'absolute',
                    top: isPortrait ? 260 : 170,
                    bottom: isPortrait ? 70 : 50,
                    left: isPortrait ? 80 : 80,
                    right: isPortrait ? 80 : 80,
                    display: 'flex',
                    flexDirection: isPortrait ? 'column' : 'row',
                    justifyContent: isPortrait ? 'center' : 'flex-start',
                    gap: isPortrait ? 60 : 80,
                }}
            >
                {/* BEFORE panel */}
                <div
                    style={{
                        flex: isPortrait ? undefined : 1,
                        display: 'flex',
                        flexDirection: 'column',
                        padding: 64 * scale,
                        borderRadius: 40,
                        background: `${props.primaryColor}0a`,
                        border: `2px solid ${props.primaryColor}33`,
                        opacity: fadeIn(frame, 15),
                        transform: slideIn(frame, 'left', 15, 40),
                    }}
                >
                    <EditableText
                        text={props.beforeTitle}
                        fontSize={isPortrait ? 64 : 52 * scale}
                        fontFamily={interFont}
                        color={COLORS.accent}
                        fontWeight={800}
                        letterSpacing={4}
                        style={{ marginBottom: 40 }}
                    />
                    {beforeItems.map((item, i) => (
                        <div
                            key={i}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 24,
                                marginBottom: 28,
                                opacity: fadeIn(frame, 30 + i * 6),
                            }}
                        >
                            <div
                                style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: '50%',
                                    background: COLORS.accent,
                                    flexShrink: 0,
                                }}
                            />
                            <EditableText
                                text={item}
                                fontSize={isPortrait ? 48 : 40 * scale}
                                fontFamily={interFont}
                                color={COLORS.textSecondary}
                                fontWeight={400}
                            />
                        </div>
                    ))}
                </div>

                {/* Divider arrow */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: isPortrait ? 'flex-end' : 'center',
                        opacity: dividerProgress,
                        transform: `scale(${dividerProgress})`,
                    }}
                >
                    <div
                        style={{
                            width: isPortrait ? 50 : 60,
                            height: isPortrait ? 50 : 60,
                            borderRadius: '50%',
                            background: GRADIENTS.bgMain,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 56,
                            boxShadow: `0 0 30px ${props.successColor}44`,
                        }}
                    >
                        {isPortrait ? '↓' : '→'}
                    </div>
                </div>

                {/* AFTER panel */}
                <div
                    style={{
                        flex: isPortrait ? undefined : 1,
                        display: 'flex',
                        flexDirection: 'column',
                        padding: 64 * scale,
                        borderRadius: 40,
                        background: `${props.successColor}0a`,
                        border: `2px solid ${props.successColor}33`,
                        opacity: fadeIn(frame, 60),
                        transform: slideIn(frame, 'right', 60, 40),
                    }}
                >
                    <EditableText
                        text={props.afterTitle}
                        fontSize={isPortrait ? 64 : 52 * scale}
                        fontFamily={interFont}
                        color={COLORS.accent}
                        fontWeight={800}
                        letterSpacing={4}
                        style={{ marginBottom: 40 }}
                    />
                    {afterItems.map((item, i) => (
                        <div
                            key={i}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 24,
                                marginBottom: 28,
                                opacity: fadeIn(frame, 75 + i * 6),
                            }}
                        >
                            <div
                                style={{
                                    width: 20,
                                    height: 20,
                                    borderRadius: '50%',
                                    background: `${props.successColor}33`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 24,
                                    color: props.successColor,
                                    flexShrink: 0,
                                }}
                            >
                                ✓
                            </div>
                            <EditableText
                                text={item}
                                fontSize={isPortrait ? 48 : 40 * scale}
                                fontFamily={interFont}
                                color={COLORS.textSecondary}
                                fontWeight={400}
                            />
                        </div>
                    ))}
                </div>
            </div>
        </AbsoluteFill>
    );
};

// ─── Register ────────────────────────────────────────────────
registerTemplate({
    id: 'case-study-before-after-01',
    name: 'Case Study Before & After',
    category: 'case-study',
    description: 'Side-by-side comparison with animated reveal showing transformation results',
    tags: ['before-after', 'comparison', 'transformation', 'case-study'],
    component: CaseStudyBeforeAfter01,
    schema: caseStudyBeforeAfterSchema,
    defaultProps: caseStudyBeforeAfterSchema.parse({}),
    durationInFrames: DEFAULT_DURATION_FRAMES,
    fps: DEFAULT_FPS,
});
