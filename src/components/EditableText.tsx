import React from 'react';

interface EditableTextProps {
    text: string;
    fontSize?: number;
    fontFamily?: string;
    color?: string;
    fontWeight?: number | string;
    fontStyle?: React.CSSProperties['fontStyle'];
    textAlign?: React.CSSProperties['textAlign'];
    lineHeight?: number;
    letterSpacing?: number;
    textTransform?: React.CSSProperties['textTransform'];
    maxLines?: number;
    style?: React.CSSProperties;
}

/**
 * A text component whose content comes from template props.
 * Handles line clamping, styling, and consistent rendering.
 */
export const EditableText: React.FC<EditableTextProps> = ({
    text,
    fontSize = 48,
    fontFamily = 'Inter, sans-serif',
    color = '#ffffff',
    fontWeight = 700,
    fontStyle = 'normal',
    textAlign = 'left',
    lineHeight = 1.2,
    letterSpacing = -0.5,
    textTransform = 'none',
    maxLines,
    style = {},
}) => {
    const clampStyle: React.CSSProperties = maxLines
        ? {
            display: '-webkit-box',
            WebkitLineClamp: maxLines,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
        }
        : {};

    return (
        <div
            style={{
                fontSize,
                fontFamily,
                color,
                fontWeight,
                fontStyle,
                textAlign,
                lineHeight,
                letterSpacing,
                textTransform,
                ...clampStyle,
                ...style,
            }}
        >
            {text}
        </div>
    );
};
