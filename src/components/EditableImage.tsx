import React from 'react';
import { Img } from 'remotion';

interface EditableImageProps {
    src: string;
    alt?: string;
    objectFit?: React.CSSProperties['objectFit'];
    borderRadius?: number;
    style?: React.CSSProperties;
}

/**
 * An image component whose `src` comes from template props.
 * Uses Remotion's <Img> for correct frame-synced loading.
 */
export const EditableImage: React.FC<EditableImageProps> = ({
    src,
    alt = '',
    objectFit = 'cover',
    borderRadius = 0,
    style = {},
}) => {
    return (
        <Img
            src={src}
            alt={alt}
            style={{
                width: '100%',
                height: '100%',
                objectFit,
                borderRadius,
                ...style,
            }}
        />
    );
};
