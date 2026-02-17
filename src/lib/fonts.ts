import { loadFont as loadInter } from '@remotion/google-fonts/Inter';
import { loadFont as loadPoppins } from '@remotion/google-fonts/Poppins';
import { loadFont as loadMontserrat } from '@remotion/google-fonts/Montserrat';
import { loadFont as loadPlayfairDisplay } from '@remotion/google-fonts/PlayfairDisplay';
import { loadFont as loadRobotoMono } from '@remotion/google-fonts/RobotoMono';
import { loadFont as loadSpaceGrotesk } from '@remotion/google-fonts/SpaceGrotesk';

// Load and export font families
export const { fontFamily: interFont } = loadInter();
export const { fontFamily: poppinsFont } = loadPoppins();
export const { fontFamily: montserratFont } = loadMontserrat();
export const { fontFamily: playfairFont } = loadPlayfairDisplay();
export const { fontFamily: robotoMonoFont } = loadRobotoMono();
export const { fontFamily: spaceGroteskFont } = loadSpaceGrotesk();

// Map of all available fonts for schema dropdowns
export const FONT_OPTIONS = {
    Inter: interFont,
    Poppins: poppinsFont,
    Montserrat: montserratFont,
    'Playfair Display': playfairFont,
    'Roboto Mono': robotoMonoFont,
    'Space Grotesk': spaceGroteskFont,
} as const;

export type FontName = keyof typeof FONT_OPTIONS;

export function getFontFamily(name: FontName): string {
    return FONT_OPTIONS[name];
}
