
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useTauri } from '../hooks/useTauri';
import { logger } from '../utils/logger';

// Types (simplified from main.js logic)
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
    start: number; // in frames or seconds (we'll use seconds for now, flexible)
    duration: number;
    offset: number; // start time within the source media
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

export interface EditorState {
    currentProject: Project | null;
    media: MediaItem[];
    tracks: Track[];
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    status: 'ready' | 'processing' | 'error';
    statusMessage: string;
}

interface EditorContextType extends EditorState {
    loadProjects: () => Promise<void>;
    createProject: (name: string, fps: number, options?: any) => Promise<void>;
    importMedia: (path?: string) => Promise<void>;
    addClip: (mediaId: string, trackId: string, time: number) => void;
    moveClip: (clipId: string, trackId: string, newStartTime: number) => void;
    togglePlayback: () => void;
    seekTo: (time: number) => void;
    setStatus: (status: 'ready' | 'processing' | 'error', message: string) => void;
}

const EditorContext = createContext<EditorContextType | null>(null);

export const EditorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { invokeCommand, isTauri } = useTauri();

    // State
    const [currentProject, setCurrentProject] = useState<Project | null>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [media, setMedia] = useState<MediaItem[]>([]);
    const [tracks, setTracks] = useState<Track[]>([
        { id: 'track-1', type: 'video', name: 'Video 1', clips: [] },
        { id: 'track-2', type: 'audio', name: 'Audio 1', clips: [] }
    ]);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration] = useState(0);
    const [status, setStatus] = useState<'ready' | 'processing' | 'error'>('ready');
    const [statusMessage, setStatusMessage] = useState('Ready');

    // Actions

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
            ...p,
            fps: p.fps || s.fps || 30,
            width: p.width || dims.w,
            height: p.height || dims.h,
            aspectRatio: p.aspectRatio || s.aspectRatio || '16:9',
        };
    };

    const loadProjects = useCallback(async () => {
        try {
            const result = await invokeCommand<{ projects: any[] }>('list_projects');
            if (result && result.projects && result.projects.length > 0) {
                setCurrentProject(normalizeProject(result.projects[0]));
                setMedia([]);
            }
        } catch (e) {
            console.debug('Backend not available, starting fresh');
        }
    }, [invokeCommand]);

    const createProject = useCallback(async (name: string, fps: number, options: any = {}) => {
        try {
            setStatusWrapper('processing', 'Creating Project...');

            // Map simple resolution string to dimensions
            let width = 1920;
            let height = 1080;
            if (options.resolution === '4K') { width = 3840; height = 2160; }
            if (options.resolution === '720p') { width = 1280; height = 720; }

            const settings = {
                aspectRatio: options.aspectRatio || '16:9',
                fps,
                resolution: options.resolution || '1080p',
                language: options.language || 'en',
                aiMode: options.aiMode || 'hybrid',
                transcriptionModel: options.transcriptionModel || 'whisper-base.en'
            };

            const result = await invokeCommand<{ project: Project }>('create_project', {
                request: {
                    name,
                    settings
                }
            });

            // Merge backend response with local knowledge of dimensions if needed
            const newProject = result.project || result;
            // Ensure dimensions are set locally if backend doesn't fully hydrate them from "settings" yet
            if (!newProject.width) newProject.width = width;
            if (!newProject.height) newProject.height = height;

            setCurrentProject(newProject);
            setStatusWrapper('ready', `Project "${name}" created`);
        } catch (e: any) {
            setStatusWrapper('error', e.message || 'Failed to create project');
            console.error(e);
            alert(`Failed to create project: ${e.message} `);
        }
    }, [invokeCommand, setStatusWrapper]);

    const importMedia = useCallback(async (path?: string) => {
        if (!currentProject) {
            alert('Please create a project first');
            return;
        }

        try {
            let filePath: string | null = path || null;

            // If no path provided, open dialog
            if (!filePath) {
                if (isTauri) {
                    try {
                        // @ts-ignore
                        const { open } = await import('@tauri-apps/plugin-dialog');
                        const selected = await open({
                            multiple: false,
                            filters: [{ name: 'Video', extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm'] }]
                        });
                        if (selected) filePath = selected as string;
                    } catch (e) {
                        // Fallback for v1 or if plugin not found, try direct global
                        // @ts-ignore
                        if (window.__TAURI__?.dialog) {
                            // @ts-ignore
                            filePath = await window.__TAURI__.dialog.open({
                                multiple: false,
                                filters: [{ name: 'Video', extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm'] }]
                            });
                        }
                    }
                } else {
                    // Browser fallback
                    if (fileInputRef.current) {
                        fileInputRef.current.click();
                        return;
                    }
                }
            }


            if (!filePath) return;

            // Optimistic update
            const tempId = `media - ${Date.now()} `;
            const newItem: MediaItem = {
                id: tempId,
                path: filePath,
                name: filePath.split(/[/\\]/).pop() || 'media',
                type: 'video',
                status: 'processing'
            };
            setMedia(prev => [...prev, newItem]);

            setStatusWrapper('processing', 'Importing media...');

            // Call backend
            const result = await invokeCommand<any>('ingest_media', {
                request: {
                    projectId: currentProject.id,
                    input: filePath,
                    generateProxy: true,
                    generateWaveform: true
                }
            });

            // Update with result
            setMedia(prev => prev.map(item => {
                if (item.id === tempId) {
                    return {
                        ...item,
                        status: 'ok',
                        proxyPath: result.proxyPath || undefined,
                        waveformPath: result.waveformPath || undefined,
                        duration: result.metadata?.duration
                    };
                }
                return item;
            }));

            setStatusWrapper('ready', 'Media imported');
        } catch (e: any) {
            setStatusWrapper('error', 'Import failed');
            alert(`Import failed: ${e.message} `);
            // Remove failed item
            setMedia(prev => prev.filter(m => m.status !== 'error' && m.status !== 'processing'));
        }
    }, [currentProject, invokeCommand, isTauri, setStatusWrapper]);

    const togglePlayback = useCallback(() => {
        setIsPlaying(prev => !prev);
    }, []);

    useEffect(() => {
        let animationFrame: number;
        let lastTime = performance.now();

        const loop = () => {
            const now = performance.now();
            const dt = (now - lastTime) / 1000; // seconds
            lastTime = now;

            if (isPlaying) {
                setCurrentTime(prev => prev + dt);
                animationFrame = requestAnimationFrame(loop);
            }
        };

        if (isPlaying) {
            lastTime = performance.now();
            animationFrame = requestAnimationFrame(loop);
        } else {
            // cancelAnimationFrame is not strictly needed as we don't request if !isPlaying
            // but good practice if we change logic
        }

        return () => {
            if (animationFrame) cancelAnimationFrame(animationFrame);
        };
    }, [isPlaying]);

    const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !currentProject) return;

        setStatusWrapper('processing', `Uploading ${file.name}...`);
        logger.log(`Starting upload for file: ${file.name} `);

        try {
            const uploadUrl = 'http://localhost:43123/media/upload';
            logger.debug(`POST request to ${uploadUrl} `);

            const response = await fetch(uploadUrl, {
                method: 'POST',
                headers: {
                    'x-filename': file.name
                },
                body: file
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Upload failed: ${response.status} ${response.statusText} - ${text} `);
            }

            const result = await response.json();
            logger.log('Upload successful', result);

            if (result.ok && result.path) {
                // Call importMedia with the path on the server
                await importMedia(result.path);
            } else {
                throw new Error('Upload response missing "path"');
            }
        } catch (error: any) {
            setStatusWrapper('error', `Upload failed: ${error.message} `);
            logger.error('Upload Error', error);
            console.error(error);
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    }, [currentProject, setStatusWrapper, importMedia]);

    const seekTo = useCallback((time: number) => {
        setCurrentTime(time);
    }, [setCurrentTime]);

    const addClip = useCallback((mediaId: string, trackId: string, time: number) => {
        const mediaItem = media.find(m => m.id === mediaId);
        if (!mediaItem) return;

        const newClip: Clip = {
            id: `clip - ${Date.now()} `,
            mediaId,
            trackId,
            start: time,
            duration: mediaItem.duration || 5, // Default to 5s if duration unknown
            offset: 0,
            type: mediaItem.type as any,
            name: mediaItem.name
        };

        setTracks(prev => prev.map(track => {
            if (track.id === trackId) {
                return { ...track, clips: [...track.clips, newClip] };
            }
            return track;
        }));
    }, [media, setTracks]);

    const moveClip = useCallback((clipId: string, trackId: string, newStartTime: number) => {
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
    }, [setTracks]);

    // Initial load
    useEffect(() => {
        loadProjects();
    }, [loadProjects]);

    return (
        <EditorContext.Provider value={{
            currentProject,
            media,
            tracks,
            isPlaying,
            currentTime,
            duration,
            status,
            statusMessage,
            loadProjects,
            createProject,
            importMedia,
            addClip,
            moveClip,
            togglePlayback,
            seekTo,
            setStatus: setStatusWrapper
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
