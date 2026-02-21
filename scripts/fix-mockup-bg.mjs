import fs from 'fs';

const files = [
    "InstagramAdMockup.tsx",
    "RedditThreadMockup.tsx",
    "FacebookAdMockup.tsx",
    "TwitterPostMockup.tsx",
    "LinkedInPostMockup.tsx",
    "YouTubePlayerMockup.tsx",
    "AppStoreMockup.tsx",
    "IMessageMockup.tsx",
    "GoogleSearchMockup.tsx",
    "ReviewMockup.tsx",
    "ClientLogoGrid.tsx"
].map(f => "src/templates/business-marketing/" + f);

let fixed = 0;
for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    const original = content;

    // Use specific exact-match replacement for the AbsoluteFill tag
    if (file.includes('InstagramAdMockup')) {
        content = content.replace(
            "backgroundColor: '#0f172a', fontFamily: interFont, alignItems: 'center', justifyContent: 'center'",
            "background: resolveCanvasBackground('#0f172a', backgroundControls), fontFamily: interFont, alignItems: 'center', justifyContent: 'center'"
        );
    } else if (file.includes('RedditThreadMockup')) {
        content = content.replace(
            "backgroundColor: canvasBg, fontFamily: interFont, alignItems: 'center', justifyContent: 'center'",
            "background: resolveCanvasBackground(canvasBg, backgroundControls), fontFamily: interFont, alignItems: 'center', justifyContent: 'center'"
        );
    } else if (file.includes('FacebookAdMockup')) {
        content = content.replace(
            "backgroundColor: '#e9ebee', fontFamily: interFont, alignItems: 'center', justifyContent: 'center'",
            "background: resolveCanvasBackground('#e9ebee', backgroundControls), fontFamily: interFont, alignItems: 'center', justifyContent: 'center'"
        );
    } else if (file.includes('TwitterPostMockup')) {
        content = content.replace(
            "backgroundColor: darkMode ? '#15202b' : '#f7f9f9', fontFamily: interFont, alignItems: 'center', justifyContent: 'center'",
            "background: resolveCanvasBackground(darkMode ? '#15202b' : '#f7f9f9', backgroundControls), fontFamily: interFont, alignItems: 'center', justifyContent: 'center'"
        );
    } else if (file.includes('LinkedInPostMockup')) {
        content = content.replace(
            "backgroundColor: '#f3f2ef', fontFamily: interFont, alignItems: 'center', justifyContent: 'center'",
            "background: resolveCanvasBackground('#f3f2ef', backgroundControls), fontFamily: interFont, alignItems: 'center', justifyContent: 'center'"
        );
    } else if (file.includes('YouTubePlayerMockup')) {
        content = content.replace(
            "backgroundColor: '#0f0f0f', fontFamily: interFont, alignItems: 'center', justifyContent: 'center'",
            "background: resolveCanvasBackground('#0f0f0f', backgroundControls), fontFamily: interFont, alignItems: 'center', justifyContent: 'center'"
        );
    } else if (file.includes('AppStoreMockup')) {
        content = content.replace(
            "backgroundColor: '#000000', fontFamily: interFont, alignItems: 'center', justifyContent: 'center'",
            "background: resolveCanvasBackground('#000000', backgroundControls), fontFamily: interFont, alignItems: 'center', justifyContent: 'center'"
        );
    } else if (file.includes('IMessageMockup')) {
        content = content.replace(
            "backgroundColor: '#000000', fontFamily: interFont, alignItems: 'center', justifyContent: 'center'",
            "background: resolveCanvasBackground('#000000', backgroundControls), fontFamily: interFont, alignItems: 'center', justifyContent: 'center'"
        );
    } else if (file.includes('GoogleSearchMockup')) {
        content = content.replace(
            "backgroundColor: '#ffffff', fontFamily: interFont, alignItems: 'center', justifyContent: 'center'",
            "background: resolveCanvasBackground('#ffffff', backgroundControls), fontFamily: interFont, alignItems: 'center', justifyContent: 'center'"
        );
    } else if (file.includes('ReviewMockup')) {
        content = content.replace(
            "backgroundColor: '#f8f9fa', fontFamily: interFont, alignItems: 'center', justifyContent: 'center'",
            "background: resolveCanvasBackground('#f8f9fa', backgroundControls), fontFamily: interFont, alignItems: 'center', justifyContent: 'center'"
        );
    } else if (file.includes('ClientLogoGrid')) {
        content = content.replace(
            "backgroundColor: backgroundColor, fontFamily: interFont, color: textColor",
            "background: resolveCanvasBackground(backgroundColor, backgroundControls), fontFamily: interFont, color: textColor"
        );
        content = content.replace(
            "backgroundColor, fontFamily: interFont, color: textColor",
            "background: resolveCanvasBackground(backgroundColor, backgroundControls), fontFamily: interFont, color: textColor"
        );
    }

    if (content !== original) {
        fs.writeFileSync(file, content);
        console.log("Fixed " + file);
        fixed++;
    }
}
console.log("Fixed " + fixed + " files");
