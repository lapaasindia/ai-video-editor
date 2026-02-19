import React, { useEffect, useRef } from 'react';
import { Player, PlayerRef } from '@remotion/player';
import { useEditor } from '../../context/EditorContext';
import { AbsoluteFill, Sequence, Video, Audio, Img } from 'remotion';
import { getTemplateById } from '../../templates/registry';

const BACKEND = 'http://127.0.0.1:43123';

/** Convert a local filesystem path to a backend-served URL */
const toMediaUrl = (filePath: string): string => {
    if (!filePath) return '';
    // Already a URL
    if (filePath.startsWith('http://') || filePath.startsWith('https://') || filePath.startsWith('blob:')) {
        return filePath;
    }
    return `${BACKEND}/media/file?path=${encodeURIComponent(filePath)}`;
};

const TimelineComposition: React.FC<{ tracks: any[]; fps: number }> = ({ tracks, fps }) => {
    return (
        <AbsoluteFill style={{ backgroundColor: '#000' }}>
            {tracks.map(track => (
                <AbsoluteFill key={track.id}>
                    {track.clips.map((clip: any) => {
                        const frames = Math.max(1, Math.round(clip.duration * fps));
                        if (clip.duration <= 0) return null;

                        // Resolve component type
                        let Component: any = null;
                        let props: any = { src: clip.src };

                        if (clip.type === 'video') {
                            Component = Video;
                            props = {
                                src: clip.src,
                                startFrom: clip.offset ? Math.round(clip.offset * fps) : undefined,
                                onError: (e: any) => console.warn('Video load error', e)
                            };
                        } else if (clip.type === 'audio') {
                            Component = Audio;
                        } else if (clip.type === 'image') {
                            Component = Img;
                        } else if (clip.type === 'template' && clip.templateId) {
                            const template = getTemplateById(clip.templateId);
                            if (template) {
                                Component = template.component;
                                props = clip.content || {};
                            }
                        }

                        if (!Component) return null;

                        return (
                            <Sequence key={clip.id} from={Math.round(clip.start * fps)} durationInFrames={frames}>
                                <Component {...props} />
                            </Sequence>
                        );
                    })}
                </AbsoluteFill>
            ))}
        </AbsoluteFill>
    );
};

export const PreviewPanel: React.FC = () => {
    const { tracks, currentTime, isPlaying, media, currentProject } = useEditor();
    const playerRef = useRef<PlayerRef>(null);
    const fps = currentProject?.fps || 30;

    // Sync external time to player
    useEffect(() => {
        if (playerRef.current) {
            const frame = Math.round(currentTime * fps);
            if (Math.abs(playerRef.current.getCurrentFrame() - frame) > 1) {
                playerRef.current.seekTo(frame);
            }
        }
    }, [currentTime, fps]);

    // Sync player pause/play
    useEffect(() => {
        if (playerRef.current) {
            if (isPlaying && !playerRef.current.isPlaying()) {
                playerRef.current.play();
            } else if (!isPlaying && playerRef.current.isPlaying()) {
                playerRef.current.pause();
            }
        }
    }, [isPlaying]);

    return (
        <div className="panel panel-right" id="preview-panel">
            <div className="panel-header">
                <h3>Preview</h3>
                <div className="panel-actions">
                    <span style={{ fontSize: '0.8rem', marginRight: '1rem' }}>
                        {Math.round(currentTime * fps)} frames ({fps}fps)
                    </span>
                </div>
            </div>
            <div className="panel-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', height: '100%', width: '100%' }}>
                <Player
                    ref={playerRef}
                    component={TimelineComposition}
                    inputProps={{
                        tracks: tracks.map(t => ({
                            ...t,
                            clips: t.clips.map(c => ({
                                ...c,
                                // Resolve src: convert filesystem path to backend URL
                                src: toMediaUrl(media.find(m => m.id === c.mediaId)?.path || '')
                            }))
                        })),
                        fps,
                    }}
                    durationInFrames={Math.max(300, ...tracks.flatMap(t => t.clips).map(c => Math.round((c.start + c.duration) * fps)))}
                    compositionWidth={currentProject?.width || 1920}
                    compositionHeight={currentProject?.height || 1080}
                    fps={fps}
                    style={{
                        width: '100%',
                        height: 'auto',
                        aspectRatio: '16/9',
                        maxHeight: '100%'
                    }}
                    controls
                    clickToPlay={false} // Managed by our context
                    loop
                />
            </div>
        </div>
    );
};
