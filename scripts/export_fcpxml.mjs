import fs from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2);
const projectId = args[args.indexOf('--project-id') + 1];
const outputPath = args[args.indexOf('--output') + 1];

if (!projectId || !outputPath) {
    console.error('Usage: node export_fcpxml.mjs --project-id <id> --output <path>');
    process.exit(1);
}

// Helper to format time as integer seconds/fractions or fractional seconds
const formatTime = (us) => `${(us / 1000000).toFixed(4)}s`;

async function main() {
    // 1. Load project and timeline
    // We assume default path because server.mjs uses default path currently
    const rootDir = path.resolve(process.cwd()); // handled by caller usually
    // But we need to know where data is.
    // server.mjs passes no path info about data dir.
    // We'll assume standard layout: ../desktop/data/{id} relative to script?
    // script is in /scripts. data in /desktop/data.
    const projectDir = readArg('--project-dir') || path.join(process.cwd(), 'desktop', 'data', projectId);

    // Check if separate project location is supported later, but for now standard path.
    const timelinePath = path.join(projectDir, 'timeline.json');
    const projectsPath = path.join(process.cwd(), 'desktop', 'data', 'projects.json');

    let timeline;
    try {
        timeline = JSON.parse(await fs.readFile(timelinePath, 'utf8'));
    } catch (e) {
        console.error('Failed to read timeline', e);
        process.exit(1);
    }

    let project = {};
    try {
        const projects = JSON.parse(await fs.readFile(projectsPath, 'utf8'));
        project = projects.find(p => p.id === projectId) || {};
    } catch (e) {
        console.warn('Failed to read project metadata, using defaults');
    }

    const fps = timeline.fps || 30;
    const width = project.width || 1920;
    const height = project.height || 1080;
    const frameDuration = `100/${fps * 100}s`; // e.g. 100/3000s for 30fps

    // 2. Collect resources (assets)
    const resources = new Map(); // path -> id
    let resCounter = 1;

    // Filter valid clips
    const clips = (timeline.clips || []).sort((a, b) => (a.startUs || 0) - (b.startUs || 0));

    // Register all file-based assets
    for (const clip of clips) {
        if (clip.sourceRef && !resources.has(clip.sourceRef)) {
            // Only add if it looks like a file
            if (clip.sourceRef.startsWith('/') || clip.sourceRef.match(/^[a-zA-Z]:/)) {
                resources.set(clip.sourceRef, `r${resCounter++}`);
            }
        }
    }

    // 3. Build XML
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<!DOCTYPE fcpxml>\n`;
    xml += `<fcpxml version="1.8">\n`;

    // Resources
    xml += `    <resources>\n`;
    xml += `        <format id="r1" name="FFVideoFormat${height}p${fps}" frameDuration="${frameDuration}" width="${width}" height="${height}" colorSpace="1-1-1 (Rec. 709)"/>\n`;
    for (const [path, id] of resources.entries()) {
        xml += `        <asset id="${id}" name="${path.split('/').pop()}" uid="${id}" src="file://${path}" />\n`;
    }
    xml += `    </resources>\n`;

    // Library -> Event -> Project -> Sequence
    xml += `    <library>\n`;
    xml += `        <event name="AI Editor Export">\n`;
    xml += `            <project name="${project.name || 'Project'}">\n`;
    xml += `                <sequence format="r1" duration="${formatTime(timeline.durationUs || 0)}" tcStart="0s" tcFormat="NDF">\n`;
    xml += `                    <spine>\n`;

    let currentTime = 0;

    for (const clip of clips) {
        const start = clip.startUs || 0;
        const duration = clip.durationUs || 0;
        const offset = clip.sourceOffsetUs || 0;

        // Add gap if needed
        if (start > currentTime) {
            const gapDur = start - currentTime;
            xml += `                        <gap name="Gap" offset="${formatTime(currentTime)}" duration="${formatTime(gapDur)}" start="${formatTime(currentTime)}"/>\n`;
        }

        const resId = resources.get(clip.sourceRef);

        if (clip.type === 'video' && resId) {
            xml += `                        <video name="${clip.label || 'Video'}" offset="${formatTime(start)}" ref="${resId}" duration="${formatTime(duration)}" start="${formatTime(offset)}">\n`;
            xml += `                        </video>\n`;
        } else if (clip.type === 'audio' && resId) {
            xml += `                        <audio name="${clip.label || 'Audio'}" offset="${formatTime(start)}" ref="${resId}" duration="${formatTime(duration)}" start="${formatTime(offset)}"/>\n`;
        } else if (clip.type === 'image' && resId) {
            // FCPXML uses 'asset-clip' or 'video' for images usually, 'ref' points to image asset
            xml += `                        <video name="${clip.label || 'Image'}" offset="${formatTime(start)}" ref="${resId}" duration="${formatTime(duration)}" start="0s"/>\n`;
        } else if (clip.type === 'template' || !resId) {
            // Placeholder title
            xml += `                        <title name="${clip.label || 'Template'}" offset="${formatTime(start)}" ref="r1" duration="${formatTime(duration)}" start="${formatTime(start)}">\n`;
            xml += `                            <text>\n`;
            xml += `                                <text-style ref="ts1">${clip.label || 'Template'}</text-style>\n`;
            xml += `                            </text>\n`;
            xml += `                            <text-style-def id="ts1">\n`;
            xml += `                                <text-style font="Helvetica" fontSize="40" fontColor="1 1 1 1" alignment="center"/>\n`;
            xml += `                            </text-style-def>\n`;
            xml += `                        </title>\n`;
        }

        currentTime = Math.max(currentTime, start + duration);
    }

    xml += `                    </spine>\n`;
    xml += `                </sequence>\n`;
    xml += `            </project>\n`;
    xml += `        </event>\n`;
    xml += `    </library>\n`;
    xml += `</fcpxml>\n`;

    await fs.writeFile(outputPath, xml, 'utf8');
    console.log(JSON.stringify({ ok: true, path: outputPath }));
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
