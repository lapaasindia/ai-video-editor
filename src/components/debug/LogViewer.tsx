import React, { useEffect, useState } from 'react';
import { logger, LogEntry } from '../../utils/logger';

export const LogViewer: React.FC = () => {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        return logger.subscribe(setLogs);
    }, []);

    if (!isVisible) {
        return (
            <button
                onClick={() => setIsVisible(true)}
                style={{
                    position: 'fixed',
                    bottom: '10px',
                    right: '10px',
                    zIndex: 9999,
                    background: '#333',
                    color: '#fff',
                    border: '1px solid #555',
                    padding: '5px 10px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                }}
            >
                Output Logs
                {logs.filter(l => l.level === 'error').length > 0 &&
                    <span style={{ marginLeft: '5px', color: '#ff5555' }}>●</span>
                }
            </button>
        );
    }

    return (
        <div style={{
            position: 'fixed',
            bottom: '0',
            right: '0',
            width: '100%',
            height: '300px',
            backgroundColor: '#1e1e1e',
            borderTop: '1px solid #333',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            fontFamily: 'monospace',
            fontSize: '12px'
        }}>
            <div style={{
                padding: '5px 10px',
                background: '#252526',
                borderBottom: '1px solid #333',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <span style={{ fontWeight: 'bold', color: '#ccc' }}>Debug Console</span>
                <div>
                    <button
                        onClick={() => logger.clear()}
                        style={{ marginRight: '10px', background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer' }}
                    >
                        Clear
                    </button>
                    <button
                        onClick={() => setIsVisible(false)}
                        style={{ background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer' }}
                    >
                        Close
                    </button>
                </div>
            </div>
            <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '10px',
                color: '#d4d4d4'
            }}>
                {logs.map(log => (
                    <div key={log.id} style={{ marginBottom: '4px', borderBottom: '1px solid #2a2a2a', paddingBottom: '2px' }}>
                        <span style={{ color: '#569cd6' }}>[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                        <span style={{
                            marginLeft: '8px',
                            fontWeight: 'bold',
                            color: log.level === 'error' ? '#f44747' :
                                log.level === 'warn' ? '#cca700' :
                                    '#4ec9b0'
                        }}>
                            {log.level.toUpperCase()}
                        </span>:
                        <span style={{ marginLeft: '8px', color: '#cccccc' }}>{log.message}</span>
                        {log.data && (
                            <pre style={{ margin: '2px 0 0 20px', color: '#9cdcfe', fontSize: '11px', overflowX: 'auto' }}>
                                {typeof log.data === 'object' ? JSON.stringify(log.data, null, 2) : String(log.data)}
                            </pre>
                        )}
                    </div>
                ))}
                {logs.length === 0 && <div style={{ color: '#666', fontStyle: 'italic' }}>No logs yet...</div>}
            </div>
        </div>
    );
};
