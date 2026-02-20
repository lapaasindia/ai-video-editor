import React, { useState, useMemo, useEffect } from 'react';
import { useEditor } from '../../context/EditorContext';
import { ProjectWizard } from '../wizard/ProjectWizard';
import { ProjectSettingsModal } from '../modals/ProjectSettingsModal';
import { getTemplateRegistry, getCategoryLabel, TEMPLATE_CATEGORIES, TemplateMetadata } from '../../templates/registry';
import { TemplatePreviewModal } from '../modals/TemplatePreviewModal';

export const ProjectPanel: React.FC = () => {
    const [activeTab, setActiveTab] = useState('project');
    const [showWizard, setShowWizard] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [projectsList, setProjectsList] = useState<any[]>([]);
    const [templateSearch, setTemplateSearch] = useState('');
    const [activeCategory, setActiveCategory] = useState<string>('all');
    const [selectedTemplate, setSelectedTemplate] = useState<TemplateMetadata | null>(null);
    const { currentProject, media, importMedia, backendAvailable, loadProject, pipelineStage, addTemplateClip, addTrack, currentTime, tracks } = useEditor();

    const allTemplates = useMemo(() => getTemplateRegistry(), []);
    const filteredTemplates = useMemo(() => {
        return allTemplates.filter(t => {
            const matchesSearch = templateSearch === '' ||
                t.name.toLowerCase().includes(templateSearch.toLowerCase()) ||
                t.description.toLowerCase().includes(templateSearch.toLowerCase());
            const matchesCategory = activeCategory === 'all' || t.category === activeCategory;
            return matchesSearch && matchesCategory;
        });
    }, [allTemplates, templateSearch, activeCategory]);

    useEffect(() => {
        if (backendAvailable && !currentProject) {
            fetch('http://127.0.0.1:43123/projects')
                .then(res => res.json())
                .then(data => {
                    if (data.projects) {
                        setProjectsList(data.projects.sort((a: any, b: any) =>
                            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
                        ));
                    }
                })
                .catch(err => console.error('Failed to fetch projects', err));
        }
    }, [backendAvailable, currentProject]);

    const handleLoad = async (id: string) => {
        if (loadProject) {
            await loadProject(id);
        }
    };

    const handleAddTemplate = () => {
        if (!selectedTemplate || !currentProject) return;

        const duration = selectedTemplate.durationInFrames / selectedTemplate.fps;
        let targetTrackId = '';

        // Try to find a video/overlay track with no overlap at currentTime
        for (const track of tracks) {
            if (track.type !== 'video' && track.type !== 'overlay') continue;

            const hasOverlap = track.clips.some(clip => {
                const clipEnd = clip.start + clip.duration;
                const newEnd = currentTime + duration;
                return (currentTime < clipEnd && newEnd > clip.start);
            });

            if (!hasOverlap) {
                targetTrackId = track.id;
                break;
            }
        }

        // If no suitable track found, create a new one
        if (!targetTrackId) {
            const newId = `track-video-${Date.now()}`;
            addTrack('video', newId);
            targetTrackId = newId;
        }

        addTemplateClip(selectedTemplate.id, targetTrackId, currentTime);
    };

    return (
        <>
            <div className="panel panel-left project-panel" id="project-panel">
                <div className="panel-header">
                    <h3>Project</h3>
                    <div className="panel-tabs">
                        <button
                            className={`tab-btn ${activeTab === 'project' ? 'active' : ''}`}
                            onClick={() => setActiveTab('project')}
                        >
                            Project
                        </button>
                        <button
                            className={`tab-btn ${activeTab === 'templates' ? 'active' : ''}`}
                            onClick={() => setActiveTab('templates')}
                        >
                            Templates
                        </button>
                    </div>
                </div>

                <div className="panel-content">
                    {activeTab === 'project' && (
                        <div style={{ padding: 'var(--spacing-md)' }}>
                            {!currentProject ? (
                                <div style={{ padding: 20, textAlign: 'center', height: '100%', overflowY: 'auto' }}>
                                    <div className="empty-state" style={{ marginBottom: 20 }}>No active project</div>
                                    <button className="btn-primary" onClick={() => setShowWizard(true)} style={{ marginBottom: 20 }}>
                                        Create New Project
                                    </button>

                                    {projectsList.length > 0 && (
                                        <div style={{ textAlign: 'left', marginTop: 20 }}>
                                            <h4 style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>Recent Projects</h4>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                {projectsList.map(p => (
                                                    <div
                                                        key={p.id}
                                                        className="project-item"
                                                        onClick={() => handleLoad(p.id)}
                                                        style={{
                                                            padding: '10px',
                                                            background: 'var(--bg-secondary)',
                                                            borderRadius: 6,
                                                            cursor: 'pointer',
                                                            border: '1px solid var(--panel-border)',
                                                            transition: 'all 0.2s',
                                                        }}
                                                    >
                                                        <div style={{ fontWeight: 500, fontSize: 13 }}>{p.name}</div>
                                                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                                            {new Date(p.updatedAt).toLocaleDateString()}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <>
                                    <div className="project-info">
                                        <div className="info-row">
                                            <span className="info-label">Name</span>
                                            <span className="info-value">{currentProject.name}</span>
                                        </div>
                                        <div className="info-row">
                                            <span className="info-label">Resolution</span>
                                            <span className="info-value">{currentProject.width}×{currentProject.height}</span>
                                        </div>
                                        <div className="info-row">
                                            <span className="info-label">Settings</span>
                                            <span className="info-value">{currentProject.fps}fps / {currentProject.aspectRatio || '16:9'}</span>
                                        </div>
                                        {(currentProject as any).projectDir && (
                                            <div className="info-row">
                                                <span className="info-label">Folder</span>
                                                <span
                                                    className="info-value"
                                                    title={(currentProject as any).projectDir}
                                                    style={{ fontSize: 10, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }}
                                                    onClick={() => {
                                                        fetch(`${(window as any).__BACKEND_URL || 'http://127.0.0.1:43123'}/open-path`, {
                                                            method: 'POST',
                                                            headers: { 'Content-Type': 'application/json' },
                                                            body: JSON.stringify({ path: (currentProject as any).projectDir })
                                                        }).catch(() => { });
                                                    }}
                                                >📂 {((currentProject as any).projectDir || '').split('/').pop()}</span>
                                            </div>
                                        )}
                                        <button
                                            className="btn-text btn-sm"
                                            style={{ marginTop: 8, width: '100%', textAlign: 'center', fontSize: 11, color: 'var(--accent-primary)' }}
                                            onClick={() => setShowSettings(true)}
                                        >
                                            Edit Settings
                                        </button>
                                    </div>
                                </>
                            )}

                            <div className="section-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <h3>Media</h3>
                                <button className="btn-secondary btn-sm" onClick={() => importMedia()} title="Import video, audio or image" disabled={!currentProject}>
                                    + Import
                                </button>
                            </div>

                            <div className="media-grid">
                                {!currentProject ? (
                                    <div className="empty-state-small">
                                        <p style={{ color: 'var(--text-muted)', fontSize: 11 }}>Create a project to import media</p>
                                    </div>
                                ) : media.length === 0 ? (
                                    <div className="empty-state-small">
                                        <p style={{ color: 'var(--text-muted)', fontSize: 11 }}>No media imported</p>
                                    </div>
                                ) : (
                                    media.map((item) => (
                                        <div
                                            key={item.id}
                                            className="media-item"
                                            draggable={item.status === 'ok'}
                                            onDragStart={(e) => {
                                                e.dataTransfer.setData('application/json', JSON.stringify({
                                                    type: 'media-item',
                                                    id: item.id,
                                                    duration: item.duration,
                                                    mediaType: item.type
                                                }));
                                                e.dataTransfer.effectAllowed = 'copy';
                                            }}
                                        >
                                            <div className="media-icon">
                                                {item.status === 'processing' ? (
                                                    <div className="spinner-small" title="Processing..."></div>
                                                ) : item.status === 'error' ? (
                                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#e74c3c" strokeWidth="2">
                                                        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                                                    </svg>
                                                ) : (
                                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                        <path d="M15 10l5 5-5 5" />
                                                        <path d="M4 4v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2H6c-1.1 0-2 .9-2 2z" />
                                                    </svg>
                                                )}
                                            </div>
                                            <span className="media-name" title={item.path} style={item.status === 'error' ? { color: '#e74c3c' } : {}}>{item.name}</span>
                                            {item.status === 'error' && <span className="media-badge" title="Import failed" style={{ background: '#e74c3c' }}>!</span>}
                                            {item.proxyPath && <span className="media-badge" title="Proxy Ready">P</span>}
                                        </div>
                                    ))
                                )}
                            </div>

                        </div>
                    )}

                    {activeTab === 'templates' && (
                        <div style={{ padding: 'var(--spacing-md)' }}>
                            <div className="search-box">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                                <input
                                    type="text"
                                    placeholder="Search templates..."
                                    value={templateSearch}
                                    onChange={e => setTemplateSearch(e.target.value)}
                                />
                            </div>
                            <div className="template-categories" style={{ marginBottom: 8 }}>
                                <button
                                    className={`category-chip ${activeCategory === 'all' ? 'active' : ''}`}
                                    onClick={() => setActiveCategory('all')}
                                >All ({allTemplates.length})</button>
                                {TEMPLATE_CATEGORIES.map(cat => {
                                    const count = allTemplates.filter(t => t.category === cat).length;
                                    if (count === 0) return null;
                                    return (
                                        <button
                                            key={cat}
                                            className={`category-chip ${activeCategory === cat ? 'active' : ''}`}
                                            onClick={() => setActiveCategory(cat)}
                                        >{getCategoryLabel(cat)} ({count})</button>
                                    );
                                })}
                            </div>
                            <div className="template-grid">
                                {filteredTemplates.length === 0 ? (
                                    <div className="empty-state-small"><p>No templates found</p></div>
                                ) : filteredTemplates.map(t => (
                                    <div
                                        key={t.id}
                                        className="template-card"
                                        title={t.description}
                                        draggable
                                        onDragStart={(e) => {
                                            e.dataTransfer.setData('application/json', JSON.stringify({
                                                type: 'template-item',
                                                id: t.id,
                                                duration: t.durationInFrames / t.fps
                                            }));
                                            e.dataTransfer.effectAllowed = 'copy';
                                        }}
                                        onClick={() => setSelectedTemplate(t)}
                                    >
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
                                            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500 }}>{getCategoryLabel(t.category)}</div>
                                        </div>
                                        <div style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap', fontFamily: "'SF Mono', monospace" }}>
                                            {Math.round(t.durationInFrames / t.fps)}s
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {showWizard && <ProjectWizard onClose={() => setShowWizard(false)} />}
            {showSettings && <ProjectSettingsModal onClose={() => setShowSettings(false)} />}
            {selectedTemplate && (
                <TemplatePreviewModal
                    template={selectedTemplate}
                    onClose={() => setSelectedTemplate(null)}
                    onAdd={handleAddTemplate}
                />
            )}
        </>
    );
};
