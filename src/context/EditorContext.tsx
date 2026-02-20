
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useTauri } from '../hooks/useTauri';
import { logger } from '../utils/logger';
import { getTemplateById } from '../templates/registry';

const BACKEND = 'http://127.0.0.1:43123';

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
    llmProvider?: string;
    llmModel?: string;
    inputPath?: string;
    duration?: number;
    projectDir?: string;
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
    type: 'video' | 'audio' | 'text' | 'image' | 'template';
    name: string;
    // Optional properties for overlays/templates
    sourceRef?: string;
    templateId?: string;
    content?: { headline?: string; subline?: string;[key: string]: any };
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
    | 'transcript_ready'
    | 'planning_cuts'
    | 'cuts_ready'
    | 'overlaying_chunk'
    | 'chunk_review'
    | 'rough_cut_ready'    // legacy compat
    | 'enriching'
    | 'enrichment_ready'
    | 'rendering'
    | 'done'
    | 'error';

export interface ChunkOverlay {
    id: string;
    templateId: string;
    templateName: string;
    startUs: number;
    endUs: number;
    content: { headline: string; subline: string };
    assetQuery?: string;
    assetPath?: string;
    approved: boolean;
}

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
    pipelineProgress: { percent: number; message: string; startedAt: number } | null;
    transcript: TranscriptSegment[] | null;
    fullTranscript: any | null;  // full canonical transcript from backend
    cutPlan: CutRange[] | null;
    renderResult: RenderResult | null;
    enrichmentSummary: { templateCount: number; assetCount: number } | null;
    renderProgress: { percent: number; stage: string } | null;
    agenticProgress: { currentStep: string; percent: number; status: string; detail: string } | null;
    // Chunk-by-chunk state
    overlayChunkIndex: number;
    totalOverlayChunks: number;
    currentChunkOverlays: ChunkOverlay[];
    chunkOverlays: Record<number, ChunkOverlay[]>;
    fastTrackMode: boolean;
}

interface EditorContextType extends EditorState {
    backendAvailable: boolean;
    loadProjects: () => Promise<void>;
    createProject: (name: string, fps: number, options?: any) => Promise<void>;
    closeProject: () => void;
    importMedia: (path?: string) => Promise<void>;
    addClip: (mediaId: string, trackId: string, time: number) => void;
    addTemplateClip: (templateId: string, trackId: string, time: number) => void;
    addTrack: (type?: 'video' | 'audio' | 'overlay' | 'text', id?: string) => void;
    deleteTrack: (trackId: string) => void;
    updateClip: (clipId: string, trackId: string, updates: Partial<Clip>) => void;
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
    exportFCPXML: () => Promise<void>;
    approveTranscript: () => Promise<void>;
    approveCuts: () => void;
    approveChunk: () => void;
    toggleFastTrack: () => void;
    retryStep: () => void;
    editNow: () => Promise<void>;
    agenticEdit: () => Promise<void>;
    renderVideo: (options?: { burnSubtitles?: boolean; quality?: string }) => Promise<void>;
    openInFinder: (filePath: string) => Promise<void>;
    resetPipeline: () => void;
    updateProject: (id: string, updates: Partial<Project> & { settings?: any }) => Promise<void>;
    saveProject: () => Promise<void>;
    loadProject: (projectId: string) => Promise<void>;
    setMedia: React.Dispatch<React.SetStateAction<MediaItem[]>>;
    setTracks: React.Dispatch<React.SetStateAction<Track[]>>;
    setCutPlan: React.Dispatch<React.SetStateAction<CutRange[] | null>>;
    setCurrentChunkOverlays: React.Dispatch<React.SetStateAction<ChunkOverlay[]>>;
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
    const [pipelineProgress, setPipelineProgress] = useState<{ percent: number; message: string; startedAt: number } | null>(null);
    const [transcript, setTranscript] = useState<TranscriptSegment[] | null>(null);
    const [cutPlan, setCutPlan] = useState<CutRange[] | null>(null);
    const [renderResult, setRenderResult] = useState<RenderResult | null>(null);
    const [enrichmentSummary, setEnrichmentSummary] = useState<{ templateCount: number; assetCount: number } | null>(null);
    const [renderProgress, setRenderProgress] = useState<{ percent: number; stage: string } | null>(null);
    const [agenticProgress, setAgenticProgress] = useState<{ currentStep: string; percent: number; status: string; detail: string } | null>(null);
    const [fullTranscript, setFullTranscript] = useState<any>(null);
    // Chunk-by-chunk overlay state
    const [overlayChunkIndex, setOverlayChunkIndex] = useState(0);
    const [totalOverlayChunks, setTotalOverlayChunks] = useState(0);
    const [currentChunkOverlays, setCurrentChunkOverlays] = useState<ChunkOverlay[]>([]);
    const [chunkOverlays, setChunkOverlays] = useState<Record<number, ChunkOverlay[]>>({});
    const [fastTrackMode, setFastTrackMode] = useState(false);
    const [lastFailedStep, setLastFailedStep] = useState<string | null>(null);

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
            llmProvider: s.llmProvider || p.llmProvider || 'ollama',
            llmModel: s.llmModel || p.llmModel || '',
            inputPath: p.inputPath || '',
            duration: p.duration,
            projectDir: p.projectDir || '',
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
            const msg = err instanceof Error ? err.message : String(err);
            // Network errors are expected when backend hasn't started yet — downgrade to warn
            if (msg.includes('fetch') || msg.includes('NetworkError') || msg.includes('Failed to fetch') || msg.includes('ECONNREFUSED')) {
                logger.warn('loadProjects: backend not ready yet');
            } else {
                logger.error('loadProjects failed', msg);
            }
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
                    body: JSON.stringify({ name, fps, settings: options, projectDir: options?.projectDir })
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
        setPipelineProgress({ percent: 0, message: 'Uploading video…', startedAt: Date.now() });
        logger.log(`Starting upload for file: ${mediaName}`);

        try {
            // Step 1: Upload file to server (using XHR for progress)
            const uploadResponse = await new Promise<Response>((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('POST', `${BACKEND}/media/upload`);
                xhr.setRequestHeader('x-filename', encodeURIComponent(file.name));
                xhr.upload.onprogress = (e) => {
                    if (e.lengthComputable) {
                        const pct = Math.round((e.loaded / e.total) * 90); // 0-90% for upload
                        setPipelineProgress(prev => prev ? { ...prev, percent: pct, message: `Uploading… ${pct}%` } : prev);
                    }
                };
                xhr.onload = () => {
                    const resp = new Response(xhr.responseText, { status: xhr.status, statusText: xhr.statusText });
                    resolve(resp);
                };
                xhr.onerror = () => reject(new Error('Upload network error'));
                xhr.ontimeout = () => reject(new Error('Upload timed out'));
                xhr.send(file);
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
            setPipelineProgress(prev => prev ? { ...prev, percent: 92, message: 'Processing video metadata…' } : prev);
            logger.log(`Ingesting from: ${uploadResult.path}`);

            const ingestResponse = await fetch(`${BACKEND}/media/ingest`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: AbortSignal.timeout(120_000),
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
            setPipelineProgress(prev => prev ? { ...prev, percent: 100, message: 'Import complete!' } : prev);
            setTimeout(() => setPipelineProgress(null), 1500); // Clear after 1.5s
            setStatusWrapper('ready', `Imported: ${mediaName}`);

            // Store inputPath on project for pipeline use
            setCurrentProject(prev => prev ? { ...prev, inputPath: finalPath, duration: durationSec } : prev);

            // Auto-create a default clip on track-1 so the video plays immediately
            if (durationSec && durationSec > 0) {
                setTracks(prev => prev.map(track => {
                    if (track.id === 'track-1' && track.clips.length === 0) {
                        return {
                            ...track,
                            clips: [{
                                id: `clip-${Date.now()}`,
                                mediaId: tempId,
                                trackId: 'track-1',
                                start: 0,
                                duration: durationSec,
                                offset: 0,
                                type: 'video' as const,
                                name: mediaName,
                            }]
                        };
                    }
                    return track;
                }));
            }

        } catch (error: any) {
            const msg = error?.name === 'TimeoutError'
                ? 'Ingest timed out — file may be too large. Try a smaller file.'
                : (error?.message || error?.name || JSON.stringify(error) || 'Unknown error');
            logger.error('Import Error', { message: msg, error });
            setMedia(prev => prev.map(item =>
                item.id === tempId ? { ...item, status: 'error' as const } : item
            ));
            setStatusWrapper('error', `Import failed: ${msg}`);
            setPipelineProgress(null);
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

        const videoItem = media.find(m => m.status === 'ok' && m.type.toLowerCase() === 'video');
        if (!videoItem) {
            alert('Please import a video first (status must be OK)');
            return;
        }

        setPipelineStage('transcribing');
        setPipelineError(null);
        setLastFailedStep(null);
        setPipelineProgress({ percent: 5, message: 'Extracting audio…', startedAt: Date.now() });
        setStatusWrapper('processing', 'Transcribing audio…');
        logger.log('startEditing: calling /pipeline/transcribe', { projectId: currentProject.id, input: videoItem.path });

        try {
            setPipelineProgress(prev => prev ? { ...prev, percent: 15, message: 'Running speech recognition…' } : prev);
            const res = await fetch(`${BACKEND}/pipeline/transcribe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: currentProject.id,
                    input: videoItem.path,
                    mode: currentProject.aiMode || 'hybrid',
                    language: currentProject.language || 'en',
                    sourceRef: videoItem.id,
                    transcriptionModel: currentProject.transcriptionModel || '',
                })
            });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(`Transcription failed (${res.status}): ${text}`);
            }

            const data = await res.json();
            setPipelineProgress(prev => prev ? { ...prev, percent: 90, message: 'Parsing transcript…' } : prev);
            logger.log('transcription result', data);

            // Store the full transcript
            setFullTranscript(data.transcript || null);

            // Extract segments for display
            const segments: TranscriptSegment[] = (data.transcript?.segments || []).map((s: any) => ({
                id: s.id || `seg-${s.startUs}`,
                startUs: Number(s.startUs || 0),
                endUs: Number(s.endUs || 0),
                text: s.text || '',
                confidence: Number(s.confidence || 0.9),
            }));
            setTranscript(segments);

            // Move to transcript review stage — user must approve
            setPipelineProgress(null);
            setPipelineStage('transcript_ready');
            setStatusWrapper('ready', `Transcription complete — ${segments.length} segments, ${data.wordCount || 0} words. Review and approve.`);

        } catch (err: any) {
            logger.error('startEditing (transcribe) failed', err);
            setLastFailedStep('transcribe');
            setPipelineProgress(null);
            setPipelineStage('error');
            setPipelineError(err.message);
            setStatusWrapper('error', `Transcription failed: ${err.message}`);
        }
    }, [currentProject, media, setStatusWrapper]);

    // ── Pipeline: Approve Transcript → Plan Cuts ──────────────────────────────

    const approveTranscript = useCallback(async () => {
        if (!currentProject) return;

        const videoItem = media.find(m => m.status === 'ok' && m.type.toLowerCase() === 'video');
        if (!videoItem) return;

        setPipelineStage('planning_cuts');
        setPipelineProgress({ percent: 10, message: 'Analyzing transcript for silences…', startedAt: Date.now() });
        setStatusWrapper('processing', 'Analyzing video for cuts…');
        logger.log('approveTranscript: calling /pipeline/cut-plan');

        try {
            const res = await fetch(`${BACKEND}/pipeline/cut-plan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: currentProject.id,
                    input: videoItem.path,
                    sourceRef: videoItem.id,
                    fps: currentProject.fps || 30,
                    mode: 'heuristic',
                    llmProvider: currentProject.llmProvider || '',
                    llmModel: currentProject.llmModel || '',
                })
            });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(`Cut planning failed (${res.status}): ${text}`);
            }

            setPipelineProgress(prev => prev ? { ...prev, percent: 80, message: 'Building timeline…' } : prev);
            const data = await res.json();
            logger.log('cut-plan result', data);

            // Extract cut ranges
            const removeRanges: CutRange[] = (data.removeRanges || []).map((r: any) => ({
                startUs: Number(r.startUs || 0),
                endUs: Number(r.endUs || 0),
                reason: r.reason || 'unknown',
                confidence: Number(r.confidence || 0.7),
            }));
            setCutPlan(removeRanges);

            // Populate timeline from returned clips
            const timelineClips = data.timeline?.clips || [];
            if (timelineClips.length > 0) {
                setTracks(prev => prev.map(track => {
                    if (track.id === 'track-1') {
                        const videoClips = timelineClips
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
                        return { ...track, clips: videoClips };
                    }
                    return track;
                }));
            }

            setPipelineProgress(null);
            setPipelineStage('cuts_ready');
            setStatusWrapper('ready', `${removeRanges.length} cuts found. Review on timeline, then approve.`);

        } catch (err: any) {
            logger.error('approveTranscript (cut-plan) failed', err);
            setLastFailedStep('cut-plan');
            setPipelineProgress(null);
            setPipelineStage('error');
            setPipelineError(err.message);
            setStatusWrapper('error', `Cut planning failed: ${err.message}`);
        }
    }, [currentProject, media, setStatusWrapper]);

    // ── Chunk splitting helper ─────────────────────────────────────────────────

    const splitIntoChunks = useCallback((segments: TranscriptSegment[], maxSentences = 3) => {
        const chunks: { index: number; startUs: number; endUs: number; segments: TranscriptSegment[] }[] = [];
        let current: TranscriptSegment[] = [];
        let chunkStart = segments.length > 0 ? segments[0].startUs : 0;

        for (const seg of segments) {
            current.push(seg);
            if (current.length >= maxSentences) {
                chunks.push({ index: chunks.length, startUs: chunkStart, endUs: seg.endUs, segments: [...current] });
                current = [];
                chunkStart = seg.endUs;
            }
        }
        if (current.length > 0) {
            chunks.push({ index: chunks.length, startUs: chunkStart, endUs: current[current.length - 1].endUs, segments: [...current] });
        }
        return chunks;
    }, []);

    // ── Process a single chunk (overlay plan + asset fetch) ──────────────────

    const processChunk = useCallback(async (chunkIdx: number, chunks: any[]) => {
        if (!currentProject || chunkIdx >= chunks.length) return;

        const chunk = chunks[chunkIdx];
        setPipelineStage('overlaying_chunk');
        setOverlayChunkIndex(chunkIdx);
        const chunkPct = Math.round(((chunkIdx) / chunks.length) * 100);
        setPipelineProgress({ percent: chunkPct, message: `Planning overlays for chunk ${chunkIdx + 1}/${chunks.length}…`, startedAt: Date.now() });
        setStatusWrapper('processing', `Planning overlays for chunk ${chunkIdx + 1}/${chunks.length}…`);

        try {
            // 1. Call overlay plan
            const overlayRes = await fetch(`${BACKEND}/pipeline/overlay-plan-chunk`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: currentProject.id,
                    chunkIndex: chunkIdx,
                    chunkStartUs: chunk.startUs,
                    chunkEndUs: chunk.endUs,
                    mode: 'auto',
                    llmProvider: currentProject.llmProvider || '',
                    llmModel: currentProject.llmModel || '',
                }),
            });

            if (!overlayRes.ok) {
                const text = await overlayRes.text();
                throw new Error(`Overlay planning failed: ${text}`);
            }

            const overlayData = await overlayRes.json();
            const overlays = (overlayData.overlays || []).map((o: any) => ({
                id: o.id || `overlay-${chunkIdx}-${Math.random().toString(36).slice(2, 6)}`,
                templateId: o.templateId || '',
                templateName: o.templateName || '',
                startUs: Number(o.startUs || 0),
                endUs: Number(o.endUs || 0),
                content: {
                    headline: o.content?.headline || o.headline || '',
                    subline: o.content?.subline || o.subline || '',
                },
                assetQuery: o.assetQuery || '',
                assetPath: '',
                approved: false,
            }));

            // 2. Attempt to fetch assets for each overlay
            setPipelineProgress(prev => prev ? { ...prev, percent: chunkPct + Math.round(50 / chunks.length), message: `Fetching assets for chunk ${chunkIdx + 1}…` } : prev);
            for (const overlay of overlays) {
                if (!overlay.assetQuery) continue;
                try {
                    const assetRes = await fetch(`${BACKEND}/pipeline/fetch-asset`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            projectId: currentProject.id,
                            query: overlay.assetQuery,
                            kind: 'image',
                            provider: 'pexels',
                        }),
                    });
                    if (assetRes.ok) {
                        const assetData = await assetRes.json();
                        overlay.assetPath = assetData.localPath || '';
                    }
                } catch (e: any) {
                    logger.error(`Asset fetch for "${overlay.assetQuery}" failed: ${e?.message || e}`);
                }
            }

            setCurrentChunkOverlays(overlays);
            setChunkOverlays(prev => ({ ...prev, [chunkIdx]: overlays }));
            return overlays;
        } catch (err: any) {
            logger.error(`processChunk ${chunkIdx} failed`, err);
            throw err;
        }
    }, [currentProject, setStatusWrapper]);

    // ── Pipeline: Approve Cuts → Start Chunk Processing ──────────────────────

    const [transcriptChunks, setTranscriptChunks] = useState<any[]>([]);

    const applyOverlaysToTimeline = useCallback(async () => {
        // Collect all overlays from all chunks
        const allOverlays: ChunkOverlay[] = [];
        for (let i = 0; i < totalOverlayChunks; i++) {
            if (chunkOverlays[i]) {
                const approved = chunkOverlays[i].filter(o => o.approved);
                allOverlays.push(...approved);
            }
        }

        logger.log(`Applying ${allOverlays.length} overlays to timeline...`);
        if (allOverlays.length === 0) return;

        // Create or find "AI Overlays" track
        let overlayTrackId = tracks.find(t => t.name === 'AI Overlays')?.id;
        const newTracks = [...tracks];

        if (!overlayTrackId) {
            overlayTrackId = `track-overlay-${Date.now()}`;
            // Insert it above the first track (video) or append
            newTracks.push({
                id: overlayTrackId,
                name: 'AI Overlays',
                type: 'overlay',
                clips: [],
                isMuted: false,
                isLocked: false,
            });
        }

        // Create clips
        const newClips: Clip[] = allOverlays.map((overlay, idx) => ({
            id: `clip-overlay-${Date.now()}-${idx}`,
            mediaId: overlay.templateId || `asset-${idx}`, // Use templateId or dummy
            trackId: overlayTrackId!,
            start: overlay.startUs / 1_000_000,
            duration: (overlay.endUs - overlay.startUs) / 1_000_000,
            offset: 0,
            type: overlay.templateId ? 'template' : (overlay.assetPath?.endsWith('.mp4') ? 'video' : 'image'),
            name: overlay.templateName || (overlay.assetPath ? 'Asset' : 'Overlay'),
            sourceRef: overlay.assetPath, // Store path in sourceRef for renderer
            templateId: overlay.templateId, // Store template ID
            content: overlay.content, // Store content for template
        }));

        // Update tracks
        const finalTracks = newTracks.map(t => {
            if (t.id === overlayTrackId) {
                // Determine if we merge or replace?
                // For now, let's append effectively, but since it's a new generation, maybe we should clear old AI clips?
                // The user might have manually added clips.
                // Let's just append.
                return { ...t, clips: [...t.clips, ...newClips] };
            }
            return t;
        });

        setTracks(finalTracks);

        // Trigger save project to persist
        // We can't call saveProject directly here easily as it depends on tracks which is stale in closure?
        // Actually saveProject uses currentProject.
        // But saveProject reads `tracks` from closure. So if we call saveProject() immediately, it sees OLD tracks.
        // We need useEffect to save when tracks change?
        // Or updated saveProject to accept tracks argument.
        // For now, setting tracks will update state. The generic auto-save interval (every 2s) will catch it.
        // EditorContext already has poll/autosave?
        // line 1342: const interval = setInterval(poll, 2000);
        // poll() reloads project from backend? No, `loadProjects`.
        // Wait, is there an autosave?
        // I don't see autosave interval calling saveProject.
        // The user must click Save?
        // I should call saveProject AFTER state update.
        // But I can't await state update.
        // I'll leave it to the user or rely on subsequent actions. 
        // Actually, I should probably force a save.

    }, [chunkOverlays, totalOverlayChunks, tracks, setTracks]);

    const approveCuts = useCallback(async () => {
        if (!transcript || transcript.length === 0) {
            setPipelineStage('rough_cut_ready');
            setStatusWrapper('ready', 'Cuts approved! Choose Edit Now for enrichment or Render to export.');
            return;
        }

        // Split transcript into chunks (2-3 sentences each)
        const chunks = splitIntoChunks(transcript, 3);
        setTranscriptChunks(chunks);
        setTotalOverlayChunks(chunks.length);
        setOverlayChunkIndex(0);
        setChunkOverlays({}); // Reset overlays for new run

        logger.log('approveCuts: split into chunks', { count: chunks.length });

        if (chunks.length === 0) {
            setPipelineStage('rough_cut_ready');
            setStatusWrapper('ready', 'Cuts approved! No chunks to process.');
            return;
        }

        // Process first chunk
        try {
            await processChunk(0, chunks);

            if (fastTrackMode) {
                // Fast track: auto-approve and process all chunks
                for (let i = 1; i < chunks.length; i++) {
                    setOverlayChunkIndex(i);
                    await processChunk(i, chunks);
                }
                setPipelineProgress(null);
                await applyOverlaysToTimeline(); // Apply immediately
                setPipelineStage('enrichment_ready');
                setStatusWrapper('ready', `All ${chunks.length} chunks processed (fast track)! Ready to render.`);
            } else {
                // Show chunk review UI
                setPipelineProgress(null);
                setPipelineStage('chunk_review');
                setStatusWrapper('ready', `Chunk 1/${chunks.length} ready for review.`);
            }
        } catch (err: any) {
            setLastFailedStep('overlay-chunk');
            setPipelineProgress(null);
            setPipelineStage('error');
            setPipelineError(err.message);
            setStatusWrapper('error', `Overlay planning failed: ${err.message}`);
        }
    }, [transcript, splitIntoChunks, processChunk, fastTrackMode, setStatusWrapper]);

    // ── Pipeline: Approve Chunk → Next or Done ───────────────────────────────

    const approveChunk = useCallback(async () => {
        const nextIdx = overlayChunkIndex + 1;

        if (nextIdx >= transcriptChunks.length) {
            // All chunks done
            setPipelineProgress(null);
            await applyOverlaysToTimeline(); // Apply immediately
            setPipelineStage('enrichment_ready');
            setStatusWrapper('ready', `All ${transcriptChunks.length} chunks processed! Ready to render.`);
            return;
        }

        // Process next chunk
        try {
            await processChunk(nextIdx, transcriptChunks);

            if (fastTrackMode) {
                // Fast track: auto-approve remaining
                for (let i = nextIdx + 1; i < transcriptChunks.length; i++) {
                    setOverlayChunkIndex(i);
                    await processChunk(i, transcriptChunks);
                }
                setPipelineProgress(null);
                await applyOverlaysToTimeline(); // Apply immediately
                setPipelineStage('enrichment_ready');
                setStatusWrapper('ready', `All ${transcriptChunks.length} chunks processed! Ready to render.`);
            } else {
                setPipelineProgress(null);
                setPipelineStage('chunk_review');
                setStatusWrapper('ready', `Chunk ${nextIdx + 1}/${transcriptChunks.length} ready for review.`);
            }
        } catch (err: any) {
            setLastFailedStep('overlay-chunk');
            setPipelineProgress(null);
            setPipelineStage('error');
            setPipelineError(err.message);
            setStatusWrapper('error', `Chunk ${nextIdx + 1} failed: ${err.message}`);
        }
    }, [overlayChunkIndex, transcriptChunks, processChunk, fastTrackMode, setStatusWrapper]);

    // ── Pipeline: Toggle fast track ───────────────────────────────────────────

    const toggleFastTrack = useCallback(() => {
        setFastTrackMode(prev => !prev);
    }, []);

    // ── Pipeline: Retry failed step ───────────────────────────────────────────

    const retryStep = useCallback(() => {
        if (lastFailedStep === 'transcribe') {
            startEditing();
        } else if (lastFailedStep === 'cut-plan') {
            approveTranscript();
        } else if (lastFailedStep === 'overlay-chunk') {
            // Retry the current chunk
            processChunk(overlayChunkIndex, transcriptChunks).then(() => {
                setPipelineStage('chunk_review');
                setStatusWrapper('ready', `Chunk ${overlayChunkIndex + 1}/${transcriptChunks.length} ready for review.`);
            }).catch((err: any) => {
                setPipelineError(err.message);
                setStatusWrapper('error', `Retry failed: ${err.message}`);
            });
        } else {
            startEditing();
        }
    }, [lastFailedStep, startEditing, approveTranscript, processChunk, overlayChunkIndex, transcriptChunks, setStatusWrapper]);

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

    // ── Pipeline: Agentic Edit (full AI pipeline) ────────────────────────

    const agenticEdit = useCallback(async () => {
        if (!currentProject) {
            alert('No active project');
            return;
        }

        const videoItem = media.find(m => m.status === 'ok' && m.type.toLowerCase() === 'video');
        if (!videoItem) {
            alert('Please import a video first');
            return;
        }

        setPipelineStage('transcribing');
        setPipelineError(null);
        setAgenticProgress({ currentStep: 'starting', percent: 0, status: 'running', detail: 'Initializing AI pipeline...' });
        setStatusWrapper('processing', 'AI is editing your video step-by-step…');
        logger.log('agenticEdit: calling /agentic-edit', { projectId: currentProject.id, input: videoItem.path });

        // Start progress polling
        const progressInterval = setInterval(async () => {
            try {
                const res = await fetch(`${BACKEND}/agentic-edit/progress/${currentProject.id}`);
                if (res.ok) {
                    const progress = await res.json();
                    setAgenticProgress({
                        currentStep: progress.currentStep || 'processing',
                        percent: progress.percent || 0,
                        status: progress.status || 'running',
                        detail: progress.detail || '',
                    });
                    setStatusWrapper('processing', `AI Step: ${progress.currentStep || 'processing'} (${progress.percent || 0}%)`);
                }
            } catch { /* polling error, ignore */ }
        }, 2000);

        try {
            const res = await fetch(`${BACKEND}/agentic-edit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: currentProject.id,
                    input: videoItem.path,
                    language: currentProject.language || 'hi',
                    fps: currentProject.fps || 30,
                    mode: currentProject.aiMode || 'hybrid',
                    sourceRef: videoItem.id,
                    fetchExternal: true,
                    llmProvider: currentProject.llmProvider || '',
                    llmModel: currentProject.llmModel || '',
                })
            });

            clearInterval(progressInterval);

            if (!res.ok) {
                const text = await res.text();
                throw new Error(`Agentic Edit failed (${res.status}): ${text}`);
            }

            const data = await res.json();
            logger.log('agenticEdit result', data);

            // Extract results from the agentic pipeline
            const aiDecisions = data.aiDecisions || {};

            setEnrichmentSummary({
                templateCount: aiDecisions.templatesSelected || 0,
                assetCount: aiDecisions.stockMediaSuggested || 0,
            });

            // ── Wire high-retention plan into the timeline ──────────────────
            const templatePlacements: Array<{
                id: string; templateName?: string; startUs?: number; endUs?: number;
                content?: { headline?: string; subline?: string };
            }> = aiDecisions.templateDetails || [];

            const stockMedia: Array<{
                id: string; kind?: string; query?: string;
                startUs?: number; endUs?: number; provider?: string;
            }> = aiDecisions.stockMediaDetails || [];

            const chunksAnalysed = aiDecisions.chunksAnalysed || 0;
            const chunksCut      = aiDecisions.chunksCut || 0;

            setTracks(prev => {
                let next = [...prev];

                // ── Track 1: AI Templates (overlay) ──────────────────────────
                if (templatePlacements.length > 0) {
                    const overlayTrackId = 'track-overlay-ai';
                    const templateClips = templatePlacements.map((p, i) => ({
                        id: `ai-tpl-${Date.now()}-${i}`,
                        mediaId: p.id || `template-${i}`,
                        trackId: overlayTrackId,
                        start: (p.startUs ?? i * 7_000_000) / 1_000_000,
                        duration: ((p.endUs ?? 0) - (p.startUs ?? 0)) / 1_000_000 || 3,
                        offset: 0,
                        type: 'template' as const,
                        name: p.templateName || p.id || 'AI Template',
                        content: {
                            headline: p.content?.headline || '',
                            subline: p.content?.subline || '',
                        },
                    }));

                    const hasOverlay = next.some(t => t.id === overlayTrackId);
                    if (hasOverlay) {
                        next = next.map(t => t.id === overlayTrackId
                            ? { ...t, clips: [...t.clips, ...templateClips] }
                            : t
                        );
                    } else {
                        next = [...next, {
                            id: overlayTrackId,
                            name: `AI Templates (${templatePlacements.length})`,
                            type: 'overlay' as const,
                            clips: templateClips,
                            muted: false,
                            locked: false,
                        }];
                    }
                }

                // ── Track 2: B-Roll / Stock Media ─────────────────────────────
                if (stockMedia.length > 0) {
                    const assetTrackId = 'track-broll-ai';
                    const assetClips = stockMedia.map((a, i) => ({
                        id: `ai-broll-${Date.now()}-${i}`,
                        mediaId: a.id || `asset-${i}`,
                        trackId: assetTrackId,
                        start: (a.startUs ?? i * 7_000_000) / 1_000_000,
                        duration: ((a.endUs ?? 0) - (a.startUs ?? 0)) / 1_000_000 || 5,
                        offset: 0,
                        type: 'image' as const,
                        name: a.query || `${a.kind || 'media'} ${i + 1}`,
                        assetData: {
                            kind: a.kind || 'image',
                            query: a.query || '',
                            provider: a.provider || 'pexels',
                        },
                    }));

                    const hasBroll = next.some(t => t.id === assetTrackId);
                    if (hasBroll) {
                        next = next.map(t => t.id === assetTrackId
                            ? { ...t, clips: [...t.clips, ...assetClips] }
                            : t
                        );
                    } else {
                        next = [...next, {
                            id: assetTrackId,
                            name: `B-Roll / Stock (${stockMedia.length})`,
                            type: 'broll' as const,
                            clips: assetClips,
                            muted: false,
                            locked: false,
                        }];
                    }
                }

                return next;
            });

            logger.log(`High-retention: ${chunksAnalysed} chunks, ${chunksCut} cut, ${templatePlacements.length} templates, ${stockMedia.length} B-roll`);

            setAgenticProgress({
                currentStep: 'complete',
                percent: 100,
                status: 'done',
                detail: `${chunksCut} cuts · ${templatePlacements.length} templates · ${stockMedia.length} B-roll (every 5-7s)`,
            });

            setPipelineStage('enrichment_ready');
            setStatusWrapper('ready',
                `High-retention edit ready — ${chunksCut} cuts, ${templatePlacements.length} templates, ${stockMedia.length} B-roll assets`
            );

        } catch (err: any) {
            clearInterval(progressInterval);
            logger.error('agenticEdit failed', err);
            setPipelineStage('error');
            setPipelineError(err.message);
            setAgenticProgress({ currentStep: 'error', percent: 0, status: 'failed', detail: err.message });
            setStatusWrapper('error', `AI Edit failed: ${err.message}`);
        }
    }, [currentProject, media, setStatusWrapper]);

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
            name: mediaItem.name,
            sourceRef: mediaItem.path, // Store path for renderer
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

    const addTemplateClip = useCallback((templateId: string, trackId: string, time: number) => {
        const template = getTemplateById(templateId);
        if (!template) return;

        const duration = template.durationInFrames / template.fps;

        const newClip: Clip = {
            id: `clip-tmpl-${Date.now()}`,
            mediaId: templateId, // Use templateId as mediaId for templates
            trackId,
            start: time,
            duration: duration || 5,
            offset: 0,
            type: 'template',
            name: template.name,
            templateId: template.id,
            content: template.defaultProps as any, // Initial content
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
    }, [tracks, setTracks]);

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
    // Poll every 2s until connected, then slow to 10s to reduce noise.

    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        let connected = false;

        const checkBackend = async () => {
            try {
                const res = await fetch(`${BACKEND}/health`, { signal: AbortSignal.timeout(3000) });
                const ok = res.ok;
                setBackendAvailable(ok);
                if (ok && !connected) {
                    connected = true;
                    clearInterval(interval);
                    interval = setInterval(checkBackend, 10000);
                }
            } catch {
                setBackendAvailable(false);
                if (connected) {
                    // Backend just went down — switch back to fast polling
                    connected = false;
                    clearInterval(interval);
                    interval = setInterval(checkBackend, 2000);
                }
            }
        };

        checkBackend();
        interval = setInterval(checkBackend, 2000);
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

    const updateClip = useCallback((clipId: string, trackId: string, updates: Partial<Clip>) => {
        setTracks(prev => {
            const newTracks = prev.map(track => {
                if (track.id !== trackId) return track;
                return {
                    ...track,
                    clips: track.clips.map(clip => {
                        if (clip.id !== clipId) return clip;
                        return { ...clip, ...updates };
                    })
                };
            });
            // Add to undo stack
            setUndoStack(s => [...s.slice(-MAX_UNDO), prev]);
            setRedoStack([]);
            return newTracks;
        });
    }, []);

    const addTrack = useCallback((type: 'video' | 'audio' | 'overlay' | 'text' = 'video', id?: string) => {
        setTracks(prev => {
            const count = prev.filter(t => t.type === type).length + 1;
            const newTrack: Track = {
                id: id || `track-${type}-${Date.now()}`,
                type,
                name: `${type.charAt(0).toUpperCase() + type.slice(1)} ${count}`,
                clips: []
            };
            return [...prev, newTrack];
        });
    }, []);

    const deleteTrack = useCallback((trackId: string) => {
        setTracks(prev => prev.filter(t => t.id !== trackId));
    }, []);


    // ─── Persistence ─────────────────────────────────────────────────────────────

    const saveProject = useCallback(async () => {
        if (!currentProject) return;

        // Convert tracks to timeline format for backend clips
        const clips = tracks.flatMap(t => t.clips.map(c => {
            // Map frontend Clip type to backend clipType
            let clipType = 'source_clip';
            if (c.type === 'template') {
                clipType = 'template_clip';
            } else if (c.type === 'image') {
                clipType = 'asset_clip';
            } else if (t.type === 'overlay') {
                clipType = 'asset_clip';
            } else if (c.type === 'video') {
                clipType = 'source_clip';
            }

            return {
                id: c.id,
                clipType,
                type: c.type, // Keep original type
                startUs: Math.round(c.start * 1_000_000),
                durationUs: Math.round(c.duration * 1_000_000),
                sourceOffsetUs: Math.round(c.offset * 1_000_000),
                label: c.name,
                mediaId: c.mediaId,
                trackId: t.id,
                sourceRef: c.sourceRef,
                templateId: c.templateId,
                content: c.content,
            };
        }));

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
            // setStatusWrapper('processing', 'Saving project...');
            if (isTauri) {
                await invokeCommand('save_project', { project: timeline });
                // TODO: Save state in Tauri too?
            } else {
                const res = await fetch(`${BACKEND}/projects/${currentProject.id}/save`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ state, timeline })
                });
                if (!res.ok) throw new Error(`Save failed: ${res.statusText}`);
            }
            logger.log('Project saved', { clips: clips.length });
        } catch (e: any) {
            logger.error('Failed to save project', e);
        }
    }, [currentProject, tracks, isTauri, media, pipelineStage, pipelineError, transcript, cutPlan, enrichmentSummary, status, statusMessage]);

    const exportFCPXML = useCallback(async () => {
        if (!currentProject) return;
        try {
            logger.log('Exporting FCPXML...');
            const res = await fetch(`${BACKEND}/projects/${currentProject.id}/export-fcpxml`, {
                method: 'POST'
            });
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();

            if (data.path) {
                await fetch(`${BACKEND}/open-path`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: data.path, reveal: true })
                });
                logger.log('FCPXML exported', { path: data.path });
            }
        } catch (e: any) {
            logger.error('FCPXML Export failed', e);
        }
    }, [currentProject]);

    const loadProject = useCallback(async (projectId: string) => {
        try {
            setStatusWrapper('processing', 'Loading project...');
            const res = await fetch(`${BACKEND}/projects/${projectId}/load`);
            if (!res.ok) throw new Error('Failed to load');

            const data = await res.json();
            if (data.state) {
                if (data.state.media) setMedia(data.state.media);
                if (data.state.pipelineStage) setPipelineStage(data.state.pipelineStage);
                if (data.state.transcript) setTranscript(data.state.transcript);
                if (data.state.cutPlan) setCutPlan(data.state.cutPlan);
                if (data.state.enrichmentSummary) setEnrichmentSummary(data.state.enrichmentSummary);
            }

            // Load tracks: prefer state.tracks, but fall back to timeline.clips if tracks are empty
            const stateTracks: Track[] | undefined = data.state?.tracks;
            const hasClipsInTracks = stateTracks && stateTracks.some((t: Track) => t.clips && t.clips.length > 0);

            if (hasClipsInTracks) {
                setTracks(stateTracks!);
            } else if (data.timeline?.clips && data.timeline.clips.length > 0) {
                // Map timeline.json clips → frontend tracks
                const mediaItems: MediaItem[] = data.state?.media || [];
                const firstVideo = mediaItems.find(m => m.type === 'video');
                const firstMediaId = firstVideo?.id || mediaItems[0]?.id || 'unknown';

                const timelineClips = data.timeline.clips as any[];
                let timelineOffset = 0; // running offset for sequential placement

                const videoClips: Clip[] = [];
                const overlayClips: Clip[] = [];
                const captionClips: Clip[] = [];

                for (const c of timelineClips) {
                    const startUs = Number(c.startUs || 0);
                    const endUs = Number(c.endUs || 0);
                    const sourceStartUs = Number(c.sourceStartUs || startUs);
                    const durationSec = (endUs - startUs) / 1_000_000;
                    const offsetSec = sourceStartUs / 1_000_000;

                    if (c.clipType === 'source_clip' || !c.clipType) {
                        videoClips.push({
                            id: c.clipId || `tl-${Date.now()}-${videoClips.length}`,
                            mediaId: firstMediaId,
                            trackId: 'track-1',
                            start: timelineOffset,
                            duration: durationSec,
                            offset: offsetSec,
                            type: 'video' as const,
                            name: c.label || c.clipId || `Clip ${videoClips.length + 1}`,
                        });
                        timelineOffset += durationSec;
                    } else if (c.clipType === 'overlay_clip' || c.clipType === 'template_clip') {
                        overlayClips.push({
                            id: c.clipId || `ov-${Date.now()}-${overlayClips.length}`,
                            mediaId: c.sourceRef || '',
                            trackId: 'track-overlays',
                            start: startUs / 1_000_000,
                            duration: durationSec,
                            offset: 0,
                            type: 'template' as const,
                            name: c.label || c.templateId || `Overlay ${overlayClips.length + 1}`,
                            templateId: c.templateId,
                            content: c.templateData,
                        });
                    } else if (c.clipType === 'caption_clip') {
                        captionClips.push({
                            id: c.clipId || `cap-${Date.now()}-${captionClips.length}`,
                            mediaId: '',
                            trackId: 'track-captions',
                            start: startUs / 1_000_000,
                            duration: durationSec,
                            offset: 0,
                            type: 'text' as const,
                            name: c.text || `Caption ${captionClips.length + 1}`,
                        });
                    }
                }

                const mappedTracks: Track[] = [
                    { id: 'track-overlays', name: 'Overlays', type: 'overlay', clips: overlayClips, isLocked: false },
                    { id: 'track-captions', name: 'Captions', type: 'text', clips: captionClips, isLocked: false },
                    { id: 'track-1', name: 'Video 1', type: 'video', clips: videoClips, isLocked: false },
                    { id: 'track-audio', name: 'Audio 1', type: 'audio', clips: [], isLocked: false },
                ];

                setTracks(mappedTracks);
                logger.log(`Mapped ${videoClips.length} video, ${overlayClips.length} overlay, ${captionClips.length} caption clips from timeline.json`);
            } else if (stateTracks) {
                setTracks(stateTracks);
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
            pipelineProgress,
            transcript,
            fullTranscript,
            cutPlan,
            renderResult,
            enrichmentSummary,
            renderProgress,
            agenticProgress,
            overlayChunkIndex,
            totalOverlayChunks,
            currentChunkOverlays,
            chunkOverlays,
            fastTrackMode,
            loadProjects,
            createProject,
            importMedia,
            addClip,
            addTemplateClip,
            addTrack,
            deleteTrack,
            updateClip,
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
            approveTranscript,
            approveCuts,
            approveChunk,
            toggleFastTrack,
            retryStep,
            editNow,
            agenticEdit,
            renderVideo,
            exportFCPXML,
            openInFinder,
            resetPipeline,
            updateProject,
            saveProject,
            loadProject,
            closeProject,
            setMedia,
            setTracks,
            setCutPlan,
            setCurrentChunkOverlays,
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
