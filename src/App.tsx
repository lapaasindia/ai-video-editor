import { ProjectPanel } from './components/editor/ProjectPanel';
import { PreviewPanel } from './components/editor/PreviewPanel';
import { TimelinePanel } from './components/editor/TimelinePanel';
import { PropertiesPanel } from './components/editor/PropertiesPanel';
import { EditorProvider, useEditor } from './context/EditorContext';
import { ModelManager } from './components/settings/ModelManager';
import { useState } from 'react';
import { LogViewer } from './components/debug/LogViewer';
import './App.css';

// Side-effect imports to register all templates into the registry
import './templates/case-study/CaseStudyHero01';
import './templates/case-study/CaseStudyStats01';
import './templates/case-study/CaseStudyTimeline01';
import './templates/case-study/CaseStudyBeforeAfter01';
import './templates/case-study/CaseStudyQuote01';
import './templates/case-study/CaseStudyProblemSolution01';
import './templates/case-study/CaseStudyResults01';
import './templates/case-study/CaseStudyCompanyProfile01';
import './templates/case-study/CaseStudyProcess01';
import './templates/case-study/CaseStudyROI01';
import './templates/case-study/CaseStudyTestimonialGrid01';
import './templates/business-news/BizNewsBreaking01';
import './templates/business-news/BizNewsMarketUpdate01';
import './templates/business-news/BizNewsEarnings01';
import './templates/business-news/BizNewsMerger01';
import './templates/business-news/BizNewsIPO01';
import './templates/business-news/BizNewsPolicy01';
import './templates/tech-news/TechNewsLaunch01';
import './templates/tech-news/TechNewsFunding01';
import './templates/tech-news/TechNewsAIUpdate01';
import './templates/tech-news/TechNewsOpenSource01';
import './templates/tech-news/TechNewsSecurity01';
import './templates/data-visualization/DataVizBarChart01';
import './templates/data-visualization/DataVizDonut01';
import './templates/data-visualization/DataVizCounter01';
import './templates/text-animation/TextAnimGradient01';
import './templates/text-animation/TextAnimTypewriter01';
import './templates/logo-reveal/LogoRevealMinimal01';
import './templates/logo-reveal/LogoRevealGlitch01';
import './templates/social-media-promo/SocialPromo01';
import './templates/social-media-promo/SocialPromoEvent01';
import './templates/listicle-ranking/ListicleRanking01';
import './templates/lower-thirds/LowerThirds01';
import './templates/lower-thirds/LowerThirdsTopic01';
import './templates/startup-showcase/StartupVision01';
import './templates/startup-showcase/BoldPitch01';
import './templates/startup-showcase/ProductLaunch01';
import './templates/startup-showcase/TechInnovation01';
import './templates/startup-showcase/CreativeStory01';
import './templates/startup-showcase/DataInsights01';
import './templates/startup-showcase/FounderJourney01';
import './templates/startup-showcase/LifestyleBrand01';
import './templates/startup-showcase/CompanyHistory01';
import './templates/startup-showcase/AppDemo01';
import './templates/social-hooks/CutoutHook01';
import './templates/social-hooks/HeadlineCard01';
import './templates/social-hooks/LightLeakSmash01';
import './templates/social-hooks/ZoomReveal01';
import './templates/social-hooks/CollagePiP01';
import './templates/social-hooks/CensorStickers01';
import './templates/social-hooks/MoneyRain01';
import './templates/social-hooks/ArticleHighlight01';
import './templates/social-hooks/PhoneCameo01';
import './templates/social-hooks/BilingualOutro01';
import './templates/social-hooks/ProofTiles01';
import './templates/social-hooks/SplitCompare01';
import './templates/social-hooks/StampVerdict01';
import './templates/social-hooks/TimelineSteps01';
import './templates/social-hooks/AutoWhoosh01';

const EditorLayout = () => {
    const { currentProject, backendAvailable, saveProject, renderVideo, closeProject } = useEditor();
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
                        <span className="app-name">Lapaas AI Editor</span>
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
                    <button
                        className="action-button secondary"
                        onClick={() => saveProject && saveProject()}
                        title="Save Project (Cmd+S)"
                        style={{ marginRight: 10 }}
                    >
                        Save
                    </button>
                    {currentProject && (
                        <button
                            className="action-button secondary"
                            onClick={() => closeProject && closeProject()}
                            title="Close current project"
                            style={{ marginRight: 10 }}
                        >
                            Close
                        </button>
                    )}
                    <div
                        title={backendAvailable ? 'Backend server connected' : 'Backend server not running – start it with: npm run desktop:backend'}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                            fontSize: 11,
                            color: backendAvailable ? '#2ecc71' : '#e74c3c',
                            marginRight: 8,
                            cursor: 'default',
                        }}
                    >
                        <span style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: backendAvailable ? '#2ecc71' : '#e74c3c',
                            display: 'inline-block',
                        }} />
                        {backendAvailable ? 'Backend' : 'No Backend'}
                    </div>
                    <button className="action-button primary" onClick={() => renderVideo && renderVideo()}>Export</button>
                </div>
            </header>

            <div className="workspace">
                <ProjectPanel />
                <div className="center-area">
                    <PreviewPanel />
                    <TimelinePanel />
                </div>
                <PropertiesPanel />
            </div>

            {showSettings && <ModelManager onClose={() => setShowSettings(false)} />}
        </div>
    );
};

import { ErrorBoundary } from './components/common/ErrorBoundary';

function App() {
    return (
        <ErrorBoundary>
            <EditorProvider>
                <div className="app-container">
                    <EditorLayout />
                    <LogViewer />
                </div>
            </EditorProvider>
        </ErrorBoundary>
    );
}

export default App;
