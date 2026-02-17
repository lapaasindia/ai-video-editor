import React from 'react';
import { Img, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import {
    type BackgroundControlProps,
    shouldRenderBackgroundLayer,
    useResolvedBackgroundControls,
} from '../lib/background';

interface AnimatedImageProps {
    src: string;
    opacity?: number;
    blur?: number;
    /** Zoom range: start → end scale. Default [1, 1.15] */
    zoomRange?: [number, number];
    /** Pan direction. Default 'right' */
    panDirection?: 'left' | 'right' | 'up' | 'down';
    /** Pan amount in pixels. Default 60 */
    panAmount?: number;
    style?: React.CSSProperties;
    showBackground?: boolean;
    transparentBackground?: boolean;
}

/**
 * Ken Burns animated background image.
 * Applies a slow zoom + pan over the entire composition duration.
 */
export const AnimatedImage: React.FC<AnimatedImageProps> = ({
    src,
    opacity = 0.35,
    blur = 2,
    zoomRange = [1, 1.15],
    panDirection = 'right',
    panAmount = 60,
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

    const scale = interpolate(frame, [0, durationInFrames], zoomRange, {
        extrapolateRight: 'clamp',
    });

    const pan = interpolate(frame, [0, durationInFrames], [0, panAmount], {
        extrapolateRight: 'clamp',
    });

    const panTransform = {
        left: `translateX(${pan}px)`,
        right: `translateX(-${pan}px)`,
        up: `translateY(${pan}px)`,
        down: `translateY(-${pan}px)`,
    }[panDirection];

    return (
        <div
            style={{
                position: 'absolute',
                top: -panAmount,
                left: -panAmount,
                right: -panAmount,
                bottom: -panAmount,
                opacity,
                overflow: 'hidden',
                ...style,
            }}
        >
            <Img
                src={src}
                style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    transform: `scale(${scale}) ${panTransform}`,
                    filter: blur > 0 ? `blur(${blur}px)` : undefined,
                    willChange: 'transform',
                }}
            />
        </div>
    );
};
