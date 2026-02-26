import React, { useState, useMemo } from 'react';
import { useEditor } from '../../context/EditorContext';
import { getTemplateById } from '../../templates/registry';
import { ReviewDashboard } from './ReviewDashboard';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatUs(us: number): string {
    const totalSec = us / 1_000_000;
    const mins = Math.floor(totalSec / 60);
    const secs = (totalSec % 60).toFixed(1);
    return `${mins}:${secs.padStart(4, '0')}`;
}

function formatDuration(us: number): string {
    const sec = us / 1_000_000;
    if (sec < 60) return `${sec.toFixed(1)}s`;
    return `${Math.floor(sec / 60)}m ${(sec % 60).toFixed(0)}s`;
}

const FILLER_WORDS = ['um', 'uh', 'erm', 'hmm', 'like', 'you know', 'actually', 'basically'];

// ─── Sub-components ───────────────────────────────────────────────────────────

const Spinner: React.FC<{ label: string }> = ({ label }) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '24px 0' }}>
        <div className="spinner-small" style={{ width: 28, height: 28, borderWidth: 3 }} />
        <span style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>{label}</span>
    </div>
);

const ProgressBar: React.FC<{ percent: number; stage: string }> = ({ percent, stage }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '24px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
            <span style={{ color: 'var(--text-muted)', textTransform: 'capitalize' }}>{stage}</span>
            <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>{Math.round(percent)}%</span>
        </div>
        <div style={{
            height: 6,
            borderRadius: 3,
            background: 'var(--bg-secondary, #1a1a2e)',
            overflow: 'hidden',
        }}>
            <div style={{
                height: '100%',
                width: `${Math.min(100, percent)}%`,
                borderRadius: 3,
                background: 'linear-gradient(90deg, var(--accent-primary, #4a9eff), #7c3aed)',
                transition: 'width 0.5s',
            }} />
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
            Rendering… This may take several minutes.
        </span>
    </div>
);

const STAGE_ICONS: Record<string, string> = {
    done: '✔',
    skipped: '⏭',
    running: '⏳',
    pending: '○',
    error: '✗',
};

const STAGE_COLORS: Record<string, string> = {
    done: '#10b981',
    skipped: '#f59e0b',
    running: '#818cf8',
    pending: 'var(--text-muted)',
    error: '#ef4444',
};

const ALL_STEPS = [
    { key: 'transcription', label: 'Transcription' },
    { key: 'transcript_annotation', label: 'Transcript Annotation' },
    { key: 'semantic_chunking', label: 'Semantic Chunking' },
    { key: 'high_retention_analysis', label: 'High-Retention Analysis' },
    { key: 'chunk_qc', label: 'Chunk Quality Control' },
    { key: 'asset_quality', label: 'Asset Quality Gate' },
    { key: 'cut_safety_review', label: 'Cut Safety Review' },
    { key: 'seam_quality', label: 'Seam Quality Analysis' },
    { key: 'cross_chunk_review', label: 'Cross-Chunk Consistency' },
    { key: 'global_analysis', label: 'Global Video Intelligence' },
    { key: 'pre_render_qa', label: 'Pre-Render QA' },
    { key: 'timeline_assembly', label: 'Timeline Assembly' },
];

const StageProcessing: React.FC<{ label: string; stageIcon?: string }> = ({ label, stageIcon = '⏳' }) => {
    const { pipelineProgress, agenticProgress, overlayChunkIndex, totalOverlayChunks, pipelineStage } = useEditor();
    const [elapsed, setElapsed] = React.useState(0);

    React.useEffect(() => {
        if (!pipelineProgress?.startedAt) { setElapsed(0); return; }
        const interval = setInterval(() => {
            setElapsed(Math.floor((Date.now() - pipelineProgress.startedAt) / 1000));
        }, 1000);
        return () => clearInterval(interval);
    }, [pipelineProgress?.startedAt]);

    const formatElapsed = (sec: number) => {
        if (sec < 60) return `${sec}s`;
        return `${Math.floor(sec / 60)}m ${sec % 60}s`;
    };

    // Use agenticProgress if available, otherwise fallback to legacy pipelineProgress
    const percent = agenticProgress?.percent ?? pipelineProgress?.percent ?? 0;
    const message = agenticProgress?.detail || agenticProgress?.currentStep || pipelineProgress?.message || label;
    const isOverlay = pipelineStage === 'overlaying_chunk';

    // Build stage status map from stageLog
    const stageLog = agenticProgress?.stageLog || [];
    const stageStatusMap: Record<string, { status: string; detail: string; subStages: Array<{ subStage: string; status: string; detail: string; timestamp: string }> }> = {};
    for (const entry of stageLog) {
        if (!stageStatusMap[entry.step]) {
            stageStatusMap[entry.step] = { status: entry.status, detail: entry.detail, subStages: [] };
        } else {
            stageStatusMap[entry.step].status = entry.status;
            stageStatusMap[entry.step].detail = entry.detail;
        }
        if (entry.subStage) {
            const existing = stageStatusMap[entry.step].subStages.find(s => s.subStage === entry.subStage);
            if (existing) {
                existing.status = entry.status;
                existing.detail = entry.detail;
            } else {
                stageStatusMap[entry.step].subStages.push({
                    subStage: entry.subStage,
                    status: entry.status,
                    detail: entry.detail,
                    timestamp: entry.timestamp,
                });
            }
        }
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '16px 0' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="spinner-small" style={{ width: 20, height: 20, borderWidth: 2, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {stageIcon} {message}
                    </div>
                    {agenticProgress?.llmProvider && (
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, display: 'flex', gap: 6 }}>
                            <span style={{ color: '#4ec9b0' }}>LLM: {agenticProgress.llmProvider}/{agenticProgress.llmModel}</span>
                        </div>
                    )}
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                        Elapsed: {formatElapsed(elapsed)}
                    </div>
                </div>
            </div>

            {/* Progress bar */}
            <div style={{
                height: 6,
                borderRadius: 3,
                background: 'var(--bg-secondary, #1a1a2e)',
                overflow: 'hidden',
            }}>
                <div style={{
                    height: '100%',
                    width: `${Math.min(100, Math.max(2, percent))}%`,
                    borderRadius: 3,
                    background: isOverlay || agenticProgress
                        ? 'linear-gradient(90deg, #7c3aed, #a855f7)'
                        : 'linear-gradient(90deg, var(--accent-primary, #4a9eff), #7c3aed)',
                    transition: 'width 0.5s ease',
                }} />
            </div>

            {/* Percentage */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)' }}>
                <span>{Math.round(percent)}%</span>
                {agenticProgress && agenticProgress.currentStep && (
                    <span style={{ textTransform: 'capitalize' }}>
                        {agenticProgress.currentStep.replace(/_/g, ' ')}
                        {agenticProgress.subStage ? ` → ${agenticProgress.subStage.replace(/_/g, ' ')}` : ''}
                    </span>
                )}
                {!agenticProgress && isOverlay && totalOverlayChunks > 0 && (
                    <span>Chunk {overlayChunkIndex + 1} / {totalOverlayChunks}</span>
                )}
            </div>

            {/* Stage Log — Pipeline Steps */}
            {stageLog.length > 0 && (
                <div style={{
                    marginTop: 4,
                    background: 'var(--bg-secondary, #1a1a2e)',
                    borderRadius: 6,
                    padding: '8px 10px',
                    maxHeight: 260,
                    overflowY: 'auto',
                    border: '1px solid var(--panel-border, #2a2a3e)',
                }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Pipeline Stages
                    </div>
                    {ALL_STEPS.map((stepDef, idx) => {
                        const info = stageStatusMap[stepDef.key];
                        const status = info?.status || 'pending';
                        const icon = STAGE_ICONS[status] || '○';
                        const color = STAGE_COLORS[status] || 'var(--text-muted)';
                        const isActive = agenticProgress?.currentStep === stepDef.key && status === 'running';
                        return (
                            <div key={stepDef.key} style={{ marginBottom: 2 }}>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: 6,
                                    padding: '3px 0',
                                    opacity: status === 'pending' ? 0.4 : 1,
                                }}>
                                    <span style={{ fontSize: 11, color, flexShrink: 0, width: 14, textAlign: 'center' }}>
                                        {isActive ? (
                                            <span className="spinner-small" style={{ display: 'inline-block', width: 10, height: 10, borderWidth: 1.5 }} />
                                        ) : icon}
                                    </span>
                                    <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0, width: 16 }}>{idx + 1}.</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <span style={{ fontSize: 11, fontWeight: isActive ? 600 : 400, color: isActive ? 'var(--text-primary)' : color }}>
                                            {stepDef.label}
                                        </span>
                                        {info?.detail && status !== 'pending' && (
                                            <div style={{
                                                fontSize: 9,
                                                color: 'var(--text-muted)',
                                                marginTop: 1,
                                                lineHeight: 1.3,
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                            }}>
                                                {info.detail}
                                            </div>
                                        )}
                                        {/* Sub-stages */}
                                        {info?.subStages && info.subStages.length > 0 && (
                                            <div style={{ marginTop: 2, paddingLeft: 10, borderLeft: '1px solid var(--panel-border, #2a2a3e)' }}>
                                                {info.subStages.map((sub, si) => {
                                                    const subIcon = STAGE_ICONS[sub.status] || '○';
                                                    const subColor = STAGE_COLORS[sub.status] || 'var(--text-muted)';
                                                    const isSubActive = sub.status === 'running';
                                                    return (
                                                        <div key={si} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '1px 0' }}>
                                                            <span style={{ fontSize: 9, color: subColor, width: 12, textAlign: 'center', flexShrink: 0 }}>
                                                                {isSubActive ? (
                                                                    <span className="spinner-small" style={{ display: 'inline-block', width: 8, height: 8, borderWidth: 1 }} />
                                                                ) : subIcon}
                                                            </span>
                                                            <span style={{ fontSize: 9, color: isSubActive ? 'var(--text-primary)' : subColor }}>
                                                                {sub.subStage.replace(/_/g, ' ')}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Helpful tip (when no stage log yet) */}
            {stageLog.length === 0 && (
                <div style={{
                    fontSize: 10,
                    color: 'var(--text-muted)',
                    textAlign: 'center',
                    opacity: 0.7,
                    lineHeight: 1.4,
                }}>
                    {agenticProgress
                        ? 'AI is analyzing your video and generating edits…'
                        : isOverlay
                            ? 'AI is analyzing each transcript section and selecting relevant assets…'
                            : 'This may take a few minutes depending on video length.'}
                </div>
            )}
        </div>
    );
};

const StageIdle: React.FC = () => {
    const { media, agenticEdit, currentProject, tracks } = useEditor();
    const videoItem = media.find(m => m.status === 'ok' && m.type.toLowerCase() === 'video');
    const canStart = !!currentProject && !!videoItem;

    // Use trimmed clip duration from timeline if available, otherwise fall back to original
    const videoClip = videoItem ? tracks.flatMap(t => t.clips).find(c => c.mediaId === videoItem.id && c.type === 'video') : null;
    const displayDuration = videoClip?.duration || videoItem?.duration || 0;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ padding: '12px 0', borderBottom: '1px solid var(--panel-border)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Source Video</div>
                {videoItem ? (
                    <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500, wordBreak: 'break-all' }}>
                        {videoItem.name}
                        {displayDuration > 0 && (
                            <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: 6 }}>
                                ({formatDuration(displayDuration * 1_000_000)})
                            </span>
                        )}
                    </div>
                ) : (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        {currentProject ? 'No video imported yet' : 'Create a project first'}
                    </div>
                )}
            </div>

            <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                AI will transcribe, cut silences, add templates and stock B-roll, and generate a fully edited timeline automatically.
            </div>

            <button
                className="btn-primary btn-block"
                onClick={agenticEdit}
                disabled={!canStart}
                style={{ opacity: canStart ? 1 : 0.4, cursor: canStart ? 'pointer' : 'not-allowed' }}
            >
                ▶ Start Editing
            </button>

            {!canStart && currentProject && !videoItem && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
                    Import a video to enable AI editing. <br />
                    (Status must be OK)
                </div>
            )}
        </div>
    );
};

// ── Step 1 → 2: User reviews transcript ──────────────────────────────────────

const SPEAKER_COLORS = ['#3498db', '#e74c3c', '#2ecc71', '#9b59b6', '#f39c12', '#1abc9c', '#e67e22', '#8e44ad'];

const RISK_COLORS: Record<string, { bg: string; border: string; text: string; badge: string }> = {
    high: { bg: 'rgba(231,76,60,0.10)', border: 'rgba(231,76,60,0.35)', text: '#e74c3c', badge: '#e74c3c' },
    medium: { bg: 'rgba(243,156,18,0.10)', border: 'rgba(243,156,18,0.30)', text: '#f39c12', badge: '#f39c12' },
    low: { bg: 'rgba(241,196,15,0.06)', border: 'rgba(241,196,15,0.20)', text: '#f1c40f', badge: '#f1c40f' },
    none: { bg: 'transparent', border: 'transparent', text: 'var(--text-primary)', badge: 'transparent' },
};

const StageTranscriptReady: React.FC = () => {
    const { transcript, approveTranscript, seekTo, currentTime, resetPipeline, updateTranscriptSegment } = useEditor();
    const [expanded, setExpanded] = useState(true);
    const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);
    const [editingSegId, setEditingSegId] = useState<string | null>(null);
    const [editText, setEditText] = useState('');
    const [speakerFilter, setSpeakerFilter] = useState<number | null>(null);

    const activeSegIndex = useMemo(() => {
        if (!transcript) return -1;
        const timeUs = currentTime * 1_000_000;
        return transcript.findIndex(seg => timeUs >= seg.startUs && timeUs <= seg.endUs);
    }, [transcript, currentTime]);

    const hasAnnotations = useMemo(() =>
        transcript?.some(s => s.annotation && s.annotation.flagCount > 0) ?? false,
    [transcript]);

    const speakerList = useMemo(() => {
        if (!transcript) return [];
        const seen = new Map<number, string>();
        for (const seg of transcript) {
            if (seg.speaker != null && seg.speakerIndex != null && !seen.has(seg.speakerIndex)) {
                seen.set(seg.speakerIndex, seg.speaker);
            }
        }
        return Array.from(seen.entries()).sort((a, b) => a[0] - b[0]);
    }, [transcript]);

    const reliabilityStats = useMemo(() => {
        if (!transcript) return null;
        const total = transcript.length;
        const flagged = transcript.filter(s => s.annotation && s.annotation.flagCount > 0).length;
        const highRisk = transcript.filter(s => s.annotation?.riskLevel === 'high').length;
        const medRisk = transcript.filter(s => s.annotation?.riskLevel === 'medium').length;
        return { total, flagged, highRisk, medRisk };
    }, [transcript]);

    const displaySegments = useMemo(() => {
        if (!transcript) return [];
        let segs = transcript;
        if (showFlaggedOnly) segs = segs.filter(s => s.annotation && s.annotation.flagCount > 0);
        if (speakerFilter !== null) segs = segs.filter(s => s.speakerIndex === speakerFilter);
        return segs;
    }, [transcript, showFlaggedOnly, speakerFilter]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{
                background: 'rgba(46,204,113,0.08)',
                border: '1px solid rgba(46,204,113,0.25)',
                borderRadius: 6,
                padding: '10px 12px',
            }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#2ecc71', marginBottom: 4 }}>
                    ✅ Transcription Complete
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {transcript?.length || 0} segments found. Review below and approve to proceed.
                </div>
            </div>

            {hasAnnotations && reliabilityStats && (
                <div style={{
                    background: reliabilityStats.highRisk > 0 ? 'rgba(231,76,60,0.06)' : 'rgba(52,152,219,0.06)',
                    border: `1px solid ${reliabilityStats.highRisk > 0 ? 'rgba(231,76,60,0.20)' : 'rgba(52,152,219,0.20)'}`,
                    borderRadius: 6,
                    padding: '8px 10px',
                    fontSize: 11,
                }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                        📊 Transcript Quality
                    </div>
                    <div style={{ display: 'flex', gap: 12, color: 'var(--text-muted)' }}>
                        <span>{reliabilityStats.flagged}/{reliabilityStats.total} flagged</span>
                        {reliabilityStats.highRisk > 0 && (
                            <span style={{ color: '#e74c3c' }}>🔴 {reliabilityStats.highRisk} high-risk</span>
                        )}
                        {reliabilityStats.medRisk > 0 && (
                            <span style={{ color: '#f39c12' }}>🟡 {reliabilityStats.medRisk} medium</span>
                        )}
                    </div>
                </div>
            )}

            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button
                    className="btn-secondary btn-sm"
                    onClick={() => setExpanded(v => !v)}
                    style={{ textAlign: 'left', flex: 1 }}
                >
                    {expanded ? '▾' : '▸'} Transcript ({transcript?.length || 0} segments)
                </button>
                {hasAnnotations && (
                    <button
                        className="btn-secondary btn-sm"
                        onClick={() => setShowFlaggedOnly(v => !v)}
                        style={{ fontSize: 10, whiteSpace: 'nowrap', opacity: showFlaggedOnly ? 1 : 0.6 }}
                    >
                        ⚠ {showFlaggedOnly ? 'Show All' : 'Flagged Only'}
                    </button>
                )}
            </div>

            {speakerList.length > 1 && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>Speaker:</span>
                    <button
                        className="btn-secondary btn-sm"
                        onClick={() => setSpeakerFilter(null)}
                        style={{
                            fontSize: 9, padding: '1px 6px',
                            opacity: speakerFilter === null ? 1 : 0.5,
                            border: speakerFilter === null ? '1px solid var(--accent-primary)' : undefined,
                        }}
                    >All</button>
                    {speakerList.map(([idx, _name]) => (
                        <button
                            key={idx}
                            className="btn-secondary btn-sm"
                            onClick={() => setSpeakerFilter(speakerFilter === idx ? null : idx)}
                            style={{
                                fontSize: 9, padding: '1px 6px',
                                background: SPEAKER_COLORS[idx % SPEAKER_COLORS.length] + (speakerFilter === idx ? '33' : '11'),
                                color: SPEAKER_COLORS[idx % SPEAKER_COLORS.length],
                                border: speakerFilter === idx ? `1px solid ${SPEAKER_COLORS[idx % SPEAKER_COLORS.length]}` : undefined,
                                fontWeight: speakerFilter === idx ? 700 : 400,
                            }}
                        >S{idx + 1}</button>
                    ))}
                </div>
            )}

            {expanded && transcript && (
                <div style={{
                    maxHeight: 320,
                    overflowY: 'auto',
                    border: '1px solid var(--panel-border)',
                    borderRadius: 6,
                    padding: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                }}>
                    {displaySegments.map((seg, _i) => {
                        const risk = seg.annotation?.riskLevel || 'none';
                        const riskStyle = RISK_COLORS[risk] || RISK_COLORS.none;
                        const isActive = transcript.indexOf(seg) === activeSegIndex;
                        const flags = seg.annotation?.flags || [];

                        return (
                            <div
                                key={seg.id}
                                onClick={() => seekTo(seg.startUs / 1_000_000)}
                                title={flags.length > 0 ? flags.map(f => f.message).join('\n') : undefined}
                                style={{
                                    fontSize: 11,
                                    cursor: 'pointer',
                                    padding: '5px 6px',
                                    borderRadius: 4,
                                    background: isActive ? 'rgba(74,158,255,0.15)' : riskStyle.bg,
                                    border: isActive
                                        ? '1px solid rgba(74,158,255,0.3)'
                                        : risk !== 'none'
                                            ? `1px solid ${riskStyle.border}`
                                            : '1px solid transparent',
                                    transition: 'background 0.15s',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <span style={{ color: 'var(--accent-primary)', fontFamily: 'monospace', fontSize: 10, flexShrink: 0 }}>
                                        {formatUs(seg.startUs)}
                                    </span>
                                    {seg.speaker && (
                                        <span style={{
                                            fontSize: 8,
                                            padding: '1px 4px',
                                            borderRadius: 3,
                                            background: SPEAKER_COLORS[(seg.speakerIndex ?? 0) % SPEAKER_COLORS.length] + '22',
                                            color: SPEAKER_COLORS[(seg.speakerIndex ?? 0) % SPEAKER_COLORS.length],
                                            fontWeight: 700,
                                            flexShrink: 0,
                                            border: `1px solid ${SPEAKER_COLORS[(seg.speakerIndex ?? 0) % SPEAKER_COLORS.length]}44`,
                                        }}>
                                            S{(seg.speakerIndex ?? 0) + 1}
                                        </span>
                                    )}
                                    {risk !== 'none' && (
                                        <span style={{
                                            fontSize: 8,
                                            padding: '1px 4px',
                                            borderRadius: 3,
                                            background: riskStyle.badge,
                                            color: '#fff',
                                            fontWeight: 700,
                                            textTransform: 'uppercase',
                                            flexShrink: 0,
                                        }}>
                                            {risk}
                                        </span>
                                    )}
                                    {editingSegId === seg.id ? (
                                        <input
                                            autoFocus
                                            value={editText}
                                            onChange={e => setEditText(e.target.value)}
                                            onBlur={() => {
                                                if (editText.trim() && editText !== seg.text) {
                                                    updateTranscriptSegment(seg.id, editText.trim());
                                                }
                                                setEditingSegId(null);
                                            }}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); }
                                                if (e.key === 'Escape') { setEditingSegId(null); }
                                            }}
                                            onClick={e => e.stopPropagation()}
                                            style={{
                                                flex: 1, fontSize: 11, color: 'var(--text-primary)',
                                                background: 'rgba(74,158,255,0.10)', border: '1px solid rgba(74,158,255,0.4)',
                                                borderRadius: 3, padding: '1px 4px', outline: 'none',
                                                fontFamily: 'inherit',
                                            }}
                                        />
                                    ) : (
                                        <span
                                            style={{ color: riskStyle.text, flex: 1, cursor: 'text' }}
                                            onDoubleClick={e => {
                                                e.stopPropagation();
                                                setEditingSegId(seg.id);
                                                setEditText(seg.text);
                                            }}
                                            title="Double-click to edit"
                                        >{seg.text}</span>
                                    )}
                                    {seg.confidence < 0.7 && (
                                        <span style={{ fontSize: 9, color: '#e74c3c', flexShrink: 0 }}>
                                            {Math.round(seg.confidence * 100)}%
                                        </span>
                                    )}
                                </div>
                                {flags.length > 0 && (
                                    <div style={{ display: 'flex', gap: 4, marginTop: 2, flexWrap: 'wrap' }}>
                                        {flags.map((f, fi) => (
                                            <span key={fi} style={{
                                                fontSize: 9,
                                                color: RISK_COLORS[f.severity]?.text || 'var(--text-muted)',
                                                opacity: 0.8,
                                            }}>
                                                {f.type.replace(/_/g, ' ')}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                <button className="btn-primary btn-block" onClick={approveTranscript}>
                    ✅ Approve & Plan Cuts
                </button>
                <button className="btn-secondary btn-block" onClick={resetPipeline}>
                    ↩ Start Over
                </button>
            </div>
        </div>
    );
};

// ── Step 2 → 3: User reviews cuts ────────────────────────────────────────────

const StageCutsReady: React.FC = () => {
    const { transcript, cutPlan, setCutPlan, approveCuts, seekTo, resetPipeline } = useEditor();
    const [rejectedIndices, setRejectedIndices] = useState<Set<number>>(new Set());

    const totalRemovedUs = useMemo(() =>
        (cutPlan || []).reduce((sum, r, i) =>
            rejectedIndices.has(i) ? sum : sum + (r.endUs - r.startUs), 0
        ), [cutPlan, rejectedIndices]);

    const toggleCut = (index: number) => {
        setRejectedIndices(prev => {
            const next = new Set(prev);
            if (next.has(index)) next.delete(index);
            else next.add(index);
            return next;
        });
    };

    const applyAndApprove = () => {
        if (cutPlan && rejectedIndices.size > 0) {
            setCutPlan(cutPlan.filter((_, i) => !rejectedIndices.has(i)));
        }
        approveCuts();
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{
                background: 'var(--bg-secondary)',
                borderRadius: 6,
                padding: '10px 12px',
                border: '1px solid var(--panel-border)',
            }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                    ✂️ Cut Plan Ready
                </div>
                <div style={{ display: 'flex', gap: 16 }}>
                    <div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent-primary)' }}>
                            {transcript?.length || 0}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>segments</div>
                    </div>
                    <div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: '#e74c3c' }}>
                            {(cutPlan?.length || 0) - rejectedIndices.size}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>active cuts</div>
                    </div>
                    {totalRemovedUs > 0 && (
                        <div>
                            <div style={{ fontSize: 18, fontWeight: 700, color: '#f39c12' }}>
                                {formatDuration(totalRemovedUs)}
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>removed</div>
                        </div>
                    )}
                </div>
            </div>

            {/* Cut list */}
            {cutPlan && cutPlan.length > 0 && (
                <div style={{
                    maxHeight: 200,
                    overflowY: 'auto',
                    border: '1px solid var(--panel-border)',
                    borderRadius: 6,
                    padding: 6,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                }}>
                    {cutPlan.map((cut, i) => {
                        const isRejected = rejectedIndices.has(i);
                        return (
                            <div key={i} style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '4px 6px',
                                borderRadius: 4,
                                background: isRejected ? 'rgba(255,255,255,0.02)' : 'rgba(231,76,60,0.06)',
                                border: `1px solid ${isRejected ? '#333' : 'rgba(231,76,60,0.2)'}`,
                                opacity: isRejected ? 0.5 : 1,
                            }}>
                                <button
                                    onClick={() => toggleCut(i)}
                                    title={isRejected ? 'Accept this cut' : 'Reject this cut'}
                                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 14, padding: 0, lineHeight: 1, flexShrink: 0 }}
                                >
                                    {isRejected ? '⬜' : '✅'}
                                </button>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 10, fontFamily: 'monospace', color: isRejected ? '#666' : '#e74c3c', textDecoration: isRejected ? 'line-through' : 'none' }}>
                                        {formatUs(cut.startUs)} → {formatUs(cut.endUs)}
                                        <span style={{ marginLeft: 4, color: '#888' }}>({formatDuration(cut.endUs - cut.startUs)})</span>
                                    </div>
                                    <div style={{ fontSize: 10, color: isRejected ? '#555' : '#999', textDecoration: isRejected ? 'line-through' : 'none', marginTop: 1 }}>
                                        {cut.reason}
                                    </div>
                                </div>
                                <button
                                    onClick={() => seekTo(cut.startUs / 1_000_000)}
                                    title="Jump to this cut"
                                    style={{ background: 'transparent', border: '1px solid #444', color: '#aaa', borderRadius: 3, padding: '2px 5px', fontSize: 10, cursor: 'pointer', flexShrink: 0 }}
                                >
                                    ▶
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                <button className="btn-primary btn-block" onClick={applyAndApprove}>
                    ✅ Approve Cuts & Continue
                </button>
                <button className="btn-secondary btn-block" onClick={resetPipeline}>
                    ↩ Start Over
                </button>
            </div>
        </div>
    );
};

const StageRoughCutReady: React.FC = () => {
    const { transcript, cutPlan, setCutPlan, editNow, renderVideo, seekTo, currentTime } = useEditor();
    const [showTranscript, setShowTranscript] = useState(false);
    const [showWords, setShowWords] = useState(false);
    const [rejectedIndices, setRejectedIndices] = useState<Set<number>>(new Set());

    const totalRemovedUs = useMemo(() =>
        (cutPlan || []).reduce((sum, r, i) =>
            rejectedIndices.has(i) ? sum : sum + (r.endUs - r.startUs), 0
        ), [cutPlan, rejectedIndices]);

    const toggleCut = (index: number) => {
        setRejectedIndices(prev => {
            const next = new Set(prev);
            if (next.has(index)) next.delete(index);
            else next.add(index);
            return next;
        });
    };

    const applyAcceptedCuts = () => {
        if (!cutPlan) return;
        const accepted = cutPlan.filter((_, i) => !rejectedIndices.has(i));
        setCutPlan(accepted);
        setRejectedIndices(new Set());
    };

    // Find active transcript segment based on current time
    const activeSegIndex = useMemo(() => {
        if (!transcript) return -1;
        const timeUs = currentTime * 1_000_000;
        return transcript.findIndex(seg => timeUs >= seg.startUs && timeUs <= seg.endUs);
    }, [transcript, currentTime]);

    // Highlight filler words in text
    const highlightFillers = (text: string) => {
        const words = text.split(/(\s+)/);
        return words.map((word, i) => {
            const isF = FILLER_WORDS.some(f => word.toLowerCase().replace(/[.,!?]/g, '') === f);
            if (isF) {
                return <span key={i} style={{
                    background: 'rgba(243,156,18,0.25)',
                    color: '#f39c12',
                    borderRadius: 3,
                    padding: '0 2px',
                }}>{word}</span>;
            }
            return <span key={i}>{word}</span>;
        });
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Cut summary */}
            <div style={{
                background: 'var(--bg-secondary)',
                borderRadius: 6,
                padding: '10px 12px',
                border: '1px solid var(--panel-border)'
            }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                    ✂️ Rough Cut Ready
                </div>
                <div style={{ display: 'flex', gap: 16 }}>
                    <div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent-primary)' }}>
                            {transcript?.length || 0}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>segments</div>
                    </div>
                    <div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: '#e74c3c' }}>
                            {(cutPlan?.length || 0) - rejectedIndices.size}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>active cuts</div>
                    </div>
                    {totalRemovedUs > 0 && (
                        <div>
                            <div style={{ fontSize: 18, fontWeight: 700, color: '#f39c12' }}>
                                {formatDuration(totalRemovedUs)}
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>removed</div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Transcript Review ─────────────────────────────────────────── */}
            <button
                className="btn-secondary btn-sm"
                onClick={() => setShowTranscript(v => !v)}
                style={{ textAlign: 'left' }}
            >
                {showTranscript ? '▾' : '▸'} Transcript ({transcript?.length || 0} segments)
            </button>

            {showTranscript && transcript && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
                        <label style={{ fontSize: 10, color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <input type="checkbox" checked={showWords} onChange={e => setShowWords(e.target.checked)} style={{ width: 12, height: 12 }} />
                            Word-level
                        </label>
                    </div>
                    <div style={{
                        maxHeight: 200,
                        overflowY: 'auto',
                        border: '1px solid var(--panel-border)',
                        borderRadius: 6,
                        padding: 8,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                    }}>
                        {transcript.map((seg, i) => (
                            <div
                                key={seg.id}
                                onClick={() => seekTo(seg.startUs / 1_000_000)}
                                style={{
                                    fontSize: 11,
                                    cursor: 'pointer',
                                    padding: '4px 6px',
                                    borderRadius: 4,
                                    background: i === activeSegIndex ? 'rgba(74,158,255,0.15)' : 'transparent',
                                    border: i === activeSegIndex ? '1px solid rgba(74,158,255,0.3)' : '1px solid transparent',
                                    transition: 'background 0.15s',
                                }}
                            >
                                <span style={{
                                    color: 'var(--accent-primary)',
                                    fontFamily: 'monospace',
                                    marginRight: 6,
                                    fontSize: 10,
                                }}>
                                    {formatUs(seg.startUs)}
                                </span>
                                <span style={{ color: 'var(--text-primary)' }}>
                                    {highlightFillers(seg.text)}
                                </span>
                                {showWords && (seg as any).words && (
                                    <div style={{ marginTop: 4, paddingLeft: 12, display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                                        {((seg as any).words as Array<{ word: string; startUs: number; endUs: number }>).map((w, wi) => (
                                            <span
                                                key={wi}
                                                onClick={(e) => { e.stopPropagation(); seekTo(w.startUs / 1_000_000); }}
                                                style={{
                                                    fontSize: 10,
                                                    color: '#aaa',
                                                    cursor: 'pointer',
                                                    padding: '1px 3px',
                                                    borderRadius: 2,
                                                    background: 'rgba(255,255,255,0.05)',
                                                }}
                                                title={`${formatUs(w.startUs)} → ${formatUs(w.endUs)}`}
                                            >
                                                {w.word}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── AI Cut Decisions ──────────────────────────────────────────── */}
            {cutPlan && cutPlan.length > 0 && (
                <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        AI Cut Decisions
                    </div>
                    <div style={{
                        maxHeight: 180,
                        overflowY: 'auto',
                        border: '1px solid var(--panel-border)',
                        borderRadius: 6,
                        padding: 6,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                    }}>
                        {cutPlan.map((cut, i) => {
                            const isRejected = rejectedIndices.has(i);
                            return (
                                <div key={i} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    padding: '4px 6px',
                                    borderRadius: 4,
                                    background: isRejected ? 'rgba(255,255,255,0.02)' : 'rgba(231,76,60,0.06)',
                                    border: `1px solid ${isRejected ? '#333' : 'rgba(231,76,60,0.2)'}`,
                                    opacity: isRejected ? 0.5 : 1,
                                    transition: 'all 0.15s',
                                }}>
                                    {/* Accept/Reject toggle */}
                                    <button
                                        onClick={() => toggleCut(i)}
                                        title={isRejected ? 'Accept this cut' : 'Reject this cut'}
                                        style={{
                                            background: 'transparent',
                                            border: 'none',
                                            cursor: 'pointer',
                                            fontSize: 14,
                                            padding: 0,
                                            lineHeight: 1,
                                            flexShrink: 0,
                                        }}
                                    >
                                        {isRejected ? '⬜' : '✅'}
                                    </button>

                                    {/* Cut info */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{
                                            fontSize: 10,
                                            fontFamily: 'monospace',
                                            color: isRejected ? '#666' : '#e74c3c',
                                            textDecoration: isRejected ? 'line-through' : 'none',
                                        }}>
                                            {formatUs(cut.startUs)} → {formatUs(cut.endUs)}
                                            <span style={{ marginLeft: 4, color: '#888', fontFamily: 'inherit' }}>
                                                ({formatDuration(cut.endUs - cut.startUs)})
                                            </span>
                                        </div>
                                        <div style={{
                                            fontSize: 10,
                                            color: isRejected ? '#555' : '#999',
                                            textDecoration: isRejected ? 'line-through' : 'none',
                                            marginTop: 1,
                                        }}>
                                            {cut.reason}
                                        </div>
                                    </div>

                                    {/* Jump button */}
                                    <button
                                        onClick={() => seekTo(cut.startUs / 1_000_000)}
                                        title="Jump to this cut"
                                        style={{
                                            background: 'transparent',
                                            border: '1px solid #444',
                                            color: '#aaa',
                                            borderRadius: 3,
                                            padding: '2px 5px',
                                            fontSize: 10,
                                            cursor: 'pointer',
                                            flexShrink: 0,
                                        }}
                                    >
                                        ▶
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                    {rejectedIndices.size > 0 && (
                        <button
                            className="btn-secondary btn-sm"
                            onClick={applyAcceptedCuts}
                            style={{ marginTop: 6, fontSize: 10 }}
                        >
                            Apply {(cutPlan.length - rejectedIndices.size)} accepted cuts
                        </button>
                    )}
                </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                <button className="btn-primary btn-block" onClick={editNow}>
                    ✨ Edit Now (Add Templates)
                </button>
                <button className="btn-secondary btn-block" onClick={() => renderVideo()}>
                    🎬 Render (Skip Enrichment)
                </button>
            </div>
        </div>
    );
};

const StageEnrichmentReady: React.FC = () => {
    const { enrichmentSummary, renderVideo } = useEditor();

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{
                background: 'var(--bg-secondary)',
                borderRadius: 6,
                padding: '10px 12px',
                border: '1px solid var(--panel-border)'
            }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                    ✨ Enrichment Ready
                </div>
                <div style={{ display: 'flex', gap: 16 }}>
                    <div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent-primary)' }}>
                            {enrichmentSummary?.templateCount || 0}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>templates</div>
                    </div>
                    <div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: '#2ecc71' }}>
                            {enrichmentSummary?.assetCount || 0}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>assets</div>
                    </div>
                </div>
            </div>

            <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Templates and assets have been placed on the timeline. Review the Overlays track, then render your final video.
            </div>

            <button className="btn-primary btn-block" onClick={() => renderVideo()}>
                🎬 Render Final Video
            </button>
            <button className="btn-secondary btn-block" onClick={() => renderVideo({ burnSubtitles: true })}>
                🎬 Render with Subtitles
            </button>
        </div>
    );
};

// ── Chunk Review: user reviews overlays for each chunk ──────────────────────

const StageChunkReview: React.FC = () => {
    const {
        currentChunkOverlays, setCurrentChunkOverlays,
        overlayChunkIndex, totalOverlayChunks,
        approveChunk, fastTrackMode, toggleFastTrack, resetPipeline,
    } = useEditor();

    const updateOverlayField = (idx: number, field: string, value: string) => {
        setCurrentChunkOverlays((prev: any[]) => prev.map((o: any, i: number) => {
            if (i !== idx) return o;
            if (field === 'headline' || field === 'subline') {
                return { ...o, content: { ...o.content, [field]: value } };
            }
            return { ...o, [field]: value };
        }));
    };

    const toggleApproval = (idx: number) => {
        setCurrentChunkOverlays((prev: any[]) => prev.map((o: any, i: number) =>
            i === idx ? { ...o, approved: !o.approved } : o
        ));
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Chunk progress header */}
            <div style={{
                background: 'rgba(124,58,237,0.08)',
                border: '1px solid rgba(124,58,237,0.25)',
                borderRadius: 6,
                padding: '10px 12px',
            }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#7c3aed', marginBottom: 4 }}>
                    🎯 Chunk {overlayChunkIndex + 1} / {totalOverlayChunks}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {currentChunkOverlays.length} overlay(s) suggested. Review and approve.
                </div>
                {/* Progress bar */}
                <div style={{ marginTop: 6, height: 4, borderRadius: 2, background: 'rgba(124,58,237,0.15)' }}>
                    <div style={{
                        height: '100%', borderRadius: 2,
                        width: `${((overlayChunkIndex + 1) / Math.max(totalOverlayChunks, 1)) * 100}%`,
                        background: 'linear-gradient(90deg, #7c3aed, #4a9eff)',
                        transition: 'width 0.3s',
                    }} />
                </div>
            </div>

            {/* Overlay cards */}
            {currentChunkOverlays.length === 0 ? (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
                    No overlays for this chunk.
                </div>
            ) : (
                <div style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {currentChunkOverlays.map((overlay: any, idx: number) => (
                        <div key={overlay.id || idx} style={{
                            border: `1px solid ${overlay.approved ? 'rgba(46,204,113,0.4)' : 'var(--panel-border)'}`,
                            background: overlay.approved ? 'rgba(46,204,113,0.05)' : 'var(--bg-secondary)',
                            borderRadius: 6,
                            padding: '8px 10px',
                        }}>
                            {/* Template name and toggle */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent-primary)' }}>
                                    {overlay.templateName || overlay.templateId}
                                </div>
                                <button
                                    onClick={() => toggleApproval(idx)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: 0 }}
                                    title={overlay.approved ? 'Unapprove' : 'Approve'}
                                >
                                    {overlay.approved ? '✅' : '⬜'}
                                </button>
                            </div>

                            {/* Timing */}
                            <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#888', marginBottom: 4 }}>
                                {formatUs(overlay.startUs)} → {formatUs(overlay.endUs)} ({formatDuration(overlay.endUs - overlay.startUs)})
                            </div>

                            {/* Editable headline */}
                            <input
                                type="text"
                                value={overlay.content?.headline || ''}
                                onChange={e => updateOverlayField(idx, 'headline', e.target.value)}
                                placeholder="Headline"
                                style={{
                                    width: '100%', padding: '4px 6px', fontSize: 11, fontWeight: 600,
                                    background: 'rgba(255,255,255,0.03)', border: '1px solid #333',
                                    borderRadius: 3, color: 'var(--text-primary)', marginBottom: 4,
                                    boxSizing: 'border-box',
                                }}
                            />
                            {/* Editable subline */}
                            <input
                                type="text"
                                value={overlay.content?.subline || ''}
                                onChange={e => updateOverlayField(idx, 'subline', e.target.value)}
                                placeholder="Subline"
                                style={{
                                    width: '100%', padding: '4px 6px', fontSize: 10,
                                    background: 'rgba(255,255,255,0.03)', border: '1px solid #333',
                                    borderRadius: 3, color: 'var(--text-muted)',
                                    boxSizing: 'border-box',
                                }}
                            />

                            {/* Asset info */}
                            {overlay.assetQuery && (
                                <div style={{ fontSize: 9, color: '#666', marginTop: 4 }}>
                                    🖼 Asset: "{overlay.assetQuery}"
                                    {overlay.assetPath && <span style={{ color: '#2ecc71' }}> ✔ downloaded</span>}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Fast Track toggle */}
            <label style={{
                display: 'flex', alignItems: 'center', gap: 8,
                fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer',
                padding: '4px 0',
            }}>
                <input
                    type="checkbox"
                    checked={fastTrackMode}
                    onChange={toggleFastTrack}
                    style={{ width: 14, height: 14 }}
                />
                ⚡ Fast Track (auto-approve remaining chunks)
            </label>

            {/* Action buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button className="btn-primary btn-block" onClick={approveChunk}>
                    {overlayChunkIndex < totalOverlayChunks - 1
                        ? `✅ Approve & Next Chunk (${overlayChunkIndex + 2}/${totalOverlayChunks})`
                        : '✅ Approve & Finish'
                    }
                </button>
                <button className="btn-secondary btn-block" onClick={resetPipeline}>
                    ↩ Start Over
                </button>
            </div>
        </div>
    );
};

const StageDone: React.FC = () => {
    const { renderResult, openInFinder, resetPipeline } = useEditor();

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{
                background: 'rgba(46,204,113,0.1)',
                border: '1px solid rgba(46,204,113,0.3)',
                borderRadius: 6,
                padding: '10px 12px',
            }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#2ecc71', marginBottom: 4 }}>
                    ✅ Render Complete
                </div>
                {renderResult?.durationSec && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        Duration: {formatDuration(renderResult.durationSec * 1_000_000)}
                    </div>
                )}
                {renderResult?.overlayAppliedCount !== undefined && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        Overlays applied: {renderResult.overlayAppliedCount}
                    </div>
                )}
            </div>

            {renderResult?.outputPath && (
                <div style={{
                    fontSize: 11,
                    color: 'var(--text-muted)',
                    wordBreak: 'break-all',
                    background: 'var(--bg-secondary)',
                    borderRadius: 4,
                    padding: '6px 8px',
                    fontFamily: 'monospace',
                }}>
                    {renderResult.outputPath}
                </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {renderResult?.outputPath && (
                    <button
                        className="btn-primary btn-block"
                        onClick={() => openInFinder(renderResult.outputPath)}
                    >
                        📂 Open in Finder
                    </button>
                )}
                <button className="btn-secondary btn-block" onClick={resetPipeline}>
                    ↩ Start New Edit
                </button>
            </div>
        </div>
    );
};

const StageError: React.FC = () => {
    const { pipelineError, resetPipeline, retryStep } = useEditor();

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{
                background: 'rgba(231,76,60,0.1)',
                border: '1px solid rgba(231,76,60,0.3)',
                borderRadius: 6,
                padding: '10px 12px',
            }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#e74c3c', marginBottom: 4 }}>
                    ❌ Pipeline Error
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', wordBreak: 'break-word', lineHeight: 1.5 }}>
                    {pipelineError || 'An unknown error occurred.'}
                </div>
            </div>

            <button className="btn-primary btn-block" onClick={retryStep}>
                🔄 Retry Failed Step
            </button>
            <button className="btn-secondary btn-block" onClick={resetPipeline}>
                ↩ Start Over
            </button>
        </div>
    );
};

// ─── Template Properties Panel ──────────────────────────────────────────────

// ─── Inline field editor for a single primitive value ────────────────────────
const PrimitiveField: React.FC<{
    label: string;
    value: unknown;
    onChange: (v: any) => void;
}> = ({ label, value, onChange }) => {
    const type = typeof value;
    const inputStyle: React.CSSProperties = {
        width: '100%', padding: '4px 6px', fontSize: 11,
        background: 'rgba(255,255,255,0.05)', border: '1px solid var(--panel-border)',
        borderRadius: 4, color: 'var(--text-primary)',
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <label style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                {label.replace(/([A-Z])/g, ' $1').trim()}
            </label>
            {type === 'string' && (
                label.toLowerCase().includes('color') ? (
                    <div style={{ display: 'flex', gap: 8 }}>
                        <input type="color" value={value as string} onChange={e => onChange(e.target.value)}
                            style={{ width: 30, height: 24, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }} />
                        <input type="text" value={value as string} onChange={e => onChange(e.target.value)}
                            style={{ ...inputStyle, flex: 1, width: 'auto' }} />
                    </div>
                ) : (
                    <input type="text" value={value as string} onChange={e => onChange(e.target.value)} style={inputStyle} />
                )
            )}
            {type === 'number' && (
                <input type="number" value={value as number} onChange={e => onChange(Number(e.target.value))} style={inputStyle} />
            )}
            {type === 'boolean' && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, cursor: 'pointer', color: 'var(--text-primary)' }}>
                    <input type="checkbox" checked={value as boolean} onChange={e => onChange(e.target.checked)} />
                    {value ? 'Enabled' : 'Disabled'}
                </label>
            )}
        </div>
    );
};

// ─── Collapsible array item editor ───────────────────────────────────────────
const ArrayItemEditor: React.FC<{
    item: Record<string, unknown>;
    index: number;
    onFieldChange: (field: string, value: any) => void;
    onRemove: () => void;
}> = ({ item, index, onFieldChange, onRemove }) => {
    const [open, setOpen] = useState(false);
    const preview = Object.values(item).filter(v => typeof v === 'string').slice(0, 2).join(' · ') || `Item ${index + 1}`;

    return (
        <div style={{ border: '1px solid var(--panel-border)', borderRadius: 6, overflow: 'hidden', background: 'rgba(255,255,255,0.02)' }}>
            <div
                onClick={() => setOpen(!open)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', cursor: 'pointer', fontSize: 11, color: 'var(--text-primary)', userSelect: 'none' }}
            >
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                    <span style={{ fontSize: 9, opacity: 0.5 }}>{open ? '▼' : '▶'}</span>
                    <span style={{ fontWeight: 600, flexShrink: 0 }}>#{index + 1}</span>
                    <span style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preview}</span>
                </span>
                <button onClick={e => { e.stopPropagation(); onRemove(); }}
                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 13, padding: '0 4px', lineHeight: 1 }}
                    title="Remove item">×</button>
            </div>
            {open && (
                <div style={{ padding: '6px 8px 10px', display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--panel-border)' }}>
                    {Object.entries(item).map(([field, val]) => (
                        <PrimitiveField key={field} label={field} value={val} onChange={v => onFieldChange(field, v)} />
                    ))}
                </div>
            )}
        </div>
    );
};

// ─── Array prop editor with add/remove ───────────────────────────────────────
const ArrayPropEditor: React.FC<{
    label: string;
    items: Record<string, unknown>[];
    defaultItem: Record<string, unknown>;
    onChange: (items: Record<string, unknown>[]) => void;
}> = ({ label, items, defaultItem, onChange }) => {
    const [collapsed, setCollapsed] = useState(true);

    const handleFieldChange = (index: number, field: string, value: any) => {
        const next = items.map((item, i) => i === index ? { ...item, [field]: value } : item);
        onChange(next);
    };

    const handleRemove = (index: number) => {
        onChange(items.filter((_, i) => i !== index));
    };

    const handleAdd = () => {
        onChange([...items, { ...defaultItem }]);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div onClick={() => setCollapsed(!collapsed)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}>
                <label style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'capitalize', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, opacity: 0.5 }}>{collapsed ? '▶' : '▼'}</span>
                    {label.replace(/([A-Z])/g, ' $1').trim()} ({items.length})
                </label>
            </div>
            {!collapsed && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 4 }}>
                    {items.map((item, i) => (
                        <ArrayItemEditor
                            key={i}
                            item={item}
                            index={i}
                            onFieldChange={(field, value) => handleFieldChange(i, field, value)}
                            onRemove={() => handleRemove(i)}
                        />
                    ))}
                    <button onClick={handleAdd}
                        style={{
                            background: 'rgba(255,255,255,0.05)', border: '1px dashed var(--panel-border)',
                            borderRadius: 6, padding: '5px 0', fontSize: 11, color: 'var(--text-muted)',
                            cursor: 'pointer', marginTop: 2,
                        }}>
                        + Add Item
                    </button>
                </div>
            )}
        </div>
    );
};

const TemplateProperties: React.FC<{ clip: any }> = ({ clip }) => {
    const { updateClip } = useEditor();
    const template = useMemo(() => clip.templateId ? getTemplateById(clip.templateId) : undefined, [clip.templateId]);

    if (!template) return <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Template not found</div>;

    const props = { ...template.defaultProps, ...(clip.content || {}) };

    const handleChange = (key: string, value: any) => {
        updateClip(clip.id, clip.trackId, {
            content: { ...clip.content, [key]: value }
        });
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12, borderTop: '1px solid var(--panel-border)', paddingTop: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>
                Template Options
            </div>
            {Object.entries(template.defaultProps).map(([key, defaultValue]) => {
                const value = props[key] ?? defaultValue;
                const type = typeof defaultValue;

                // Array of objects — render collapsible array editor
                if (Array.isArray(defaultValue) && defaultValue.length > 0 && typeof defaultValue[0] === 'object' && defaultValue[0] !== null) {
                    const currentItems = (Array.isArray(value) ? value : defaultValue) as Record<string, unknown>[];
                    const defaultItem = defaultValue[0] as Record<string, unknown>;
                    return (
                        <ArrayPropEditor
                            key={key}
                            label={key}
                            items={currentItems}
                            defaultItem={defaultItem}
                            onChange={items => handleChange(key, items)}
                        />
                    );
                }

                // Skip non-array objects
                if (type === 'object' && defaultValue !== null) return null;

                return (
                    <PrimitiveField
                        key={key}
                        label={key}
                        value={value}
                        onChange={v => handleChange(key, v)}
                    />
                );
            })}
        </div>
    );
};

// ─── Clip Properties Panel ──────────────────────────────────────────────────

const ClipProperties: React.FC = () => {
    const { selectedClipId, tracks, currentProject } = useEditor();

    if (!selectedClipId) {
        return (
            <div className="empty-state-small">
                <p>Select a clip to edit properties</p>
            </div>
        );
    }

    // Find the selected clip and its parent track
    let selectedClip: any = null;
    let parentTrack: any = null;
    for (const track of tracks) {
        const clip = track.clips.find(c => c.id === selectedClipId);
        if (clip) {
            selectedClip = clip;
            parentTrack = track;
            break;
        }
    }

    if (!selectedClip || !parentTrack) {
        return (
            <div className="empty-state-small">
                <p>Select a clip to edit properties</p>
            </div>
        );
    }

    const fps = currentProject?.fps || 30;
    const trackId = parentTrack.id as string;

    // Determine AI track badge
    const AI_BADGE: Record<string, { label: string; color: string }> = {
        'track-cuts-ai': { label: 'AI Cut', color: '#e74c3c' },
        'track-rawcuts': { label: 'Detected Cut', color: '#e74c3c' },
        'track-seams-ai': { label: 'Seam Warning', color: '#e67e22' },
        'track-chunks-ai': { label: 'Semantic Chunk', color: '#1abc9c' },
        'track-text-ai': { label: 'Text Overlay', color: '#f1c40f' },
        'track-overlay-ai': { label: 'AI Template', color: '#9b59b6' },
        'track-broll-ai': { label: 'B-Roll', color: '#3498db' },
    };
    const badge = AI_BADGE[trackId];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                Clip Inspector
                {badge && (
                    <span style={{
                        fontSize: 9, padding: '1px 6px', borderRadius: 3,
                        background: `${badge.color}22`, color: badge.color, border: `1px solid ${badge.color}44`,
                    }}>{badge.label}</span>
                )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr', gap: '6px 8px', fontSize: 11 }}>
                <span style={{ color: 'var(--text-muted)' }}>Name</span>
                <span style={{ color: 'var(--text-primary)', wordBreak: 'break-all' }}>{selectedClip.name || 'Unnamed'}</span>

                <span style={{ color: 'var(--text-muted)' }}>Track</span>
                <span style={{ color: 'var(--text-primary)' }}>{parentTrack.name}</span>

                <span style={{ color: 'var(--text-muted)' }}>Start</span>
                <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                    {selectedClip.start.toFixed(3)}s (frame {Math.round(selectedClip.start * fps)})
                </span>

                <span style={{ color: 'var(--text-muted)' }}>Duration</span>
                <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                    {selectedClip.duration.toFixed(3)}s ({Math.round(selectedClip.duration * fps)} frames)
                </span>

                <span style={{ color: 'var(--text-muted)' }}>End</span>
                <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                    {(selectedClip.start + selectedClip.duration).toFixed(3)}s
                </span>

                <span style={{ color: 'var(--text-muted)' }}>Offset</span>
                <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                    {selectedClip.offset.toFixed(3)}s
                </span>

                <span style={{ color: 'var(--text-muted)' }}>Type</span>
                <span style={{ color: 'var(--text-primary)' }}>{selectedClip.type}</span>

                {parentTrack.isLocked && <>
                    <span style={{ color: 'var(--text-muted)' }}>Status</span>
                    <span style={{ color: '#e67e22', fontSize: 10 }}>🔒 Locked (read-only)</span>
                </>}
            </div>

            {/* AI-specific content for text overlay clips */}
            {trackId === 'track-text-ai' && selectedClip.name && (
                <div style={{ marginTop: 6, padding: 8, borderRadius: 4, background: 'rgba(241,196,15,0.08)', border: '1px solid rgba(241,196,15,0.15)', fontSize: 11 }}>
                    <div style={{ fontWeight: 600, color: '#f1c40f', marginBottom: 4 }}>Overlay Text</div>
                    <div style={{ color: 'var(--text-primary)' }}>{selectedClip.name}</div>
                </div>
            )}

            {/* AI-specific content for B-roll clips */}
            {trackId === 'track-broll-ai' && (selectedClip as any).assetData && (
                <div style={{ marginTop: 6, padding: 8, borderRadius: 4, background: 'rgba(52,152,219,0.08)', border: '1px solid rgba(52,152,219,0.15)', fontSize: 11 }}>
                    <div style={{ fontWeight: 600, color: '#3498db', marginBottom: 4 }}>Asset Details</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '50px 1fr', gap: '3px 6px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Kind</span>
                        <span>{(selectedClip as any).assetData.kind}</span>
                        <span style={{ color: 'var(--text-muted)' }}>Query</span>
                        <span>{(selectedClip as any).assetData.query}</span>
                        <span style={{ color: 'var(--text-muted)' }}>Source</span>
                        <span>{(selectedClip as any).assetData.provider}</span>
                    </div>
                </div>
            )}

            {selectedClip.type === 'template' && (
                <TemplateProperties clip={selectedClip} />
            )}
        </div>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const PropertiesPanel: React.FC = () => {
    const [activeTab, setActiveTab] = useState('ai');
    const { pipelineStage, renderProgress } = useEditor();

    const renderAIContent = () => {
        switch (pipelineStage) {
            case 'idle':
                return <StageIdle />;
            case 'transcribing':
                return <StageProcessing label="Transcribing audio…" stageIcon="🎤" />;
            case 'transcript_ready':
                return <StageTranscriptReady />;
            case 'planning_cuts':
                return <StageProcessing label="Analyzing for cuts…" stageIcon="✂️" />;
            case 'cuts_ready':
                return <StageCutsReady />;
            case 'rough_cut_ready':
                return <StageRoughCutReady />;
            case 'overlaying_chunk':
                return <StageProcessing label="Planning overlays…" stageIcon="🎨" />;
            case 'enriching':
                return <StageProcessing label="Enriching with templates…" stageIcon="✨" />;
            case 'enrichment_ready':
                return <StageEnrichmentReady />;
            case 'chunk_review':
                return <StageChunkReview />;
            case 'rendering':
                return renderProgress
                    ? <ProgressBar percent={renderProgress.percent} stage={renderProgress.stage} />
                    : <Spinner label="Rendering final video… This may take several minutes." />;
            case 'done':
                return <StageDone />;
            case 'error':
                return <StageError />;
            default:
                return <StageIdle />;
        }
    };

    const aiTabLabel = () => {
        switch (pipelineStage) {
            case 'transcribing':
            case 'planning_cuts':
            case 'enriching':
            case 'overlaying_chunk':
            case 'rendering':
                return 'AI ⏳';
            case 'transcript_ready':
            case 'cuts_ready':
            case 'rough_cut_ready':
            case 'enrichment_ready':
            case 'chunk_review':
                return 'AI ✓';
            case 'done':
                return 'AI ✅';
            case 'error':
                return 'AI ❌';
            default:
                return 'AI';
        }
    };

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
                        {aiTabLabel()}
                    </button>
                    <button
                        className={`panel-tab ${activeTab === 'review' ? 'active' : ''}`}
                        onClick={() => setActiveTab('review')}
                    >
                        Review
                    </button>
                </div>
            </div>

            <div className="panel-content">
                {activeTab === 'properties' && (
                    <div className="tab-content active" style={{ padding: '12px' }}>
                        <ClipProperties />
                    </div>
                )}

                {activeTab === 'ai' && (
                    <div className="tab-content active" style={{ padding: '12px' }}>
                        {renderAIContent()}
                    </div>
                )}

                {activeTab === 'review' && (
                    <div className="tab-content active" style={{ padding: '12px' }}>
                        <ReviewDashboard />
                    </div>
                )}
            </div>
        </aside>
    );
};
