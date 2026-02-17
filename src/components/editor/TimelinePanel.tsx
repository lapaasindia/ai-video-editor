import React, { useRef, useState, useEffect } from 'react';
import { useEditor } from '../../context/EditorContext';

export const TimelinePanel: React.FC = () => {
    const { tracks, currentTime, seekTo, isPlaying, togglePlayback, addClip, moveClip } = useEditor();
    const timelineRef = useRef<HTMLDivElement>(null);

    // internal drag state
    const [dragging, setDragging] = useState<{ clipId: string, trackId: string, startX: number, initialTime: number } | null>(null);

    // Zoom level: pixels per second
    const zoom = 50;

    // Global mouse moves for dragging clips
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (dragging && timelineRef.current) {
                const diffPixels = e.clientX - dragging.startX;
                const diffSeconds = diffPixels / zoom;
                let newTime = Math.max(0, dragging.initialTime + diffSeconds);

                // Snapping Logic
                const snapThreshold = 10 / zoom; // 10 pixels

                // Snap to Playhead
                if (Math.abs(newTime - currentTime) < snapThreshold) {
                    newTime = currentTime;
                }

                // Snap to other clips (simple version: snap to start/end of other clips on same track)
                // We can expand this to all tracks if needed
                const track = tracks.find(t => t.id === dragging.trackId);
                if (track) {
                    track.clips.forEach(clip => {
                        if (clip.id === dragging.clipId) return; // Don't snap to self

                        // Snap to start
                        if (Math.abs(newTime - clip.start) < snapThreshold) {
                            newTime = clip.start;
                        }

                        // Snap to end
                        const clipEnd = clip.start + clip.duration;
                        if (Math.abs(newTime - clipEnd) < snapThreshold) {
                            newTime = clipEnd;
                        }

                        // Snap end of dragged clip to start of target clip
                        const draggingEnd = newTime + (tracks.find(t => t.id === dragging.trackId)?.clips.find(c => c.id === dragging.clipId)?.duration || 0);
                        if (Math.abs(draggingEnd - clip.start) < snapThreshold) {
                            newTime = clip.start - (tracks.find(t => t.id === dragging.trackId)?.clips.find(c => c.id === dragging.clipId)?.duration || 0);
                        }
                    });
                }

                moveClip(dragging.clipId, dragging.trackId, newTime);
            }
        };

        const handleMouseUp = () => {
            setDragging(null);
        };

        if (dragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [dragging, moveClip, zoom, currentTime, tracks]);

    const handleTimelineClick = (e: React.MouseEvent) => {
        // Prevent seeking if we just finished dragging
        if (dragging) return;

        // Only seek if clicking on ruler or empty track space (not a clip)
        const target = e.target as HTMLElement;
        if (target.closest('.timeline-clip')) return;

        if (!timelineRef.current) return;
        const rect = timelineRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left - 200; // 200px sidebar offset
        const time = Math.max(0, x / zoom);
        seekTo(time);
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        const frames = Math.floor((seconds % 1) * 30); // 30fps assumption for display
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
    };

    return (
        <div className="panel panel-bottom timeline-panel" id="timeline-panel">
            <div className="panel-header">
                <h3>Timeline</h3>
                <div className="timeline-controls-header">
                    <button className="btn-icon" onClick={togglePlayback}>
                        {isPlaying ? '⏸' : '▶'}
                    </button>
                    <span className="time-display">{formatTime(currentTime)}</span>
                </div>
            </div>

            <div className="timeline-container">
                <div className="timeline-content" ref={timelineRef}>
                    <div className="timeline-ruler" onClick={handleTimelineClick}>
                        <div
                            className="playhead"
                            style={{ left: `${200 + currentTime * zoom}px` }}
                        />
                    </div>

                    <div className="tracks-container">
                        {tracks.map(track => (
                            <div key={track.id} className="track">
                                <div className="track-header">
                                    <span className="track-name">{track.name}</span>
                                    <div className="track-actions">
                                        <button className="btn-icon-xs">M</button>
                                        <button className="btn-icon-xs">L</button>
                                    </div>
                                </div>
                                <div
                                    className="track-lane"
                                    onClick={handleTimelineClick}
                                    onDragOver={(e) => {
                                        e.preventDefault();
                                        e.dataTransfer.dropEffect = 'copy';
                                    }}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        try {
                                            const data = JSON.parse(e.dataTransfer.getData('application/json'));
                                            if (data.type === 'media-item') {
                                                const rect = e.currentTarget.getBoundingClientRect();
                                                const x = e.clientX - rect.left;
                                                const time = Math.max(0, x / zoom);
                                                addClip(data.id, track.id, time);
                                            }
                                        } catch (err) {
                                            console.error('Drop failed', err);
                                        }
                                    }}
                                >
                                    {track.clips.map(clip => (
                                        <div
                                            key={clip.id}
                                            className={`timeline-clip clip-${clip.type}`}
                                            style={{
                                                left: `${clip.start * zoom}px`,
                                                width: `${clip.duration * zoom}px`
                                            }}
                                            title={clip.name}
                                            onMouseDown={(e) => {
                                                e.stopPropagation();
                                                setDragging({
                                                    clipId: clip.id,
                                                    trackId: track.id,
                                                    startX: e.clientX,
                                                    initialTime: clip.start
                                                });
                                            }}
                                        >
                                            <span className="clip-name">{clip.name}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
