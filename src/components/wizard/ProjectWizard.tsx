import React, { useState } from 'react';
import { useEditor } from '../../context/EditorContext';

interface ProjectWizardProps {
    onClose: () => void;
}

export const ProjectWizard: React.FC<ProjectWizardProps> = ({ onClose }) => {
    const { createProject } = useEditor();
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        name: 'My New Project',
        projectDir: '',
        aspectRatio: '16:9',
        fps: 30,
        resolution: '1080p',
        language: 'en',
        aiMode: 'hybrid',
        transcriptionModel: 'whisper-base.en',
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleNext = () => setStep(prev => prev + 1);
    const handleBack = () => setStep(prev => prev - 1);

    const handleSubmit = async () => {
        await createProject(formData.name, Number(formData.fps), {
            aspectRatio: formData.aspectRatio,
            resolution: formData.resolution,
            language: formData.language,
            aiMode: formData.aiMode,
            transcriptionModel: formData.transcriptionModel,
            projectDir: formData.projectDir || undefined,
        });
        onClose();
    };

    const handleBrowseFolder = async () => {
        try {
            // Try Tauri dialog first
            const { open } = await import('@tauri-apps/plugin-dialog');
            const selected = await open({ directory: true, title: 'Choose Project Folder' });
            if (selected) {
                setFormData(prev => ({ ...prev, projectDir: selected as string }));
            }
        } catch {
            // Fallback: let user type a path
            const userPath = prompt('Enter the full path for the project folder:', formData.projectDir || '');
            if (userPath) {
                setFormData(prev => ({ ...prev, projectDir: userPath }));
            }
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content wizard-modal">
                <div className="wizard-header">
                    <h2>Create New Project</h2>
                    <div className="step-indicator">Step {step} of 4</div>
                </div>

                <div className="wizard-body">
                    {step === 1 && (
                        <div className="wizard-step">
                            <h3>Project Details</h3>
                            <div className="form-group">
                                <label>Project Name</label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    autoFocus
                                />
                            </div>
                            <div className="form-group">
                                <label>Project Folder</label>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <input
                                        type="text"
                                        name="projectDir"
                                        value={formData.projectDir}
                                        onChange={handleChange}
                                        placeholder="Leave blank for default location"
                                        style={{ flex: 1 }}
                                    />
                                    <button
                                        type="button"
                                        className="btn-secondary btn-sm"
                                        onClick={handleBrowseFolder}
                                    >Browse</button>
                                </div>
                                <small style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                                    All assets, renders & temp files will live here
                                </small>
                            </div>
                            <div className="form-group">
                                <label>Aspect Ratio</label>
                                <select name="aspectRatio" value={formData.aspectRatio} onChange={handleChange}>
                                    <option value="16:9">16:9 (Landscape)</option>
                                    <option value="9:16">9:16 (Vertical)</option>
                                    <option value="1:1">1:1 (Square)</option>
                                </select>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="wizard-step">
                            <h3>Technical Settings</h3>
                            <div className="form-group">
                                <label>Resolution</label>
                                <select name="resolution" value={formData.resolution} onChange={handleChange}>
                                    <option value="1080p">1080p (HD)</option>
                                    <option value="4K">4K (UHD)</option>
                                    <option value="720p">720p (HD)</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Frame Rate (FPS)</label>
                                <select name="fps" value={formData.fps} onChange={handleChange}>
                                    <option value="24">24 fps (Cinematic)</option>
                                    <option value="30">30 fps (Standard)</option>
                                    <option value="60">60 fps (Smooth)</option>
                                </select>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="wizard-step">
                            <h3>AI Processing Options</h3>
                            <div className="form-group">
                                <label>Processing Mode</label>
                                <select name="aiMode" value={formData.aiMode} onChange={handleChange}>
                                    <option value="local">Local Only (Privacy)</option>
                                    <option value="api">Cloud API (Speed)</option>
                                    <option value="hybrid">Hybrid (Balanced)</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Primary Language</label>
                                <select name="language" value={formData.language} onChange={handleChange}>
                                    <option value="en">English</option>
                                    <option value="hi">Hindi</option>
                                    <option value="es">Spanish</option>
                                    <option value="fr">French</option>
                                    <option value="de">German</option>
                                </select>
                            </div>
                        </div>
                    )}

                    {step === 4 && (
                        <div className="wizard-step">
                            <h3>Model Selection</h3>
                            <div className="form-group">
                                <label>Transcription Model</label>
                                <select name="transcriptionModel" value={formData.transcriptionModel} onChange={handleChange}>
                                    <option value="whisper-tiny.en">Whisper Tiny (English Only)</option>
                                    <option value="whisper-base.en">Whisper Base (English Only)</option>
                                    <option value="whisper-base">Whisper Base (Multilingual)</option>
                                    <option value="whisper-small">Whisper Small (Multilingual)</option>
                                    <option value="whisper-medium">Whisper Medium (High Accuracy)</option>
                                    <option value="sarvam">Sarvam AI (Best for Hindi)</option>
                                </select>
                            </div>
                            <p className="info-text">
                                <span className="icon">ⓘ</span>
                                Selected model will be downloaded if not available locally.
                            </p>
                        </div>
                    )}
                </div>

                <div className="wizard-footer">
                    {step > 1 && (
                        <button className="btn-secondary" onClick={handleBack}>Back</button>
                    )}
                    <div className="spacer"></div>
                    {step < 4 ? (
                        <button className="btn-primary" onClick={handleNext}>Next</button>
                    ) : (
                        <button className="btn-primary" onClick={handleSubmit}>Create Project</button>
                    )}
                    <button className="btn-text" onClick={onClose}>Cancel</button>
                </div>
            </div>
        </div>
    );
};
