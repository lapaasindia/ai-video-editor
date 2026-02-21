
type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export type LogCategory =
    | 'import'      // Video/media import flow
    | 'upload'      // File upload to backend
    | 'ingest'      // Media ingest (ffprobe metadata)
    | 'pipeline'    // General pipeline orchestration
    | 'transcribe'  // Speech-to-text
    | 'cut-plan'    // Silence/filler detection & cut planning
    | 'overlay'     // Overlay planning per chunk
    | 'asset'       // Stock media / asset fetching
    | 'agentic'     // Full agentic editing pipeline
    | 'render'      // Final render
    | 'edit-now'    // Edit-now enrichment
    | 'timeline'    // Timeline mutations (add/move/trim/delete clips)
    | 'project'     // Project CRUD
    | 'backend'     // Backend health / connectivity
    | 'ui'          // UI interactions
    | 'general';    // Catch-all

export interface LogEntry {
    id: string;
    timestamp: number;
    level: LogLevel;
    category: LogCategory;
    message: string;
    data?: unknown;
    durationMs?: number;
}

class Logger {
    private logs: LogEntry[] = [];
    private listeners: ((logs: LogEntry[]) => void)[] = [];
    private maxLogs = 2000;
    private timers: Map<string, number> = new Map();

    private notify() {
        this.listeners.forEach(l => l([...this.logs]));
    }

    private addLog(level: LogLevel, category: LogCategory, message: string, data?: unknown, durationMs?: number) {
        const entry: LogEntry = {
            id: `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
            timestamp: Date.now(),
            level,
            category,
            message,
            data: data !== undefined ? data : undefined,
            durationMs,
        };
        this.logs.unshift(entry);
        if (this.logs.length > this.maxLogs) {
            this.logs.pop();
        }
        this.notify();

        // Always log to browser console for devtools visibility
        const tag = `[${category.toUpperCase()}]`;
        const ts = new Date().toISOString().slice(11, 23);
        const durStr = durationMs != null ? ` (${durationMs}ms)` : '';
        const prefix = `${ts} ${tag}${durStr}`;

        if (level === 'error') {
            console.error(prefix, message, data ?? '');
        } else if (level === 'warn') {
            console.warn(prefix, message, data ?? '');
        } else if (level === 'debug') {
            console.debug(prefix, message, data ?? '');
        } else {
            console.log(prefix, message, data ?? '');
        }
    }

    // ── Convenience methods (backward-compatible) ─────────────────────────

    log(message: string, data?: unknown)   { this.addLog('info',  'general',  message, data); }
    error(message: string, data?: unknown) { this.addLog('error', 'general',  message, data); }
    warn(message: string, data?: unknown)  { this.addLog('warn',  'general',  message, data); }
    debug(message: string, data?: unknown) { this.addLog('debug', 'general',  message, data); }

    // ── Category-aware methods ─────────────────────────────────────────────

    info(category: LogCategory, message: string, data?: unknown)  { this.addLog('info',  category, message, data); }
    err(category: LogCategory, message: string, data?: unknown)   { this.addLog('error', category, message, data); }
    warning(category: LogCategory, message: string, data?: unknown) { this.addLog('warn', category, message, data); }
    trace(category: LogCategory, message: string, data?: unknown) { this.addLog('debug', category, message, data); }

    // ── Timing helpers ────────────────────────────────────────────────────

    /** Start a named timer. Returns the label for use with timeEnd. */
    time(label: string): string {
        this.timers.set(label, performance.now());
        return label;
    }

    /** End a named timer, log elapsed time under the given category. */
    timeEnd(label: string, category: LogCategory, message?: string): number {
        const start = this.timers.get(label);
        if (start == null) {
            this.addLog('warn', category, `timeEnd called for unknown timer: ${label}`);
            return 0;
        }
        const elapsed = Math.round(performance.now() - start);
        this.timers.delete(label);
        this.addLog('info', category, message || `${label} completed`, undefined, elapsed);
        return elapsed;
    }

    // ── Step helper (logs start → returns finish callback) ────────────────

    step(category: LogCategory, stepName: string, data?: unknown): (result?: unknown) => number {
        const timerLabel = `${category}:${stepName}:${Date.now()}`;
        this.time(timerLabel);
        this.addLog('info', category, `▶ ${stepName}`, data);
        return (result?: unknown) => {
            const elapsed = this.timeEnd(timerLabel, category, `✔ ${stepName}`);
            if (result !== undefined) {
                this.addLog('debug', category, `  ${stepName} result`, result);
            }
            return elapsed;
        };
    }

    // ── Query / subscribe ─────────────────────────────────────────────────

    getLogs(filter?: { category?: LogCategory; level?: LogLevel; limit?: number }) {
        let result = [...this.logs];
        if (filter?.category) result = result.filter(l => l.category === filter.category);
        if (filter?.level) result = result.filter(l => l.level === filter.level);
        if (filter?.limit) result = result.slice(0, filter.limit);
        return result;
    }

    subscribe(listener: (logs: LogEntry[]) => void) {
        this.listeners.push(listener);
        listener([...this.logs]);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    clear() {
        this.logs = [];
        this.timers.clear();
        this.notify();
    }
}

export const logger = new Logger();

// ── Global error handlers ─────────────────────────────────────────────────

window.addEventListener('error', (event) => {
    logger.err('general', 'Uncaught Exception', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
    });
});

window.addEventListener('unhandledrejection', (event) => {
    logger.err('general', 'Unhandled Promise Rejection', {
        reason: String(event.reason),
        stack: event.reason?.stack,
    });
});
