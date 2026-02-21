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
import { COLORS } from '../../lib/theme';
import {
    resolveCanvasBackground,
    useResolvedBackgroundControls,
} from '../../lib/background';
import { interFont } from '../../lib/fonts';

export const techStackOrbitSchema = z.object({
    title: z.string().default('Integrates With Everything'),
    centerLogoUrl: z.string().default('https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg'),
    orbitLogos: z.array(z.string()).default([
        'https://upload.wikimedia.org/wikipedia/commons/2/2f/Google_2015_logo.svg',
        'https://upload.wikimedia.org/wikipedia/commons/e/e8/Tesla_logo.png',
        'https://upload.wikimedia.org/wikipedia/commons/0/08/Netflix_2015_logo.svg',
        'https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg',
        'https://upload.wikimedia.org/wikipedia/commons/4/44/Microsoft_logo.svg',
        'https://upload.wikimedia.org/wikipedia/commons/b/b8/YouTube_Logo_2017.svg',
    ]),
    backgroundColor: z.string().default(COLORS.bg),
    textColor: z.string().default(COLORS.textPrimary),
    orbitColor: z.string().default('rgba(255,255,255,0.1)'),
});

type Props = z.infer<typeof techStackOrbitSchema>;

export const TechStackOrbit: React.FC<Props> = ({
    title,
    centerLogoUrl,
    orbitLogos,
    backgroundColor,
    textColor,
    orbitColor,
}) => {
    const frame = useCurrentFrame();
    const { fps, width, height } = useVideoConfig();
    
    const scale = useScaleFactor();
    const backgroundControls = useResolvedBackgroundControls();
    const isPortrait = useIsPortrait();

    const titleY = spring({ frame, fps, config: { damping: 12 } });
    const titleOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

    // Math for orbit path
    const totalOrbitItems = orbitLogos.length;
    const anglePerItem = 360 / Math.max(1, totalOrbitItems);
    
    // Create 2 or 3 orbital rings depending on count for a 3D atom look
    const maxRadius = isPortrait ? width * 0.35 : height * 0.35;
    
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

            {/* Orbit System Container */}
            <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: maxRadius * 2,
                height: maxRadius * 2,
            }}>
                {/* Orbital Rings */}
                <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    border: `2px dashed ${orbitColor}`, borderRadius: '50%',
                    transform: `rotate(${rotation * 0.5}deg)`,
                }} />
                <div style={{
                    position: 'absolute', top: maxRadius * 0.3, left: maxRadius * 0.3, right: maxRadius * 0.3, bottom: maxRadius * 0.3,
                    border: `1px solid ${orbitColor}`, borderRadius: '50%',
                    transform: `rotate(${-rotation}deg)`,
                }} />

                {/* Center Core Logo */}
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: `translate(-50%, -50%) scale(${spring({ frame: frame - 10, fps, config: { damping: 12 } })})`,
                    width: 140 * scale,
                    height: 140 * scale,
                    backgroundColor: '#fff',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.3), 0 0 40px rgba(255,255,255,0.2)',
                    zIndex: 10,
                    padding: 20 * scale,
                }}>
                    <Img src={centerLogoUrl} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                </div>

                {/* Orbiting Logos */}
                {orbitLogos.map((logo, i) => {
                    // Distribute across 2 rings randomly based on index
                    const isOnOuterRing = i % 2 === 0;
                    const r = isOnOuterRing ? maxRadius : maxRadius * 0.7;
                    
                    const startAngle = i * anglePerItem;
                    // Outer ring spins forward, inner ring spins backward
                    const currentAngle = isOnOuterRing ? startAngle + rotation : startAngle - (rotation * 1.5);
                    const rad = (currentAngle - 90) * Math.PI / 180;
                    
                    const x = Math.cos(rad) * r;
                    const y = Math.sin(rad) * r;

                    const delay = 30 + i * 5; // ripple out
                    const pop = spring({ frame: frame - delay, fps, config: { damping: 12, mass: 0.8 } });

                    return (
                        <div key={i} style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            // Translate to orbit position, then counter-rotate so the logo stays upright
                            transform: `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${pop})`,
                            width: 80 * scale,
                            height: 80 * scale,
                            backgroundColor: '#fff',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 10px 20px rgba(0,0,0,0.2)',
                            zIndex: isOnOuterRing ? 5 : 2,
                            padding: 16 * scale,
                        }}>
                            <Img src={logo} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                        </div>
                    );
                })}
            </div>
        </AbsoluteFill>
    );
};

registerTemplate({
    tags: [],
    id: 'tech-stack-orbit-01',
    name: 'Tech Stack Orbit',
    description: 'Dynamic planetary orbit showing integrations circling around a central product logo.',
    category: 'business-marketing',
    durationInFrames: 240,
    fps: 30,
    component: TechStackOrbit,
    schema: techStackOrbitSchema,
    defaultProps: techStackOrbitSchema.parse({}),
});
