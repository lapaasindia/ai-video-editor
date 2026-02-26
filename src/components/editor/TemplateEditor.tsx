import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Player } from '@remotion/player';
import {
    getTemplateRegistry,
    getCategories,
    getCategoryLabel,
    TemplateMetadata,
    TemplateCategory,
} from '../../templates/registry';

const BACKEND = 'http://127.0.0.1:43123';

// ─── Zod Schema Introspection ────────────────────────────────────────────────
// Extract field definitions from a zod schema for auto-generating form fields

interface FieldDef {
    key: string;
    type: 'string' | 'number' | 'boolean' | 'color' | 'url' | 'select';
    label: string;
    defaultValue: unknown;
    options?: string[];
}

function introspectSchema(schema: any, defaults: Record<string, unknown>): FieldDef[] {
    const fields: FieldDef[] = [];
    if (!schema || !schema.shape) return fields;

    for (const [key, fieldSchema] of Object.entries(schema.shape) as [string, any][]) {
        // Unwrap .default() / .optional() wrappers
        let inner = fieldSchema;
        while (inner?._def?.innerType) inner = inner._def.innerType;

        const typeName = inner?._def?.typeName || '';
        const defaultVal = defaults[key];

        let type: FieldDef['type'] = 'string';
        if (typeName === 'ZodNumber') type = 'number';
        else if (typeName === 'ZodBoolean') type = 'boolean';
        else if (typeName === 'ZodEnum') type = 'select';

        // Heuristic: detect color fields
        if (type === 'string' && (
            key.toLowerCase().includes('color') ||
            key.toLowerCase().includes('background') ||
            (typeof defaultVal === 'string' && /^#[0-9a-f]{3,8}$/i.test(defaultVal))
        )) {
            type = 'color';
        }

        // Heuristic: detect URL fields
        if (type === 'string' && (
            key.toLowerCase().includes('url') ||
            key.toLowerCase().includes('image') ||
            key.toLowerCase().includes('icon') ||
            (typeof defaultVal === 'string' && (defaultVal.startsWith('http') || defaultVal.startsWith('/')))
        )) {
            type = 'url';
        }

        // Get enum options
        let options: string[] | undefined;
        if (typeName === 'ZodEnum' && inner?._def?.values) {
            options = inner._def.values;
        }

        fields.push({
            key,
            type,
            label: key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim(),
            defaultValue: defaultVal,
            options,
        });
    }
    return fields;
}

// ─── Props Editor Panel ──────────────────────────────────────────────────────

const PropsEditor: React.FC<{
    fields: FieldDef[];
    values: Record<string, unknown>;
    onChange: (key: string, value: unknown) => void;
    onReset: () => void;
}> = ({ fields, values, onChange, onReset }) => {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Properties ({fields.length})
                </span>
                <button
                    onClick={onReset}
                    style={{
                        fontSize: 10, padding: '2px 8px', background: 'rgba(239,68,68,0.1)',
                        border: '1px solid rgba(239,68,68,0.2)', borderRadius: 4,
                        color: '#f87171', cursor: 'pointer',
                    }}
                >
                    Reset Defaults
                </button>
            </div>
            {fields.map(field => (
                <div key={field.key} style={{ marginBottom: 8 }}>
                    <label style={{
                        display: 'block', fontSize: 10, fontWeight: 600,
                        color: 'var(--text-muted)', marginBottom: 3, letterSpacing: 0.3,
                    }}>
                        {field.label}
                    </label>

                    {field.type === 'boolean' ? (
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={!!values[field.key]}
                                onChange={e => onChange(field.key, e.target.checked)}
                                style={{ accentColor: '#6366f1' }}
                            />
                            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                {values[field.key] ? 'On' : 'Off'}
                            </span>
                        </label>
                    ) : field.type === 'number' ? (
                        <input
                            type="number"
                            value={Number(values[field.key] ?? field.defaultValue ?? 0)}
                            onChange={e => onChange(field.key, parseFloat(e.target.value) || 0)}
                            step={Number(values[field.key]) < 10 ? 0.1 : 1}
                            style={inputStyle}
                        />
                    ) : field.type === 'color' ? (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <input
                                type="color"
                                value={String(values[field.key] || '#000000')}
                                onChange={e => onChange(field.key, e.target.value)}
                                style={{ width: 32, height: 26, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
                            />
                            <input
                                type="text"
                                value={String(values[field.key] || '')}
                                onChange={e => onChange(field.key, e.target.value)}
                                style={{ ...inputStyle, flex: 1 }}
                            />
                        </div>
                    ) : field.type === 'select' && field.options ? (
                        <select
                            value={String(values[field.key] || '')}
                            onChange={e => onChange(field.key, e.target.value)}
                            style={{ ...inputStyle, cursor: 'pointer' }}
                        >
                            {field.options.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                    ) : field.type === 'url' ? (
                        <input
                            type="text"
                            value={String(values[field.key] || '')}
                            onChange={e => onChange(field.key, e.target.value)}
                            placeholder="https://..."
                            style={{ ...inputStyle, fontSize: 10, fontFamily: 'monospace' }}
                        />
                    ) : (
                        // String or long text
                        String(values[field.key] || '').length > 60 ? (
                            <textarea
                                value={String(values[field.key] || '')}
                                onChange={e => onChange(field.key, e.target.value)}
                                rows={3}
                                style={{ ...inputStyle, resize: 'vertical', minHeight: 50 }}
                            />
                        ) : (
                            <input
                                type="text"
                                value={String(values[field.key] || '')}
                                onChange={e => onChange(field.key, e.target.value)}
                                style={inputStyle}
                            />
                        )
                    )}
                </div>
            ))}
        </div>
    );
};

const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '5px 8px',
    fontSize: 12,
    background: 'var(--bg-tertiary, #1a1a2e)',
    border: '1px solid var(--panel-border, #333)',
    borderRadius: 4,
    color: 'var(--text-primary, #e4e4e4)',
    outline: 'none',
    boxSizing: 'border-box',
};

// ─── Template Card (left sidebar) ────────────────────────────────────────────

const TemplateCard: React.FC<{
    template: TemplateMetadata;
    isSelected: boolean;
    onClick: () => void;
}> = ({ template, isSelected, onClick }) => (
    <div
        onClick={onClick}
        style={{
            padding: '8px 10px',
            marginBottom: 3,
            borderRadius: 6,
            cursor: 'pointer',
            border: isSelected ? '1px solid #6366f1' : '1px solid transparent',
            background: isSelected ? 'rgba(99,102,241,0.12)' : 'transparent',
            transition: 'all 0.15s',
        }}
        onMouseEnter={e => { if (!isSelected) (e.currentTarget.style.background = 'rgba(255,255,255,0.03)'); }}
        onMouseLeave={e => { if (!isSelected) (e.currentTarget.style.background = 'transparent'); }}
    >
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>
            {template.name}
        </div>
        <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2, display: 'flex', gap: 6, alignItems: 'center' }}>
            <code style={{ fontSize: 9, background: 'rgba(0,0,0,0.2)', padding: '1px 4px', borderRadius: 2 }}>
                {template.id}
            </code>
            <span>{template.durationInFrames / template.fps}s</span>
        </div>
        {template.tags.length > 0 && (
            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 3, display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {template.tags.slice(0, 4).map(t => (
                    <span key={t} style={{
                        background: 'rgba(99,102,241,0.1)', padding: '0 4px', borderRadius: 2,
                        color: '#818cf8', fontSize: 8,
                    }}>{t}</span>
                ))}
            </div>
        )}
    </div>
);

// ─── Import Template Dialog ──────────────────────────────────────────────────

const ImportDialog: React.FC<{
    onClose: () => void;
    onImported: () => void;
}> = ({ onClose, onImported }) => {
    const [fileName, setFileName] = useState('');
    const [content, setContent] = useState('');
    const [category, setCategory] = useState('custom');
    const [status, setStatus] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleFileSelect = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.tsx,.ts';
        input.onchange = async (e: any) => {
            const file = e.target.files[0];
            if (!file) return;
            setFileName(file.name);
            const text = await file.text();
            setContent(text);
        };
        input.click();
    };

    const handleUpload = async () => {
        if (!fileName || !content) {
            setStatus('Please select a file first');
            return;
        }
        setLoading(true);
        setStatus(null);
        try {
            const res = await fetch(`${BACKEND}/templates/upload`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fileName, content, category }),
            });
            const data = await res.json();
            if (data.ok) {
                setStatus(`Uploaded: ${data.templateName} (${data.templateId}). Restart app to use in pipeline.`);
                onImported();
            } else {
                setStatus(`Error: ${data.error}`);
            }
        } catch (e: any) {
            setStatus(`Upload failed: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 10001,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        }} onClick={onClose}>
            <div style={{
                background: 'var(--bg-secondary, #1e1e2e)', borderRadius: 12,
                border: '1px solid var(--panel-border, #333)', padding: 24,
                width: 520, maxHeight: '80vh', overflow: 'auto',
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            }} onClick={e => e.stopPropagation()}>
                <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                    Import Template
                </h3>

                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    <button onClick={handleFileSelect} style={{
                        padding: '8px 16px', fontSize: 12, background: '#6366f1',
                        border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer',
                    }}>
                        Select .tsx File
                    </button>
                    {fileName && <span style={{ fontSize: 12, color: 'var(--text-secondary)', alignSelf: 'center' }}>{fileName}</span>}
                </div>

                <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                        Category
                    </label>
                    <select value={category} onChange={e => setCategory(e.target.value)} style={inputStyle}>
                        <option value="custom">Custom</option>
                        {getCategories().map(c => <option key={c} value={c}>{getCategoryLabel(c)}</option>)}
                    </select>
                </div>

                {content && (
                    <div style={{ marginBottom: 12 }}>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                            Preview ({content.length} chars)
                        </label>
                        <pre style={{
                            ...inputStyle, height: 120, overflow: 'auto', fontSize: 10,
                            fontFamily: 'monospace', whiteSpace: 'pre', margin: 0,
                        }}>
                            {content.slice(0, 2000)}
                        </pre>
                    </div>
                )}

                {status && (
                    <div style={{
                        padding: '8px 12px', marginBottom: 12, borderRadius: 6, fontSize: 12,
                        background: status.startsWith('Error') || status.startsWith('Upload failed')
                            ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                        color: status.startsWith('Error') || status.startsWith('Upload failed')
                            ? '#f87171' : '#10b981',
                    }}>
                        {status}
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button onClick={onClose} style={{
                        padding: '8px 16px', fontSize: 12, background: 'transparent',
                        border: '1px solid var(--panel-border)', borderRadius: 6,
                        color: 'var(--text-secondary)', cursor: 'pointer',
                    }}>Cancel</button>
                    <button onClick={handleUpload} disabled={!content || loading} style={{
                        padding: '8px 16px', fontSize: 12, background: loading ? '#555' : '#6366f1',
                        border: 'none', borderRadius: 6, color: '#fff',
                        cursor: loading ? 'wait' : 'pointer', opacity: !content ? 0.4 : 1,
                    }}>{loading ? 'Uploading...' : 'Upload Template'}</button>
                </div>
            </div>
        </div>
    );
};

// ─── Create Template Dialog ──────────────────────────────────────────────────

function generateTemplateCode(opts: {
    id: string; name: string; category: string; description: string;
    tags: string[]; headline: string; subline: string;
    bgColor: string; textColor: string; accentColor: string;
}): string {
    const componentName = opts.id
        .split('-')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join('');
    return `import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import { z } from 'zod';
import { registerTemplate } from '../registry';

export const ${componentName}Schema = z.object({
    headline: z.string().default('${opts.headline.replace(/'/g, "\\'")}'),
    subline: z.string().default('${opts.subline.replace(/'/g, "\\'")}'),
    backgroundColor: z.string().default('${opts.bgColor}'),
    textColor: z.string().default('${opts.textColor}'),
    accentColor: z.string().default('${opts.accentColor}'),
});

type Props = z.infer<typeof ${componentName}Schema>;

export const ${componentName}: React.FC<Props> = ({
    headline, subline, backgroundColor, textColor, accentColor,
}) => {
    const frame = useCurrentFrame();
    const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
    const slideY = interpolate(frame, [0, 20], [30, 0], { extrapolateRight: 'clamp' });

    return (
        <AbsoluteFill style={{
            background: backgroundColor,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 80,
            fontFamily: "'Inter', 'Segoe UI', sans-serif",
        }}>
            <div style={{
                opacity,
                transform: \`translateY(\${slideY}px)\`,
                textAlign: 'center',
            }}>
                <div style={{
                    width: 60, height: 4, borderRadius: 2,
                    background: accentColor, margin: '0 auto 24px',
                }} />
                <h1 style={{
                    fontSize: 64, fontWeight: 800, color: textColor,
                    lineHeight: 1.1, margin: '0 0 16px',
                    letterSpacing: -1,
                }}>
                    {headline}
                </h1>
                {subline && (
                    <p style={{
                        fontSize: 28, color: textColor,
                        opacity: 0.7, margin: 0, lineHeight: 1.4,
                    }}>
                        {subline}
                    </p>
                )}
            </div>
        </AbsoluteFill>
    );
};

registerTemplate({
    id: '${opts.id}',
    name: '${opts.name.replace(/'/g, "\\'")}',
    category: '${opts.category}',
    description: '${opts.description.replace(/'/g, "\\'")}',
    tags: [${opts.tags.map(t => `'${t}'`).join(', ')}],
    component: ${componentName},
    schema: ${componentName}Schema,
    defaultProps: ${componentName}Schema.parse({}),
    durationInFrames: 90,
    fps: 30,
});
`;
}

const CreateTemplateDialog: React.FC<{
    onClose: () => void;
    onCreated: () => void;
}> = ({ onClose, onCreated }) => {
    const [name, setName] = useState('');
    const [category, setCategory] = useState('custom');
    const [description, setDescription] = useState('');
    const [tags, setTags] = useState('');
    const [headline, setHeadline] = useState('Your Headline Here');
    const [subline, setSubline] = useState('Supporting text goes here');
    const [bgColor, setBgColor] = useState('#1a1a2e');
    const [textColor, setTextColor] = useState('#ffffff');
    const [accentColor, setAccentColor] = useState('#6366f1');
    const [status, setStatus] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [showCode, setShowCode] = useState(false);

    const templateId = useMemo(() => {
        return name.trim()
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .slice(0, 40) + '-01';
    }, [name]);

    const fileName = useMemo(() => {
        return templateId
            .split('-')
            .map(w => w.charAt(0).toUpperCase() + w.slice(1))
            .join('') + '.tsx';
    }, [templateId]);

    const code = useMemo(() => generateTemplateCode({
        id: templateId,
        name: name.trim() || 'Untitled Template',
        category,
        description: description.trim() || 'A custom template',
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        headline, subline, bgColor, textColor, accentColor,
    }), [templateId, name, category, description, tags, headline, subline, bgColor, textColor, accentColor]);

    const handleCreate = async () => {
        if (!name.trim()) { setStatus('Please enter a template name'); return; }
        setLoading(true);
        setStatus(null);
        try {
            const res = await fetch(`${BACKEND}/templates/upload`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fileName, content: code, category }),
            });
            const data = await res.json();
            if (data.ok) {
                setStatus(`Created "${name.trim()}" (${templateId}). Restart app to use in pipeline.`);
                onCreated();
            } else {
                setStatus(`Error: ${data.error}`);
            }
        } catch (e: any) {
            setStatus(`Failed: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 10001,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        }} onClick={onClose}>
            <div style={{
                background: 'var(--bg-secondary, #1e1e2e)', borderRadius: 12,
                border: '1px solid var(--panel-border, #333)', padding: 24,
                width: 600, maxHeight: '85vh', overflow: 'auto',
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            }} onClick={e => e.stopPropagation()}>
                <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                    Create New Template
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div>
                        <label style={labelStyle}>Template Name *</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)}
                            placeholder="My Custom Template" style={inputStyle} />
                    </div>
                    <div>
                        <label style={labelStyle}>Category</label>
                        <select value={category} onChange={e => setCategory(e.target.value)} style={inputStyle}>
                            <option value="custom">Custom</option>
                            {getCategories().map(c => <option key={c} value={c}>{getCategoryLabel(c)}</option>)}
                        </select>
                    </div>
                </div>

                <div style={{ marginBottom: 12 }}>
                    <label style={labelStyle}>Description</label>
                    <input type="text" value={description} onChange={e => setDescription(e.target.value)}
                        placeholder="A brief description of this template" style={inputStyle} />
                </div>

                <div style={{ marginBottom: 12 }}>
                    <label style={labelStyle}>Tags (comma-separated)</label>
                    <input type="text" value={tags} onChange={e => setTags(e.target.value)}
                        placeholder="custom, headline, marketing" style={inputStyle} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div>
                        <label style={labelStyle}>Default Headline</label>
                        <input type="text" value={headline} onChange={e => setHeadline(e.target.value)} style={inputStyle} />
                    </div>
                    <div>
                        <label style={labelStyle}>Default Subline</label>
                        <input type="text" value={subline} onChange={e => setSubline(e.target.value)} style={inputStyle} />
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                    <div>
                        <label style={labelStyle}>Background</label>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)}
                                style={{ width: 32, height: 26, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }} />
                            <input type="text" value={bgColor} onChange={e => setBgColor(e.target.value)}
                                style={{ ...inputStyle, flex: 1, fontSize: 11 }} />
                        </div>
                    </div>
                    <div>
                        <label style={labelStyle}>Text Color</label>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <input type="color" value={textColor} onChange={e => setTextColor(e.target.value)}
                                style={{ width: 32, height: 26, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }} />
                            <input type="text" value={textColor} onChange={e => setTextColor(e.target.value)}
                                style={{ ...inputStyle, flex: 1, fontSize: 11 }} />
                        </div>
                    </div>
                    <div>
                        <label style={labelStyle}>Accent</label>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <input type="color" value={accentColor} onChange={e => setAccentColor(e.target.value)}
                                style={{ width: 32, height: 26, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }} />
                            <input type="text" value={accentColor} onChange={e => setAccentColor(e.target.value)}
                                style={{ ...inputStyle, flex: 1, fontSize: 11 }} />
                        </div>
                    </div>
                </div>

                {/* Generated info */}
                <div style={{
                    padding: '8px 12px', marginBottom: 12, borderRadius: 6,
                    background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)',
                    fontSize: 11, color: 'var(--text-secondary)',
                }}>
                    <div><strong>ID:</strong> <code>{templateId}</code></div>
                    <div><strong>File:</strong> <code>src/templates/{category}/{fileName}</code></div>
                    <button onClick={() => setShowCode(v => !v)} style={{
                        marginTop: 4, background: 'none', border: 'none', color: '#818cf8',
                        cursor: 'pointer', fontSize: 11, padding: 0,
                    }}>{showCode ? 'Hide' : 'Show'} generated code</button>
                </div>

                {showCode && (
                    <pre style={{
                        ...inputStyle, height: 200, overflow: 'auto', fontSize: 10,
                        fontFamily: 'monospace', whiteSpace: 'pre', marginBottom: 12,
                        lineHeight: 1.5,
                    }}>{code}</pre>
                )}

                {status && (
                    <div style={{
                        padding: '8px 12px', marginBottom: 12, borderRadius: 6, fontSize: 12,
                        background: status.startsWith('Error') || status.startsWith('Failed') || status.startsWith('Please')
                            ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                        color: status.startsWith('Error') || status.startsWith('Failed') || status.startsWith('Please')
                            ? '#f87171' : '#10b981',
                    }}>{status}</div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button onClick={onClose} style={{
                        padding: '8px 16px', fontSize: 12, background: 'transparent',
                        border: '1px solid var(--panel-border)', borderRadius: 6,
                        color: 'var(--text-secondary)', cursor: 'pointer',
                    }}>Cancel</button>
                    <button onClick={handleCreate} disabled={!name.trim() || loading} style={{
                        padding: '8px 16px', fontSize: 12,
                        background: !name.trim() || loading ? '#555' : '#6366f1',
                        border: 'none', borderRadius: 6, color: '#fff',
                        cursor: !name.trim() || loading ? 'default' : 'pointer',
                        opacity: !name.trim() ? 0.4 : 1, fontWeight: 600,
                    }}>{loading ? 'Creating...' : 'Create Template'}</button>
                </div>
            </div>
        </div>
    );
};

const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 10, fontWeight: 600,
    color: 'var(--text-muted)', marginBottom: 3, letterSpacing: 0.3,
};

// ─── Delete Confirmation Dialog ──────────────────────────────────────────────

const DeleteDialog: React.FC<{
    template: TemplateMetadata;
    onConfirm: () => void;
    onCancel: () => void;
}> = ({ template, onConfirm, onCancel }) => (
    <div style={{
        position: 'fixed', inset: 0, zIndex: 10001,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)',
    }} onClick={onCancel}>
        <div style={{
            background: 'var(--bg-secondary, #1e1e2e)', borderRadius: 12,
            border: '1px solid var(--panel-border)', padding: 24, width: 400,
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: '#f87171' }}>
                Delete Template
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Are you sure you want to delete <strong style={{ color: 'var(--text-primary)' }}>{template.name}</strong>
                {' '}(<code style={{ fontSize: 11 }}>{template.id}</code>)?
                This will remove the template file from the custom templates directory.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button onClick={onCancel} style={{
                    padding: '8px 16px', fontSize: 12, background: 'transparent',
                    border: '1px solid var(--panel-border)', borderRadius: 6,
                    color: 'var(--text-secondary)', cursor: 'pointer',
                }}>Cancel</button>
                <button onClick={onConfirm} style={{
                    padding: '8px 16px', fontSize: 12, background: '#ef4444',
                    border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer',
                }}>Delete Template</button>
            </div>
        </div>
    </div>
);

// ─── Main Template Editor ────────────────────────────────────────────────────

interface TemplateEditorProps {
    onClose: () => void;
}

export const TemplateEditor: React.FC<TemplateEditorProps> = ({ onClose }) => {
    const allTemplates = useMemo(() => getTemplateRegistry(), []);
    const categories = useMemo(() => getCategories(), []);

    const [selectedId, setSelectedId] = useState<string>(allTemplates[0]?.id || '');
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState<TemplateCategory | 'all'>('all');
    const [editedProps, setEditedProps] = useState<Record<string, unknown>>({});
    const [showImport, setShowImport] = useState(false);
    const [showCreate, setShowCreate] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<TemplateMetadata | null>(null);
    const [deleteStatus, setDeleteStatus] = useState<string | null>(null);

    // Selected template
    const selectedTemplate = useMemo(
        () => allTemplates.find(t => t.id === selectedId),
        [allTemplates, selectedId]
    );

    // Filtered template list
    const filteredTemplates = useMemo(() => {
        let list = allTemplates;
        if (filterCategory !== 'all') {
            list = list.filter(t => t.category === filterCategory);
        }
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter(t =>
                t.name.toLowerCase().includes(q) ||
                t.id.toLowerCase().includes(q) ||
                t.tags.some(tag => tag.toLowerCase().includes(q)) ||
                t.description.toLowerCase().includes(q)
            );
        }
        return list;
    }, [allTemplates, filterCategory, searchQuery]);

    // Category counts
    const categoryCounts = useMemo(() => {
        const counts: Record<string, number> = { all: allTemplates.length };
        for (const t of allTemplates) {
            counts[t.category] = (counts[t.category] || 0) + 1;
        }
        return counts;
    }, [allTemplates]);

    // Schema fields for selected template
    const fields = useMemo(
        () => selectedTemplate ? introspectSchema(selectedTemplate.schema, selectedTemplate.defaultProps as Record<string, unknown>) : [],
        [selectedTemplate]
    );

    // Current preview props = defaults merged with edits
    const currentProps = useMemo(() => {
        if (!selectedTemplate) return {};
        return { ...(selectedTemplate.defaultProps as Record<string, unknown>), ...editedProps };
    }, [selectedTemplate, editedProps]);

    // Reset props when selecting a new template
    useEffect(() => {
        setEditedProps({});
    }, [selectedId]);

    const handlePropChange = useCallback((key: string, value: unknown) => {
        setEditedProps(prev => ({ ...prev, [key]: value }));
    }, []);

    const handleReset = useCallback(() => {
        setEditedProps({});
    }, []);

    const handleSelect = useCallback((id: string) => {
        setSelectedId(id);
    }, []);

    const handleDelete = async () => {
        if (!deleteTarget) return;
        try {
            const res = await fetch(`${BACKEND}/templates/${deleteTarget.id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.ok && data.deleted) {
                setDeleteStatus(`Deleted ${deleteTarget.name}. Restart app to apply.`);
            } else {
                setDeleteStatus('Only custom templates can be deleted.');
            }
        } catch (e: any) {
            setDeleteStatus(`Delete failed: ${e.message}`);
        }
        setDeleteTarget(null);
    };

    // Keyboard: Escape to close
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (showImport) setShowImport(false);
                else if (showCreate) setShowCreate(false);
                else if (deleteTarget) setDeleteTarget(null);
                else onClose();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose, showImport, showCreate, deleteTarget]);

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            display: 'flex', flexDirection: 'column',
            background: 'var(--bg-primary, #0f0f1a)',
            color: 'var(--text-primary, #e4e4e4)',
        }}>
            {/* ── Top Bar ─────────────────────────────────────────── */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 20px',
                borderBottom: '1px solid var(--panel-border, #333)',
                background: 'var(--bg-secondary, #1a1a2e)',
                flexShrink: 0,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Template Editor</h2>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'rgba(99,102,241,0.15)', padding: '2px 8px', borderRadius: 4 }}>
                        {allTemplates.length} templates
                    </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button onClick={() => setShowCreate(true)} style={toolbarBtnStyle('#10b981')}>
                        + Create New
                    </button>
                    <button onClick={() => setShowImport(true)} style={toolbarBtnStyle('#6366f1')}>
                        Import .tsx
                    </button>
                    {selectedTemplate && (
                        <button onClick={() => setDeleteTarget(selectedTemplate)} style={toolbarBtnStyle('#ef4444')}>
                            Delete
                        </button>
                    )}
                    <button onClick={onClose} style={{
                        padding: '6px 14px', fontSize: 12, background: 'transparent',
                        border: '1px solid var(--panel-border)', borderRadius: 6,
                        color: 'var(--text-secondary)', cursor: 'pointer',
                    }}>
                        ✕ Close
                    </button>
                </div>
            </div>

            {/* Status banner */}
            {deleteStatus && (
                <div style={{
                    padding: '8px 20px', fontSize: 12,
                    background: deleteStatus.includes('failed') || deleteStatus.includes('Only') ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                    color: deleteStatus.includes('failed') || deleteStatus.includes('Only') ? '#f87171' : '#10b981',
                    borderBottom: '1px solid var(--panel-border)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                    <span>{deleteStatus}</span>
                    <button onClick={() => setDeleteStatus(null)} style={{
                        background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 14,
                    }}>✕</button>
                </div>
            )}

            {/* ── Main Content: 3-panel layout ─────────────────── */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

                {/* ── LEFT: Template List ──────────────────────── */}
                <div style={{
                    width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column',
                    borderRight: '1px solid var(--panel-border, #333)',
                    background: 'var(--bg-secondary, #1a1a2e)',
                }}>
                    {/* Search */}
                    <div style={{ padding: '10px 10px 6px' }}>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search templates..."
                            style={{ ...inputStyle, fontSize: 12, padding: '7px 10px' }}
                        />
                    </div>

                    {/* Category filter */}
                    <div style={{ padding: '4px 10px 8px', display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                        <button
                            onClick={() => setFilterCategory('all')}
                            style={catBtnStyle(filterCategory === 'all')}
                        >
                            All ({categoryCounts.all || 0})
                        </button>
                        {categories.filter(c => categoryCounts[c]).map(cat => (
                            <button
                                key={cat}
                                onClick={() => setFilterCategory(cat)}
                                style={catBtnStyle(filterCategory === cat)}
                            >
                                {getCategoryLabel(cat).split(' ')[0]} ({categoryCounts[cat]})
                            </button>
                        ))}
                    </div>

                    {/* Template list */}
                    <div style={{ flex: 1, overflow: 'auto', padding: '0 6px 10px' }}>
                        {filteredTemplates.length === 0 ? (
                            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                                No templates found
                            </div>
                        ) : (
                            filteredTemplates.map(t => (
                                <TemplateCard
                                    key={t.id}
                                    template={t}
                                    isSelected={t.id === selectedId}
                                    onClick={() => handleSelect(t.id)}
                                />
                            ))
                        )}
                    </div>
                </div>

                {/* ── CENTER: Live Preview ─────────────────────── */}
                <div style={{
                    flex: 1, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    background: '#0a0a12', padding: 20, overflow: 'auto',
                }}>
                    {selectedTemplate ? (
                        <>
                            {/* Template info header */}
                            <div style={{
                                marginBottom: 12, textAlign: 'center', width: '100%', maxWidth: 700,
                            }}>
                                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                                    {selectedTemplate.name}
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                                    {selectedTemplate.description}
                                </div>
                                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, display: 'flex', justifyContent: 'center', gap: 12 }}>
                                    <span>ID: <code style={{ background: 'rgba(0,0,0,0.3)', padding: '1px 4px', borderRadius: 2 }}>{selectedTemplate.id}</code></span>
                                    <span>Category: {getCategoryLabel(selectedTemplate.category)}</span>
                                    <span>Duration: {selectedTemplate.durationInFrames / selectedTemplate.fps}s</span>
                                    <span>FPS: {selectedTemplate.fps}</span>
                                </div>
                            </div>

                            {/* Remotion Player */}
                            <div style={{
                                width: '100%', maxWidth: 700,
                                borderRadius: 8, overflow: 'hidden',
                                border: '1px solid var(--panel-border, #333)',
                                boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                            }}>
                                <Player
                                    key={selectedId}
                                    component={selectedTemplate.component as React.ComponentType<any>}
                                    inputProps={currentProps}
                                    durationInFrames={selectedTemplate.durationInFrames}
                                    compositionWidth={1920}
                                    compositionHeight={1080}
                                    fps={selectedTemplate.fps}
                                    style={{
                                        width: '100%',
                                        height: 'auto',
                                        aspectRatio: '16/9',
                                    }}
                                    controls
                                    loop
                                    autoPlay
                                    errorFallback={({ error }) => (
                                        <div style={{ color: '#f87171', padding: 20, background: '#111', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <div style={{ textAlign: 'center' }}>
                                                <div style={{ fontWeight: 700, marginBottom: 8 }}>Render Error</div>
                                                <div style={{ fontSize: 12, color: '#888' }}>{error.message}</div>
                                            </div>
                                        </div>
                                    )}
                                />
                            </div>

                            {/* Tags */}
                            {selectedTemplate.tags.length > 0 && (
                                <div style={{
                                    marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 4,
                                    justifyContent: 'center', maxWidth: 700,
                                }}>
                                    {selectedTemplate.tags.map(tag => (
                                        <span key={tag} style={{
                                            fontSize: 10, padding: '2px 8px', borderRadius: 10,
                                            background: 'rgba(99,102,241,0.1)', color: '#818cf8',
                                            border: '1px solid rgba(99,102,241,0.15)',
                                        }}>{tag}</span>
                                    ))}
                                </div>
                            )}
                        </>
                    ) : (
                        <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                            Select a template from the list
                        </div>
                    )}
                </div>

                {/* ── RIGHT: Props Editor ──────────────────────── */}
                <div style={{
                    width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column',
                    borderLeft: '1px solid var(--panel-border, #333)',
                    background: 'var(--bg-secondary, #1a1a2e)',
                }}>
                    <div style={{
                        padding: '10px 12px', borderBottom: '1px solid var(--panel-border)',
                        fontSize: 12, fontWeight: 700,
                    }}>
                        Template Properties
                    </div>
                    <div style={{ flex: 1, overflow: 'auto', padding: '10px 12px' }}>
                        {selectedTemplate && fields.length > 0 ? (
                            <PropsEditor
                                fields={fields}
                                values={currentProps}
                                onChange={handlePropChange}
                                onReset={handleReset}
                            />
                        ) : selectedTemplate ? (
                            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                                No editable properties found
                            </div>
                        ) : (
                            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                                Select a template to edit its properties
                            </div>
                        )}
                    </div>

                    {/* Quick info panel at bottom */}
                    {selectedTemplate && (
                        <div style={{
                            padding: '10px 12px', borderTop: '1px solid var(--panel-border)',
                            fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.5,
                        }}>
                            <div style={{ fontWeight: 700, marginBottom: 4 }}>Pipeline Integration</div>
                            <div>• AI selects templates by <code>id</code> and <code>tags</code></div>
                            <div>• Props <code>headline</code> & <code>subline</code> are set by AI</div>
                            <div>• Other props use <code>defaultProps</code> values</div>
                            <div>• Changes here are preview-only (not saved)</div>
                        </div>
                    )}
                </div>
            </div>

            {/* Dialogs */}
            {showImport && (
                <ImportDialog
                    onClose={() => setShowImport(false)}
                    onImported={() => {}}
                />
            )}
            {showCreate && (
                <CreateTemplateDialog
                    onClose={() => setShowCreate(false)}
                    onCreated={() => {}}
                />
            )}
            {deleteTarget && (
                <DeleteDialog
                    template={deleteTarget}
                    onConfirm={handleDelete}
                    onCancel={() => setDeleteTarget(null)}
                />
            )}
        </div>
    );
};

// ─── Style helpers ───────────────────────────────────────────────────────────

function toolbarBtnStyle(bg: string): React.CSSProperties {
    return {
        padding: '6px 14px', fontSize: 12, background: bg,
        border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer',
        fontWeight: 600,
    };
}

function catBtnStyle(active: boolean): React.CSSProperties {
    return {
        padding: '2px 7px', fontSize: 9, borderRadius: 4, cursor: 'pointer',
        background: active ? '#6366f1' : 'rgba(255,255,255,0.05)',
        color: active ? '#fff' : 'var(--text-muted)',
        border: active ? '1px solid #6366f1' : '1px solid transparent',
        fontWeight: active ? 600 : 400,
        transition: 'all 0.15s',
    };
}
