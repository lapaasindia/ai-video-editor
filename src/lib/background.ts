import { createContext, useContext } from 'react';
import { getInputProps } from 'remotion';

export type GlobalBackgroundControls = {
    showBackground: boolean;
    transparentBackground: boolean;
};

export type BackgroundControlProps = Partial<GlobalBackgroundControls>;

export const DEFAULT_BACKGROUND_CONTROLS: GlobalBackgroundControls = {
    showBackground: true,
    transparentBackground: false,
};

export const useResolvedBackgroundControls = (
    props?: BackgroundControlProps,
): GlobalBackgroundControls => {
    const contextControls = useBackgroundControls();
    const inputProps = (getInputProps() ?? {}) as BackgroundControlProps;

    return {
        showBackground:
            props?.showBackground ??
            contextControls.showBackground ??
            inputProps.showBackground ??
            DEFAULT_BACKGROUND_CONTROLS.showBackground,
        transparentBackground:
            props?.transparentBackground ??
            contextControls.transparentBackground ??
            inputProps.transparentBackground ??
            DEFAULT_BACKGROUND_CONTROLS.transparentBackground,
    };
};

const BackgroundControlsContext = createContext<GlobalBackgroundControls>(
    DEFAULT_BACKGROUND_CONTROLS,
);

export const BackgroundControlsProvider = BackgroundControlsContext.Provider;

export const useBackgroundControls = (): GlobalBackgroundControls => {
    return useContext(BackgroundControlsContext);
};

export const resolveBackgroundControls = (
    props?: BackgroundControlProps,
): GlobalBackgroundControls => {
    const inputProps = (getInputProps() ?? {}) as BackgroundControlProps;

    return {
        showBackground:
            props?.showBackground ??
            inputProps.showBackground ??
            DEFAULT_BACKGROUND_CONTROLS.showBackground,
        transparentBackground:
            props?.transparentBackground ??
            inputProps.transparentBackground ??
            DEFAULT_BACKGROUND_CONTROLS.transparentBackground,
    };
};

export const resolveCanvasBackground = (
    fallbackColor: string,
    controls: GlobalBackgroundControls,
): string => {
    if (controls.transparentBackground) return 'transparent';
    return controls.showBackground ? fallbackColor : 'transparent';
};

export const shouldRenderBackgroundLayer = (
    controls: GlobalBackgroundControls,
): boolean => {
    return controls.showBackground && !controls.transparentBackground;
};
