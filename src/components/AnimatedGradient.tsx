import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import {
    BackgroundControlProps,
    useResolvedBackgroundControls,
    shouldRenderBackgroundLayer,
} from '../lib/background';

interface AnimatedGradientProps {
    /** Base color for the gradient. Default '#0F0F0F' */
    baseColor?: string;
    /** Accent color for the moving highlight. Default 'rgba(0,230,118,0.08)' */
    accentColor?: string;
    /** Second accent for richer movement. Default 'rgba(0,200,83,0.05)' */
    secondaryColor?: string;
    /** Speed multiplier. Default 1 */
    speed?: number;
    style?: React.CSSProperties;
    showBackground?: boolean;
    transparentBackground?: boolean;
}

/**
 * Animated gradient background with slow-moving radial highlights.
 * Creates subtle motion for solid-color backgrounds.
 */
export const AnimatedGradient: React.FC<AnimatedGradientProps> = ({
    baseColor = '#0F0F0F',
    accentColor = 'rgba(0,230,118,0.08)',
    secondaryColor = 'rgba(0,200,83,0.05)',
    speed = 1,
    style = {},
    showBackground,
    transparentBackground,
}) => {
    const frame = useCurrentFrame();
    const { durationInFrames } = useVideoConfig();

    const controls = useResolvedBackgroundControls({
        showBackground,
        transparentBackground,
    } as BackgroundControlProps);

    if (!shouldRenderBackgroundLayer(controls)) {
        return null;
    }

    // Primary orb moves diagonally top-left → bottom-right
    const x1 = interpolate(
        frame,
        [0, durationInFrames],
        [15, 75],
        { extrapolateRight: 'clamp' },
    ) * speed;
    const y1 = interpolate(
        frame,
        [0, durationInFrames],
        [10, 65],
        { extrapolateRight: 'clamp' },
    ) * speed;

    // Secondary orb moves opposite direction
    const x2 = interpolate(
        frame,
        [0, durationInFrames],
        [80, 25],
        { extrapolateRight: 'clamp' },
    ) * speed;
    const y2 = interpolate(
        frame,
        [0, durationInFrames],
        [70, 20],
        { extrapolateRight: 'clamp' },
    ) * speed;

    // Third subtle orb pulses in center area
    const x3 = interpolate(
        frame,
        [0, durationInFrames],
        [40, 60],
        { extrapolateRight: 'clamp' },
    );
    const y3 = interpolate(
        frame,
        [0, durationInFrames],
        [55, 35],
        { extrapolateRight: 'clamp' },
    );

    const background = [
        `radial-gradient(ellipse 800px 800px at ${x1}% ${y1}%, ${accentColor} 0%, transparent 70%)`,
        `radial-gradient(ellipse 600px 600px at ${x2}% ${y2}%, ${secondaryColor} 0%, transparent 70%)`,
        `radial-gradient(ellipse 500px 500px at ${x3}% ${y3}%, ${secondaryColor} 0%, transparent 60%)`,
        baseColor,
    ].join(', ');

    return (
        <div
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background,
                willChange: 'background',
                ...style,
            }}
        />
    );
};
