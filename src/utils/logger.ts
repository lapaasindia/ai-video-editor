
type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogEntry {
    id: string;
    timestamp: number;
    level: LogLevel;
    message: string;
    data?: any;
}

class Logger {
    private logs: LogEntry[] = [];
    private listeners: ((logs: LogEntry[]) => void)[] = [];
    private maxLogs = 1000;

    private notify() {
        this.listeners.forEach(l => l([...this.logs]));
    }

    private addLog(level: LogLevel, message: string, data?: any) {
        const entry: LogEntry = {
            id: Math.random().toString(36).substring(7),
            timestamp: Date.now(),
            level,
            message,
            data
        };
        this.logs.unshift(entry);
        if (this.logs.length > this.maxLogs) {
            this.logs.pop();
        }
        this.notify();

        // Also log to console for devtools
        const consoleMethod = level === 'info' ? 'log' : level;
        // Avoid infinite loop if we monkey-patch console later
        // @ts-ignore
        if (console[consoleMethod].__original) {
            // @ts-ignore
            console[consoleMethod].__original(message, data || '');
        } else {
            // @ts-ignore
            // console[consoleMethod](message, data || '');
        }
    }

    log(message: string, data?: any) { this.addLog('info', message, data); }
    error(message: string, data?: any) { this.addLog('error', message, data); }
    warn(message: string, data?: any) { this.addLog('warn', message, data); }
    debug(message: string, data?: any) { this.addLog('debug', message, data); }

    getLogs() { return [...this.logs]; }

    subscribe(listener: (logs: LogEntry[]) => void) {
        this.listeners.push(listener);
        listener([...this.logs]);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    clear() {
        this.logs = [];
        this.notify();
    }
}

export const logger = new Logger();

// Optional: Global error handler
window.addEventListener('error', (event) => {
    logger.error('Uncaught Exception', { message: event.message, filename: event.filename, lineno: event.lineno });
});

window.addEventListener('unhandledrejection', (event) => {
    logger.error('Unhandled Rejection', { reason: event.reason });
});
