import React, { useEffect, useState } from 'react';
import { useTauri } from '../../hooks/useTauri';

interface ModelManagerProps {
    onClose: () => void;
}

interface ModelHealth {
    status: 'ok' | 'error';
    models: {
        [key: string]: boolean;
    };
}

export const ModelManager: React.FC<ModelManagerProps> = ({ onClose }) => {
    const { invokeCommand } = useTauri();
    const [health, setHealth] = useState<ModelHealth | null>(null);
    const [loading, setLoading] = useState(true);
    const [installing, setInstalling] = useState<string | null>(null);

    useEffect(() => {
        checkHealth();
    }, []);

    const checkHealth = async () => {
        try {
            setLoading(true);
            const result = await invokeCommand<ModelHealth>('model_health');
            setHealth(result);
        } catch (e) {
            console.error('Failed to check model health', e);
        } finally {
            setLoading(false);
        }
    };

    const installModel = async (runtime: string, model: string) => {
        try {
            setInstalling(`${runtime}-${model}`);
            await invokeCommand('install_model', { runtime, model });
            await checkHealth();
        } catch (e) {
            console.error('Failed to install model', e);
            alert('Installation failed. Check logs.');
        } finally {
            setInstalling(null);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content wizard-modal" style={{ width: '600px' }}>
                <div className="wizard-header">
                    <h2>AI Model Manager</h2>
                    <button className="btn-text" onClick={checkHealth} title="Refresh">↻</button>
                </div>

                <div className="wizard-body">
                    {loading ? (
                        <div className="loading-state">Checking local models...</div>
                    ) : (
                        <div className="settings-list">
                            <div className="setting-group">
                                <h3>Whisper (Transcription)</h3>
                                <div className="model-row">
                                    <div className="model-info">
                                        <span className="model-name">Whisper Base (English)</span>
                                        <span className="model-desc">Balanced speed/accuracy (~140MB)</span>
                                    </div>
                                    <div className="model-action">
                                        {health?.models?.['whisper-base.en'] ? (
                                            <span className="status-badge success">Installed</span>
                                        ) : (
                                            <button
                                                className="btn-secondary btn-sm"
                                                disabled={!!installing}
                                                onClick={() => installModel('whisper', 'base.en')}
                                            >
                                                {installing === 'whisper-base.en' ? 'Installing...' : 'Download'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="setting-group">
                                <h3>Llama / Ollama (Reasoning)</h3>
                                <div className="model-row">
                                    <div className="model-info">
                                        <span className="model-name">Llama 3.2 1B</span>
                                        <span className="model-desc">Fast instruction following (~1.2GB)</span>
                                    </div>
                                    <div className="model-action">
                                        {health?.models?.['llama-3.2-1b'] ? (
                                            <span className="status-badge success">Installed</span>
                                        ) : (
                                            <button
                                                className="btn-secondary btn-sm"
                                                disabled={!!installing}
                                                onClick={() => installModel('ollama', 'llama3.2:1b')}
                                            >
                                                {installing === 'ollama-llama3.2:1b' ? 'Installing...' : 'Download'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="info-box">
                                <p>Models are stored locally in <code>~/.lapaas/models</code>.</p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="wizard-footer">
                    <div className="spacer"></div>
                    <button className="btn-primary" onClick={onClose}>Done</button>
                </div>
            </div>
        </div>
    );
};
