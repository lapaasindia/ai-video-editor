import { invoke } from '@tauri-apps/api/core';
import { useCallback } from 'react';

// Helper to check if running in Tauri
const isTauri = () => !!(window as any).__TAURI__;

// Define available commands
export type TauriCommand =
    | 'list_projects'
    | 'create_project'
    | 'ingest_media'
    | 'start_editing'
    | 'edit_now'
    | 'render'
    | 'model_health'
    | 'install_model'
    | 'save_project';

export const useTauri = () => {
    const _isTauri = isTauri();

    // useCallback with empty deps so invokeCommand has a stable reference across renders.
    // Without this, every render creates a new invokeCommand → loadProjects re-runs →
    // setMedia([]) clears uploaded media items.
    const invokeCommand = useCallback(async <T,>(cmd: TauriCommand, args: Record<string, any> = {}): Promise<T> => {
        if (_isTauri) {
            try {
                return await invoke<T>(cmd, args);
            } catch (e) {
                console.error(`Tauri command ${cmd} failed:`, e);
                throw e;
            }
        } else {
            if (process.env.NODE_ENV === 'development') {
                console.debug(`[Browser] Routing command via HTTP: ${cmd}`);
            }
            const routeMap: Record<string, { method: string; path: string; body?: any }> = {
                'list_projects': { method: 'GET', path: '/projects' },
                'create_project': { method: 'POST', path: '/projects/create', body: args.request },
                'ingest_media': { method: 'POST', path: '/media/ingest', body: args.request },
                'start_editing': { method: 'POST', path: '/start-editing', body: args.request },
                'edit_now': { method: 'POST', path: '/edit-now', body: args.request },
                'render': { method: 'POST', path: '/render', body: args.request },
                'model_health': { method: 'GET', path: '/models/health' },
                'install_model': { method: 'POST', path: '/models/install', body: args },
            };

            const route = routeMap[cmd];
            if (!route) throw new Error(`Unknown command: ${cmd}`);

            try {
                const response = await fetch(`http://127.0.0.1:43123${route.path}`, {
                    method: route.method,
                    headers: { 'Content-Type': 'application/json' },
                    body: route.body ? JSON.stringify(route.body) : undefined
                });
                if (!response.ok) {
                    const errBody = await response.text();
                    console.error(`[useTauri] ${cmd} HTTP ${response.status}:`, errBody);
                    throw new Error(errBody || response.statusText);
                }
                return await response.json();
            } catch (e) {
                console.error(`[useTauri] ${cmd} failed:`, e);
                throw e;
            }
        }

    }, [_isTauri]);

    return { invokeCommand, isTauri: _isTauri };
};
