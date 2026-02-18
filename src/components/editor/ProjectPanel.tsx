import React, { useState, useMemo } from 'react';
import { useEditor } from '../../context/EditorContext';
import { ProjectWizard } from '../wizard/ProjectWizard';
import { getTemplateRegistry, getCategoryLabel, TEMPLATE_CATEGORIES } from '../../templates/registry';

export const ProjectPanel: React.FC = () => {
    const [activeTab, setActiveTab] = useState('project');
    const [showWizard, setShowWizard] = useState(false);
    const [templateSearch, setTemplateSearch] = useState('');
    const [activeCategory, setActiveCategory] = useState<string>('all');
    const { currentProject, media, importMedia } = useEditor();

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

    return (
        <>
            <aside className="panel panel-left" id="project-panel">
                <div className="panel-header">
                    <div className="panel-tabs">
                        <button
                            className={`panel-tab ${activeTab === 'project' ? 'active' : ''}`}
                            onClick={() => setActiveTab('project')}
                        >
                            Project
                        </button>
                        <button
                            className={`panel-tab ${activeTab === 'templates' ? 'active' : ''}`}
                            onClick={() => setActiveTab('templates')}
                        >
                            Templates
                        </button>
                    </div>
                </div>

                <div className="panel-content">
                    {activeTab === 'project' && (
                        <div className="tab-content active">
                            <div className="project-info">
                                {!currentProject ? (
                                    <div className="empty-state-small">
                                        <p>No active project</p>
                                        <button className="btn-primary btn-sm" onClick={() => setShowWizard(true)}>Create Project</button>
                                    </div>
                                ) : (
                                    <>
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
                                    </>
                                )}
                            </div>

                            <div className="section-header">
                                <h3>Media</h3>
                            </div>

                            <div className="media-grid">
                                {media.length === 0 ? (
                                    <div className="empty-state-small">
                                        <p>No media imported</p>
                                        <button className="btn-secondary btn-sm" onClick={() => importMedia()}>Import Video</button>
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
                                                    duration: item.duration
                                                }));
                                                e.dataTransfer.effectAllowed = 'copy';
                                            }}
                                        >
                                            <div className="media-icon">
                                                {item.status === 'processing' ? (
                                                    <div className="spinner-small" title="Processing..."></div>
                                                ) : (
                                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                        <path d="M15 10l5 5-5 5" />
                                                        <path d="M4 4v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2H6c-1.1 0-2 .9-2 2z" />
                                                    </svg>
                                                )}
                                            </div>
                                            <span className="media-name" title={item.path}>{item.name}</span>
                                            {item.proxyPath && <span className="media-badge" title="Proxy Ready">P</span>}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'templates' && (
                        <div className="tab-content active">
                            <div className="search-box">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
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
                                    <div key={t.id} className="template-card" title={t.description} style={{ cursor: 'pointer', padding: 8, background: 'var(--bg-secondary)', borderRadius: 6, border: '1px solid var(--panel-border)' }}>
                                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{t.name}</div>
                                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{getCategoryLabel(t.category)}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </aside>

            {showWizard && <ProjectWizard onClose={() => setShowWizard(false)} />}
        </>
    );
};
