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

export const stepByStepProcessSchema = z.object({
    title: z.string().default('How It Works'),
    steps: z.array(z.object({
        title: z.string(),
        desc: z.string(),
        icon: z.string(),
    backgroundColor: z.string().default(COLORS.bg),
    })).default([
        { title: 'Create Account', desc: 'Sign up in under 60 seconds. No credit card required.', icon: '📝' },
        { title: 'Connect Data', desc: 'Securely sync your analytics and CRM platforms.', icon: '🔗' },
        { title: 'AI Analysis', desc: 'Our engine identifies hidden revenue opportunities.', icon: '🤖' },
        { title: 'Execute', desc: 'Deploy automated campaigns and watch metrics soar.', icon: '🚀' },
    ]),
    backgroundColor: z.string().default('#f8fafc'),
    textColor: z.string().default('#0f172a'),
    primaryColor: z.string().default('#3b82f6'),
});

type Props = z.infer<typeof stepByStepProcessSchema>;

export const StepByStepProcess: React.FC<Props> = ({
    title,
    steps,
    backgroundColor,
    textColor,
    primaryColor,
}) => {
    const frame = useCurrentFrame();
    const { fps, width, height } = useVideoConfig();
    
    const scale = useScaleFactor();
    const backgroundControls = useResolvedBackgroundControls();
    const isPortrait = useIsPortrait();

    const titleY = spring({ frame, fps, config: { damping: 12 } });
    const titleOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

    const totalSteps = steps.length;
    const paddingX = isPortrait ? 60 * scale : 120 * scale;
    const startY = isPortrait ? height * 0.25 : height * 0.35;
    const availableWidth = width - (paddingX * 2);
    
    // Layout: Horizontal if landscape, Vertical if portrait
    const gap = isPortrait ? 60 * scale : 40 * scale;
    const stepWidth = isPortrait ? availableWidth : (availableWidth - (gap * (totalSteps - 1))) / totalSteps;

    return (
        <AbsoluteFill style={{ background: resolveCanvasBackground(backgroundColor, backgroundControls), fontFamily: interFont, color: textColor }}>
            {/* Header */}
            <div style={{
                position: 'absolute',
                top: isPortrait ? 100 * scale : 100 * scale,
                left: paddingX,
                width: availableWidth,
                textAlign: 'center',
                transform: `translateY(${(1 - titleY) * -30}px)`,
                opacity: titleOpacity,
            }}>
                <EditableText
                    text={title}
                    style={{
                        fontFamily: interFont,
                        fontWeight: 800,
                        fontSize: (isPortrait ? 60 : 72) * scale,
                        margin: 0,
                        letterSpacing: '-0.02em',
                    }}
                />
            </div>

            {/* Connecting Line (drawn dynamically) */}
            <div style={{
                position: 'absolute',
                top: isPortrait ? startY : startY + (40 * scale), // center of icon
                left: isPortrait ? paddingX + (40 * scale) : paddingX + (stepWidth / 2),
                width: isPortrait ? 4 * scale : availableWidth - stepWidth,
                height: isPortrait ? height * 0.6 : 4 * scale,
                backgroundColor: `${primaryColor}30`,
                zIndex: 0,
            }}>
                {/* Animated Fill */}
                <div style={{
                    position: 'absolute',
                    top: 0, left: 0,
                    width: isPortrait ? '100%' : `${interpolate(frame, [20, 20 + (totalSteps * 15)], [0, 100], { extrapolateRight: 'clamp' })}%`,
                    height: isPortrait ? `${interpolate(frame, [20, 20 + (totalSteps * 15)], [0, 100], { extrapolateRight: 'clamp' })}%` : '100%',
                    backgroundColor: primaryColor,
                    boxShadow: `0 0 10px ${primaryColor}`,
                }} />
            </div>

            {/* Steps Container */}
            <div style={{
                position: 'absolute',
                top: startY,
                left: paddingX,
                width: availableWidth,
                display: 'flex',
                flexDirection: isPortrait ? 'column' : 'row',
                justifyContent: 'space-between',
                alignItems: isPortrait ? 'flex-start' : 'flex-start',
                gap: gap,
                zIndex: 1,
            }}>
                {steps.map((step, i) => {
                    const delay = 20 + i * 15;
                    const pop = spring({ frame: frame - delay, fps, config: { damping: 12, mass: 1.2 } });
                    const op = interpolate(frame - delay, [0, 10], [0, 1], { extrapolateRight: 'clamp' });

                    return (
                        <div key={i} style={{
                            width: isPortrait ? '100%' : stepWidth,
                            display: 'flex',
                            flexDirection: isPortrait ? 'row' : 'column',
                            alignItems: isPortrait ? 'flex-start' : 'center',
                            textAlign: isPortrait ? 'left' : 'center',
                            gap: 20 * scale,
                            opacity: op,
                        }}>
                            {/* Icon/Number Badge */}
                            <div style={{
                                width: 80 * scale,
                                height: 80 * scale,
                                borderRadius: '50%',
                                backgroundColor: '#fff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 32 * scale,
                                transform: `scale(${pop})`,
                                boxShadow: `0 10px 20px ${primaryColor}40`,
                                border: `4px solid ${primaryColor}`,
                                flexShrink: 0,
                                position: 'relative',
                            }}>
                                {step.icon}
                                {/* Step Number Badge */}
                                <div style={{
                                    position: 'absolute',
                                    top: -10 * scale,
                                    right: -10 * scale,
                                    width: 32 * scale,
                                    height: 32 * scale,
                                    backgroundColor: textColor,
                                    color: backgroundColor,
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 16 * scale,
                                    fontWeight: 800,
                                    fontFamily: interFont,
                                }}>
                                    {i + 1}
                                </div>
                            </div>
                            
                            {/* Text Content */}
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 10 * scale,
                                transform: `translateY(${(1 - pop) * 20}px)`,
                                marginTop: isPortrait ? 10 * scale : 0,
                            }}>
                                <div style={{
                                    fontSize: 24 * scale,
                                    fontWeight: 800,
                                    fontFamily: interFont,
                                    color: textColor,
                                }}>
                                    {step.title}
                                </div>
                                <div style={{
                                    fontSize: 18 * scale,
                                    color: '#64748b',
                                    lineHeight: 1.5,
                                }}>
                                    {step.desc}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </AbsoluteFill>
    );
};

registerTemplate({
    tags: [],
    id: 'step-by-step-process-01',
    name: 'Dynamic Step-by-Step Process',
    description: 'A connected roadmap showing N steps in a process. Draws lines between nodes automatically.',
    category: 'business-marketing',
    durationInFrames: 180,
    fps: 30,
    component: StepByStepProcess,
    schema: stepByStepProcessSchema,
    defaultProps: stepByStepProcessSchema.parse({}),
});
