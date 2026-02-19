import React, { useState, useEffect } from 'react';
import { useEditor } from '../../context/EditorContext';

interface ProjectSettingsModalProps {
    onClose: () => void;
}

interface ProviderModel {
    id: string;
    label: string;
    default?: boolean;
}

interface Provider {
    id: string;
    label: string;
    type: 'local' | 'cloud';
    available: boolean;
    models: ProviderModel[];
}

const BACKEND = 'http://127.0.0.1:43123';

// Fallback catalog in case /ai/providers fails
const FALLBACK_PROVIDERS: Provider[] = [
    {
        id: 'ollama', label: 'Ollama (Local)', type: 'local', available: true,
        models: [
            { id: 'qwen3:1.7b', label: 'Qwen3 1.7B (Fast, Hindi OK)', default: true },
            { id: 'ai4bharat/airavata', label: 'Airavata (Hindi-specialized)' },
        ],
    },
    {
        id: 'openai', label: 'OpenAI', type: 'cloud', available: false,
        models: [
            { id: 'gpt-4o', label: 'GPT-4o (Flagship)', default: true },
            { id: 'gpt-4o-mini', label: 'GPT-4o Mini (Fast)' },
        ],
    },
    {
        id: 'google', label: 'Google Gemini', type: 'cloud', available: false,
        models: [
            { id: 'gemini-2.5-flash-preview-05-20', label: 'Gemini 2.5 Flash', default: true },
        ],
    },
    {
        id: 'anthropic', label: 'Anthropic', type: 'cloud', available: false,
        models: [
            { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4', default: true },
        ],
    },
    {
        id: 'sarvam', label: 'Sarvam AI', type: 'cloud', available: false,
        models: [
            { id: 'sarvam-m', label: 'Sarvam-M (Hindi-optimized)', default: true },
        ],
    },
];

export const ProjectSettingsModal: React.FC<ProjectSettingsModalProps> = ({ onClose }) => {
    const { currentProject, updateProject } = useEditor();
    const [name, setName] = useState(currentProject?.name || '');
    const [resolution, setResolution] = useState(currentProject?.resolution || '1080p');
    const [fps, setFps] = useState(currentProject?.fps || 30);
    const [aiMode, setAiMode] = useState(currentProject?.aiMode || 'hybrid');
    const [language, setLanguage] = useState(currentProject?.language || 'en');
    const [llmProvider, setLlmProvider] = useState(currentProject?.llmProvider || 'ollama');
    const [llmModel, setLlmModel] = useState(currentProject?.llmModel || '');
    const [customModel, setCustomModel] = useState('');
    const [loading, setLoading] = useState(false);
    const [providers, setProviders] = useState<Provider[]>(FALLBACK_PROVIDERS);

    // Fetch provider catalog from backend
    useEffect(() => {
        fetch(`${BACKEND}/ai/providers`)
            .then(res => res.json())
            .then(data => {
                if (data.providers && data.providers.length > 0) {
                    setProviders(data.providers);
                }
            })
            .catch(() => { /* use fallback */ });
    }, []);

    // Set default model when provider changes
    useEffect(() => {
        const provider = providers.find(p => p.id === llmProvider);
        if (provider) {
            const defaultModel = provider.models.find(m => m.default);
            if (!llmModel || !provider.models.some(m => m.id === llmModel)) {
                setLlmModel(defaultModel?.id || provider.models[0]?.id || '');
            }
        }
    }, [llmProvider, providers]);

    const selectedProvider = providers.find(p => p.id === llmProvider);
    const isCustomModel = llmModel === 'custom';

    const handleSave = async () => {
        if (!currentProject) return;
        setLoading(true);
        try {
            const finalModel = isCustomModel ? customModel : llmModel;
            await updateProject(currentProject.id, {
                name,
                settings: {
                    resolution,
                    fps,
                    aiMode,
                    language,
                    llmProvider,
                    llmModel: finalModel,
                }
            });
            onClose();
        } catch (error) {
            console.error(error);
            alert('Failed to update project settings');
        } finally {
            setLoading(false);
        }
    };

    const selectStyle = {
        width: '100%',
        padding: '8px 12px',
        background: 'var(--bg-tertiary)',
        border: '1px solid var(--panel-border)',
        borderRadius: 4,
        color: 'var(--text-primary)',
        fontSize: 13,
    };

    const labelStyle = {
        display: 'block' as const,
        marginBottom: 8,
        fontSize: 13,
        color: 'var(--text-secondary)',
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content wizard-modal" style={{ width: '560px', maxHeight: '90vh', overflowY: 'auto' as const }}>
                <div className="wizard-header">
                    <h2>Project Settings</h2>
                </div>

                <div className="wizard-body">
                    {/* Basic Settings */}
                    <div className="form-group" style={{ marginBottom: 16 }}>
                        <label style={labelStyle}>Project Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            style={{ ...selectStyle }}
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                        <div className="form-group">
                            <label style={labelStyle}>Resolution</label>
                            <select value={resolution} onChange={e => setResolution(e.target.value)} style={selectStyle}>
                                <option value="1080p">1080p (1920×1080)</option>
                                <option value="4K">4K (3840×2160)</option>
                                <option value="720p">720p (1280×720)</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label style={labelStyle}>Frame Rate</label>
                            <select value={fps} onChange={e => setFps(Number(e.target.value))} style={selectStyle}>
                                <option value={24}>24 fps</option>
                                <option value={25}>25 fps</option>
                                <option value={30}>30 fps</option>
                                <option value={60}>60 fps</option>
                            </select>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                        <div className="form-group">
                            <label style={labelStyle}>AI Mode</label>
                            <select value={aiMode} onChange={e => setAiMode(e.target.value)} style={selectStyle}>
                                <option value="fast">Fast (Lower Quality)</option>
                                <option value="hybrid">Balanced</option>
                                <option value="quality">High Quality (Slower)</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label style={labelStyle}>Language</label>
                            <select value={language} onChange={e => setLanguage(e.target.value)} style={selectStyle}>
                                <option value="en">English</option>
                                <option value="hi">Hindi</option>
                                <option value="es">Spanish</option>
                                <option value="fr">French</option>
                                <option value="de">German</option>
                                <option value="it">Italian</option>
                                <option value="pt">Portuguese</option>
                                <option value="ta">Tamil</option>
                                <option value="te">Telugu</option>
                                <option value="bn">Bengali</option>
                                <option value="mr">Marathi</option>
                                <option value="gu">Gujarati</option>
                                <option value="kn">Kannada</option>
                                <option value="ml">Malayalam</option>
                            </select>
                        </div>
                    </div>

                    {/* AI Model Section */}
                    <div style={{
                        padding: 16,
                        background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(168,85,247,0.08))',
                        borderRadius: 10,
                        border: '1px solid rgba(99,102,241,0.2)',
                        marginBottom: 16,
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                            <span style={{ fontSize: 16 }}>🤖</span>
                            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>AI Model</span>
                        </div>

                        <div className="form-group" style={{ marginBottom: 12 }}>
                            <label style={labelStyle}>Provider</label>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }}>
                                {providers.map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => setLlmProvider(p.id)}
                                        style={{
                                            padding: '10px 12px',
                                            borderRadius: 8,
                                            border: llmProvider === p.id
                                                ? '2px solid #6366f1'
                                                : '1px solid var(--panel-border)',
                                            background: llmProvider === p.id
                                                ? 'rgba(99,102,241,0.15)'
                                                : 'var(--bg-tertiary)',
                                            cursor: 'pointer',
                                            textAlign: 'left' as const,
                                            transition: 'all 0.2s',
                                        }}
                                    >
                                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                                            {p.label}
                                        </div>
                                        <div style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <span style={{
                                                display: 'inline-block',
                                                width: 6,
                                                height: 6,
                                                borderRadius: '50%',
                                                background: p.type === 'local' ? '#10b981' : (p.available ? '#6366f1' : '#ef4444'),
                                            }} />
                                            <span style={{ color: 'var(--text-muted)' }}>
                                                {p.type === 'local' ? 'Local' : p.available ? 'Connected' : 'Key needed'}
                                            </span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="form-group" style={{ marginBottom: isCustomModel ? 8 : 0 }}>
                            <label style={labelStyle}>Model</label>
                            <select
                                value={llmModel}
                                onChange={e => setLlmModel(e.target.value)}
                                style={selectStyle}
                            >
                                {selectedProvider?.models.map(m => (
                                    <option key={m.id} value={m.id}>{m.label}</option>
                                ))}
                            </select>
                        </div>

                        {isCustomModel && (
                            <div className="form-group">
                                <input
                                    type="text"
                                    value={customModel}
                                    onChange={e => setCustomModel(e.target.value)}
                                    placeholder="Enter custom model name (e.g., my-model:latest)"
                                    style={{ ...selectStyle, marginTop: 8 }}
                                />
                            </div>
                        )}

                        {selectedProvider?.type === 'cloud' && !selectedProvider.available && (
                            <div style={{
                                marginTop: 10,
                                padding: '8px 10px',
                                background: 'rgba(239,68,68,0.1)',
                                borderRadius: 6,
                                fontSize: 11,
                                color: '#f87171',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                            }}>
                                <span>⚠️</span>
                                <span>
                                    Set <code style={{ background: 'rgba(0,0,0,0.2)', padding: '1px 4px', borderRadius: 3 }}>
                                        {providers.find(p => p.id === llmProvider)?.id === 'openai' ? 'OPENAI_API_KEY' :
                                            providers.find(p => p.id === llmProvider)?.id === 'google' ? 'GOOGLE_API_KEY' :
                                                providers.find(p => p.id === llmProvider)?.id === 'anthropic' ? 'ANTHROPIC_API_KEY' :
                                                    providers.find(p => p.id === llmProvider)?.id === 'sarvam' ? 'SARVAM_API_KEY' :
                                                        'API_KEY'}
                                    </code> environment variable to use this provider.
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="wizard-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                    <button className="btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
                    <button className="btn-primary" onClick={handleSave} disabled={loading}>
                        {loading ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
};
