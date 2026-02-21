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

export const benefitCheckmarksSchema = z.object({
    title: z.string().default('What You Get'),
    benefits: z.array(z.string()).default([
        'Full access to all AI tools',
        'Unlimited HD video exports',
        'Priority 24/7 customer support',
        'Custom brand kits & fonts',
        'Team collaboration workspace',
        '1TB cloud storage included',
    ]),
    backgroundColor: z.string().default(COLORS.bg),
    textColor: z.string().default(COLORS.textPrimary),
    primaryColor: z.string().default('#22c55e'),
});

type Props = z.infer<typeof benefitCheckmarksSchema>;

export const BenefitCheckmarks: React.FC<Props> = ({
    title,
    benefits,
    backgroundColor,
    textColor,
    primaryColor,
}) => {
    const frame = useCurrentFrame();
    const { fps, width } = useVideoConfig();
    
    const scale = useScaleFactor();
    const backgroundControls = useResolvedBackgroundControls();
    const isPortrait = useIsPortrait();

    const titleY = spring({ frame, fps, config: { damping: 12 } });
    const titleOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

    const totalBenefits = benefits.length;
    // Auto-columns logic: if > 5 items and landscape, split into 2 columns
    const cols = isPortrait ? 1 : (totalBenefits > 5 ? 2 : 1);
    
    const paddingX = isPortrait ? 60 * scale : 120 * scale;
    const availableWidth = width - (paddingX * 2);

    return (
        <AbsoluteFill style={{ background: resolveCanvasBackground(backgroundColor, backgroundControls), fontFamily: interFont, color: textColor }}>
            {/* Header */}
            <div style={{
                position: 'absolute',
                top: isPortrait ? 150 * scale : 120 * scale,
                left: paddingX,
                width: availableWidth,
                textAlign: cols > 1 ? 'center' : 'left',
                transform: `translateY(${(1 - titleY) * -30}px)`,
                opacity: titleOpacity,
            }}>
                <EditableText
                    text={title}
                    style={{
                        fontFamily: interFont,
                        fontWeight: 800,
                        fontSize: (isPortrait ? 64 : 80) * scale,
                        margin: 0,
                        letterSpacing: '-0.02em',
                        color: textColor,
                    }}
                />
                <div style={{
                    width: 100 * scale,
                    height: 8 * scale,
                    backgroundColor: primaryColor,
                    marginTop: 20 * scale,
                    borderRadius: 4 * scale,
                    margin: cols > 1 ? '20px auto 0' : '20px 0 0',
                }} />
            </div>

            {/* List Container */}
            <div style={{
                position: 'absolute',
                top: isPortrait ? 300 * scale : 280 * scale,
                left: paddingX,
                width: availableWidth,
                display: 'grid',
                gridTemplateColumns: `repeat(${cols}, 1fr)`,
                columnGap: 80 * scale,
                rowGap: isPortrait ? 40 * scale : 30 * scale,
            }}>
                {benefits.map((benefit, i) => {
                    const delay = 15 + i * 8; // Rapid fire pop in
                    
                    const pop = spring({ frame: frame - delay, fps, config: { damping: 12, mass: 0.8 } });
                    const xOffset = spring({ frame: frame - delay, fps, config: { damping: 14 } });
                    const op = interpolate(frame - delay, [0, 10], [0, 1], { extrapolateRight: 'clamp' });

                    return (
                        <div key={i} style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 24 * scale,
                            opacity: op,
                            transform: `translateX(${(1 - xOffset) * -40}px)`,
                        }}>
                            {/* Checkmark Circle */}
                            <div style={{
                                width: 48 * scale,
                                height: 48 * scale,
                                borderRadius: '50%',
                                backgroundColor: `${primaryColor}20`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transform: `scale(${pop})`,
                                boxShadow: `0 0 20px ${primaryColor}40`,
                                flexShrink: 0,
                            }}>
                                <svg width={28 * scale} height={28 * scale} viewBox="0 0 24 24" fill="none" stroke={primaryColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                            </div>
                            
                            {/* Benefit Text */}
                            <div style={{
                                fontSize: (isPortrait ? 28 : 32) * scale,
                                fontWeight: 600,
                                color: COLORS.textPrimary,
                                lineHeight: 1.3,
                            }}>
                                {benefit}
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
    id: 'benefit-checkmarks-01',
    name: 'Rapid Fire Checkmarks',
    description: 'A punchy, fast-animating list of checkmarks detailing benefits. Auto-splits into columns if list is long.',
    category: 'business-marketing',
    durationInFrames: 150,
    fps: 30,
    component: BenefitCheckmarks,
    schema: benefitCheckmarksSchema,
    defaultProps: benefitCheckmarksSchema.parse({}),
});
