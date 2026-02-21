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

export const marketingFlywheelSchema = z.object({
    title: z.string().default('The Marketing Flywheel'),
    segments: z.array(z.object({
        label: z.string(),
        color: z.string(),
        icon: z.string(),
    backgroundColor: z.string().default(COLORS.bg),
    })).default([
        { label: 'Attract', color: '#ef4444', icon: '🧲' },
        { label: 'Engage', color: '#eab308', icon: '🤝' },
        { label: 'Delight', color: '#22c55e', icon: '✨' },
    ]),
    backgroundColor: z.string().default('#ffffff'),
    textColor: z.string().default('#0f172a'),
    centerText: z.string().default('Growth'),
});

type Props = z.infer<typeof marketingFlywheelSchema>;

export const FlywheelModel: React.FC<Props> = ({
    title,
    segments,
    backgroundColor,
    textColor,
    centerText,
}) => {
    const frame = useCurrentFrame();
    const { fps, width, height } = useVideoConfig();
    
    const scale = useScaleFactor();
    const backgroundControls = useResolvedBackgroundControls();
    const isPortrait = useIsPortrait();

    const titleY = spring({ frame, fps, config: { damping: 12 } });
    const titleOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

    // Math for drawing circle segments
    const totalSegments = Math.max(1, segments.length);
    const anglePerSegment = 360 / totalSegments;
    const radius = isPortrait ? width * 0.35 : height * 0.3;
    
    // Constant rotation animation
    const rotation = interpolate(frame, [0, 300], [0, 360], { extrapolateRight: 'extend' });

    return (
        <AbsoluteFill style={{ background: resolveCanvasBackground(backgroundColor, backgroundControls), fontFamily: interFont, color: textColor }}>
            {/* Header */}
            <div style={{
                position: 'absolute',
                top: isPortrait ? 100 * scale : 80 * scale,
                left: 0,
                width: '100%',
                textAlign: 'center',
                transform: `translateY(${(1 - titleY) * -50}px)`,
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

            {/* Flywheel Container */}
            <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                width: radius * 2,
                height: radius * 2,
                transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
                borderRadius: '50%',
                boxShadow: '0 20px 50px rgba(0,0,0,0.1)',
                border: `${8 * scale}px solid #fff`,
                overflow: 'hidden',
            }}>
                {segments.map((seg, i) => {
                    // Start angle and end angle for the conic-gradient hack
                    const startAngle = i * anglePerSegment;
                    const endAngle = (i + 1) * anglePerSegment;
                    
                    // We draw slices using conic gradients
                    // Wait until frame 15 to pop them in
                    const delay = 15 + i * 10;
                    const pop = spring({ frame: frame - delay, fps, config: { damping: 14 } });

                    return (
                        <div key={i} style={{
                            position: 'absolute',
                            top: 0, left: 0, right: 0, bottom: 0,
                            background: seg.color,
                            // Use clip-path to make slices
                            clipPath: totalSegments > 1 
                                ? `polygon(50% 50%, ${50 + 50 * Math.cos((startAngle - 90) * Math.PI / 180)}% ${50 + 50 * Math.sin((startAngle - 90) * Math.PI / 180)}%, ${50 + 50 * Math.cos((endAngle - 90) * Math.PI / 180)}% ${50 + 50 * Math.sin((endAngle - 90) * Math.PI / 180)}%)`
                                : 'none',
                            transform: `scale(${pop})`,
                            transformOrigin: '50% 50%',
                            opacity: pop,
                        }} />
                    );
                })}

                {/* Inner Hole (Donut) */}
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: `translate(-50%, -50%)`,
                    width: radius * 0.9,
                    height: radius * 0.9,
                    backgroundColor: '#fff',
                    borderRadius: '50%',
                    boxShadow: 'inset 0 10px 20px rgba(0,0,0,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10,
                }}>
                    {/* Counter-rotate the center text so it stays upright */}
                    <div style={{
                        transform: `rotate(${-rotation}deg)`,
                        fontSize: 48 * scale,
                        fontWeight: 900,
                        fontFamily: interFont,
                        color: textColor,
                    }}>
                        {centerText}
                    </div>
                </div>
            </div>

            {/* Labels outside the wheel */}
            {segments.map((seg, i) => {
                const midAngle = (i + 0.5) * anglePerSegment;
                // Add rotation offset to find actual screen position
                const actualAngle = midAngle + rotation;
                const rad = (actualAngle - 90) * Math.PI / 180;
                
                const labelRadius = radius + 80 * scale;
                const x = Math.cos(rad) * labelRadius;
                const y = Math.sin(rad) * labelRadius;

                const delay = 30 + i * 10;
                const op = interpolate(frame - delay, [0, 10], [0, 1], { extrapolateRight: 'clamp' });

                return (
                    <div key={i} style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12 * scale,
                        opacity: op,
                        backgroundColor: '#fff',
                        padding: `${12 * scale}px ${24 * scale}px`,
                        borderRadius: 30 * scale,
                        boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
                        border: `2px solid ${seg.color}`,
                    }}>
                        <span style={{ fontSize: 32 * scale }}>{seg.icon}</span>
                        <span style={{ 
                            fontSize: 24 * scale, 
                            fontWeight: 800, 
                            color: seg.color,
                            fontFamily: interFont,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                        }}>
                            {seg.label}
                        </span>
                    </div>
                );
            })}
        </AbsoluteFill>
    );
};

registerTemplate({
    tags: [],
    id: 'flywheel-model-01',
    name: 'Dynamic Marketing Flywheel',
    description: 'An animated circular flywheel that divides itself into slices based on the segments array and rotates continuously.',
    category: 'business-marketing',
    durationInFrames: 240,
    fps: 30,
    component: FlywheelModel,
    schema: marketingFlywheelSchema,
    defaultProps: marketingFlywheelSchema.parse({}),
});
