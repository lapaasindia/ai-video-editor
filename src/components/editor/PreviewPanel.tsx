import React, { useEffect, useRef } from 'react';
import { Player, PlayerRef } from '@remotion/player';
import { useEditor } from '../../context/EditorContext';
import { AbsoluteFill, Sequence, Video, Audio, Img } from 'remotion';

const TimelineComposition: React.FC<{ tracks: any[] }> = ({ tracks }) => {
    return (
        <AbsoluteFill style={{ backgroundColor: '#000' }}>
            {tracks.map(track => (
                <AbsoluteFill key={track.id}>
                    {track.clips.map((clip: any) => {
                        // Simple mapping for now
                        const Component =
                            clip.type === 'video' ? Video :
                                clip.type === 'audio' ? Audio :
                                    clip.type === 'image' ? Img :
                                        null;

                        if (!Component) return null;

                        return (
                            <Sequence key={clip.id} from={Math.round(clip.start * 30)} durationInFrames={Math.round(clip.duration * 30)}>
                                <Component src={clip.src} />
                            </Sequence>
                        );
                    })}
                </AbsoluteFill>
            ))}
        </AbsoluteFill>
    );
};

export const PreviewPanel: React.FC = () => {
    const { tracks, currentTime, isPlaying, media } = useEditor();
    const playerRef = useRef<PlayerRef>(null);

    // Sync external time to player
    useEffect(() => {
        if (playerRef.current) {
            const frame = Math.round(currentTime * 30);
            if (Math.abs(playerRef.current.getCurrentFrame() - frame) > 1) {
                playerRef.current.seekTo(frame);
            }
        }
    }, [currentTime]);

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
                        {Math.round(currentTime * 30)} frames
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
                                // Resolve src here
                                src: media.find(m => m.id === c.mediaId)?.path || ''
                            }))
                        }))
                    }}
                    durationInFrames={Math.max(300, ...tracks.flatMap(t => t.clips).map(c => (c.start + c.duration) * 30))}
                    compositionWidth={1920}
                    compositionHeight={1080}
                    fps={30}
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
