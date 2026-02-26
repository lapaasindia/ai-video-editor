import React, { useEffect, useState } from 'react';
import { logger, LogEntry } from '../../utils/logger';
import { useEditor } from '../../context/EditorContext';

export const LogViewer: React.FC = () => {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [isVisible, setIsVisible] = useState(false);
    const { pipelineStage, currentProject, pipelineProgress, agenticProgress } = useEditor();

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
                    background: '#252526',
                    color: '#ccc',
                    border: '1px solid #3c3c3c',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
                }}
            >
                <span>Terminal</span>
                {pipelineStage !== 'idle' && pipelineStage !== 'done' && pipelineStage !== 'error' && (
                    <div className="spinner-small" style={{ width: 10, height: 10, borderWidth: 2 }} />
                )}
                {logs.filter(l => l.level === 'error').length > 0 &&
                    <span style={{ color: '#f48771', fontSize: '10px' }}>● err</span>
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
            height: '40vh',
            backgroundColor: '#1e1e1e',
            borderTop: '1px solid #333',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            fontFamily: '"SF Mono", Monaco, Menlo, Consolas, "Courier New", monospace',
            fontSize: '12px'
        }}>
            <div style={{
                padding: '8px 12px',
                background: '#252526',
                borderBottom: '1px solid #333',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <span style={{ fontWeight: '600', color: '#e0e0e0' }}>Terminal Output</span>
                    {currentProject && (
                        <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: '#9cdcfe', background: '#1e1e1e', padding: '2px 8px', borderRadius: '4px', border: '1px solid #333' }}>
                            <span><span style={{ color: '#569cd6' }}>LLM:</span> {currentProject.llmProvider || 'auto'}/{currentProject.llmModel || 'default'}</span>
                            <span><span style={{ color: '#569cd6' }}>Transcription:</span> {currentProject.transcriptionModel || 'auto'}</span>
                            <span><span style={{ color: '#569cd6' }}>Mode:</span> {currentProject.aiMode}</span>
                        </div>
                    )}
                    {pipelineStage !== 'idle' && (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '11px' }}>
                            <span style={{ color: '#c586c0' }}>Stage:</span>
                            {agenticProgress ? (
                                <>
                                    <span style={{ color: '#ce9178' }}>{agenticProgress.currentStep?.replace(/_/g, ' ')}</span>
                                    {agenticProgress.subStage && (
                                        <span style={{ color: '#9cdcfe' }}>→ {agenticProgress.subStage.replace(/_/g, ' ')}</span>
                                    )}
                                    <span style={{ color: '#4ec9b0' }}>{agenticProgress.percent}%</span>
                                    {agenticProgress.detail && (
                                        <span style={{ color: '#808080', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{agenticProgress.detail}</span>
                                    )}
                                </>
                            ) : (
                                <>
                                    <span style={{ color: '#ce9178' }}>{pipelineStage}</span>
                                    {pipelineProgress && (
                                        <span style={{ color: '#4ec9b0' }}>{Math.round(pipelineProgress.percent)}% - {pipelineProgress.message}</span>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>
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
                color: '#d4d4d4',
                display: 'flex',
                flexDirection: 'column-reverse' // Auto-scroll to bottom by reversing flex direction
            }}>
                <div>
                    {logs.slice().reverse().map(log => (
                        <div key={log.id} style={{ marginBottom: '2px', borderBottom: '1px solid #2a2a2a', paddingBottom: '2px', lineHeight: '1.4' }}>
                            <span style={{ color: '#569cd6' }}>[{new Date(log.timestamp).toLocaleTimeString([], { hour12: false })}]</span>
                            <span style={{
                                marginLeft: '8px',
                                display: 'inline-block',
                                width: '50px',
                                fontWeight: 'bold',
                                color: log.level === 'error' ? '#f48771' :
                                    log.level === 'warn' ? '#cca700' :
                                    log.level === 'debug' ? '#9cdcfe' : '#4ec9b0'
                            }}>
                                {log.level.toUpperCase()}
                            </span>
                            <span style={{
                                color: '#c586c0',
                                marginLeft: '4px',
                                display: 'inline-block',
                                width: '90px',
                            }}>
                                [{log.category}]
                            </span>
                            <span style={{ marginLeft: '8px', color: log.level === 'error' ? '#f48771' : '#cccccc' }}>{log.message}</span>
                            {log.durationMs !== undefined && (
                                <span style={{ color: '#b5cea8', marginLeft: '8px' }}>({log.durationMs}ms)</span>
                            )}
                            {log.data !== undefined && (
                                <pre style={{ margin: '2px 0 2px 190px', color: '#9cdcfe', fontSize: '11px', overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                    {typeof log.data === 'object' ? JSON.stringify(log.data, null, 2) : String(log.data)}
                                </pre>
                            )}
                        </div>
                    ))}
                    {logs.length === 0 && <div style={{ color: '#666', fontStyle: 'italic', padding: '10px' }}>No logs yet...</div>}
                </div>
            </div>
        </div>
    );
};
