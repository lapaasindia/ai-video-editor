import { ProjectPanel } from './components/editor/ProjectPanel';
import { PreviewPanel } from './components/editor/PreviewPanel';
import { TimelinePanel } from './components/editor/TimelinePanel';
import { PropertiesPanel } from './components/editor/PropertiesPanel';
import { EditorProvider, useEditor } from './context/EditorContext';
import { ModelManager } from './components/settings/ModelManager';
import { useState } from 'react';
import { LogViewer } from './components/debug/LogViewer';
import './App.css';

const EditorLayout = () => {
    const { importMedia, currentProject } = useEditor();
    const [showSettings, setShowSettings] = useState(false);

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (!currentProject) return;

        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            const file = files[0];
            // @ts-ignore
            const path = file.path || file.name;

            // In browser, this might trigger upload if we enhance importMedia
            // For now, let's just log it
            console.log('Dropped file', path);

            if (currentProject) {
                // attempt import if we have a path (Tauri) or file object (Browser)
                // importMedia handles both if we pass the right thing?
                // importMedia expects string path. 
                // We need to handle file upload for browser drop here if we want drag-drop to work in browser.
                // For now, let's skip complex drag-drop for browser and rely on the button.
            }
        }
    };

    return (
        <div
            className="editor-app"
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={handleDrop}
        >
            <header className="menu-bar">
                <div className="menu-bar-left">
                    <div className="app-logo">
                        <span className="app-name">Lapaas Frame</span>
                    </div>
                    <nav className="app-menu">
                        <button className="menu-item active">Edit</button>
                        <button className="menu-item">View</button>
                        <button className="menu-item" onClick={() => setShowSettings(true)}>Settings</button>
                        <button className="menu-item">Help</button>
                    </nav>
                </div>
                <div className="menu-bar-center">
                    <span className="project-title">{currentProject?.name || 'Untitled Project'}</span>
                </div>
                <div className="menu-bar-right">
                    <button className="action-button primary">Export</button>
                </div>
            </header>

            <div className="main-content">
                <ProjectPanel />
                <div className="center-panel">
                    <PreviewPanel />
                    <TimelinePanel />
                </div>
                <PropertiesPanel />
            </div>

            {showSettings && <ModelManager onClose={() => setShowSettings(false)} />}
        </div>
    );
};

function App() {
    return (
        <EditorProvider>
            <div className="app-container">
                <EditorLayout />
                <LogViewer />
            </div>
        </EditorProvider>
    );
}

export default App;
