import React, { useState } from 'react';
import { useEditor } from '../../context/EditorContext';
import { ProjectWizard } from '../wizard/ProjectWizard';

export const ProjectPanel: React.FC = () => {
    const [activeTab, setActiveTab] = useState('project');
    const [showWizard, setShowWizard] = useState(false);
    const { currentProject, media, importMedia } = useEditor();

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
                                <input type="text" placeholder="Search templates..." />
                            </div>
                            <div className="template-grid">
                                {/* Templates list will go here */}
                            </div>
                        </div>
                    )}
                </div>
            </aside>

            {showWizard && <ProjectWizard onClose={() => setShowWizard(false)} />}
        </>
    );
};
