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
import { interFont, montserratFont } from '../../lib/fonts';

export const sprintProgressBarSchema = z.object({
    title: z.string().default('Q4 Product Roadmap'),
    sprints: z.array(z.object({
        name: z.string(),
        status: z.enum(['done', 'active', 'pending']),
    })).default([
        { name: 'User Auth', status: 'done' },
        { name: 'Dashboard UI', status: 'done' },
        { name: 'Stripe Integration', status: 'active' },
        { name: 'Analytics Beta', status: 'pending' },
        { name: 'Public Launch', status: 'pending' },
    ]),
    backgroundColor: z.string().default('#0f172a'),
    textColor: z.string().default('#ffffff'),
    doneColor: z.string().default('#10b981'), // Green
    activeColor: z.string().default('#3b82f6'), // Blue
    pendingColor: z.string().default('rgba(255,255,255,0.1)'), // Gray
});

type Props = z.infer<typeof sprintProgressBarSchema>;

export const SprintProgressBar: React.FC<Props> = ({
    title,
    sprints,
    backgroundColor,
    textColor,
    doneColor,
    activeColor,
    pendingColor,
}) => {
    const frame = useCurrentFrame();
    const { fps, width, height } = useVideoConfig();
    const scale = useScaleFactor();
    const isPortrait = useIsPortrait();

    const titleY = spring({ frame, fps, config: { damping: 12 } });
    const titleOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

    const totalSprints = sprints.length;
    const paddingX = isPortrait ? 60 * scale : 120 * scale;
    const availableWidth = width - (paddingX * 2);
    
    // Layout
    const startY = height * 0.5;
    const segmentWidth = availableWidth / totalSprints;

    // We calculate "overall progress" based on the last 'done' or 'active' item
    let targetProgressIndex = 0;
    for (let i = 0; i < sprints.length; i++) {
        if (sprints[i].status === 'done') targetProgressIndex = i + 1;
        if (sprints[i].status === 'active') {
            targetProgressIndex = i + 0.5; // active sits half way in its segment
            break;
        }
    }
    const targetFillWidth = (targetProgressIndex / totalSprints) * availableWidth;
    
    // Animate the fill bar
    const fillProgress = spring({ frame: frame - 20, fps, config: { damping: 20, mass: 1.5 } });
    const currentFillWidth = fillProgress * targetFillWidth;

    return (
        <AbsoluteFill style={{ backgroundColor, fontFamily: interFont, color: textColor }}>
            {/* Header */}
            <div style={{
                position: 'absolute',
                top: isPortrait ? 150 * scale : 150 * scale,
                left: paddingX,
                width: availableWidth,
                textAlign: 'center',
                transform: `translateY(${(1 - titleY) * -30}px)`,
                opacity: titleOpacity,
            }}>
                <EditableText
                    text={title}
                    style={{
                        fontFamily: montserratFont,
                        fontWeight: 800,
                        fontSize: (isPortrait ? 60 : 72) * scale,
                        margin: 0,
                        letterSpacing: '-0.02em',
                    }}
                />
            </div>

            {/* Progress Bar Container */}
            <div style={{
                position: 'absolute',
                top: startY,
                left: paddingX,
                width: availableWidth,
                height: 16 * scale,
                backgroundColor: pendingColor,
                borderRadius: 8 * scale,
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)',
            }}>
                {/* Active Fill Layer */}
                <div style={{
                    position: 'absolute',
                    top: 0, left: 0, bottom: 0,
                    width: currentFillWidth,
                    backgroundColor: activeColor, // default to active blue for the moving part
                    borderRadius: 8 * scale,
                    boxShadow: `0 0 20px ${activeColor}80`,
                }} />
                
                {/* Done Fill Overlay (turns green up to the last 'done' segment) */}
                <div style={{
                    position: 'absolute',
                    top: 0, left: 0, bottom: 0,
                    width: Math.min(currentFillWidth, (Math.floor(targetProgressIndex) / totalSprints) * availableWidth),
                    backgroundColor: doneColor,
                    borderRadius: 8 * scale,
                    boxShadow: `0 0 20px ${doneColor}80`,
                    transition: 'width 0.1s', // snap to green as the blue bar passes
                }} />

                {/* Nodes / Checkpoints */}
                {sprints.map((sprint, i) => {
                    // Position is center of segment
                    const nodeX = (i + 0.5) * segmentWidth;
                    
                    // Has the animated line reached this node yet?
                    const hasReached = currentFillWidth >= nodeX;
                    const pop = spring({ frame: frame - (20 + i * 5), fps, config: { damping: 10 } }); // labels pop in sequence
                    
                    let nodeColor = pendingColor;
                    if (hasReached) {
                        nodeColor = sprint.status === 'done' ? doneColor : (sprint.status === 'active' ? activeColor : pendingColor);
                    }

                    return (
                        <React.Fragment key={i}>
                            {/* Checkpoint Dot */}
                            <div style={{
                                position: 'absolute',
                                top: '50%',
                                left: nodeX,
                                width: 32 * scale,
                                height: 32 * scale,
                                backgroundColor: backgroundColor,
                                border: `${6 * scale}px solid ${nodeColor}`,
                                borderRadius: '50%',
                                transform: 'translate(-50%, -50%)',
                                zIndex: 10,
                                transition: 'all 0.2s',
                                boxShadow: hasReached && sprint.status !== 'pending' ? `0 0 15px ${nodeColor}` : 'none',
                            }} />

                            {/* Label */}
                            <div style={{
                                position: 'absolute',
                                top: isPortrait && i % 2 !== 0 ? -80 * scale : 40 * scale, // Stagger up/down in portrait
                                left: nodeX,
                                width: segmentWidth * 0.9,
                                textAlign: 'center',
                                transform: `translateX(-50%) scale(${pop})`,
                                opacity: pop,
                            }}>
                                <div style={{ 
                                    fontSize: 18 * scale, 
                                    fontWeight: 700, 
                                    fontFamily: montserratFont,
                                    color: hasReached && sprint.status !== 'pending' ? '#fff' : 'rgba(255,255,255,0.4)',
                                    transition: 'color 0.2s',
                                }}>
                                    {sprint.name}
                                </div>
                                <div style={{ 
                                    fontSize: 14 * scale, 
                                    fontWeight: 800, 
                                    textTransform: 'uppercase',
                                    color: nodeColor,
                                    marginTop: 4 * scale,
                                    opacity: hasReached ? 1 : 0,
                                    transition: 'opacity 0.2s',
                                }}>
                                    {sprint.status}
                                </div>
                            </div>
                        </React.Fragment>
                    );
                })}
            </div>
        </AbsoluteFill>
    );
};

registerTemplate({
    id: 'sprint-progress-bar-01',
    name: 'Dynamic Sprint Roadmap',
    description: 'A horizontal progress bar that fills up to indicate completed vs active milestones.',
    category: 'dynamic-timelines',
    durationInFrames: 180,
    fps: 30,
    component: SprintProgressBar,
    schema: sprintProgressBarSchema,
    defaultProps: sprintProgressBarSchema.parse({}),
});
