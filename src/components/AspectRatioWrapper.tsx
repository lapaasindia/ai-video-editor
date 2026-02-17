import React from 'react';
import { AbsoluteFill } from 'remotion';

interface AspectRatioWrapperProps {
    children: React.ReactNode;
    backgroundColor?: string;
}

/**
 * Top-level wrapper applied inside every template.
 * Fills the full composition area and provides a consistent
 * background + flexible container.
 */
export const AspectRatioWrapper: React.FC<AspectRatioWrapperProps> = ({
    children,
    backgroundColor = '#000000',
}) => {
    return (
        <AbsoluteFill
            style={{
                backgroundColor,
                overflow: 'hidden',
                fontFamily: 'Inter, system-ui, sans-serif',
            }}
        >
            {children}
        </AbsoluteFill>
    );
};
