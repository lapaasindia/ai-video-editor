import React, { useState } from 'react';
import { useEditor } from '../../context/EditorContext';

interface ProjectSettingsModalProps {
    onClose: () => void;
}

export const ProjectSettingsModal: React.FC<ProjectSettingsModalProps> = ({ onClose }) => {
    const { currentProject, updateProject } = useEditor();
    const [name, setName] = useState(currentProject?.name || '');
    const [resolution, setResolution] = useState(currentProject?.resolution || '1080p');
    const [fps, setFps] = useState(currentProject?.fps || 30);
    const [aiMode, setAiMode] = useState(currentProject?.aiMode || 'hybrid');
    const [language, setLanguage] = useState(currentProject?.language || 'en');
    const [loading, setLoading] = useState(false);

    const handleSave = async () => {
        if (!currentProject) return;
        setLoading(true);
        try {
            await updateProject(currentProject.id, {
                name,
                settings: {
                    resolution,
                    fps,
                    aiMode,
                    language
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

    return (
        <div className="modal-overlay">
            <div className="modal-content wizard-modal" style={{ width: '500px' }}>
                <div className="wizard-header">
                    <h2>Project Settings</h2>
                </div>

                <div className="wizard-body">
                    <div className="form-group" style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', marginBottom: 8, fontSize: 13, color: 'var(--text-secondary)' }}>Project Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--panel-border)', borderRadius: 4, color: 'var(--text-primary)' }}
                        />
                    </div>

                    <div className="form-group" style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', marginBottom: 8, fontSize: 13, color: 'var(--text-secondary)' }}>Resolution</label>
                        <select
                            value={resolution}
                            onChange={e => setResolution(e.target.value)}
                            style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--panel-border)', borderRadius: 4, color: 'var(--text-primary)' }}
                        >
                            <option value="1080p">1080p (1920x1080)</option>
                            <option value="4K">4K (3840x2160)</option>
                            <option value="720p">720p (1280x720)</option>
                        </select>
                    </div>

                    <div className="form-group" style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', marginBottom: 8, fontSize: 13, color: 'var(--text-secondary)' }}>Frame Rate</label>
                        <select
                            value={fps}
                            onChange={e => setFps(Number(e.target.value))}
                            style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--panel-border)', borderRadius: 4, color: 'var(--text-primary)' }}
                        >
                            <option value={24}>24 fps</option>
                            <option value={25}>25 fps</option>
                            <option value={30}>30 fps</option>
                            <option value={60}>60 fps</option>
                        </select>
                    </div>

                    <div className="form-group" style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', marginBottom: 8, fontSize: 13, color: 'var(--text-secondary)' }}>AI Mode</label>
                        <select
                            value={aiMode}
                            onChange={e => setAiMode(e.target.value)}
                            style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--panel-border)', borderRadius: 4, color: 'var(--text-primary)' }}
                        >
                            <option value="fast">Fast (Lower Quality)</option>
                            <option value="hybrid">Balanced</option>
                            <option value="quality">High Quality (Slower)</option>
                        </select>
                    </div>

                    <div className="form-group" style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', marginBottom: 8, fontSize: 13, color: 'var(--text-secondary)' }}>Language</label>
                        <select
                            value={language}
                            onChange={e => setLanguage(e.target.value)}
                            style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--panel-border)', borderRadius: 4, color: 'var(--text-primary)' }}
                        >
                            <option value="en">English</option>
                            <option value="es">Spanish</option>
                            <option value="fr">French</option>
                            <option value="de">German</option>
                            <option value="it">Italian</option>
                            <option value="pt">Portuguese</option>
                            <option value="hi">Hindi</option>
                        </select>
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
