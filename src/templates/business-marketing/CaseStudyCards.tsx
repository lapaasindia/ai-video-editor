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

export const caseStudyCardSchema = z.object({
    title: z.string().default('Case Studies'),
    studies: z.array(z.object({
        company: z.string(),
        logoUrl: z.string(),
        metric: z.string(),
        detail: z.string(),
        color: z.string(),
    })).default([
        { 
            company: 'Acme Corp', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg',
            metric: '+250%', detail: 'Increase in organic traffic in 6 months', color: '#f59e0b'
        },
        { 
            company: 'Globex', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/e/e8/Tesla_logo.png',
            metric: '10x', detail: 'Faster deployment cycle times', color: '#ef4444'
        },
        { 
            company: 'Soylent', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/0/08/Netflix_2015_logo.svg',
            metric: '-40%', detail: 'Reduction in customer churn rate', color: '#eab308'
        }
    ]),
    backgroundColor: z.string().default('#0f172a'),
    textColor: z.string().default('#ffffff'),
    cardBgColor: z.string().default('#1e293b'),
});

type Props = z.infer<typeof caseStudyCardSchema>;

export const CaseStudyCards: React.FC<Props> = ({
    title,
    studies,
    backgroundColor,
    textColor,
    cardBgColor,
}) => {
    const frame = useCurrentFrame();
    const { fps, width, height } = useVideoConfig();
    const scale = useScaleFactor();
    const isPortrait = useIsPortrait();

    const titleY = spring({ frame, fps, config: { damping: 12 } });
    const titleOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

    const totalStudies = studies.length;
    const paddingX = isPortrait ? 60 * scale : 120 * scale;
    const availableWidth = width - (paddingX * 2);
    
    // We display them horizontally stacked. If portrait, display them vertically.
    const gap = 30 * scale;
    const itemWidth = isPortrait ? availableWidth : (availableWidth - (gap * (totalStudies - 1))) / totalStudies;
    
    return (
        <AbsoluteFill style={{ backgroundColor, fontFamily: interFont, color: textColor }}>
            {/* Header */}
            <div style={{
                position: 'absolute',
                top: isPortrait ? 120 * scale : 100 * scale,
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
                        color: textColor,
                    }}
                />
            </div>

            {/* Cards Container */}
            <div style={{
                position: 'absolute',
                top: isPortrait ? 250 * scale : 250 * scale,
                left: paddingX,
                width: availableWidth,
                display: 'flex',
                flexDirection: isPortrait ? 'column' : 'row',
                justifyContent: 'center',
                alignItems: isPortrait ? 'center' : 'stretch',
                gap: gap,
            }}>
                {studies.map((study, i) => {
                    // Cards flip in 3D
                    const delay = 20 + i * 15;
                    // Flip starts at 90deg (invisible edge), ends at 0
                    const flip = interpolate(spring({ frame: frame - delay, fps, config: { damping: 14, mass: 1.5 } }), [0, 1], [90, 0]);
                    const op = interpolate(frame - delay, [0, 5], [0, 1], { extrapolateRight: 'clamp' });
                    
                    return (
                        <div key={i} style={{
                            width: isPortrait ? '100%' : itemWidth,
                            backgroundColor: cardBgColor,
                            borderRadius: 24 * scale,
                            padding: isPortrait ? 30 * scale : 40 * scale,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            textAlign: 'center',
                            transform: `perspective(1000px) rotateY(${flip}deg)`,
                            transformOrigin: 'center center',
                            opacity: op,
                            boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
                            borderTop: `4px solid ${study.color}`,
                            position: 'relative',
                        }}>
                            {/* Logo */}
                            <div style={{
                                width: 120 * scale,
                                height: 60 * scale,
                                marginBottom: 30 * scale,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                opacity: 0.8,
                            }}>
                                <Img src={study.logoUrl} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                            </div>

                            {/* Huge Metric */}
                            <div style={{
                                fontSize: (isPortrait ? 64 : 80) * scale,
                                fontWeight: 900,
                                fontFamily: montserratFont,
                                color: study.color,
                                marginBottom: 16 * scale,
                                textShadow: `0 4px 10px ${study.color}40`,
                                lineHeight: 1,
                            }}>
                                {study.metric}
                            </div>
                            
                            {/* Detail Text */}
                            <div style={{
                                fontSize: 20 * scale,
                                fontWeight: 500,
                                color: 'rgba(255,255,255,0.9)',
                                lineHeight: 1.4,
                            }}>
                                {study.detail}
                            </div>
                        </div>
                    );
                })}
            </div>
        </AbsoluteFill>
    );
};

registerTemplate({
    id: 'case-study-cards-01',
    name: 'Dynamic Case Study Cards',
    description: 'Flipping 3D cards that display impressive case study metrics for clients.',
    category: 'social-proof',
    durationInFrames: 180,
    fps: 30,
    component: CaseStudyCards,
    schema: caseStudyCardSchema,
    defaultProps: caseStudyCardSchema.parse({}),
});
