import React from 'react';
import { Player } from '@remotion/player';
import { TemplateMetadata } from '../../templates/registry';

interface TemplatePreviewModalProps {
    template: TemplateMetadata;
    onClose: () => void;
    onAdd: () => void;
}

export const TemplatePreviewModal: React.FC<TemplatePreviewModalProps> = ({ template, onClose, onAdd }) => {
    const Component = template.component;

    // Handle ESC key to close
    React.useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    const handleError = ({ error }: { error: Error }) => {
        console.error('Player runtime error:', error);
        return <div style={{ color: 'red', padding: 20 }}>Error: {error.message}</div>;
    };

    return (
        <div className="modal-overlay" onClick={onClose} style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000
        }}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: '8px',
                width: '900px',
                maxWidth: '95vw',
                maxHeight: '95vh',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                border: '1px solid var(--panel-border)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
            }}>
                {/* Header */}
                <div style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid var(--panel-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: 'var(--bg-tertiary)'
                }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)' }}>{template.name}</h3>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{template.id}</span>
                    </div>
                    <button onClick={onClose} style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        fontSize: '1.5rem',
                        padding: '0 8px',
                        lineHeight: 1
                    }}>
                        &times;
                    </button>
                </div>

                {/* Body - Player */}
                <div style={{
                    flex: 1,
                    background: '#000',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '20px',
                    minHeight: '400px'
                }}>
                    <div style={{
                        width: '100%',
                        maxWidth: '800px',
                        aspectRatio: '16/9',
                        borderRadius: '4px',
                        overflow: 'hidden',
                        boxShadow: '0 0 0 1px #333'
                    }}>
                        <Player
                            component={Component}
                            inputProps={template.defaultProps}
                            durationInFrames={template.durationInFrames}
                            fps={template.fps}
                            compositionWidth={1920}
                            compositionHeight={1080}
                            style={{ width: '100%', height: '100%' }}
                            controls
                            autoPlay
                            loop
                            errorFallback={handleError}
                        />
                    </div>
                </div>

                {/* Footer */}
                <div style={{
                    padding: '16px 20px',
                    borderTop: '1px solid var(--panel-border)',
                    backgroundColor: 'var(--bg-tertiary)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <div style={{ maxWidth: '60%' }}>
                        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                            {template.description}
                        </p>
                        <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                            {template.tags.map(tag => (
                                <span key={tag} style={{
                                    fontSize: '0.75rem',
                                    padding: '2px 6px',
                                    background: 'var(--bg-primary)',
                                    borderRadius: '4px',
                                    color: 'var(--text-muted)',
                                    border: '1px solid var(--panel-border)'
                                }}>
                                    #{tag}
                                </span>
                            ))}
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button className="btn-secondary" onClick={onClose}>
                            Cancel
                        </button>
                        <button className="btn-primary" onClick={() => { onAdd(); onClose(); }}>
                            Add to Timeline
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
