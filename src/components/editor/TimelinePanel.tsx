import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useEditor } from '../../context/EditorContext';

// ── Constants ────────────────────────────────────────────────────────────────

const TRACK_HEIGHT = 52;
const TRACK_HEADER_WIDTH = 110;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 20;

const BASE_PX_PER_SEC = 80;

const TRACK_COLORS: Record<string, string> = {
    video: '#4a9eff',
    audio: '#4caf50',
    overlay: '#ab47bc',
    text: '#ffb300',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toFixed(1).padStart(4, '0')}`;
};

// ── Component ────────────────────────────────────────────────────────────────

export const TimelinePanel: React.FC = () => {
    const {
        tracks,
        currentTime,
        seekTo,
        moveClip,
        splitClip,
        trimClip,
        deleteClip,
        undo,
        redo,
        canUndo,
        canRedo,
        selectedClipId,
        setSelectedClipId,
        addClip,
        addTemplateClip,
        addTrack,
        deleteTrack,
    } = useEditor();

    // ── Local state ──────────────────────────────────────────────────────────

    const [zoom, setZoom] = useState(1);
    const [scrollLeft, setScrollLeft] = useState(0);
    const timelineRef = useRef<HTMLDivElement>(null);
    const headerRef = useRef<HTMLDivElement>(null);
    const isScrollingRef = useRef(false);

    // Drag state
    const [dragState, setDragState] = useState<{
        type: 'move' | 'trim-start' | 'trim-end';
        clipId: string;
        trackId: string;
        startX: number;
        startValue: number; // clip.start for move, or edge time for trim
    } | null>(null);

    const pxPerSec = BASE_PX_PER_SEC * zoom;

    // ── Computed values ──────────────────────────────────────────────────────

    const totalDuration = useMemo(() => {
        const maxEnd = Math.max(
            10,
            ...tracks.flatMap(t => t.clips).map(c => c.start + c.duration)
        );
        return maxEnd + 5; // add padding
    }, [tracks]);

    // Track display order: overlay/text → video → audio
    const TRACK_ORDER: Record<string, number> = { overlay: 0, text: 1, video: 2, audio: 3 };
    const sortedTracks = useMemo(() =>
        [...tracks].sort((a, b) => (TRACK_ORDER[a.type] ?? 2) - (TRACK_ORDER[b.type] ?? 2)),
        [tracks]);

    const totalWidth = totalDuration * pxPerSec;

    // ── Time ruler ticks ─────────────────────────────────────────────────────

    const rulerTicks = useMemo(() => {
        // Choose tick interval based on zoom
        let interval = 1;
        if (pxPerSec < 20) interval = 10;
        else if (pxPerSec < 40) interval = 5;
        else if (pxPerSec < 100) interval = 2;
        else if (pxPerSec > 300) interval = 0.5;
        else if (pxPerSec > 600) interval = 0.25;

        const ticks: { time: number; major: boolean }[] = [];
        for (let t = 0; t <= totalDuration; t += interval) {
            ticks.push({ time: t, major: t % (interval * 5) < 0.001 || interval >= 5 });
        }
        return ticks;
    }, [totalDuration, pxPerSec]);

    // ── Mouse handlers ───────────────────────────────────────────────────────

    const timeFromX = useCallback((clientX: number): number => {
        if (!timelineRef.current) return 0;
        const rect = timelineRef.current.getBoundingClientRect();
        return Math.max(0, (clientX - rect.left + scrollLeft) / pxPerSec);
    }, [pxPerSec, scrollLeft]);

    const handleTimelineClick = useCallback((e: React.MouseEvent) => {
        // Only seek if clicking on empty space (not on a clip)
        if ((e.target as HTMLElement).closest('.timeline-clip')) return;
        seekTo(timeFromX(e.clientX));
    }, [seekTo, timeFromX]);

    const handleClipMouseDown = useCallback((
        e: React.MouseEvent,
        clipId: string,
        trackId: string,
        clipStart: number,
        type: 'move' | 'trim-start' | 'trim-end'
    ) => {
        e.stopPropagation();
        e.preventDefault();
        setSelectedClipId(clipId);
        setDragState({
            type,
            clipId,
            trackId,
            startX: e.clientX,
            startValue: type === 'move' ? clipStart : type === 'trim-start' ? clipStart : clipStart,
        });
    }, [setSelectedClipId]);

    // Global mouse handlers for drag
    useEffect(() => {
        if (!dragState) return;

        const handleMouseMove = (e: MouseEvent) => {
            const deltaPx = e.clientX - dragState.startX;
            const deltaSec = deltaPx / pxPerSec;

            if (dragState.type === 'move') {
                const newStart = Math.max(0, dragState.startValue + deltaSec);
                moveClip(dragState.clipId, dragState.trackId, newStart);
            } else if (dragState.type === 'trim-start') {
                const newValue = dragState.startValue + deltaSec;
                trimClip(dragState.clipId, dragState.trackId, 'start', newValue);
            } else if (dragState.type === 'trim-end') {
                const newValue = dragState.startValue + deltaSec;
                trimClip(dragState.clipId, dragState.trackId, 'end', newValue);
            }
        };

        const handleMouseUp = () => {
            setDragState(null);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [dragState, pxPerSec, moveClip, trimClip]);

    // ── Split at playhead ────────────────────────────────────────────────────

    const handleSplit = useCallback(() => {
        // Find clip under playhead on selected track, or any track
        for (const track of tracks) {
            for (const clip of track.clips) {
                if (
                    currentTime > clip.start + 0.01 &&
                    currentTime < clip.start + clip.duration - 0.01
                ) {
                    // If there's a selected clip, only split that one
                    if (selectedClipId && clip.id !== selectedClipId) continue;
                    splitClip(clip.id, track.id, currentTime);
                    return;
                }
            }
        }
    }, [tracks, currentTime, selectedClipId, splitClip]);

    const handleDelete = useCallback(() => {
        if (!selectedClipId) return;
        for (const track of tracks) {
            const clip = track.clips.find(c => c.id === selectedClipId);
            if (clip) {
                deleteClip(clip.id, track.id, true); // ripple delete
                return;
            }
        }
    }, [selectedClipId, tracks, deleteClip]);

    // ── Zoom ─────────────────────────────────────────────────────────────────

    const handleWheel = useCallback((e: React.WheelEvent) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const factor = e.deltaY < 0 ? 1.15 : 0.87;
            setZoom(prev => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev * factor)));
        }
    }, []);

    const zoomIn = useCallback(() => setZoom(prev => Math.min(MAX_ZOOM, prev * 1.3)), []);
    const zoomOut = useCallback(() => setZoom(prev => Math.max(MIN_ZOOM, prev / 1.3)), []);

    // ── Keyboard shortcuts ───────────────────────────────────────────────────

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Don't handle if user is typing in an input
            if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;

            const isMeta = e.metaKey || e.ctrlKey;

            if (e.key === 's' && !isMeta) {
                e.preventDefault();
                handleSplit();
            } else if ((e.key === 'Delete' || e.key === 'Backspace') && !isMeta) {
                e.preventDefault();
                handleDelete();
            } else if (e.key === 'z' && isMeta && !e.shiftKey) {
                e.preventDefault();
                undo();
            } else if ((e.key === 'z' && isMeta && e.shiftKey) || (e.key === 'y' && isMeta)) {
                e.preventDefault();
                redo();
            } else if (e.key === '=' && isMeta) {
                e.preventDefault();
                zoomIn();
            } else if (e.key === '-' && isMeta) {
                e.preventDefault();
                zoomOut();
            } else if (e.key === 'Escape') {
                setSelectedClipId(null);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleSplit, handleDelete, undo, redo, zoomIn, zoomOut, setSelectedClipId]);

    // ── Scroll handler ───────────────────────────────────────────────────────

    const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        setScrollLeft(e.currentTarget.scrollLeft);
        if (headerRef.current && !isScrollingRef.current) {
            isScrollingRef.current = true;
            headerRef.current.scrollTop = e.currentTarget.scrollTop;
            isScrollingRef.current = false;
        }
    }, []);

    const handleHeaderScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        if (timelineRef.current && !isScrollingRef.current) {
            isScrollingRef.current = true;
            timelineRef.current.scrollTop = e.currentTarget.scrollTop;
            isScrollingRef.current = false;
        }
    }, []);

    // ── Render ────────────────────────────────────────────────────────────────

    const playheadLeft = currentTime * pxPerSec;

    return (
        <div className="panel panel-bottom" id="timeline-panel" style={{ display: 'flex', flexDirection: 'column', userSelect: 'none' }}>
            {/* Toolbar */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 8px',
                borderBottom: '1px solid var(--border-color, #333)',
                background: 'var(--panel-header-bg, #1a1a2e)',
                fontSize: '0.8rem',
                flexShrink: 0,
            }}>
                <span style={{ fontWeight: 600, marginRight: 8, color: 'var(--text-muted, #aaa)' }}>Timeline</span>

                <button onClick={handleSplit} title="Split at playhead (S)" style={toolbarBtnStyle}>
                    ✂️ Split
                </button>
                <button onClick={handleDelete} disabled={!selectedClipId} title="Delete selected clip (Del)" style={toolbarBtnStyle}>
                    🗑 Delete
                </button>

                <div style={{ width: 1, height: 20, background: '#444', margin: '0 4px' }} />

                <button onClick={undo} disabled={!canUndo} title="Undo (Cmd+Z)" style={toolbarBtnStyle}>
                    ↩ Undo
                </button>
                <button onClick={redo} disabled={!canRedo} title="Redo (Cmd+Shift+Z)" style={toolbarBtnStyle}>
                    ↪ Redo
                </button>

                <div style={{ width: 1, height: 20, background: '#444', margin: '0 4px' }} />

                <button onClick={zoomOut} title="Zoom out (Cmd+-)" style={toolbarBtnStyle}>−</button>
                <span style={{ fontSize: '0.75rem', color: '#888', minWidth: 40, textAlign: 'center' }}>
                    {Math.round(zoom * 100)}%
                </span>
                <button onClick={zoomIn} title="Zoom in (Cmd+=)" style={toolbarBtnStyle}>+</button>

                <div style={{ flex: 1 }} />

                <span style={{ fontSize: '0.75rem', color: '#999' }}>
                    {formatTime(currentTime)}
                </span>
            </div>

            {/* Timeline body */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                {/* Track headers */}
                <div
                    ref={headerRef}
                    onScroll={handleHeaderScroll}
                    style={{
                        width: TRACK_HEADER_WIDTH,
                        flexShrink: 0,
                        borderRight: '1px solid #333',
                        background: 'var(--panel-bg, #0f0f1e)',
                        overflowY: 'auto',
                        overflowX: 'hidden',
                        scrollbarWidth: 'none', // Hide scrollbar for cleaner look
                    }}
                >
                    {/* Ruler header */}
                    <div style={{ height: 26, borderBottom: '1px solid #333' }} />

                    {sortedTracks.map(track => (
                        <div key={track.id} style={{
                            height: TRACK_HEIGHT,
                            display: 'flex',
                            alignItems: 'center',
                            padding: '0 8px',
                            borderBottom: '1px solid #222',
                            fontSize: '0.75rem',
                            color: '#aaa',
                            gap: 6,
                        }}>
                            <span style={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                background: TRACK_COLORS[track.type] || '#666',
                                flexShrink: 0,
                            }} />
                            <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {track.name}
                                </span>
                                <button
                                    onClick={(e) => { e.stopPropagation(); if (confirm('Delete track?')) deleteTrack(track.id); }}
                                    style={{
                                        background: 'transparent', border: 'none', color: '#666',
                                        cursor: 'pointer', fontSize: 10, padding: 2, display: 'none'
                                    }}
                                    className="track-delete-btn"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                    ))}

                    {/* Add Track Buttons */}
                    <div style={{ padding: 8, display: 'flex', gap: 4, justifyContent: 'center', borderTop: '1px solid #333' }}>
                        <button title="Add Video Track" onClick={() => addTrack('video')} style={addTrackBtnStyle}>🎥</button>
                        <button title="Add Audio Track" onClick={() => addTrack('audio')} style={addTrackBtnStyle}>🎵</button>
                        <button title="Add Overlay Track" onClick={() => addTrack('overlay')} style={addTrackBtnStyle}>✨</button>
                    </div>
                </div>

                {/* Scrollable timeline area */}
                <div
                    ref={timelineRef}
                    style={{
                        flex: 1,
                        overflowX: 'auto',
                        overflowY: 'auto',
                        position: 'relative',
                    }}
                    onClick={handleTimelineClick}
                    onWheel={handleWheel}
                    onScroll={handleScroll}
                >
                    <div style={{ position: 'relative', width: totalWidth, minHeight: '100%' }}>
                        {/* Time ruler */}
                        <div style={{
                            height: 26,
                            borderBottom: '1px solid #333',
                            position: 'relative',
                            background: 'var(--panel-bg, #0f0f1e)',
                        }}>
                            {rulerTicks.map((tick, i) => (
                                <div key={i} style={{
                                    position: 'absolute',
                                    left: tick.time * pxPerSec,
                                    top: tick.major ? 0 : 14,
                                    bottom: 0,
                                    width: 1,
                                    background: tick.major ? '#444' : '#2a2a2a',
                                }}>
                                    {tick.major && (
                                        <span style={{
                                            position: 'absolute',
                                            top: 2,
                                            left: 4,
                                            fontSize: '0.65rem',
                                            color: '#777',
                                            whiteSpace: 'nowrap',
                                        }}>
                                            {formatTime(tick.time)}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>

                        {sortedTracks.map(track => (
                            <div
                                key={track.id}
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    e.dataTransfer.dropEffect = 'copy';
                                }}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    const dataStr = e.dataTransfer.getData('application/json');
                                    if (dataStr) {
                                        try {
                                            const data = JSON.parse(dataStr);
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            const x = e.clientX - rect.left;
                                            const time = Math.max(0, x / pxPerSec);

                                            // Determine what type of track this asset needs
                                            let requiredType: 'video' | 'audio' | 'overlay' = 'video';
                                            if (data.type === 'media-item' && data.mediaType === 'audio') {
                                                requiredType = 'audio';
                                            }

                                            // Check type compatibility
                                            const isCompatible =
                                                track.type === requiredType ||
                                                (track.type === 'overlay' && requiredType === 'video') ||
                                                (track.type === 'video' && requiredType === 'video');

                                            const addFn = (targetId: string) => {
                                                if (data.type === 'template-item') addTemplateClip(data.id, targetId, time);
                                                else addClip(data.id, targetId, time);
                                            };

                                            // Incompatible type → create correct track
                                            if (!isCompatible) {
                                                const newId = `track-${requiredType}-${Date.now()}`;
                                                addTrack(requiredType, newId);
                                                addFn(newId);
                                                return;
                                            }

                                            // Check overlap on this track
                                            const duration = data.duration || 5;
                                            const hasOverlap = track.clips.some(c => {
                                                const cEnd = c.start + c.duration;
                                                const newEnd = time + duration;
                                                return time < cEnd && newEnd > c.start;
                                            });

                                            if (hasOverlap) {
                                                // Try to find another compatible track with no overlap
                                                let placed = false;
                                                for (const t of tracks) {
                                                    if (t.id === track.id) continue;
                                                    if (t.type !== track.type && !(t.type === 'overlay' && requiredType === 'video')) continue;
                                                    const tOverlap = t.clips.some(c => {
                                                        const cEnd = c.start + c.duration;
                                                        const newEnd = time + duration;
                                                        return time < cEnd && newEnd > c.start;
                                                    });
                                                    if (!tOverlap) {
                                                        addFn(t.id);
                                                        placed = true;
                                                        break;
                                                    }
                                                }
                                                if (!placed) {
                                                    const newId = `track-${track.type}-${Date.now()}`;
                                                    addTrack(track.type as any, newId);
                                                    addFn(newId);
                                                }
                                            } else {
                                                addFn(track.id);
                                            }
                                        } catch (err) {
                                            console.error('Drop error', err);
                                        }
                                    }
                                }}
                                style={{
                                    height: TRACK_HEIGHT,
                                    position: 'relative',
                                    borderBottom: '1px solid #222',
                                    background: 'var(--panel-content-bg, #12121e)',
                                }}
                            >
                                {track.clips.map(clip => {
                                    const left = clip.start * pxPerSec;
                                    const width = clip.duration * pxPerSec;
                                    const isSelected = selectedClipId === clip.id;
                                    const baseColor = TRACK_COLORS[track.type] || '#666';

                                    return (
                                        <div
                                            key={clip.id}
                                            className="timeline-clip"
                                            onClick={(e) => { e.stopPropagation(); setSelectedClipId(clip.id); }}
                                            style={{
                                                position: 'absolute',
                                                left,
                                                top: 4,
                                                width: Math.max(width, 4),
                                                height: TRACK_HEIGHT - 8,
                                                background: `linear-gradient(180deg, ${baseColor}cc, ${baseColor}88)`,
                                                borderRadius: 4,
                                                border: isSelected ? '2px solid #fff' : `1px solid ${baseColor}`,
                                                cursor: dragState ? 'grabbing' : 'grab',
                                                overflow: 'hidden',
                                                display: 'flex',
                                                alignItems: 'center',
                                                boxShadow: isSelected ? '0 0 8px rgba(255,255,255,0.3)' : 'none',
                                                zIndex: isSelected ? 10 : 1,
                                                transition: dragState ? 'none' : 'box-shadow 0.15s',
                                            }}
                                            onMouseDown={(e) => handleClipMouseDown(e, clip.id, track.id, clip.start, 'move')}
                                        >
                                            {/* Left trim handle */}
                                            <div
                                                style={{
                                                    position: 'absolute',
                                                    left: 0,
                                                    top: 0,
                                                    width: 6,
                                                    height: '100%',
                                                    cursor: 'col-resize',
                                                    background: isSelected ? 'rgba(255,255,255,0.4)' : 'transparent',
                                                    borderRadius: '4px 0 0 4px',
                                                    zIndex: 2,
                                                }}
                                                onMouseDown={(e) => handleClipMouseDown(e, clip.id, track.id, clip.start, 'trim-start')}
                                            />

                                            {/* Clip label */}
                                            <span style={{
                                                fontSize: '0.68rem',
                                                color: '#fff',
                                                paddingLeft: 10,
                                                paddingRight: 10,
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                pointerEvents: 'none',
                                                textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                                            }}>
                                                {clip.name || 'Clip'}
                                            </span>

                                            {/* Right trim handle */}
                                            <div
                                                style={{
                                                    position: 'absolute',
                                                    right: 0,
                                                    top: 0,
                                                    width: 6,
                                                    height: '100%',
                                                    cursor: 'col-resize',
                                                    background: isSelected ? 'rgba(255,255,255,0.4)' : 'transparent',
                                                    borderRadius: '0 4px 4px 0',
                                                    zIndex: 2,
                                                }}
                                                onMouseDown={(e) => handleClipMouseDown(e, clip.id, track.id, clip.start + clip.duration, 'trim-end')}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        ))}



                        <NewTrackDropZone
                            height={60}
                            pixelsPerSecond={pxPerSec}
                            onDrop={(item, time) => {
                                // Determine type
                                let type: 'video' | 'audio' | 'overlay' = 'video';
                                if (item.mediaType === 'audio') type = 'audio';
                                if (item.type === 'image') type = 'video';

                                const newTrackId = `track-${type}-${Date.now()}`;
                                addTrack(type, newTrackId);

                                if (item.id && item.trackId) {
                                    // Existing clip move
                                    moveClip(item.id, newTrackId, time);
                                } else if (item.templateId || item.type === 'template-item') {
                                    const tid = item.templateId || item.id;
                                    addTemplateClip(tid, newTrackId, time);
                                } else {
                                    addClip(item.id, newTrackId, time);
                                }
                            }}
                        />

                        {/* Playhead */}
                        <div style={{
                            position: 'absolute',
                            left: playheadLeft,
                            top: 0,
                            bottom: 0,
                            width: 2,
                            background: '#ff4444',
                            zIndex: 20,
                            pointerEvents: 'none',
                        }}>
                            <div style={{
                                position: 'absolute',
                                top: 0,
                                left: -5,
                                width: 0,
                                height: 0,
                                borderLeft: '6px solid transparent',
                                borderRight: '6px solid transparent',
                                borderTop: '8px solid #ff4444',
                            }} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── New Track Drop Zone ─────────────────────────────────────────────────────

const NewTrackDropZone: React.FC<{
    onDrop: (item: any, time: number) => void;
    height: number;
    pixelsPerSecond: number;
}> = ({ onDrop, height, pixelsPerSecond }) => {
    const [isOver, setIsOver] = useState(false);

    return (
        <div
            onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
                setIsOver(true);
            }}
            onDragLeave={() => setIsOver(false)}
            onDrop={(e) => {
                e.preventDefault();
                setIsOver(false);
                const dataStr = e.dataTransfer.getData('application/json');
                if (dataStr) {
                    try {
                        const data = JSON.parse(dataStr);
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = e.clientX - rect.left;
                        const time = Math.max(0, x / pixelsPerSecond);
                        onDrop(data, time);
                    } catch (err) {
                        console.error('Drop error', err);
                    }
                }
            }}
            style={{
                height,
                background: isOver ? 'rgba(50, 150, 255, 0.1)' : 'transparent',
                border: isOver ? '1px dashed #4a9eff' : '1px dashed rgba(255,255,255,0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-start',
                color: isOver ? '#4a9eff' : '#444',
                fontSize: 12,
                marginTop: 8,
                borderRadius: 4,
                transition: 'all 0.2s',
                pointerEvents: 'all'
            }}
        >
            <span style={{ position: 'sticky', left: 16 }}>
                {isOver ? 'Drop to Create New Track' : 'Drag clip here to create a new layer'}
            </span>
        </div>
    );
};

// ── Styles ────────────────────────────────────────────────────────────────────

const toolbarBtnStyle: React.CSSProperties = {
    background: 'transparent',
    border: '1px solid #444',
    color: '#ccc',
    padding: '3px 8px',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: '0.75rem',
    lineHeight: 1.2,
    transition: 'background 0.15s',
};

const addTrackBtnStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid #444',
    borderRadius: 4,
    color: '#ccc',
    cursor: 'pointer',
    padding: '4px',
    fontSize: '12px',
    flex: 1,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
};
