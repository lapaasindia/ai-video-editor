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
import { fadeIn, slideIn } from '../../lib/animations';
import { EditableText } from '../../components/EditableText';
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
export const caseStudyProblemSolutionSchema = z.object({
    companyName: z.string().default('DataSync Inc.'),
    problemTitle: z.string().default('THE CHALLENGE'),
    problemText: z.string().default('Legacy systems caused 40% data loss during migration, costing $2M annually in manual reconciliation and delayed reporting.'),
    solutionTitle: z.string().default('THE SOLUTION'),
    solutionText: z.string().default('Implemented an AI-powered data pipeline with real-time validation, automated error correction, and self-healing architecture.'),
    resultText: z.string().default('99.97% data accuracy • $1.8M saved annually'),
    primaryColor: z.string().default(COLORS.accent),
    accentColor: z.string().default(COLORS.accentLight),
    backgroundColor: z.string().default(COLORS.bg),
});

type Props = z.infer<typeof caseStudyProblemSolutionSchema>;

// ─── Component ───────────────────────────────────────────────
export const CaseStudyProblemSolution01: React.FC<Props> = (props) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const isPortrait = useIsPortrait();
    const scale = useResponsive(1, 1);
    const backgroundControls = useResolvedBackgroundControls();
    const renderBackgroundLayers = shouldRenderBackgroundLayer(backgroundControls);

    const arrowProgress = spring({
        frame: frame - 80,
        fps,
        config: { damping: 12, stiffness: 100, mass: 0.8 },
    });
    const companyLabelSize = isPortrait ? 34 : 38;
    const panelTitleSize = isPortrait ? 52 : 60;
    const panelBodySize = isPortrait ? 30 : 34;
    const resultTextSize = isPortrait ? 52 : 64;

    return (
        <AbsoluteFill
            style={{
                background: resolveCanvasBackground(COLORS.bg, backgroundControls),
                overflow: 'hidden',
            }}
        >
            {/* Animated background */}
            <AnimatedGradient />
            {/* Background glow effects */}
            {renderBackgroundLayers && (
            <>
            <div
                style={{
                    position: 'absolute',
                    top: isPortrait ? '15%' : '30%',
                    left: '-10%',
                    width: 500,
                    height: 500,
                    borderRadius: '50%',
                    background: `${props.primaryColor}10`,
                    filter: 'blur(120px)',
                }}
            />
            <div
                style={{
                    position: 'absolute',
                    bottom: isPortrait ? '15%' : '20%',
                    right: '-10%',
                    width: 500,
                    height: 500,
                    borderRadius: '50%',
                    background: `${props.accentColor}10`,
                    filter: 'blur(120px)',
                }}
            />
            </>
            )}

            {/* Content */}
            <div
                style={{
                    position: 'relative',
                    zIndex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    width: '100%',
                    height: '100%',
                    justifyContent: 'center',
                    padding: isPortrait ? '120px 60px' : '60px 100px',
                    gap: isPortrait ? 40 : 60,
                }}
            >
                {/* Company header */}
                <div style={{ opacity: fadeIn(frame, 0), transform: slideIn(frame, 'down', 0, 20) }}>
                    <EditableText
                        text={props.companyName}
                        fontSize={companyLabelSize * scale}
                        fontFamily={interFont}
                        color={COLORS.textSecondary}
                        fontWeight={600}
                        textAlign="left"
                        textTransform="uppercase"
                        letterSpacing={4}
                        style={{ textAlign: 'left' }}
                    />
                </div>

                {/* Problem / Solution panels */}
                <div
                    style={{
                        flex: isPortrait ? undefined : 1,
                        display: 'flex',
                        flexDirection: isPortrait ? 'column' : 'row',
                        gap: isPortrait ? 32 : 80,
                        alignItems: 'stretch',
                    }}
                >
                    {/* Problem panel */}
                    <div
                        style={{
                            flex: isPortrait ? undefined : 1,
                            display: 'flex',
                            flexDirection: 'column',
                            padding: isPortrait ? '24px' : '40px',
                            borderRadius: 40,
                            background: `${props.primaryColor}08`,
                            border: `2px solid ${props.primaryColor}25`,
                            opacity: fadeIn(frame, 10),
                            transform: slideIn(frame, 'left', 10, 40),
                            justifyContent: isPortrait ? 'flex-end' : 'center',
                            gap: 32,
                        }}
                    >
                        {/* Icon */}
                        <div
                            style={{
                                width: 48 * scale,
                                height: 48 * scale,
                                borderRadius: 24,
                                background: `${props.primaryColor}20`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 48 * scale,
                            }}
                        >
                            ⚠
                        </div>
                        <EditableText
                            text={props.problemTitle}
                            fontSize={panelTitleSize * scale}
                            fontFamily={interFont}
                            color={COLORS.accent}
                            fontWeight={800}
                            letterSpacing={4}
                        />
                        <EditableText
                            text={props.problemText}
                            fontSize={panelBodySize * scale}
                            fontFamily={interFont}
                            color={COLORS.textSecondary}
                            fontWeight={400}
                            lineHeight={1.6}
                            maxLines={4}
                        />
                    </div>

                    {/* Arrow connector */}
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: arrowProgress,
                            transform: `scale(${arrowProgress})`,
                        }}
                    >
                        <div
                            style={{
                                width: isPortrait ? 44 : 56,
                                height: isPortrait ? 44 : 56,
                                borderRadius: '50%',
                                background: GRADIENTS.bgMain,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 38 * scale,
                                color: '#fff',
                                boxShadow: `0 0 30px ${props.accentColor}44`,
                            }}
                        >
                            {isPortrait ? '↓' : '→'}
                        </div>
                    </div>

                    {/* Solution panel */}
                    <div
                        style={{
                            flex: isPortrait ? undefined : 1,
                            display: 'flex',
                            flexDirection: 'column',
                            padding: isPortrait ? '24px' : '40px',
                            borderRadius: 40,
                            background: `${props.accentColor}08`,
                            border: `2px solid ${props.accentColor}25`,
                            opacity: fadeIn(frame, 50),
                            transform: slideIn(frame, 'right', 50, 40),
                            justifyContent: 'center',
                            gap: 32,
                        }}
                    >
                        <div
                            style={{
                                width: 48 * scale,
                                height: 48 * scale,
                                borderRadius: 24,
                                background: `${props.accentColor}20`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 48 * scale,
                            }}
                        >
                            ✦
                        </div>
                        <EditableText
                            text={props.solutionTitle}
                            fontSize={panelTitleSize * scale}
                            fontFamily={interFont}
                            color={COLORS.accentLight}
                            fontWeight={800}
                            letterSpacing={4}
                        />
                        <EditableText
                            text={props.solutionText}
                            fontSize={panelBodySize * scale}
                            fontFamily={interFont}
                            color={COLORS.textSecondary}
                            fontWeight={400}
                            lineHeight={1.6}
                            maxLines={4}
                        />
                    </div>
                </div>

                {/* Result bar */}
                <div
                    style={{
                        padding: `${16 * scale}px ${32 * scale}px`,
                        borderRadius: 24,
                        background: linearGradient(90, `${props.primaryColor}15`, `${props.accentColor}15`),
                        border: `2px solid ${props.accentColor}33`,
                        textAlign: 'center',
                        opacity: fadeIn(frame, 90),
                        transform: slideIn(frame, 'up', 90, 20),
                    }}
                >
                    <EditableText
                        text={props.resultText}
                        fontSize={resultTextSize * scale}
                        fontFamily={interFont}
                        color={COLORS.textSecondary}
                        fontWeight={700}
                        textAlign="center"
                        letterSpacing={1}
                    />
                </div>
            </div>

            {/* Bottom accent */}
            <div
                style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    width: `${interpolate(frame, [0, 90], [0, 100], { extrapolateRight: 'clamp' })}%`,
                    height: 6,
                    background: GRADIENTS.bgMain,
                }}
            />
        </AbsoluteFill>
    );
};

// ─── Register ────────────────────────────────────────────────
registerTemplate({
    id: 'case-study-problem-solution-01',
    name: 'Case Study Problem → Solution',
    category: 'case-study',
    description: 'Two-panel layout showing challenge vs solution with animated connector arrow',
    tags: ['problem', 'solution', 'challenge', 'case-study'],
    component: CaseStudyProblemSolution01,
    schema: caseStudyProblemSolutionSchema,
    defaultProps: caseStudyProblemSolutionSchema.parse({}),
    durationInFrames: DEFAULT_DURATION_FRAMES,
    fps: DEFAULT_FPS,
});
