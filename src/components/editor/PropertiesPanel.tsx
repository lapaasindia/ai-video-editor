import React, { useState } from 'react';

export const PropertiesPanel: React.FC = () => {
    const [activeTab, setActiveTab] = useState('properties');

    return (
        <aside className="panel panel-right" id="properties-panel">
            <div className="panel-header">
                <div className="panel-tabs">
                    <button
                        className={`panel-tab ${activeTab === 'properties' ? 'active' : ''}`}
                        onClick={() => setActiveTab('properties')}
                    >
                        Properties
                    </button>
                    <button
                        className={`panel-tab ${activeTab === 'ai' ? 'active' : ''}`}
                        onClick={() => setActiveTab('ai')}
                    >
                        AI
                    </button>
                </div>
            </div>

            <div className="panel-content">
                {activeTab === 'properties' && (
                    <div className="tab-content active">
                        <div className="empty-state-small">
                            <p>Select a clip to edit properties</p>
                        </div>
                    </div>
                )}

                {activeTab === 'ai' && (
                    <div className="tab-content active">
                        <div className="ai-actions">
                            <button className="btn-primary btn-block">Start AI Editing</button>
                        </div>
                    </div>
                )}
            </div>
        </aside>
    );
};
