import React, { useEffect, useState } from 'react';

interface ModelManagerProps {
    onClose: () => void;
}

interface OllamaModel {
    name: string;
    size?: string;
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

const API_KEY_MAP: Record<string, { label: string; placeholder: string; envKey: string }> = {
    sarvam: { label: 'Sarvam AI', placeholder: 'sk_...', envKey: 'SARVAM_API_KEY' },
    openai: { label: 'OpenAI', placeholder: 'sk-...', envKey: 'OPENAI_API_KEY' },
    google: { label: 'Google Gemini', placeholder: 'AIza...', envKey: 'GOOGLE_API_KEY' },
    anthropic: { label: 'Anthropic', placeholder: 'sk-ant-...', envKey: 'ANTHROPIC_API_KEY' },
};


type Tab = 'api-keys' | 'ollama-models' | 'hf-models';

interface HFFile {
    path: string;
    size: number;
    oid: string;
}

export const ModelManager: React.FC<ModelManagerProps> = ({ onClose }) => {
    const [tab, setTab] = useState<Tab>('api-keys');
    const [providers, setProviders] = useState<Provider[]>([]);
    const [installedModels, setInstalledModels] = useState<OllamaModel[]>([]);
    const [ollamaError, setOllamaError] = useState('');
    const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
    const [savedKeys, setSavedKeys] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const [saveMsg, setSaveMsg] = useState('');
    const [pulling, setPulling] = useState<string | null>(null);
    const [pullMsg, setPullMsg] = useState('');
    const [customModel, setCustomModel] = useState('');

    const [loading, setLoading] = useState(true);

    // HF State
    const [hfRepo, setHfRepo] = useState('');
    const [hfFiles, setHfFiles] = useState<HFFile[]>([]);
    const [hfSearching, setHfSearching] = useState(false);
    const [hfError, setHfError] = useState('');
    const [hfJobId, setHfJobId] = useState<string | null>(null);
    const [hfProgress, setHfProgress] = useState({ percent: 0, message: '', status: '' });

    // Load data on mount
    useEffect(() => {
        loadAll();
    }, []);

    const loadAll = async () => {
        setLoading(true);
        await Promise.all([loadProviders(), loadSavedKeys(), loadOllamaModels()]);
        setLoading(false);
    };

    const loadProviders = async () => {
        try {
            const res = await fetch(`${BACKEND}/ai/providers`);
            const data = await res.json();
            if (data.providers) setProviders(data.providers);
        } catch { }
    };

    const loadSavedKeys = async () => {
        try {
            const res = await fetch(`${BACKEND}/ai/config`);
            const data = await res.json();
            if (data.config) setSavedKeys(data.config);
        } catch { }
    };

    const loadOllamaModels = async () => {
        try {
            const res = await fetch(`${BACKEND}/ai/ollama/models`);
            const data = await res.json();
            setInstalledModels(data.models || []);
            setOllamaError(data.error || '');
        } catch (e: any) {
            setOllamaError('Cannot connect to backend');
        }
    };

    const saveApiKey = async (envKey: string, value: string) => {
        if (!value.trim()) return;
        setSaving(true);
        setSaveMsg('');
        try {
            const res = await fetch(`${BACKEND}/ai/config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: envKey, value: value.trim() }),
            });
            const data = await res.json();
            if (data.ok) {
                setSaveMsg(`✓ ${envKey} saved`);
                setApiKeys(prev => ({ ...prev, [envKey]: '' })); // Clear input
                await loadSavedKeys();
                await loadProviders(); // Refresh availability
            } else {
                setSaveMsg(`✗ ${data.error || 'Save failed'}`);
            }
        } catch {
            setSaveMsg('✗ Connection error');
        }
        setSaving(false);
        setTimeout(() => setSaveMsg(''), 3000);
    };

    const pullModel = async (model: string) => {
        if (!model.trim()) return;
        setPulling(model);
        setPullMsg(`Pulling ${model}...`);
        try {
            const res = await fetch(`${BACKEND}/ai/ollama/pull`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model }),
            });
            const data = await res.json();
            if (data.ok) {
                setPullMsg(`✓ ${model} installed`);
                await loadOllamaModels();
            } else {
                setPullMsg(`✗ ${data.error || 'Pull failed'}`);
            }
        } catch {
            setPullMsg('✗ Connection error');
        }
        setPulling(null);
        setTimeout(() => setPullMsg(''), 5000);
    };

    const searchHF = async () => {
        if (!hfRepo.trim()) return;
        setHfSearching(true);
        setHfError('');
        setHfFiles([]);
        try {
            const res = await fetch(`${BACKEND}/ai/huggingface/search`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ repo: hfRepo.trim() }),
            });
            const data = await res.json();
            if (data.files) {
                setHfFiles(data.files);
                if (data.files.length === 0) setHfError('No .gguf files found in this repo.');
            } else {
                setHfError(data.error || 'Search failed');
            }
        } catch {
            setHfError('Connection error');
        }
        setHfSearching(false);
    };

    const installHF = async (file: HFFile) => {
        const defaultName = file.path.split('/').pop()?.replace('.gguf', '').toLowerCase().replace(/[^a-z0-9]/g, '-') || 'custom-model';
        const modelName = prompt('Enter a name for this model in Ollama:', defaultName);
        if (!modelName) return;

        setHfJobId('starting');
        setHfProgress({ percent: 0, message: 'Starting...', status: 'pending' });

        try {
            const res = await fetch(`${BACKEND}/ai/huggingface/pull`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    repo: hfRepo.trim(),
                    filename: file.path,
                    modelName: modelName.trim()
                }),
            });
            const data = await res.json();
            if (data.jobId) {
                setHfJobId(data.jobId);
                pollHFProgress(data.jobId);
            } else {
                setHfError(data.error || 'Failed to start install');
                setHfJobId(null);
            }
        } catch {
            setHfError('Connection error');
            setHfJobId(null);
        }
    };

    const pollHFProgress = async (jobId: string) => {
        const interval = setInterval(async () => {
            try {
                const res = await fetch(`${BACKEND}/ai/huggingface/progress/${jobId}`);
                if (!res.ok) return; // Wait or retry
                const job = await res.json();

                setHfProgress(job);

                if (job.status === 'completed' || job.status === 'failed') {
                    clearInterval(interval);
                    setHfJobId(null);
                    if (job.status === 'completed') {
                        setSaveMsg(`✓ Installed ${jobId} (refreshing list...)`); // Not quite right, need model name?
                        loadOllamaModels();
                    } else {
                        setHfError(`Install failed: ${job.message}`);
                    }
                }
            } catch { }
        }, 1000);
    };

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const dm = 2;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    };

    const isModelInstalled = (modelId: string) => {
        return installedModels.some(m => m.name === modelId || m.name.startsWith(modelId + ':'));
    };

    const ollamaProvider = providers.find(p => p.id === 'ollama');

    const s = {
        overlay: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(4px)' },
        modal: { background: '#1a1a2e', borderRadius: 14, width: 640, maxHeight: '85vh', overflow: 'hidden', boxShadow: '0 25px 50px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column' as const },
        header: { padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
        title: { fontSize: 18, fontWeight: 700, color: '#fff', margin: 0 },
        body: { padding: '0 24px 24px', overflowY: 'auto' as const, flex: 1 },
        tabs: { display: 'flex', gap: 0, borderBottom: '1px solid rgba(255,255,255,0.08)', margin: '0 -24px 20px', padding: '0 24px' },
        tab: (active: boolean) => ({
            padding: '12px 20px', cursor: 'pointer', fontSize: 13, fontWeight: active ? 600 : 400,
            color: active ? '#818cf8' : '#aaa', background: 'none', border: 'none',
            borderBottom: active ? '2px solid #818cf8' : '2px solid transparent', transition: 'all 0.2s',
        }),
        group: { marginBottom: 20, background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 16, border: '1px solid rgba(255,255,255,0.06)' },
        groupTitle: { fontSize: 13, fontWeight: 600, color: '#ccc', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 },
        row: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 },
        input: { flex: 1, padding: '8px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, color: '#fff', fontSize: 13, outline: 'none' },
        btn: (variant: string) => ({
            padding: '7px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
            background: variant === 'primary' ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'rgba(255,255,255,0.08)',
            color: '#fff', transition: 'all 0.2s', opacity: saving || !!pulling ? 0.6 : 1,
        }),
        badge: (color: string) => ({
            display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
            background: color === 'green' ? 'rgba(16,185,129,0.15)' : color === 'yellow' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
            color: color === 'green' ? '#34d399' : color === 'yellow' ? '#fbbf24' : '#f87171',
        }),
        dot: (color: string) => ({ width: 6, height: 6, borderRadius: '50%', background: color === 'green' ? '#10b981' : color === 'yellow' ? '#f59e0b' : '#ef4444' }),
        footer: { padding: '14px 24px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
        msg: (ok: boolean) => ({ fontSize: 12, color: ok ? '#34d399' : '#f87171' }),
    };

    return (
        <div style={s.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div style={s.modal}>
                {/* Header */}
                <div style={s.header}>
                    <h2 style={s.title}>🤖 AI Model Manager</h2>
                    <button onClick={loadAll} style={{ ...s.btn(''), padding: '5px 10px' }} title="Refresh">↻</button>
                </div>

                <div style={s.body}>
                    {/* Tabs */}
                    <div style={s.tabs}>
                        <button style={s.tab(tab === 'api-keys')} onClick={() => setTab('api-keys')}>
                            🔑 API Keys
                        </button>
                        <button style={s.tab(tab === 'ollama-models')} onClick={() => setTab('ollama-models')}>
                            📦 Ollama Models
                        </button>
                        <button style={s.tab(tab === 'hf-models')} onClick={() => setTab('hf-models')}>
                            🤗 Hugging Face
                        </button>
                    </div>

                    {loading ? (
                        <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>Loading...</div>
                    ) : tab === 'api-keys' ? (
                        /* ── API Keys Tab ─────────────────────────────── */
                        <div>
                            <p style={{ fontSize: 12, color: '#888', marginBottom: 16 }}>
                                Enter API keys for cloud AI providers. Keys are stored locally and never sent externally.
                            </p>

                            {Object.entries(API_KEY_MAP).map(([providerId, info]) => {
                                const provider = providers.find(p => p.id === providerId);
                                const isConnected = provider?.available;
                                const maskedKey = savedKeys[info.envKey];

                                return (
                                    <div key={providerId} style={s.group}>
                                        <div style={s.groupTitle}>
                                            <span>{info.label}</span>
                                            {isConnected ? (
                                                <span style={s.badge('green')}>
                                                    <span style={s.dot('green')} /> Connected
                                                </span>
                                            ) : maskedKey ? (
                                                <span style={s.badge('yellow')}>
                                                    <span style={s.dot('yellow')} /> Saved
                                                </span>
                                            ) : (
                                                <span style={s.badge('red')}>
                                                    <span style={s.dot('red')} /> Not set
                                                </span>
                                            )}
                                        </div>

                                        {maskedKey && (
                                            <div style={{ fontSize: 11, color: '#666', marginBottom: 8, fontFamily: 'monospace' }}>
                                                Current: {maskedKey}
                                            </div>
                                        )}

                                        <div style={s.row}>
                                            <input
                                                type="password"
                                                placeholder={info.placeholder}
                                                value={apiKeys[info.envKey] || ''}
                                                onChange={e => setApiKeys(prev => ({ ...prev, [info.envKey]: e.target.value }))}
                                                style={s.input}
                                                onKeyDown={e => e.key === 'Enter' && saveApiKey(info.envKey, apiKeys[info.envKey] || '')}
                                            />
                                            <button
                                                onClick={() => saveApiKey(info.envKey, apiKeys[info.envKey] || '')}
                                                disabled={saving || !apiKeys[info.envKey]?.trim()}
                                                style={s.btn('primary')}
                                            >
                                                {saving ? '...' : 'Save'}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : tab === 'ollama-models' ? (
                        /* ── Ollama Models Tab ────────────────────────── */
                        <div>
                            {ollamaError && (
                                <div style={{ padding: '10px 14px', marginBottom: 16, borderRadius: 8, background: 'rgba(239,68,68,0.1)', color: '#f87171', fontSize: 12 }}>
                                    ⚠️ {ollamaError} — Make sure Ollama is installed and running.
                                </div>
                            )}

                            {/* Installed Models */}
                            <div style={s.group}>
                                <div style={s.groupTitle}>
                                    <span>Installed Models</span>
                                    <span style={{ fontSize: 11, color: '#666' }}>({installedModels.length})</span>
                                </div>
                                {installedModels.length === 0 ? (
                                    <div style={{ fontSize: 12, color: '#666', padding: '8px 0' }}>
                                        No models installed. Install one from the catalog below.
                                    </div>
                                ) : (
                                    installedModels.map(m => (
                                        <div key={m.name} style={{ ...s.row, marginBottom: 6 }}>
                                            <span style={{ flex: 1, fontSize: 13, color: '#ddd', fontFamily: 'monospace' }}>{m.name}</span>
                                            {m.size && <span style={{ fontSize: 11, color: '#666' }}>{m.size}</span>}
                                            <span style={s.badge('green')}>
                                                <span style={s.dot('green')} /> Ready
                                            </span>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Model Catalog */}
                            <div style={s.group}>
                                <div style={s.groupTitle}>Install from Catalog</div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                    {ollamaProvider?.models
                                        .filter(m => m.id !== 'custom')
                                        .map(m => {
                                            const installed = isModelInstalled(m.id);
                                            const isPulling = pulling === m.id;
                                            return (
                                                <div key={m.id} style={{
                                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                    padding: '8px 12px', borderRadius: 8,
                                                    background: installed ? 'rgba(16,185,129,0.06)' : 'rgba(255,255,255,0.03)',
                                                    border: installed ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(255,255,255,0.06)',
                                                }}>
                                                    <div>
                                                        <div style={{ fontSize: 12, fontWeight: 600, color: '#ddd' }}>{m.id}</div>
                                                        <div style={{ fontSize: 10, color: '#888' }}>{m.label}</div>
                                                    </div>
                                                    {installed ? (
                                                        <span style={{ fontSize: 10, color: '#34d399' }}>✓</span>
                                                    ) : (
                                                        <button
                                                            onClick={() => pullModel(m.id)}
                                                            disabled={!!pulling}
                                                            style={{ ...s.btn('primary'), padding: '4px 10px', fontSize: 11 }}
                                                        >
                                                            {isPulling ? '⏳' : 'Install'}
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                </div>
                            </div>

                            {/* Custom Model */}
                            <div style={s.group}>
                                <div style={s.groupTitle}>Install Custom Model</div>
                                <div style={s.row}>
                                    <input
                                        placeholder="e.g. phi4:14b or ai4bharat/airavata"
                                        value={customModel}
                                        onChange={e => setCustomModel(e.target.value)}
                                        style={s.input}
                                        onKeyDown={e => e.key === 'Enter' && pullModel(customModel)}
                                    />
                                    <button
                                        onClick={() => pullModel(customModel)}
                                        disabled={!!pulling || !customModel.trim()}
                                        style={s.btn('primary')}
                                    >
                                        {pulling === customModel ? '⏳' : 'Pull'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* ── Hugging Face Tab ─────────────────────────── */
                        <div>
                            <div style={{ marginBottom: 16 }}>
                                <div style={{ fontSize: 13, marginBottom: 8, color: '#ccc' }}>
                                    Search for GGUF models on Hugging Face (e.g. <code>TheBloke/Mistral-7B-v0.1-GGUF</code>)
                                </div>
                                <div style={s.row}>
                                    <input
                                        placeholder="Repo ID (User/Repo)"
                                        value={hfRepo}
                                        onChange={e => setHfRepo(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && searchHF()}
                                        style={s.input}
                                    />
                                    <button
                                        onClick={searchHF}
                                        disabled={hfSearching || !hfRepo.trim()}
                                        style={s.btn('primary')}
                                    >
                                        {hfSearching ? 'Searching...' : 'Search'}
                                    </button>
                                </div>
                            </div>

                            {hfError && (
                                <div style={{ padding: '10px', marginBottom: 16, borderRadius: 8, background: 'rgba(239,68,68,0.1)', color: '#f87171', fontSize: 12 }}>
                                    {hfError}
                                </div>
                            )}

                            {hfJobId && (
                                <div style={{ padding: '12px', marginBottom: 16, borderRadius: 8, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                        <span style={{ fontSize: 12, fontWeight: 600, color: '#60a5fa' }}>{hfProgress.status === 'downloading' ? 'Downloading...' : hfProgress.status === 'importing' ? 'Importing...' : 'Processing...'}</span>
                                        <span style={{ fontSize: 12, color: '#93c5fd' }}>{hfProgress.percent}%</span>
                                    </div>
                                    <div style={{ height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
                                        <div style={{ height: '100%', width: `${hfProgress.percent}%`, background: '#3b82f6', transition: 'width 0.3s' }} />
                                    </div>
                                    <div style={{ fontSize: 11, color: '#93c5fd', marginTop: 6 }}>{hfProgress.message}</div>
                                </div>
                            )}

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {hfFiles.map(file => (
                                    <div key={file.oid} style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '10px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)'
                                    }}>
                                        <div style={{ overflow: 'hidden' }}>
                                            <div style={{ fontSize: 13, fontWeight: 600, color: '#ddd', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {file.path}
                                            </div>
                                            <div style={{ fontSize: 11, color: '#888' }}>{formatBytes(file.size)}</div>
                                        </div>
                                        <button
                                            onClick={() => installHF(file)}
                                            disabled={!!hfJobId}
                                            style={{ ...s.btn('primary'), padding: '6px 12px', fontSize: 11 }}
                                        >
                                            Install
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={s.footer}>
                    <div>
                        {saveMsg && <span style={s.msg(saveMsg.startsWith('✓'))}>{saveMsg}</span>}
                        {pullMsg && <span style={s.msg(pullMsg.startsWith('✓'))}>{pullMsg}</span>}
                    </div>
                    <button onClick={onClose} style={s.btn('primary')}>Done</button>
                </div>
            </div>
        </div>
    );
};
