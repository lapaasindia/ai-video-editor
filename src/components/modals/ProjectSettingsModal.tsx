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
            { id: 'gpt-5-mini', label: 'GPT-5 Mini (Cheap, recommended)', default: true },
            { id: 'gpt-4o', label: 'GPT-4o (Flagship)' },
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

// ── Pipeline Stage Definitions for Prompt Editor ─────────────────────────────

interface PipelineStage {
    key: string;
    label: string;
    description: string;
    defaultPrompt: string;
}

const PIPELINE_STAGES: PipelineStage[] = [
    {
        key: 'high_retention_analysis',
        label: 'High-Retention Chunk Analysis',
        description: 'System prompt for per-chunk AI analysis — decides templates, B-roll, and cuts.',
        defaultPrompt: 'You are an expert video editor creating HIGH-RETENTION content for Indian YouTube audiences.',
    },
    {
        key: 'cut_plan',
        label: 'Cut Planning',
        description: 'System prompt for identifying sections to cut — filler, silence, repetitions.',
        defaultPrompt: 'You are an expert video editor AI. Analyze this transcript deeply.',
    },
    {
        key: 'overlay_plan',
        label: 'Overlay Planning',
        description: 'System prompt for suggesting overlay templates for transcript chunks.',
        defaultPrompt: 'You are an expert video editor AI. Analyze this transcript chunk and suggest overlay templates.',
    },
    {
        key: 'template_plan',
        label: 'Template Selection',
        description: 'System prompt for picking the best templates for key moments.',
        defaultPrompt: 'You are an expert video editor AI specializing in Hindi/Hinglish content. Analyze this transcript and pick the BEST templates for key moments.',
    },
    {
        key: 'start_editing',
        label: 'Start Editing Analysis',
        description: 'System prompt for initial transcript analysis — cuts, sections, overlay suggestions.',
        defaultPrompt: 'You are an expert video editor AI. Analyze this Hindi/Hinglish transcript.',
    },
    {
        key: 'chunk_replan',
        label: 'Chunk Re-Plan (QC)',
        description: 'System prompt for re-planning chunks that failed quality checks.',
        defaultPrompt: 'You are an expert video editor creating HIGH-RETENTION content. A previous edit plan for this chunk failed quality checks. Re-plan with the improvements below.',
    },
];

export const ProjectSettingsModal: React.FC<ProjectSettingsModalProps> = ({ onClose }) => {
    const { currentProject, updateProject } = useEditor();
    const [activeTab, setActiveTab] = useState<'general' | 'prompts' | 'templates'>('general');
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
    const [customPrompts, setCustomPrompts] = useState<Record<string, string>>({});
    const [promptsLoading, setPromptsLoading] = useState(false);
    const [promptsSaved, setPromptsSaved] = useState(false);
    const [expandedStage, setExpandedStage] = useState<string | null>(null);
    const [templateList, setTemplateList] = useState<Array<{ id: string; name: string; category: string; file: string; isCustom: boolean }>>([]);

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

    // Fetch template list when templates tab is active
    const fetchTemplates = () => {
        fetch(`${BACKEND}/templates/list`)
            .then(res => res.json())
            .then(data => {
                if (data.templates) setTemplateList(data.templates);
            })
            .catch(() => { /* ignore */ });
    };

    useEffect(() => {
        if (activeTab === 'templates') fetchTemplates();
    }, [activeTab]);


    // Fetch custom prompts
    useEffect(() => {
        fetch(`${BACKEND}/ai/prompts`)
            .then(res => res.json())
            .then(data => {
                if (data.prompts) setCustomPrompts(data.prompts);
            })
            .catch(() => { /* use defaults */ });
    }, []);

    const handleSavePrompts = async () => {
        setPromptsLoading(true);
        try {
            await fetch(`${BACKEND}/ai/prompts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompts: customPrompts }),
            });
            setPromptsSaved(true);
            setTimeout(() => setPromptsSaved(false), 2000);
        } catch {
            alert('Failed to save prompts');
        } finally {
            setPromptsLoading(false);
        }
    };

    const handleResetPrompt = (key: string) => {
        setCustomPrompts(prev => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
    };

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

    const tabStyle = (active: boolean) => ({
        padding: '8px 16px',
        borderRadius: '6px 6px 0 0',
        border: 'none',
        background: active ? 'var(--bg-secondary)' : 'transparent',
        color: active ? 'var(--text-primary)' : 'var(--text-muted)',
        fontWeight: active ? 600 : 400,
        fontSize: 13,
        cursor: 'pointer' as const,
        transition: 'all 0.2s',
        borderBottom: active ? '2px solid #6366f1' : '2px solid transparent',
    });

    return (
        <div className="modal-overlay">
            <div className="modal-content wizard-modal" style={{ width: '640px', maxHeight: '90vh', overflowY: 'auto' as const }}>
                <div className="wizard-header" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                    <h2>Project Settings</h2>
                    <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                        <button style={tabStyle(activeTab === 'general')} onClick={() => setActiveTab('general')}>General</button>
                        <button style={tabStyle(activeTab === 'prompts')} onClick={() => setActiveTab('prompts')}>AI Prompts</button>
                        <button style={tabStyle(activeTab === 'templates')} onClick={() => setActiveTab('templates')}>Templates</button>
                    </div>
                </div>

                <div className="wizard-body">
                    {activeTab === 'general' && <>
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
                                <option value="auto">Auto-Detect</option>
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
                    </>}

                    {activeTab === 'prompts' && (
                        <div>
                            <div style={{
                                padding: '10px 14px',
                                background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(168,85,247,0.08))',
                                borderRadius: 8,
                                border: '1px solid rgba(99,102,241,0.15)',
                                marginBottom: 16,
                                fontSize: 12,
                                color: 'var(--text-secondary)',
                                lineHeight: 1.5,
                            }}>
                                Customize the system prompts sent to the AI at each pipeline stage.
                                Leave empty to use the default prompt. Changes apply to the next AI edit run.
                            </div>

                            {PIPELINE_STAGES.map(stage => {
                                const isExpanded = expandedStage === stage.key;
                                const hasCustom = !!(customPrompts[stage.key] && customPrompts[stage.key].trim());
                                return (
                                    <div key={stage.key} style={{
                                        marginBottom: 8,
                                        border: '1px solid var(--panel-border)',
                                        borderRadius: 8,
                                        overflow: 'hidden',
                                        background: hasCustom ? 'rgba(99,102,241,0.04)' : 'var(--bg-secondary)',
                                    }}>
                                        <button
                                            onClick={() => setExpandedStage(isExpanded ? null : stage.key)}
                                            style={{
                                                width: '100%',
                                                padding: '10px 14px',
                                                background: 'none',
                                                border: 'none',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                gap: 8,
                                            }}
                                        >
                                            <div style={{ textAlign: 'left' }}>
                                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    {stage.label}
                                                    {hasCustom && (
                                                        <span style={{
                                                            fontSize: 9,
                                                            padding: '1px 6px',
                                                            borderRadius: 4,
                                                            background: 'rgba(99,102,241,0.2)',
                                                            color: '#818cf8',
                                                            fontWeight: 500,
                                                        }}>CUSTOM</span>
                                                    )}
                                                </div>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                                                    {stage.description}
                                                </div>
                                            </div>
                                            <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>
                                                {isExpanded ? '▲' : '▼'}
                                            </span>
                                        </button>

                                        {isExpanded && (
                                            <div style={{ padding: '0 14px 14px' }}>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                                                    Default: <code style={{
                                                        fontSize: 10,
                                                        background: 'rgba(0,0,0,0.15)',
                                                        padding: '2px 5px',
                                                        borderRadius: 3,
                                                        wordBreak: 'break-all',
                                                    }}>{stage.defaultPrompt}</code>
                                                </div>
                                                <textarea
                                                    value={customPrompts[stage.key] || ''}
                                                    onChange={e => setCustomPrompts(prev => ({ ...prev, [stage.key]: e.target.value }))}
                                                    placeholder={stage.defaultPrompt}
                                                    rows={4}
                                                    style={{
                                                        width: '100%',
                                                        padding: '8px 10px',
                                                        background: 'var(--bg-tertiary)',
                                                        border: '1px solid var(--panel-border)',
                                                        borderRadius: 6,
                                                        color: 'var(--text-primary)',
                                                        fontSize: 12,
                                                        fontFamily: 'monospace',
                                                        resize: 'vertical' as const,
                                                        lineHeight: 1.5,
                                                    }}
                                                />
                                                {hasCustom && (
                                                    <button
                                                        onClick={() => handleResetPrompt(stage.key)}
                                                        style={{
                                                            marginTop: 6,
                                                            padding: '4px 10px',
                                                            fontSize: 11,
                                                            background: 'rgba(239,68,68,0.1)',
                                                            border: '1px solid rgba(239,68,68,0.2)',
                                                            borderRadius: 4,
                                                            color: '#f87171',
                                                            cursor: 'pointer',
                                                        }}
                                                    >
                                                        Reset to Default
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                                <button
                                    className="btn-primary"
                                    onClick={handleSavePrompts}
                                    disabled={promptsLoading}
                                    style={{ fontSize: 13 }}
                                >
                                    {promptsLoading ? 'Saving...' : 'Save Prompts'}
                                </button>
                                {promptsSaved && (
                                    <span style={{ fontSize: 12, color: '#10b981' }}>Saved!</span>
                                )}
                            </div>
                        </div>
                    )}
                    {activeTab === 'templates' && (
                        <div style={{ padding: 20, textAlign: 'center' }}>
                            <div style={{
                                padding: '24px',
                                background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(168,85,247,0.08))',
                                borderRadius: 12,
                                border: '1px solid rgba(99,102,241,0.15)',
                                marginBottom: 16,
                            }}>
                                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                                    Template Editor
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 16 }}>
                                    Create, import, preview, and manage all {templateList.length || '...'} templates
                                    with live Remotion rendering and editable properties.
                                </div>
                                <button
                                    className="btn-primary"
                                    onClick={() => { onClose(); setTimeout(() => { const evt = new KeyboardEvent('keydown', { key: 't', metaKey: true }); window.dispatchEvent(evt); }, 100); }}
                                    style={{ fontSize: 13, padding: '8px 20px' }}
                                >
                                    Open Template Editor (⌘T)
                                </button>
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                                You can also open it from <strong>View → Template Editor</strong> in the menu bar.
                            </div>
                        </div>
                    )}
                </div>

                <div className="wizard-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                    <button className="btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
                    {activeTab === 'general' && (
                        <button className="btn-primary" onClick={handleSave} disabled={loading}>
                            {loading ? 'Saving...' : 'Save Changes'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
