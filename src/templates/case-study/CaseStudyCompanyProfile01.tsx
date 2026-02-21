import React from 'react';
import {
    AbsoluteFill,
    useCurrentFrame,
    useVideoConfig,
    interpolate } from 'remotion';
import { z } from 'zod';
import { useIsPortrait, useScaleFactor } from "../../lib/responsive";
import { fadeIn, slideIn, scaleIn } from '../../lib/animations';
import { EditableText } from '../../components/EditableText';
import { AnimatedImage } from '../../components/AnimatedImage';
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
export const caseStudyCompanyProfileSchema = z.object({
    companyName: z.string().default('NovaTech Solutions'),
    tagline: z.string().default('Enterprise Cloud Infrastructure'),
    founded: z.string().default('2019'),
    headquarters: z.string().default('San Francisco, CA'),
    employees: z.string().default('2,400+'),
    revenue: z.string().default('$180M ARR'),
    logoUrl: z.string().default(''),
    imageUrl: z.string().default('https://images.unsplash.com/photo-1497366216548-37526070297c?w=800'),
    description: z.string().default('NovaTech Solutions provides next-generation cloud infrastructure for enterprises scaling globally. Their platform powers 500+ Fortune 1000 companies.'),
    primaryColor: z.string().default(COLORS.accent),
    accentColor: z.string().default(COLORS.accentLight),
    backgroundColor: z.string().default(COLORS.bg) });

type Props = z.infer<typeof caseStudyCompanyProfileSchema>;

// ─── Component ───────────────────────────────────────────────
export const CaseStudyCompanyProfile01: React.FC<Props> = (props) => {
    const scale = useScaleFactor();
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    
    const isPortrait = useIsPortrait();
    const backgroundControls = useResolvedBackgroundControls();
    const renderBackgroundLayers = shouldRenderBackgroundLayer(backgroundControls);

    const infoItems = [
        { label: 'Founded', value: props.founded },
        { label: 'HQ', value: props.headquarters },
        { label: 'Team', value: props.employees },
        { label: 'Revenue', value: props.revenue },
    ];

    return (
        <AbsoluteFill
            style={{
                background: resolveCanvasBackground(COLORS.bg, backgroundControls),
                overflow: 'hidden',
            }}
        >
            {/* Background image */}
            {renderBackgroundLayers && (
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    opacity: fadeIn(frame, 0, 30) * 0.15 }}
            >
                <AnimatedImage src={props.imageUrl} />
            </div>
            )}

            {/* Gradient overlay */}
            {renderBackgroundLayers && (
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: linearGradient(180, `${props.backgroundColor}88`, `${props.backgroundColor}ee`, props.backgroundColor) }}
            />
            )}

            {/* Content */}
            <div
                style={{
                    position: 'relative',
                    zIndex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isPortrait ? 'center' : 'flex-start',
                    justifyContent: 'center',
                    width: '100%',
                    height: '100%',
                    padding: isPortrait ? '120px 60px' : '80px 100px',
                    gap: isPortrait ? 48 : 64 }}
            >
                {/* Label */}
                <div
                    style={{
                        padding: `${6 * scale}px ${18 * scale}px`,
                        borderRadius: 12 * scale,
                        background: `${props.primaryColor}20`,
                        border: `2px solid ${props.primaryColor}40`,
                        opacity: fadeIn(frame, 5),
                        transform: `scale(${scaleIn(frame, fps, 5)})` }}
                >
                    <EditableText
                        text="COMPANY PROFILE"
                        fontSize={32 * scale}
                        fontFamily={interFont}
                        color={COLORS.accent}
                        fontWeight={700}
                        letterSpacing={3}
                    />
                </div>

                {/* Company name */}
                <EditableText
                    text={props.companyName}
                    fontSize={isPortrait ? 104 : 144}
                    fontFamily={interFont}
                    color={COLORS.textPrimary}
                    fontWeight={900}
                    lineHeight={1.05}
                    letterSpacing={-2}
                    textAlign={isPortrait ? 'center' : 'left'}
                    style={{
                        opacity: fadeIn(frame, 10),
                        transform: slideIn(frame, 'up', 10, 25) }}
                />

                {/* Tagline */}
                <EditableText
                    text={props.tagline}
                    fontSize={isPortrait ? 48 : 64}
                    fontFamily={interFont}
                    color={COLORS.accent}
                    fontWeight={500}
                    textAlign={isPortrait ? 'center' : 'left'}
                    style={{ opacity: fadeIn(frame, 20) }}
                />

                {/* Description */}
                <EditableText
                    text={props.description}
                    fontSize={isPortrait ? 40 : 48}
                    fontFamily={interFont}
                    color={COLORS.textSecondary}
                    fontWeight={400}
                    lineHeight={1.6}
                    maxLines={3}
                    textAlign={isPortrait ? 'center' : 'left'}
                    style={{
                        opacity: fadeIn(frame, 30),
                        maxWidth: isPortrait ? '100%' : 700 }}
                />

                {/* Info grid */}
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: isPortrait ? '1fr 1fr' : 'repeat(4, 1fr)',
                        gap: isPortrait ? 24 : 40,
                        marginTop: 16 * scale,
                        width: '100%',
                        maxWidth: isPortrait ? '100%' : 900 }}
                >
                    {infoItems.map((item, i) => (
                        <div
                            key={i}
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: isPortrait ? 'center' : 'flex-start',
                                gap: 8 * scale,
                                padding: `${16 * scale}px`,
                                borderRadius: 24 * scale,
                                background: 'rgba(255,255,255,0.03)',
                                border: '2px solid rgba(255,255,255,0.06)',
                                opacity: fadeIn(frame, 45 + i * 8),
                                transform: slideIn(frame, 'up', 45 + i * 8, 20) }}
                        >
                            <EditableText
                                text={item.label}
                                fontSize={28 * scale}
                                fontFamily={interFont}
                                color={COLORS.textSecondary}
                                fontWeight={500}
                                textTransform="uppercase"
                                letterSpacing={2}
                            />
                            <EditableText
                                text={item.value}
                                fontSize={48 * scale}
                                fontFamily={interFont}
                                color={COLORS.textSecondary}
                                fontWeight={700}
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* Bottom accent */}
            {renderBackgroundLayers && (
            <div
                style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    width: `${interpolate(frame, [0, 60], [0, 100], { extrapolateRight: 'clamp' })}%`,
                    height: 6 * scale,
                    background: GRADIENTS.bgMain }}
            />
            )}
        </AbsoluteFill>
    );
};

// ─── Register ────────────────────────────────────────────────
registerTemplate({
    id: 'case-study-company-profile-01',
    name: 'Case Study Company Profile',
    category: 'case-study',
    description: 'Company overview card with name, tagline, description, and key stats grid',
    tags: ['profile', 'company', 'overview', 'case-study', 'intro'],
    component: CaseStudyCompanyProfile01,
    schema: caseStudyCompanyProfileSchema,
    defaultProps: caseStudyCompanyProfileSchema.parse({}),
    durationInFrames: DEFAULT_DURATION_FRAMES,
    fps: DEFAULT_FPS });
