import React from 'react';
import {
    AbsoluteFill,
    useCurrentFrame,
    useVideoConfig,
    interpolate,
    spring,
    Img,
} from 'remotion';
import { z } from 'zod';
import { useIsPortrait, useScaleFactor } from '../../lib/responsive';
import { EditableText } from '../../components/EditableText';
import { registerTemplate } from '../registry';
import { interFont, montserratFont } from '../../lib/fonts';

export const historyMilestonesSchema = z.object({
    title: z.string().default('Our Journey'),
    milestones: z.array(z.object({
        year: z.string(),
        title: z.string(),
        imageUrl: z.string(),
    })).default([
        { year: '2018', title: 'The Idea Born', imageUrl: 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=800' },
        { year: '2020', title: 'First Office', imageUrl: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800' },
        { year: '2022', title: 'Series A Funding', imageUrl: 'https://images.unsplash.com/photo-1556761175-5973dc0f32d7?w=800' },
        { year: '2024', title: 'Global Expansion', imageUrl: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800' },
    ]),
    backgroundColor: z.string().default('#0f172a'),
    textColor: z.string().default('#ffffff'),
    accentColor: z.string().default('#f43f5e'),
});

type Props = z.infer<typeof historyMilestonesSchema>;

export const HistoryMilestones: React.FC<Props> = ({
    title,
    milestones,
    backgroundColor,
    textColor,
    accentColor,
}) => {
    const frame = useCurrentFrame();
    const { fps, width, height } = useVideoConfig();
    const scale = useScaleFactor();
    const isPortrait = useIsPortrait();

    const titleY = spring({ frame, fps, config: { damping: 12 } });
    const titleOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

    // Cinematic zoom through logic
    // We allocate 60 frames per milestone
    const framesPerMilestone = 60;
    const currentMilestoneIndex = Math.min(
        Math.floor(frame / framesPerMilestone),
        milestones.length - 1
    );
    const progressInMilestone = (frame % framesPerMilestone) / framesPerMilestone;
    
    // We will render all milestones in 3D Z-space
    // The "camera" moves forward on the Z axis

    return (
        <AbsoluteFill style={{ backgroundColor, fontFamily: interFont, color: textColor, perspective: '1500px', overflow: 'hidden' }}>
            {/* Header stays static on screen */}
            <div style={{
                position: 'absolute',
                top: isPortrait ? 100 * scale : 80 * scale,
                left: 0,
                width: '100%',
                textAlign: 'center',
                transform: `translateY(${(1 - titleY) * -30}px)`,
                opacity: titleOpacity,
                zIndex: 100,
            }}>
                <EditableText
                    text={title}
                    style={{
                        fontFamily: montserratFont,
                        fontWeight: 800,
                        fontSize: (isPortrait ? 60 : 72) * scale,
                        margin: 0,
                        letterSpacing: '-0.02em',
                        textShadow: '0 4px 20px rgba(0,0,0,0.8)',
                    }}
                />
            </div>

            {/* 3D Scene */}
            <div style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                transformStyle: 'preserve-3d',
                // Move the entire scene forward over time
                // Each milestone is spaced 1000px apart on the Z axis
                transform: `translateZ(${frame * (1000 / framesPerMilestone)}px)`,
            }}>
                {milestones.map((m, i) => {
                    const zPosition = -(i * 1000); // 0, -1000, -2000, etc.
                    
                    // Alternating left/right positioning
                    const isLeft = i % 2 === 0;
                    const xOffset = isPortrait ? 0 : (isLeft ? -300 * scale : 300 * scale);
                    const yOffset = isPortrait ? (isLeft ? -150 * scale : 150 * scale) : 0;
                    
                    // The camera passes this item when `frame * (1000/framesPerMilestone)` > `-zPosition`
                    // At that point, the item is behind the camera (Z > 0)
                    const isPassed = (frame * (1000 / framesPerMilestone)) > (i * 1000);
                    
                    return (
                        <div key={i} style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: `translate(-50%, -50%) translate3d(${xOffset}px, ${yOffset}px, ${zPosition}px)`,
                            width: isPortrait ? 600 * scale : 800 * scale,
                            height: isPortrait ? 400 * scale : 500 * scale,
                            borderRadius: 24 * scale,
                            overflow: 'hidden',
                            boxShadow: `0 30px 60px rgba(0,0,0,0.5)`,
                            border: `2px solid ${accentColor}40`,
                            // Fade out quickly as camera passes through it
                            opacity: isPassed ? 0 : 1,
                            transition: 'opacity 0.1s',
                        }}>
                            {/* Background Image */}
                            <Img src={m.imageUrl} style={{
                                width: '100%', height: '100%', objectFit: 'cover',
                                filter: 'brightness(0.6)',
                            }} />
                            
                            {/* Text Overlay */}
                            <div style={{
                                position: 'absolute',
                                bottom: 0, left: 0, right: 0,
                                background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)',
                                padding: 40 * scale,
                            }}>
                                <div style={{
                                    fontSize: 80 * scale,
                                    fontWeight: 900,
                                    fontFamily: montserratFont,
                                    color: accentColor,
                                    lineHeight: 1,
                                    marginBottom: 10 * scale,
                                }}>
                                    {m.year}
                                </div>
                                <div style={{
                                    fontSize: 36 * scale,
                                    fontWeight: 700,
                                    color: '#fff',
                                }}>
                                    {m.title}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
            
            {/* Vignette */}
            <div style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                boxShadow: 'inset 0 0 150px rgba(0,0,0,0.8)',
                pointerEvents: 'none',
                zIndex: 50,
            }} />
        </AbsoluteFill>
    );
};

registerTemplate({
    id: 'history-milestones-01',
    name: '3D History Timeline',
    description: 'A cinematic 3D zoom-through of historical company milestones with background imagery.',
    category: 'dynamic-timelines',
    durationInFrames: 300, // Will vary based on number of items in real usage, we assume 5 items * 60 frames = 300
    fps: 30,
    component: HistoryMilestones,
    schema: historyMilestonesSchema,
    defaultProps: historyMilestonesSchema.parse({}),
});
