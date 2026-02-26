import React, { useEffect, useRef, Component, ErrorInfo, ReactNode } from 'react';
import { Player, PlayerRef } from '@remotion/player';
import { useEditor } from '../../context/EditorContext';
import { AbsoluteFill, Sequence, Video, Audio, Img } from 'remotion';
import { getTemplateById } from '../../templates/registry';

/** Error boundary to catch Remotion rendering crashes */
class PreviewErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: string }> {
    constructor(props: { children: ReactNode }) {
        super(props);
        this.state = { hasError: false, error: '' };
    }
    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error: error.message };
    }
    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error('[PreviewPanel] Render error:', error, info.componentStack);
    }
    render() {
        if (this.state.hasError) {
            return (
                <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#000', color: '#f87171', padding: 20 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Preview Error</div>
                    <div style={{ fontSize: 11, color: '#888', maxWidth: 400, textAlign: 'center' }}>{this.state.error}</div>
                    <button onClick={() => this.setState({ hasError: false, error: '' })} style={{ marginTop: 12, padding: '4px 12px', background: '#333', border: '1px solid #555', borderRadius: 4, color: '#fff', cursor: 'pointer', fontSize: 11 }}>Retry</button>
                </div>
            );
        }
        return this.props.children;
    }
}

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

/** Tracks that are metadata-only and should NOT render in preview */
const NON_RENDERABLE_TRACK_IDS = new Set([
    'track-cuts-ai',    // cut ranges (informational)
    'track-rawcuts',    // raw silence/filler cuts
    'track-chunks-ai',  // semantic chunks (text markers)
    'track-seams-ai',   // seam warnings (audio markers)
]);

/** Fallback card for template clips with unmatched IDs */
const TemplateFallbackCard: React.FC<{ headline?: string; subline?: string }> = ({ headline, subline }) => (
    <AbsoluteFill style={{
        display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
        background: 'linear-gradient(135deg, rgba(99,102,241,0.85), rgba(168,85,247,0.85))',
        padding: 40,
    }}>
        {headline && (
            <div style={{ color: '#fff', fontSize: 42, fontWeight: 800, textAlign: 'center', lineHeight: 1.2, textShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
                {headline}
            </div>
        )}
        {subline && (
            <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 22, marginTop: 12, textAlign: 'center' }}>
                {subline}
            </div>
        )}
    </AbsoluteFill>
);

/** Simple text overlay for text-type clips */
const TextOverlay: React.FC<{ text: string }> = ({ text }) => (
    <AbsoluteFill style={{
        display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
        padding: '0 60px 80px',
    }}>
        <div style={{
            background: 'rgba(0,0,0,0.7)', borderRadius: 8, padding: '10px 20px',
            color: '#fff', fontSize: 28, fontWeight: 600, maxWidth: '80%',
            textAlign: 'center', lineHeight: 1.3,
        }}>
            {text}
        </div>
    </AbsoluteFill>
);

const TimelineComposition: React.FC<{ tracks: any[]; fps: number }> = ({ tracks, fps }) => {
    // Filter to only renderable tracks, sorted so video is at the bottom (renders first)
    const renderableTracks = tracks
        .filter(t => {
            const dominated = NON_RENDERABLE_TRACK_IDS.has(t.id) || t.isMuted || t.isLocked;
            if (dominated) console.debug('[Preview] Skipping track:', t.id, t.name, { isMuted: t.isMuted, isLocked: t.isLocked });
            return !dominated;
        })
        .sort((a, b) => {
            // Video tracks render first (bottom layer), overlays on top
            const order: Record<string, number> = { video: 0, audio: 1, overlay: 2, text: 3 };
            return (order[a.type] ?? 1) - (order[b.type] ?? 1);
        });

    return (
        <AbsoluteFill style={{ backgroundColor: '#000' }}>
            {renderableTracks.map(track => (
                <AbsoluteFill key={track.id}>
                    {track.clips.map((clip: any) => {
                        const frames = Math.max(1, Math.round(clip.duration * fps));
                        if (clip.duration <= 0) return null;

                        // Resolve the media source: prefer pre-resolved src, fall back to sourceRef
                        const resolvedSrc = clip.src || (clip.sourceRef ? toMediaUrl(clip.sourceRef) : '');

                        // Resolve component type
                        let Component: any = null;
                        let props: any = {};

                        if (clip.type === 'video') {
                            if (!resolvedSrc) {
                                console.warn('[Preview] Skipping video clip with no src:', clip.id, clip.name);
                                return null;
                            }
                            Component = Video;
                            props = {
                                src: resolvedSrc,
                                startFrom: clip.offset ? Math.round(clip.offset * fps) : undefined,
                                onError: (e: any) => console.warn('[Preview] Video load error:', clip.id, resolvedSrc, e),
                                style: { width: '100%', height: '100%', objectFit: 'cover' as const },
                            };
                        } else if (clip.type === 'audio') {
                            if (!resolvedSrc) return null;
                            Component = Audio;
                            props = { src: resolvedSrc };
                        } else if (clip.type === 'image') {
                            if (!resolvedSrc) return null;
                            Component = Img;
                            props = {
                                src: resolvedSrc,
                                style: { width: '100%', height: '100%', objectFit: 'contain' as const },
                            };
                        } else if (clip.type === 'template' && clip.templateId) {
                            const template = getTemplateById(clip.templateId);
                            if (template) {
                                Component = template.component;
                                props = clip.content || {};
                            } else {
                                Component = TemplateFallbackCard;
                                props = {
                                    headline: clip.content?.headline || '',
                                    subline: clip.content?.subline || '',
                                };
                            }
                        } else if (clip.type === 'text' && clip.name) {
                            Component = TextOverlay;
                            props = { text: clip.name };
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
    const { tracks, currentTime, isPlaying, media, currentProject, seekTo: ctxSeekTo } = useEditor();
    const playerRef = useRef<PlayerRef>(null);
    const fps = currentProject?.fps || 30;
    const isPlayingRef = useRef(isPlaying);
    isPlayingRef.current = isPlaying;

    // Pre-filter tracks for the Remotion Player — only pass renderable tracks
    const renderableTracks = React.useMemo(() => {
        return tracks
            .filter(t => !NON_RENDERABLE_TRACK_IDS.has(t.id))
            .map(t => ({
                ...t,
                clips: t.clips
                    .filter((c: any) => c.duration > 0)
                    .map((c: any) => {
                        const mediaPath = media.find(m => m.id === c.mediaId)?.path;
                        const rawSrc = mediaPath || c.sourceRef || '';
                        return {
                            ...c,
                            src: toMediaUrl(rawSrc),
                        };
                    }),
            }))
            .filter(t => t.clips.length > 0); // Drop tracks with no valid clips
    }, [tracks, media]);

    // Compute duration only from renderable clips
    const totalDurationFrames = React.useMemo(() => {
        const maxFrame = renderableTracks
            .flatMap(t => t.clips)
            .reduce((max, c) => Math.max(max, Math.round((c.start + c.duration) * fps)), 0);
        return Math.max(300, maxFrame);
    }, [renderableTracks, fps]);

    // Only seek player when NOT playing (manual scrub from timeline)
    useEffect(() => {
        if (isPlayingRef.current) return;
        if (playerRef.current) {
            const frame = Math.round(currentTime * fps);
            if (Math.abs(playerRef.current.getCurrentFrame() - frame) > 1) {
                playerRef.current.seekTo(frame);
            }
        }
    }, [currentTime, fps]);

    // Let Remotion player drive currentTime while playing
    useEffect(() => {
        const player = playerRef.current;
        if (!player) return;
        const onFrame = () => {
            if (isPlayingRef.current) {
                ctxSeekTo(player.getCurrentFrame() / fps);
            }
        };
        player.addEventListener('timeupdate', onFrame);
        return () => player.removeEventListener('timeupdate', onFrame);
    }, [fps, ctxSeekTo]);

    // Sync player pause/play
    useEffect(() => {
        if (playerRef.current) {
            if (isPlaying && !playerRef.current.isPlaying()) {
                try { playerRef.current.play(); } catch { /* autoplay policy */ }
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
                {renderableTracks.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: 14, textAlign: 'center', padding: 40 }}>
                        No renderable clips. Import media or run the AI pipeline.
                    </div>
                ) : (
                    <PreviewErrorBoundary>
                    <Player
                        ref={playerRef}
                        component={TimelineComposition}
                        inputProps={{
                            tracks: renderableTracks,
                            fps,
                        }}
                        durationInFrames={totalDurationFrames}
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
                        clickToPlay={false}
                        loop
                        renderLoading={() => (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', color: '#666' }}>
                                Loading preview…
                            </div>
                        )}
                    />
                    </PreviewErrorBoundary>
                )}
            </div>
        </div>
    );
};
