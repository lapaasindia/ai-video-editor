
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useTauri } from '../hooks/useTauri';
import { logger } from '../utils/logger';

const BACKEND = 'http://localhost:43123';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Project {
    id: string;
    name: string;
    fps: number;
    width: number;
    height: number;
    aspectRatio?: string;
    resolution?: string;
    language?: string;
    aiMode?: string;
    transcriptionModel?: string;
    inputPath?: string;
    duration?: number;
}

export interface MediaItem {
    id: string;
    path: string;
    name: string;
    type: 'video' | 'image' | 'audio';
    duration?: number;
    proxyPath?: string;
    waveformPath?: string;
    status: 'ok' | 'processing' | 'error';
}

export interface Clip {
    id: string;
    mediaId: string;
    trackId: string;
    start: number;   // seconds
    duration: number; // seconds
    offset: number;
    type: 'video' | 'audio' | 'text' | 'image';
    name: string;
}

export interface Track {
    id: string;
    type: 'video' | 'audio' | 'text' | 'overlay';
    name: string;
    clips: Clip[];
    isMuted?: boolean;
    isLocked?: boolean;
}

export interface TranscriptSegment {
    id: string;
    startUs: number;
    endUs: number;
    text: string;
    confidence: number;
}

export interface CutRange {
    startUs: number;
    endUs: number;
    reason: string;
    confidence: number;
}

export interface RenderResult {
    outputPath: string;
    durationSec?: number;
    overlayAppliedCount?: number;
}

export type PipelineStage =
    | 'idle'
    | 'transcribing'
    | 'rough_cut_ready'
    | 'enriching'
    | 'enrichment_ready'
    | 'rendering'
    | 'done'
    | 'error';

export interface EditorState {
    currentProject: Project | null;
    media: MediaItem[];
    tracks: Track[];
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    status: 'ready' | 'processing' | 'error';
    statusMessage: string;
    // Pipeline state
    pipelineStage: PipelineStage;
    pipelineError: string | null;
    transcript: TranscriptSegment[] | null;
    cutPlan: CutRange[] | null;
    renderResult: RenderResult | null;
    enrichmentSummary: { templateCount: number; assetCount: number } | null;
    renderProgress: { percent: number; stage: string } | null;
}

interface EditorContextType extends EditorState {
    backendAvailable: boolean;
    loadProjects: () => Promise<void>;
    createProject: (name: string, fps: number, options?: any) => Promise<void>;
    closeProject: () => void;
    importMedia: (path?: string) => Promise<void>;
    addClip: (mediaId: string, trackId: string, time: number) => void;
    moveClip: (clipId: string, trackId: string, newStartTime: number) => void;
    splitClip: (clipId: string, trackId: string, splitTime: number) => void;
    trimClip: (clipId: string, trackId: string, side: 'start' | 'end', newValue: number) => void;
    deleteClip: (clipId: string, trackId: string, ripple?: boolean) => void;
    undo: () => void;
    redo: () => void;
    canUndo: boolean;
    canRedo: boolean;
    selectedClipId: string | null;
    setSelectedClipId: (id: string | null) => void;
    togglePlayback: () => void;
    seekTo: (time: number) => void;
    setStatus: (status: 'ready' | 'processing' | 'error', message: string) => void;
    // Pipeline actions
    startEditing: () => Promise<void>;
    editNow: () => Promise<void>;
    renderVideo: (options?: { burnSubtitles?: boolean; quality?: string }) => Promise<void>;
    openInFinder: (filePath: string) => Promise<void>;
    resetPipeline: () => void;
    updateProject: (id: string, updates: Partial<Project> & { settings?: any }) => Promise<void>;
    saveProject: () => Promise<void>;
    loadProject: (projectId: string) => Promise<void>;
    setMedia: React.Dispatch<React.SetStateAction<MediaItem[]>>;
    setTracks: React.Dispatch<React.SetStateAction<Track[]>>;
    setCutPlan: React.Dispatch<React.SetStateAction<CutRange[] | null>>;
}

const EditorContext = createContext<EditorContextType | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

export const EditorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { invokeCommand, isTauri } = useTauri();

    const DEFAULT_TRACKS: Track[] = [
        { id: 'track-1', type: 'video', name: 'Video 1', clips: [] },
        { id: 'track-2', type: 'audio', name: 'Audio 1', clips: [] },
        { id: 'track-3', type: 'overlay', name: 'Overlays', clips: [] },
        { id: 'track-4', type: 'text', name: 'Captions', clips: [] },
    ];

    // Core state
    const [currentProject, setCurrentProject] = useState<Project | null>(null);
    const [backendAvailable, setBackendAvailable] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [media, setMedia] = useState<MediaItem[]>([]);
    const [tracks, setTracks] = useState<Track[]>(DEFAULT_TRACKS);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration] = useState(0);
    const [status, setStatus] = useState<'ready' | 'processing' | 'error'>('ready');
    const [statusMessage, setStatusMessage] = useState('Ready');
    const [selectedClipId, setSelectedClipId] = useState<string | null>(null);

    // Undo/Redo stacks
    const [undoStack, setUndoStack] = useState<Track[][]>([]);
    const [redoStack, setRedoStack] = useState<Track[][]>([]);
    const MAX_UNDO = 50;

    // Pipeline state
    const [pipelineStage, setPipelineStage] = useState<PipelineStage>('idle');
    const [pipelineError, setPipelineError] = useState<string | null>(null);
    const [transcript, setTranscript] = useState<TranscriptSegment[] | null>(null);
    const [cutPlan, setCutPlan] = useState<CutRange[] | null>(null);
    const [renderResult, setRenderResult] = useState<RenderResult | null>(null);
    const [enrichmentSummary, setEnrichmentSummary] = useState<{ templateCount: number; assetCount: number } | null>(null);
    const [renderProgress, setRenderProgress] = useState<{ percent: number; stage: string } | null>(null);

    // ── Helpers ──────────────────────────────────────────────────────────────

    const setStatusWrapper = useCallback((s: 'ready' | 'processing' | 'error', m: string) => {
        setStatus(s);
        setStatusMessage(m);
    }, []);

    const normalizeProject = (p: any): Project => {
        const s = p.settings || {};
        const resMap: Record<string, { w: number; h: number }> = {
            '4K': { w: 3840, h: 2160 }, '1080p': { w: 1920, h: 1080 }, '720p': { w: 1280, h: 720 }
        };
        const dims = resMap[s.resolution] || { w: 1920, h: 1080 };
        return {
            id: p.id || p.projectId || '',
            name: p.name || 'Untitled',
            fps: Number(s.fps || p.fps || 30),
            width: dims.w,
            height: dims.h,
            aspectRatio: s.aspectRatio || p.aspectRatio || '16:9',
            resolution: s.resolution || p.resolution || '1080p',
            language: s.language || p.language || 'en',
            aiMode: s.aiMode || p.aiMode || 'hybrid',
            transcriptionModel: s.transcriptionModel || p.transcriptionModel || '',
            inputPath: p.inputPath || '',
            duration: p.duration,
        };
    };

    // ── Project management ───────────────────────────────────────────────────

    const loadProjects = useCallback(async () => {
        try {
            let projects: any[] = [];
            if (isTauri) {
                projects = await invokeCommand('list_projects', {});
            } else {
                const res = await fetch(`${BACKEND}/projects`);
                if (res.ok) {
                    const data = await res.json();
                    projects = Array.isArray(data.projects) ? data.projects : [];
                }
            }
            if (projects.length > 0) {
                setCurrentProject(normalizeProject(projects[projects.length - 1]));
            }
        } catch (err) {
            logger.error('loadProjects failed', err);
        }
    }, [isTauri, invokeCommand]);

    const createProject = useCallback(async (name: string, fps: number, options: any = {}) => {
        try {
            let project: any;
            if (isTauri) {
                project = await invokeCommand('create_project', { name, fps, ...options });
            } else {
                const res = await fetch(`${BACKEND}/projects/create`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, fps, settings: options })
                });
                const data = await res.json();
                project = data.project || data;
            }
            setCurrentProject(normalizeProject(project));
            // Reset pipeline when creating a new project
            setPipelineStage('idle');
            setTranscript(null);
            setCutPlan(null);
            setRenderResult(null);
            setEnrichmentSummary(null);
            setMedia([]);
            setTracks([
                { id: 'track-1', type: 'video', name: 'Video 1', clips: [] },
                { id: 'track-2', type: 'audio', name: 'Audio 1', clips: [] },
                { id: 'track-3', type: 'overlay', name: 'Overlays', clips: [] },
                { id: 'track-4', type: 'text', name: 'Captions', clips: [] },
            ]);
        } catch (err: any) {
            logger.error('createProject failed', err);
            setStatusWrapper('error', `Failed to create project: ${err.message}`);
        }
    }, [isTauri, invokeCommand, setStatusWrapper]);

    const updateProject = useCallback(async (id: string, updates: any) => {
        try {
            let updatedProject: any;
            if (isTauri) {
                // Not implemented in Tauri yet, or use invokeCommand('update_project', ...)
                // For now, just update local state if backend not available
                updatedProject = { ...currentProject, ...updates };
            } else {
                const res = await fetch(`${BACKEND}/projects/${id}/settings`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ settings: updates.settings || updates })
                });
                if (!res.ok) throw new Error('Failed to update project settings');
                const data = await res.json();
                updatedProject = data;
            }
            setCurrentProject(normalizeProject(updatedProject));
        } catch (err: any) {
            logger.error('updateProject failed', err);
            throw err;
        }
    }, [isTauri, currentProject]);

    // ── Media import ─────────────────────────────────────────────────────────

    const importMedia = useCallback(async (_path?: string) => {
        if (!currentProject) {
            alert('Please create a project first');
            return;
        }
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    }, [currentProject]);

    const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!currentProject) {
            alert('Please create a project first');
            return;
        }

        const tempId = `media-${Date.now()}`;
        const mediaName = file.name;

        setMedia(prev => [...prev, {
            id: tempId,
            path: mediaName,
            name: mediaName,
            type: 'video' as const,
            status: 'processing' as const
        }]);
        setStatusWrapper('processing', `Uploading ${mediaName}...`);
        logger.log(`Starting upload for file: ${mediaName}`);

        try {
            // Step 1: Upload file to server
            const uploadResponse = await fetch(`${BACKEND}/media/upload`, {
                method: 'POST',
                headers: { 'x-filename': encodeURIComponent(file.name) },
                body: file
            });

            if (!uploadResponse.ok) {
                const text = await uploadResponse.text();
                throw new Error(`Upload failed (${uploadResponse.status}): ${text}`);
            }

            const uploadResult = await uploadResponse.json();
            logger.log('Upload successful', uploadResult);

            if (!uploadResult.ok || !uploadResult.path) {
                throw new Error('Upload response missing path');
            }

            // Step 2: Ingest the uploaded file (30s timeout — ffprobe only, no proxy)
            setStatusWrapper('processing', `Processing ${mediaName}...`);
            logger.log(`Ingesting from: ${uploadResult.path}`);

            const ingestResponse = await fetch(`${BACKEND}/media/ingest`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: AbortSignal.timeout(30_000),
                body: JSON.stringify({
                    projectId: currentProject.id,
                    input: uploadResult.path,
                    generateProxy: false,
                    generateWaveform: false
                })
            });

            if (!ingestResponse.ok) {
                const text = await ingestResponse.text();
                throw new Error(`Ingest failed (${ingestResponse.status}): ${text}`);
            }

            const ingestResult = await ingestResponse.json();
            logger.log('Ingest successful', ingestResult);

            const durationSec = ingestResult.media?.durationSec;
            const finalPath = uploadResult.path;

            setMedia(prev => prev.map(item =>
                item.id === tempId
                    ? { ...item, path: finalPath, status: 'ok' as const, duration: durationSec }
                    : item
            ));
            setStatusWrapper('ready', `Imported: ${mediaName}`);

            // Store inputPath on project for pipeline use
            setCurrentProject(prev => prev ? { ...prev, inputPath: finalPath, duration: durationSec } : prev);

        } catch (error: any) {
            logger.error('Import Error', error);
            const msg = error.name === 'TimeoutError'
                ? 'Ingest timed out — the backend may still be processing. Check backend logs.'
                : error.message;
            setMedia(prev => prev.map(item =>
                item.id === tempId ? { ...item, status: 'error' as const } : item
            ));
            setStatusWrapper('error', `Import failed: ${msg}`);
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    }, [currentProject, setStatusWrapper]);

    // ── Pipeline: Start Editing ───────────────────────────────────────────────

    const startEditing = useCallback(async () => {
        if (!currentProject) {
            alert('No active project');
            return;
        }

        // Find the first ready video media item
        // Find the first ready video media item (case-insensitive check)
        const videoItem = media.find(m => m.status === 'ok' && m.type.toLowerCase() === 'video');
        if (!videoItem) {
            alert('Please import a video first (status must be OK)');
            return;
        }

        setPipelineStage('transcribing');
        setPipelineError(null);
        setStatusWrapper('processing', 'Transcribing and analyzing cuts…');
        logger.log('startEditing: calling /start-editing', { projectId: currentProject.id, input: videoItem.path });

        try {
            const res = await fetch(`${BACKEND}/start-editing`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: currentProject.id,
                    input: videoItem.path,
                    mode: currentProject.aiMode || 'hybrid',
                    language: currentProject.language || 'en',
                    fps: currentProject.fps || 30,
                    sourceRef: videoItem.id,
                    transcriptionModel: currentProject.transcriptionModel || '',
                })
            });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(`Start Editing failed (${res.status}): ${text}`);
            }

            const data = await res.json();
            logger.log('startEditing result', data);

            // Extract transcript segments
            const segments: TranscriptSegment[] = (data.pipeline?.transcript?.segments || []).map((s: any) => ({
                id: s.id || `seg-${s.startUs}`,
                startUs: Number(s.startUs || 0),
                endUs: Number(s.endUs || 0),
                text: s.text || '',
                confidence: Number(s.confidence || 0.9),
            }));
            setTranscript(segments);

            // Extract cut plan
            const removeRanges: CutRange[] = (data.pipeline?.removeRanges || []).map((r: any) => ({
                startUs: Number(r.startUs || 0),
                endUs: Number(r.endUs || 0),
                reason: r.reason || 'unknown',
                confidence: Number(r.confidence || 0.7),
            }));
            setCutPlan(removeRanges);

            // Populate timeline from returned timeline clips or generate from cut plan
            let timelineClips = data.timeline?.clips || [];

            if (timelineClips.length === 0 && videoItem.duration) {
                // Generate clips from cut plan (invert remove ranges)
                const totalDurationUs = videoItem.duration * 1_000_000;
                const keptRanges: { startUs: number; endUs: number }[] = [];
                let cursorUs = 0;

                // Sort ranges just in case
                const sortedRemove = [...removeRanges].sort((a, b) => a.startUs - b.startUs);

                for (const range of sortedRemove) {
                    if (range.startUs > cursorUs) {
                        keptRanges.push({ startUs: cursorUs, endUs: range.startUs });
                    }
                    cursorUs = Math.max(cursorUs, range.endUs);
                }
                if (cursorUs < totalDurationUs) {
                    keptRanges.push({ startUs: cursorUs, endUs: totalDurationUs });
                }

                timelineClips = keptRanges.map((range, idx) => ({
                    type: 'video',
                    startUs: 0, // placed sequentially
                    durationUs: range.endUs - range.startUs,
                    sourceOffsetUs: range.startUs,
                    label: `Clip ${idx + 1}`
                }));

                // Adjust placement start times
                let currentPlacementUs = 0;
                timelineClips = timelineClips.map((c: any) => {
                    const clip = { ...c, startUs: currentPlacementUs };
                    currentPlacementUs += c.durationUs;
                    return clip;
                });
            }

            if (timelineClips.length > 0) {
                setTracks(prev => prev.map(track => {
                    if (track.id === 'track-1') {
                        const videoCLips = timelineClips
                            .filter((c: any) => c.type === 'video' || !c.type)
                            .map((c: any, idx: number) => ({
                                id: `tl-clip-${Date.now()}-${idx}`,
                                mediaId: videoItem.id,
                                trackId: 'track-1',
                                start: Number(c.startUs || 0) / 1_000_000,
                                duration: (Number(c.endUs || 0) - Number(c.startUs || 0)) / 1_000_000,
                                offset: Number(c.sourceStartUs || c.sourceOffsetUs || 0) / 1_000_000,
                                type: 'video' as const,
                                name: c.label || c.clipId || `Clip ${idx + 1}`,
                            }));
                        return { ...track, clips: videoCLips };
                    }
                    return track;
                }));
            }

            setPipelineStage('rough_cut_ready');
            setStatusWrapper('ready', `Rough cut ready — ${segments.length} segments, ${removeRanges.length} cuts`);

        } catch (err: any) {
            logger.error('startEditing failed', err);
            setPipelineStage('error');
            setPipelineError(err.message);
            setStatusWrapper('error', `Start Editing failed: ${err.message}`);
        }
    }, [currentProject, media, setStatusWrapper]);

    // ── Pipeline: Edit Now ────────────────────────────────────────────────────

    const editNow = useCallback(async () => {
        if (!currentProject) return;

        setPipelineStage('enriching');
        setPipelineError(null);
        setStatusWrapper('processing', 'Enriching with templates and assets…');
        logger.log('editNow: calling /edit-now', { projectId: currentProject.id });

        try {
            const res = await fetch(`${BACKEND}/edit-now`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: currentProject.id,
                    fps: currentProject.fps || 30,
                    sourceRef: 'source-video',
                    fetchExternal: false,
                })
            });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(`Edit Now failed (${res.status}): ${text}`);
            }

            const data = await res.json();
            logger.log('editNow result', data);

            const templatePlacements = data.templatePlacements || data.plan?.templatePlacements || [];
            const assetPlacements = data.assetPlacements || data.plan?.assetPlacements || [];

            setEnrichmentSummary({
                templateCount: templatePlacements.length,
                assetCount: assetPlacements.length,
            });

            // Add enrichment clips to overlay track
            if (templatePlacements.length > 0) {
                setTracks(prev => prev.map(track => {
                    if (track.id === 'track-3') {
                        const enrichCLips = templatePlacements.map((p: any, idx: number) => ({
                            id: `enrich-${idx}`,
                            mediaId: '',
                            trackId: 'track-3',
                            start: Number(p.startUs || 0) / 1_000_000,
                            duration: Number((p.endUs || 0) - (p.startUs || 0)) / 1_000_000,
                            offset: 0,
                            type: 'text' as const,
                            name: p.templateId || `Template ${idx + 1}`,
                        }));
                        return { ...track, clips: enrichCLips };
                    }
                    return track;
                }));
            }

            setPipelineStage('enrichment_ready');
            setStatusWrapper('ready', `Enrichment ready — ${templatePlacements.length} templates, ${assetPlacements.length} assets`);

        } catch (err: any) {
            logger.error('editNow failed', err);
            setPipelineStage('error');
            setPipelineError(err.message);
            setStatusWrapper('error', `Edit Now failed: ${err.message}`);
        }
    }, [currentProject, setStatusWrapper]);

    // ── Pipeline: Render ──────────────────────────────────────────────────────

    const renderVideo = useCallback(async (options: { burnSubtitles?: boolean; quality?: string } = {}) => {
        if (!currentProject) return;

        setPipelineStage('rendering');
        setPipelineError(null);
        setStatusWrapper('processing', 'Rendering final video…');
        logger.log('renderVideo: calling /render', { projectId: currentProject.id });

        try {
            const res = await fetch(`${BACKEND}/render`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: currentProject.id,
                    burnSubtitles: options.burnSubtitles ?? false,
                    quality: options.quality ?? 'balanced',
                })
            });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(`Render failed (${res.status}): ${text}`);
            }

            const data = await res.json();
            logger.log('renderVideo result', data);

            const outputPath = data.outputPath || data.output || '';
            setRenderResult({
                outputPath,
                durationSec: data.durationSec,
                overlayAppliedCount: data.overlayAppliedCount,
            });

            setPipelineStage('done');
            setStatusWrapper('ready', `Render complete: ${outputPath}`);

        } catch (err: any) {
            logger.error('renderVideo failed', err);
            setPipelineStage('error');
            setPipelineError(err.message);
            setStatusWrapper('error', `Render failed: ${err.message}`);
        }
    }, [currentProject, setStatusWrapper]);

    // ── Open in Finder ────────────────────────────────────────────────────────

    const openInFinder = useCallback(async (filePath: string) => {
        try {
            await fetch(`${BACKEND}/open-path`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: filePath, reveal: true })
            });
        } catch (err) {
            logger.error('openInFinder failed', err);
        }
    }, []);

    const resetPipeline = useCallback(() => {
        setPipelineStage('idle');
        setPipelineError(null);
        setTranscript(null);
        setCutPlan(null);
        setRenderResult(null);
        setEnrichmentSummary(null);
    }, []);

    const closeProject = useCallback(() => {
        setCurrentProject(null);
        resetPipeline();
        setMedia([]);
        setTracks(DEFAULT_TRACKS);
        setCurrentTime(0);
        setIsPlaying(false);
        setStatusWrapper('ready', 'Ready');
    }, [resetPipeline, setStatusWrapper, DEFAULT_TRACKS]);

    // ── Playback ──────────────────────────────────────────────────────────────

    const togglePlayback = useCallback(() => {
        setIsPlaying(prev => !prev);
    }, []);

    useEffect(() => {
        let animationFrame: number | null = null;
        let lastTime: number | null = null;

        const loop = (timestamp: number) => {
            if (lastTime !== null) {
                const delta = (timestamp - lastTime) / 1000;
                setCurrentTime(prev => prev + delta);
            }
            lastTime = timestamp;
            if (isPlaying) {
                animationFrame = requestAnimationFrame(loop);
            }
        };

        if (isPlaying) {
            animationFrame = requestAnimationFrame(loop);
        }

        return () => {
            if (animationFrame) cancelAnimationFrame(animationFrame);
        };
    }, [isPlaying]);

    const seekTo = useCallback((time: number) => {
        setCurrentTime(time);
    }, [setCurrentTime]);

    // ── Clip management ───────────────────────────────────────────────────────

    const addClip = useCallback((mediaId: string, trackId: string, time: number) => {
        const mediaItem = media.find(m => m.id === mediaId);
        if (!mediaItem) return;

        const newClip: Clip = {
            id: `clip-${Date.now()}`,
            mediaId,
            trackId,
            start: time,
            duration: mediaItem.duration || 5,
            offset: 0,
            type: mediaItem.type as any,
            name: mediaItem.name
        };

        // Push undo before mutation
        setUndoStack(prev => [...prev.slice(-(MAX_UNDO - 1)), tracks]);
        setRedoStack([]);

        setTracks(prev => prev.map(track => {
            if (track.id === trackId) {
                return { ...track, clips: [...track.clips, newClip] };
            }
            return track;
        }));
    }, [media, tracks, setTracks]);

    const moveClip = useCallback((clipId: string, trackId: string, newStartTime: number) => {
        setUndoStack(prev => [...prev.slice(-(MAX_UNDO - 1)), tracks]);
        setRedoStack([]);

        setTracks(prev => prev.map(track => {
            if (track.id === trackId) {
                return {
                    ...track,
                    clips: track.clips.map(clip =>
                        clip.id === clipId ? { ...clip, start: Math.max(0, newStartTime) } : clip
                    )
                };
            }
            return track;
        }));
    }, [tracks, setTracks]);

    const splitClip = useCallback((clipId: string, trackId: string, splitTime: number) => {
        setUndoStack(prev => [...prev.slice(-(MAX_UNDO - 1)), tracks]);
        setRedoStack([]);

        setTracks(prev => prev.map(track => {
            if (track.id !== trackId) return track;

            const clipIndex = track.clips.findIndex(c => c.id === clipId);
            if (clipIndex === -1) return track;

            const clip = track.clips[clipIndex];
            const clipEnd = clip.start + clip.duration;

            // splitTime must be within clip range (with small margin)
            if (splitTime <= clip.start + 0.01 || splitTime >= clipEnd - 0.01) return track;

            const leftDuration = splitTime - clip.start;
            const rightDuration = clipEnd - splitTime;

            const leftClip: Clip = {
                ...clip,
                id: `${clip.id}-L`,
                duration: leftDuration,
            };

            const rightClip: Clip = {
                ...clip,
                id: `${clip.id}-R`,
                start: splitTime,
                duration: rightDuration,
                offset: clip.offset + leftDuration,
            };

            const newClips = [...track.clips];
            newClips.splice(clipIndex, 1, leftClip, rightClip);
            return { ...track, clips: newClips };
        }));
    }, [tracks, setTracks]);

    const trimClip = useCallback((clipId: string, trackId: string, side: 'start' | 'end', newValue: number) => {
        setUndoStack(prev => [...prev.slice(-(MAX_UNDO - 1)), tracks]);
        setRedoStack([]);

        setTracks(prev => prev.map(track => {
            if (track.id !== trackId) return track;

            return {
                ...track,
                clips: track.clips.map(clip => {
                    if (clip.id !== clipId) return clip;

                    if (side === 'start') {
                        const oldStart = clip.start;
                        const newStart = Math.max(0, Math.min(newValue, clip.start + clip.duration - 0.05));
                        const delta = newStart - oldStart;
                        return {
                            ...clip,
                            start: newStart,
                            duration: clip.duration - delta,
                            offset: clip.offset + delta,
                        };
                    } else {
                        // side === 'end'
                        const newEnd = Math.max(clip.start + 0.05, newValue);
                        return {
                            ...clip,
                            duration: newEnd - clip.start,
                        };
                    }
                })
            };
        }));
    }, [tracks, setTracks]);

    const deleteClip = useCallback((clipId: string, trackId: string, ripple: boolean = false) => {
        setUndoStack(prev => [...prev.slice(-(MAX_UNDO - 1)), tracks]);
        setRedoStack([]);

        setTracks(prev => prev.map(track => {
            if (track.id !== trackId) return track;

            const clip = track.clips.find(c => c.id === clipId);
            if (!clip) return track;

            let newClips = track.clips.filter(c => c.id !== clipId);

            if (ripple && clip) {
                // Shift subsequent clips left by the deleted clip's duration
                newClips = newClips.map(c => {
                    if (c.start > clip.start) {
                        return { ...c, start: Math.max(0, c.start - clip.duration) };
                    }
                    return c;
                });
            }

            return { ...track, clips: newClips };
        }));

        if (selectedClipId === clipId) {
            setSelectedClipId(null);
        }
    }, [tracks, setTracks, selectedClipId]);

    const undo = useCallback(() => {
        if (undoStack.length === 0) return;
        const previousTracks = undoStack[undoStack.length - 1];
        setRedoStack(prev => [...prev, tracks]);
        setUndoStack(prev => prev.slice(0, -1));
        setTracks(previousTracks);
    }, [undoStack, tracks, setTracks]);

    const redo = useCallback(() => {
        if (redoStack.length === 0) return;
        const nextTracks = redoStack[redoStack.length - 1];
        setUndoStack(prev => [...prev, tracks]);
        setRedoStack(prev => prev.slice(0, -1));
        setTracks(nextTracks);
    }, [redoStack, tracks, setTracks]);


    // ── Backend health check ──────────────────────────────────────────────────

    useEffect(() => {
        const checkBackend = async () => {
            try {
                const res = await fetch(`${BACKEND}/health`, { signal: AbortSignal.timeout(3000) });
                setBackendAvailable(res.ok);
            } catch {
                setBackendAvailable(false);
            }
        };
        checkBackend();
        const interval = setInterval(checkBackend, 10000);
        return () => clearInterval(interval);
    }, []);

    // ── Initial load ──────────────────────────────────────────────────────────

    useEffect(() => {
        loadProjects();
    }, [loadProjects]);

    // ── Render progress polling ──────────────────────────────────────────────

    useEffect(() => {
        if (pipelineStage !== 'rendering' || !currentProject) {
            setRenderProgress(null);
            return;
        }

        const poll = async () => {
            try {
                const res = await fetch(`${BACKEND}/render/progress?projectId=${currentProject.id}`);
                if (res.ok) {
                    setRenderProgress(await res.json());
                }
            } catch { /* ignore */ }
        };

        poll();
        const interval = setInterval(poll, 2000);
        return () => clearInterval(interval);
    }, [pipelineStage, currentProject]);


    // ─── Persistence ─────────────────────────────────────────────────────────────

    const saveProject = useCallback(async () => {
        if (!currentProject) return;

        // Convert tracks to timeline format for backend clips
        const clips = tracks.flatMap(t => t.clips.map(c => ({
            id: c.id,
            type: c.type,
            startUs: Math.round(c.start * 1_000_000),
            durationUs: Math.round(c.duration * 1_000_000),
            sourceOffsetUs: Math.round(c.offset * 1_000_000),
            label: c.name,
            mediaId: c.mediaId,
            trackId: t.id
        })));

        const timeline = {
            projectId: currentProject.id,
            durationUs: Math.max(...clips.map(c => c.startUs + c.durationUs), 0),
            fps: currentProject.fps || 30,
            clips,
        };

        const state = {
            media,
            pipelineStage,
            pipelineError,
            transcript,
            cutPlan,
            enrichmentSummary,
            tracks, // Save UI tracks state for exact restoration
            status,
            statusMessage
        };

        try {
            setStatusWrapper('processing', 'Saving project...');
            const res = await fetch(`${BACKEND}/projects/${currentProject.id}/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ state, timeline })
            });
            if (!res.ok) throw new Error('Failed to save');

            setStatusWrapper('ready', 'Project saved successfully');
        } catch (e) {
            logger.error('Save failed', e);
            setStatusWrapper('error', 'Failed to save project');
        }
    }, [currentProject, tracks, media, pipelineStage, pipelineError, transcript, cutPlan, enrichmentSummary, status, statusMessage, setStatusWrapper]);

    const loadProject = useCallback(async (projectId: string) => {
        try {
            setStatusWrapper('processing', 'Loading project...');
            const res = await fetch(`${BACKEND}/projects/${projectId}/load`);
            if (!res.ok) throw new Error('Failed to load');

            const data = await res.json();
            if (data.state) {
                if (data.state.media) setMedia(data.state.media);
                if (data.state.tracks) setTracks(data.state.tracks);
                if (data.state.pipelineStage) setPipelineStage(data.state.pipelineStage);
                if (data.state.transcript) setTranscript(data.state.transcript);
                if (data.state.cutPlan) setCutPlan(data.state.cutPlan);
                if (data.state.enrichmentSummary) setEnrichmentSummary(data.state.enrichmentSummary);
            }

            if (data.project) {
                setCurrentProject(data.project);
            }

            setStatusWrapper('ready', 'Project loaded');
        } catch (e) {
            logger.error('Load failed', e);
            setStatusWrapper('error', 'Failed to load project');
        }
    }, [setStatusWrapper, setMedia, setTracks, setPipelineStage, setTranscript, setCutPlan, setEnrichmentSummary, setCurrentProject]);

    // ── Context value ─────────────────────────────────────────────────────────

    return (
        <EditorContext.Provider value={{
            currentProject,
            backendAvailable,
            media,
            tracks,
            isPlaying,
            currentTime,
            duration,
            status,
            statusMessage,
            pipelineStage,
            pipelineError,
            transcript,
            cutPlan,
            renderResult,
            enrichmentSummary,
            renderProgress,
            loadProjects,
            createProject,
            importMedia,
            addClip,
            moveClip,
            splitClip,
            trimClip,
            deleteClip,
            undo,
            redo,
            canUndo: undoStack.length > 0,
            canRedo: redoStack.length > 0,
            selectedClipId,
            setSelectedClipId,
            togglePlayback,
            seekTo,
            setStatus: setStatusWrapper,
            startEditing,
            editNow,
            renderVideo,
            openInFinder,
            resetPipeline,
            updateProject,
            saveProject,
            loadProject,
            closeProject,
            setMedia,
            setTracks,
            setCutPlan,
        }}>
            {children}
            <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleFileUpload}
                accept="video/*,audio/*,image/*"
            />
        </EditorContext.Provider>
    );
};

export const useEditor = () => {
    const context = useContext(EditorContext);
    if (!context) throw new Error('useEditor must be used within an EditorProvider');
    return context;
};
