import React from 'react';
import {
    AbsoluteFill,
    useCurrentFrame,
    useVideoConfig,
    interpolate,
    spring,
} from 'remotion';
import { z } from 'zod';
import { useIsPortrait, useScaleFactor } from '../../lib/responsive';
import { EditableText } from '../../components/EditableText';
import { registerTemplate } from '../registry';
import { COLORS } from '../../lib/theme';
import {
    resolveCanvasBackground,
    useResolvedBackgroundControls,
} from '../../lib/background';
import { interFont } from '../../lib/fonts';

export const splitScreenMetricsSchema = z.object({
    leftTitle: z.string().default('Industry Avg'),
    rightTitle: z.string().default('With Our App'),
    leftMetric: z.string().default('14 days'),
    rightMetric: z.string().default('2 hours'),
    leftSub: z.string().default('Time to value'),
    rightSub: z.string().default('Time to value'),
    backgroundColor: z.string().default(COLORS.bg),
    textColor: z.string().default(COLORS.textPrimary),
    leftColor: z.string().default('#ef4444'),
    rightColor: z.string().default('#10b981'),
});

type Props = z.infer<typeof splitScreenMetricsSchema>;

export const SplitScreenMetrics: React.FC<Props> = ({
    leftTitle,
    rightTitle,
    leftMetric,
    rightMetric,
    leftSub,
    rightSub,
    backgroundColor,
    textColor,
    leftColor,
    rightColor,
}) => {
    const frame = useCurrentFrame();
    const { fps, width, height } = useVideoConfig();
    
    const scale = useScaleFactor();
    const backgroundControls = useResolvedBackgroundControls();
    const isPortrait = useIsPortrait();

    const popL = spring({ frame: frame - 15, fps, config: { damping: 14, mass: 1.2 } });
    const popR = spring({ frame: frame - 30, fps, config: { damping: 14, mass: 1.2 } });

    // Divide screen in half
    const halfWidth = width / 2;
    const halfHeight = height / 2;

    return (
        <AbsoluteFill style={{ background: resolveCanvasBackground(backgroundColor, backgroundControls), fontFamily: interFont, color: textColor }}>
            {isPortrait ? (
                // Top / Bottom Split
                <>
                    <div style={{
                        position: 'absolute', top: 0, left: 0, right: 0, height: halfHeight,
                        backgroundColor: `${leftColor}10`,
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        borderBottom: `2px solid ${leftColor}40`,
                        transform: `translateY(${(1 - popL) * -50}px)`,
                        opacity: popL,
                    }}>
                        <div style={{ fontSize: 28 * scale, fontWeight: 700, color: leftColor, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 20 * scale }}>
                            {leftTitle}
                        </div>
                        <EditableText text={leftMetric} style={{ fontFamily: interFont, fontWeight: 900, fontSize: 80 * scale, margin: 0, color: '#fff', textShadow: `0 4px 20px ${leftColor}40` }} />
                        <div style={{ fontSize: 24 * scale, color: COLORS.textSecondary, marginTop: 10 * scale }}>{leftSub}</div>
                    </div>
                    
                    <div style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0, height: halfHeight,
                        backgroundColor: `${rightColor}20`,
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        transform: `translateY(${(1 - popR) * 50}px)`,
                        opacity: popR,
                    }}>
                        <div style={{ fontSize: 28 * scale, fontWeight: 700, color: rightColor, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 20 * scale }}>
                            {rightTitle}
                        </div>
                        <EditableText text={rightMetric} style={{ fontFamily: interFont, fontWeight: 900, fontSize: 100 * scale, margin: 0, color: '#fff', textShadow: `0 4px 30px ${rightColor}60` }} />
                        <div style={{ fontSize: 24 * scale, color: 'rgba(255,255,255,0.8)', marginTop: 10 * scale }}>{rightSub}</div>
                    </div>
                    
                    {/* VS Badge */}
                    <div style={{
                        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                        width: 80 * scale, height: 80 * scale, borderRadius: '50%', backgroundColor: textColor, color: backgroundColor,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 24 * scale, fontWeight: 900, fontFamily: interFont,
                        boxShadow: '0 10px 30px rgba(0,0,0,0.5)', zIndex: 10,
                        opacity: interpolate(frame - 45, [0, 10], [0, 1], { extrapolateRight: 'clamp' }),
                    }}>
                        VS
                    </div>
                </>
            ) : (
                // Left / Right Split
                <>
                    <div style={{
                        position: 'absolute', top: 0, left: 0, bottom: 0, width: halfWidth,
                        backgroundColor: `${leftColor}10`,
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        borderRight: `2px solid ${leftColor}40`,
                        transform: `translateX(${(1 - popL) * -50}px)`,
                        opacity: popL,
                    }}>
                        <div style={{ fontSize: 32 * scale, fontWeight: 700, color: leftColor, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 30 * scale }}>
                            {leftTitle}
                        </div>
                        <EditableText text={leftMetric} style={{ fontFamily: interFont, fontWeight: 900, fontSize: 100 * scale, margin: 0, color: '#fff', textShadow: `0 4px 20px ${leftColor}40` }} />
                        <div style={{ fontSize: 28 * scale, color: COLORS.textSecondary, marginTop: 16 * scale }}>{leftSub}</div>
                    </div>
                    
                    <div style={{
                        position: 'absolute', top: 0, right: 0, bottom: 0, width: halfWidth,
                        backgroundColor: `${rightColor}20`,
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        transform: `translateX(${(1 - popR) * 50}px)`,
                        opacity: popR,
                    }}>
                        <div style={{ fontSize: 32 * scale, fontWeight: 700, color: rightColor, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 30 * scale }}>
                            {rightTitle}
                        </div>
                        <EditableText text={rightMetric} style={{ fontFamily: interFont, fontWeight: 900, fontSize: 120 * scale, margin: 0, color: '#fff', textShadow: `0 4px 40px ${rightColor}60` }} />
                        <div style={{ fontSize: 28 * scale, color: 'rgba(255,255,255,0.8)', marginTop: 16 * scale }}>{rightSub}</div>
                    </div>

                    {/* VS Badge */}
                    <div style={{
                        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                        width: 100 * scale, height: 100 * scale, borderRadius: '50%', backgroundColor: textColor, color: backgroundColor,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 32 * scale, fontWeight: 900, fontFamily: interFont,
                        boxShadow: '0 10px 40px rgba(0,0,0,0.5)', zIndex: 10,
                        opacity: interpolate(frame - 45, [0, 10], [0, 1], { extrapolateRight: 'clamp' }),
                    }}>
                        VS
                    </div>
                </>
            )}
        </AbsoluteFill>
    );
};

registerTemplate({
    tags: [],
    id: 'split-screen-metrics-01',
    name: 'Split Screen Metric Compare',
    description: 'A bold, split-screen layout comparing a bad metric to a good metric.',
    category: 'data-visualization',
    durationInFrames: 180,
    fps: 30,
    component: SplitScreenMetrics,
    schema: splitScreenMetricsSchema,
    defaultProps: splitScreenMetricsSchema.parse({}),
});
