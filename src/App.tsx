import React, { useState, useRef, useEffect } from 'react';
import { ProjectPanel } from './components/editor/ProjectPanel';
import { PreviewPanel } from './components/editor/PreviewPanel';
import { TimelinePanel } from './components/editor/TimelinePanel';
import { PropertiesPanel } from './components/editor/PropertiesPanel';
import { EditorProvider, useEditor } from './context/EditorContext';
import { ModelManager } from './components/settings/ModelManager';
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

// ── Dropdown menu component ───────────────────────────────────────────────────
interface MenuItem {
    label: string;
    shortcut?: string;
    action?: () => void;
    disabled?: boolean;
    separator?: boolean;
}

const MenuDropdown: React.FC<{ label: string; items: MenuItem[]; active?: boolean }> = ({ label, items, active }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            <button
                className={`menu-item${active || open ? ' active' : ''}`}
                onClick={() => setOpen(o => !o)}
            >
                {label}
            </button>
            {open && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: 4,
                    background: '#2a2a2a',
                    border: '1px solid #3a3a3a',
                    borderRadius: 6,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                    minWidth: 200,
                    zIndex: 1000,
                    padding: '4px 0',
                }}>
                    {items.map((item, i) =>
                        item.separator ? (
                            <div key={i} style={{ height: 1, background: '#3a3a3a', margin: '4px 0' }} />
                        ) : (
                            <button
                                key={i}
                                disabled={item.disabled}
                                onClick={() => { item.action?.(); setOpen(false); }}
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    width: '100%',
                                    padding: '7px 16px',
                                    background: 'transparent',
                                    border: 'none',
                                    color: item.disabled ? '#555' : '#e4e4e4',
                                    fontSize: 13,
                                    cursor: item.disabled ? 'default' : 'pointer',
                                    textAlign: 'left',
                                    gap: 24,
                                    transition: 'background 0.1s',
                                }}
                                onMouseEnter={e => { if (!item.disabled) (e.currentTarget as HTMLElement).style.background = '#3a3a3a'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                            >
                                <span>{item.label}</span>
                                {item.shortcut && (
                                    <span style={{ fontSize: 11, color: '#666', flexShrink: 0 }}>{item.shortcut}</span>
                                )}
                            </button>
                        )
                    )}
                </div>
            )}
        </div>
    );
};

// Business Marketing Templates
import './templates/business-marketing/DynamicSalesFunnel';
import './templates/business-marketing/CustomerJourneyPath';
import './templates/business-marketing/PricingComparisonTable';
import './templates/business-marketing/FlywheelModel';
import './templates/business-marketing/MarketingROICard';
import './templates/business-marketing/TestimonialCarousel';
import './templates/business-marketing/ClientLogoGrid';
import './templates/business-marketing/TrustMetricsTicker';
import './templates/business-marketing/SocialPostGrid';
import './templates/business-marketing/CaseStudyCards';
import './templates/business-marketing/FeatureListPopups';
import './templates/business-marketing/StepByStepProcess';
import './templates/business-marketing/UsVsThemTable';
import './templates/business-marketing/BenefitCheckmarks';
import './templates/business-marketing/TechStackOrbit';
import './templates/business-marketing/VerticalTimeline';
import './templates/business-marketing/SprintProgressBar';
import './templates/business-marketing/DynamicBarChart';
import './templates/business-marketing/MultiLinkOutro';
import './templates/business-marketing/ResourceDownloadList';
import './templates/business-marketing/TeamRosterGrid';
import './templates/business-marketing/ProductFeaturesGrid';
import './templates/business-marketing/PricingTiers';
import './templates/business-marketing/HistoryMilestones';
import './templates/business-marketing/WebinarAgenda';
import './templates/business-marketing/MarketShareBlocks';
import './templates/business-marketing/SpeakerRoster';
import './templates/business-marketing/SponsorBanner';
import './templates/business-marketing/ContactInfoCard';
import './templates/business-marketing/InteractivePoll';
import './templates/business-marketing/BeforeAfterSplit';
import './templates/business-marketing/HorizontalRoadmap';

const EditorLayout = () => {
    const {
        currentProject, backendAvailable, saveProject, renderVideo, exportFCPXML,
        closeProject, importMedia, undo, redo, canUndo, canRedo, resetPipeline,
    } = useEditor();
    const [showSettings, setShowSettings] = useState(false);
    const [showLogs, setShowLogs] = useState(false);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            const mod = e.metaKey || e.ctrlKey;
            if (mod && e.key === 's') { e.preventDefault(); saveProject?.(); }
            if (mod && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo?.(); }
            if (mod && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo?.(); }
            if (mod && e.key === 'i') { e.preventDefault(); importMedia?.(); }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [saveProject, undo, redo, importMedia]);

    const editMenuItems: MenuItem[] = [
        { label: 'Undo', shortcut: '⌘Z', action: undo, disabled: !canUndo },
        { label: 'Redo', shortcut: '⌘⇧Z', action: redo, disabled: !canRedo },
        { separator: true },
        { label: 'Import Media…', shortcut: '⌘I', action: () => importMedia?.(), disabled: !currentProject },
        { label: 'Save Project', shortcut: '⌘S', action: () => saveProject?.() },
        { separator: true },
        { label: 'Close Project', action: () => closeProject?.(), disabled: !currentProject },
        { label: 'Reset AI Pipeline', action: () => resetPipeline?.(), disabled: !currentProject },
    ];

    const viewMenuItems: MenuItem[] = [
        { label: 'Settings', shortcut: '⌘,', action: () => setShowSettings(true) },
        { separator: true },
        { label: 'Output Logs', action: () => setShowLogs(v => !v) },
        { separator: true },
        { label: 'Export XML (FCPXML)', action: () => exportFCPXML?.(), disabled: !currentProject },
        { label: 'Export Video', shortcut: '⌘E', action: () => renderVideo?.(), disabled: !currentProject },
    ];

    const helpMenuItems: MenuItem[] = [
        { label: 'About Lapaas AI Editor', action: () => alert('Lapaas AI Editor\nBuilt with Tauri + React + Remotion') },
        { separator: true },
        { label: 'View on GitHub', action: () => window.open('https://github.com/lapaasindia/ai-video-editor', '_blank') },
        { label: 'Report a Bug', action: () => window.open('https://github.com/lapaasindia/ai-video-editor/issues', '_blank') },
    ];

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!currentProject) return;
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) console.log('Dropped file', (files[0] as any).path || files[0].name);
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
                    <nav className="app-menu" style={{ display: 'flex', alignItems: 'center' }}>
                        <MenuDropdown label="Edit" items={editMenuItems} active />
                        <MenuDropdown label="View" items={viewMenuItems} />
                        <button className="menu-item" onClick={() => setShowSettings(true)}>Settings</button>
                        <MenuDropdown label="Help" items={helpMenuItems} />
                    </nav>
                </div>
                <div className="menu-bar-center">
                    <span className="project-title">{currentProject?.name || 'Untitled Project'}</span>
                </div>
                <div className="menu-bar-right">
                    <button
                        className="action-button secondary"
                        onClick={() => saveProject?.()}
                        title="Save Project (⌘S)"
                        disabled={!currentProject}
                        style={{ opacity: currentProject ? 1 : 0.4 }}
                    >
                        Save
                    </button>
                    {currentProject && (
                        <button
                            className="action-button secondary"
                            onClick={() => closeProject?.()}
                            title="Close current project"
                        >
                            Close
                        </button>
                    )}
                    <div
                        title={backendAvailable ? 'Backend connected' : 'Backend not running'}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 5,
                            fontSize: 11, color: backendAvailable ? '#2ecc71' : '#e74c3c',
                            cursor: 'default', padding: '0 4px',
                        }}
                    >
                        <span style={{
                            width: 8, height: 8, borderRadius: '50%',
                            background: backendAvailable ? '#2ecc71' : '#e74c3c',
                            display: 'inline-block',
                        }} />
                        {backendAvailable ? 'Backend' : 'No Backend'}
                    </div>
                    <button
                        className="action-button secondary"
                        onClick={() => exportFCPXML?.()}
                        title="Export FCPXML"
                        disabled={!currentProject}
                        style={{ opacity: currentProject ? 1 : 0.4 }}
                    >
                        Export XML
                    </button>
                    <button
                        className="action-button primary"
                        onClick={() => renderVideo?.()}
                        disabled={!currentProject}
                        style={{ opacity: currentProject ? 1 : 0.4 }}
                    >
                        Export Video
                    </button>
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
            {showLogs && <LogViewer />}
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
                </div>
            </EditorProvider>
        </ErrorBoundary>
    );
}

export default App;
