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

export const testimonialCarouselSchema = z.object({
    title: z.string().default('What Our Clients Say'),
    testimonials: z.array(z.object({
        name: z.string(),
        role: z.string(),
        text: z.string(),
        avatarUrl: z.string(),
        rating: z.number().min(1).max(5).default(5),
    })).default([
        { 
            name: 'Sarah Jenkins', 
            role: 'CMO at TechFlow', 
            text: '"This product completely transformed our marketing workflow. We saw a 300% increase in lead generation within the first month alone."',
            avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
            rating: 5
        },
        { 
            name: 'Marcus Chen', 
            role: 'Founder, StartupX', 
            text: '"The analytics dashboard is incredibly intuitive. I finally understand where our marketing spend is actually going."',
            avatarUrl: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=150',
            rating: 5
        },
        { 
            name: 'Elena Rodriguez', 
            role: 'VP of Sales', 
            text: '"Customer support is top-notch. Any time we had an issue, they resolved it in minutes. Highly recommend to any growing team."',
            avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
            rating: 4
        }
    ]),
    backgroundColor: z.string().default('#0f172a'),
    textColor: z.string().default('#ffffff'),
    cardBgColor: z.string().default('#1e293b'),
    accentColor: z.string().default('#3b82f6'),
});

type Props = z.infer<typeof testimonialCarouselSchema>;

export const TestimonialCarousel: React.FC<Props> = ({
    title,
    testimonials,
    backgroundColor,
    textColor,
    cardBgColor,
    accentColor,
}) => {
    const frame = useCurrentFrame();
    const { fps, width, height } = useVideoConfig();
    const scale = useScaleFactor();
    const isPortrait = useIsPortrait();

    const titleY = spring({ frame, fps, config: { damping: 12 } });
    const titleOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

    // Calculate how long each slide should show
    // Default 300 frames (10s at 30fps). We divide time equally.
    const totalFrames = 300; 
    const framesPerSlide = Math.floor(totalFrames / Math.max(1, testimonials.length));

    // Determine which testimonial is currently active based on frame
    const activeIndex = Math.min(
        Math.floor(frame / framesPerSlide),
        testimonials.length - 1
    );

    // Calculate progress through current slide (0 to 1)
    const slideFrame = frame % framesPerSlide;
    
    // Animation for card entering and exiting
    // Enter: spring in. Exit: drop out when slideFrame > framesPerSlide - 15
    const isExiting = slideFrame > framesPerSlide - 15 && activeIndex < testimonials.length - 1;
    
    const enterSpring = spring({ frame: slideFrame, fps, config: { damping: 14, mass: 1.2 } });
    const exitSpring = isExiting 
        ? spring({ frame: slideFrame - (framesPerSlide - 15), fps, config: { damping: 14 } }) 
        : 0;

    const cardScale = interpolate(enterSpring - exitSpring, [0, 1], [0.9, 1]);
    const cardY = interpolate(enterSpring - exitSpring, [0, 1], [100, 0]);
    const cardOpacity = interpolate(enterSpring - exitSpring, [0, 1], [0, 1]);

    const activeTestimonial = testimonials[activeIndex];

    return (
        <AbsoluteFill style={{ backgroundColor, fontFamily: interFont, color: textColor }}>
            {/* Header */}
            <div style={{
                position: 'absolute',
                top: isPortrait ? 120 * scale : 100 * scale,
                left: 0,
                width: '100%',
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

            {/* Testimonial Card */}
            <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: `translate(-50%, -50%) scale(${cardScale}) translateY(${cardY}px)`,
                opacity: cardOpacity,
                width: isPortrait ? width * 0.85 : width * 0.6,
                backgroundColor: cardBgColor,
                borderRadius: 30 * scale,
                padding: isPortrait ? 50 * scale : 80 * scale,
                boxShadow: '0 30px 60px rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.05)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
            }}>
                {/* Quote Icon */}
                <div style={{
                    fontSize: 80 * scale,
                    color: accentColor,
                    opacity: 0.5,
                    lineHeight: 0.5,
                    marginBottom: 20 * scale,
                    fontFamily: 'serif',
                }}>
                    "
                </div>

                {/* Text */}
                <div style={{
                    fontSize: (isPortrait ? 32 : 40) * scale,
                    fontWeight: 500,
                    lineHeight: 1.4,
                    marginBottom: 50 * scale,
                    color: 'rgba(255,255,255,0.9)',
                }}>
                    {activeTestimonial?.text}
                </div>

                {/* Stars */}
                <div style={{ display: 'flex', gap: 8 * scale, marginBottom: 30 * scale }}>
                    {Array.from({ length: 5 }).map((_, i) => (
                        <svg key={i} width={24 * scale} height={24 * scale} viewBox="0 0 24 24" fill={i < (activeTestimonial?.rating || 5) ? '#fbbf24' : 'transparent'} stroke={i < (activeTestimonial?.rating || 5) ? '#fbbf24' : 'rgba(255,255,255,0.2)'} strokeWidth="2">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                    ))}
                </div>

                {/* Author Info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 20 * scale }}>
                    {activeTestimonial?.avatarUrl && (
                        <Img 
                            src={activeTestimonial.avatarUrl} 
                            style={{
                                width: 80 * scale,
                                height: 80 * scale,
                                borderRadius: '50%',
                                objectFit: 'cover',
                                border: `3px solid ${accentColor}`,
                            }}
                        />
                    )}
                    <div style={{ textAlign: 'left' }}>
                        <div style={{ fontSize: 24 * scale, fontWeight: 700 }}>{activeTestimonial?.name}</div>
                        <div style={{ fontSize: 18 * scale, color: 'rgba(255,255,255,0.6)' }}>{activeTestimonial?.role}</div>
                    </div>
                </div>
            </div>

            {/* Pagination Dots */}
            <div style={{
                position: 'absolute',
                bottom: 80 * scale,
                left: 0,
                width: '100%',
                display: 'flex',
                justifyContent: 'center',
                gap: 12 * scale,
                opacity: titleOpacity,
            }}>
                {testimonials.map((_, i) => (
                    <div key={i} style={{
                        width: i === activeIndex ? 30 * scale : 12 * scale,
                        height: 12 * scale,
                        borderRadius: 6 * scale,
                        backgroundColor: i === activeIndex ? accentColor : 'rgba(255,255,255,0.2)',
                        transition: 'all 0.3s ease',
                    }} />
                ))}
            </div>
        </AbsoluteFill>
    );
};

registerTemplate({
    id: 'testimonial-carousel-01',
    name: 'Dynamic Testimonial Carousel',
    description: 'Automatically divides the video duration evenly among all provided testimonials, animating them in and out.',
    category: 'social-proof',
    durationInFrames: 300,
    fps: 30,
    component: TestimonialCarousel,
    schema: testimonialCarouselSchema,
    defaultProps: testimonialCarouselSchema.parse({}),
});
