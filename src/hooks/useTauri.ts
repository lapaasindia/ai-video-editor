import { invoke } from '@tauri-apps/api/core';

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
    | 'install_model';

export const useTauri = () => {

    const invokeCommand = async <T,>(cmd: TauriCommand, args: Record<string, any> = {}): Promise<T> => {
        if (isTauri()) {
            try {
                return await invoke<T>(cmd, args);
            } catch (e) {
                console.error(`Tauri command ${cmd} failed:`, e);
                throw e;
            }
        } else {
            // Fallback for browser development (mock or fetch from local server)
            // console.warn suppressed - expected in browser dev mode

            // Basic mapping to the local node backend if available
            // Note: functionality might be limited in browser
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
            };

            const route = routeMap[cmd];
            if (!route) throw new Error(`Unknown command: ${cmd}`);

            try {
                const response = await fetch(`http://localhost:43123${route.path}`, {
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
    };

    return { invokeCommand, isTauri: isTauri() };
};
