import React, { useState, useEffect, useMemo } from 'react';
import { useEditor } from '../../context/EditorContext';

// ── Types ────────────────────────────────────────────────────────────────────

interface QcCheck {
    check: string;
    status: 'pass' | 'warn' | 'fail';
    message: string;
    value?: number;
}

interface QualityReport {
    ok: boolean;
    overallStatus: string;
    summary: { pass: number; warn: number; fail: number; total: number };
    checks: QcCheck[];
}

interface CutSafetyReport {
    totalCuts: number;
    safeCuts: number;
    riskyCuts: number;
    downgradedCuts: number;
    avgSafetyScore: number;
    scoredCuts: { startUs: number; endUs: number; safetyScore: number; isRisky: boolean; safetyFlags: { type: string; message: string }[] }[];
}

interface ChunkQcReport {
    totalChunks: number;
    summary: { passed: number; failed: number; avgScore: number; passRate: number };
    scores: { chunkIndex: number; overall: number; passed: boolean; improvementHint: string | null; scores: Record<string, number> }[];
}

interface GlobalReport {
    hook: { score: number; suggestions: string[] };
    retentionRisks: { count: number; totalRiskSec: number; zones: { startUs: number; endUs: number; durationSec: number; severity: string; message: string }[] };
    overloadZones: { count: number };
    shortsCandidates: { count: number; candidates: { startUs: number; endUs: number; durationSec: number; preview: string }[] };
    ctaPlacements: { targetPercent: number; suggestion: string }[];
}

interface SeamQualityReport {
    seamCount: number;
    seams: { cutStartUs: number; cutEndUs: number; energyDeltaDb: number; recommendedFadeMs: number; seamQuality: string; flags: { type: string; severity: string; message: string }[] }[];
}

interface AssetQualityReport {
    totalAssets: number;
    summary: { pass: number; warn: number; fail: number; duplicates: number };
    validated: { assetId: string; kind: string; status: string; issues: string[]; resolution?: string }[];
}

interface SemanticChunksReport {
    stats: { totalChunks: number; avgChunkDurationSec: number; intentDistribution: Record<string, number>; validationFixes: number };
    validationFlags: { type: string; message: string }[];
}

interface TranscriptAnnotationReport {
    reliability: { overall: string; score: number; totalSegments: number; flaggedSegments: number; highRiskSegments: number; mediumRiskSegments: number; averageConfidence: number };
}

interface ReplanLogReport {
    replanned: number;
    iterations: number;
    maxIterations: number;
    log: { iteration: number; chunkIndex: number; scoreBefore: number; scoreAfter?: number; improved: boolean; hint: string }[];
}

interface CrossChunkReport {
    issueCount: number;
    severity: { high: number; medium: number; low: number };
    issues: { type: string; severity: string; message: string; suggestion?: string }[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatUs(us: number): string {
    const totalSec = us / 1_000_000;
    const mins = Math.floor(totalSec / 60);
    const secs = (totalSec % 60).toFixed(1);
    return `${mins}:${secs.padStart(4, '0')}`;
}

const STATUS_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
    pass: { bg: 'rgba(46,204,113,0.10)', text: '#2ecc71', icon: '✓' },
    warn: { bg: 'rgba(243,156,18,0.10)', text: '#f39c12', icon: '⚠' },
    fail: { bg: 'rgba(231,76,60,0.10)', text: '#e74c3c', icon: '✗' },
    unknown: { bg: 'rgba(127,140,141,0.10)', text: '#7f8c8d', icon: '?' },
};

const BACKEND = 'http://localhost:4343';

// ── Section Components ───────────────────────────────────────────────────────

const ScoreRing: React.FC<{ score: number; size?: number; label?: string }> = ({ score, size = 48, label }) => {
    const radius = (size - 6) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;
    const color = score >= 80 ? '#2ecc71' : score >= 60 ? '#f39c12' : '#e74c3c';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
                <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={3} />
                <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={3}
                    strokeDasharray={circumference} strokeDashoffset={offset}
                    strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                />
                <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central"
                    fill={color} fontSize={size * 0.28} fontWeight={700}
                    style={{ transform: 'rotate(90deg)', transformOrigin: 'center' }}
                >
                    {score}
                </text>
            </svg>
            {label && <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{label}</span>}
        </div>
    );
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
    const s = STATUS_COLORS[status] || STATUS_COLORS.unknown;
    return (
        <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
            background: s.bg, color: s.text, textTransform: 'uppercase',
        }}>
            {s.icon} {status}
        </span>
    );
};

const SectionHeader: React.FC<{ title: string; status?: string; expanded: boolean; onToggle: () => void }> = ({ title, status, expanded, onToggle }) => (
    <button
        onClick={onToggle}
        style={{
            display: 'flex', alignItems: 'center', gap: 8, width: '100%',
            background: 'none', border: 'none', cursor: 'pointer', padding: '8px 0',
            color: 'var(--text-primary)', fontSize: 12, fontWeight: 600, textAlign: 'left',
        }}
    >
        <span style={{ fontSize: 10, opacity: 0.5 }}>{expanded ? '▾' : '▸'}</span>
        <span style={{ flex: 1 }}>{title}</span>
        {status && <StatusBadge status={status} />}
    </button>
);

// ── Input Quality Section ────────────────────────────────────────────────────

const InputQualitySection: React.FC<{ report: QualityReport | null }> = ({ report }) => {
    const [expanded, setExpanded] = useState(false);
    if (!report) return null;

    return (
        <div style={{ borderBottom: '1px solid var(--panel-border)' }}>
            <SectionHeader title="🔍 Input Quality Gate" status={report.overallStatus} expanded={expanded} onToggle={() => setExpanded(v => !v)} />
            {expanded && (
                <div style={{ padding: '0 0 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', gap: 12, fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>
                        <span style={{ color: '#2ecc71' }}>✓ {report.summary.pass}</span>
                        <span style={{ color: '#f39c12' }}>⚠ {report.summary.warn}</span>
                        <span style={{ color: '#e74c3c' }}>✗ {report.summary.fail}</span>
                    </div>
                    {report.checks.map((c, i) => {
                        const s = STATUS_COLORS[c.status] || STATUS_COLORS.unknown;
                        return (
                            <div key={i} style={{ fontSize: 10, padding: '3px 6px', borderRadius: 3, background: s.bg, color: s.text }}>
                                {s.icon} <strong>{c.check}:</strong> {c.message}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// ── Cut Safety Section ───────────────────────────────────────────────────────

const CutSafetySection: React.FC<{ report: CutSafetyReport | null; seekTo: (sec: number) => void }> = ({ report, seekTo }) => {
    const [expanded, setExpanded] = useState(false);
    if (!report || report.totalCuts === 0) return null;

    const status = report.riskyCuts > 0 ? 'warn' : 'pass';

    return (
        <div style={{ borderBottom: '1px solid var(--panel-border)' }}>
            <SectionHeader title="✂️ Cut Safety" status={status} expanded={expanded} onToggle={() => setExpanded(v => !v)} />
            {expanded && (
                <div style={{ padding: '0 0 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', gap: 12, fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>
                        <span>{report.totalCuts} cuts</span>
                        <span style={{ color: '#2ecc71' }}>{report.safeCuts} safe</span>
                        <span style={{ color: '#f39c12' }}>{report.riskyCuts} risky</span>
                        <span>avg: {report.avgSafetyScore}</span>
                    </div>
                    {report.scoredCuts.filter(c => c.isRisky).map((c, i) => (
                        <div key={i}
                            onClick={() => seekTo(c.startUs / 1_000_000)}
                            style={{
                                fontSize: 10, padding: '4px 6px', borderRadius: 3, cursor: 'pointer',
                                background: 'rgba(231,76,60,0.08)', border: '1px solid rgba(231,76,60,0.20)',
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                                <span style={{ color: '#e74c3c', fontWeight: 600 }}>
                                    {formatUs(c.startUs)} → {formatUs(c.endUs)}
                                </span>
                                <span style={{ color: '#e74c3c' }}>Score: {c.safetyScore}</span>
                            </div>
                            {c.safetyFlags.map((f, fi) => (
                                <div key={fi} style={{ color: 'var(--text-muted)', fontSize: 9 }}>• {f.message}</div>
                            ))}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ── Seam Quality Section ──────────────────────────────────────────────────────

const SeamQualitySection: React.FC<{ report: SeamQualityReport | null; seekTo: (sec: number) => void }> = ({ report, seekTo }) => {
    const [expanded, setExpanded] = useState(false);
    if (!report || report.seamCount === 0) return null;

    const poor = report.seams.filter(s => s.seamQuality === 'poor').length;
    const status = poor > 0 ? 'warn' : 'pass';

    return (
        <div style={{ borderBottom: '1px solid var(--panel-border)' }}>
            <SectionHeader title="🎵 Seam Quality" status={status} expanded={expanded} onToggle={() => setExpanded(v => !v)} />
            {expanded && (
                <div style={{ padding: '0 0 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', gap: 12, fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>
                        <span>{report.seamCount} seams</span>
                        <span style={{ color: '#2ecc71' }}>{report.seams.filter(s => s.seamQuality === 'good').length} good</span>
                        <span style={{ color: '#f39c12' }}>{report.seams.filter(s => s.seamQuality === 'fair').length} fair</span>
                        {poor > 0 && <span style={{ color: '#e74c3c' }}>{poor} poor</span>}
                    </div>
                    {report.seams.filter(s => s.seamQuality !== 'good').map((s, i) => (
                        <div key={i}
                            onClick={() => seekTo(s.cutStartUs / 1_000_000)}
                            style={{
                                fontSize: 10, padding: '4px 6px', borderRadius: 3, cursor: 'pointer',
                                background: s.seamQuality === 'poor' ? 'rgba(231,76,60,0.08)' : 'rgba(243,156,18,0.08)',
                                border: `1px solid ${s.seamQuality === 'poor' ? 'rgba(231,76,60,0.20)' : 'rgba(243,156,18,0.15)'}`,
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                                <span style={{ fontWeight: 600 }}>{formatUs(s.cutStartUs)} → {formatUs(s.cutEndUs)}</span>
                                <span style={{ fontSize: 9 }}>Δ{s.energyDeltaDb}dB • fade {s.recommendedFadeMs}ms</span>
                            </div>
                            {s.flags.map((f, fi) => (
                                <div key={fi} style={{ color: 'var(--text-muted)', fontSize: 9 }}>• {f.message}</div>
                            ))}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ── Chunk QC Section ─────────────────────────────────────────────────────────

const ChunkQcSection: React.FC<{ report: ChunkQcReport | null; projectId: string | undefined }> = ({ report, projectId }) => {
    const [expanded, setExpanded] = useState(false);
    const [showAll, setShowAll] = useState(false);
    const [chunkDecisions, setChunkDecisions] = useState<Record<number, 'approved' | 'rejected'>>({});

    // Load persisted decisions on mount
    useEffect(() => {
        if (!projectId) return;
        fetch(`${BACKEND}/project-data/${projectId}/chunk_review_decisions.json`)
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (data?.decisions) setChunkDecisions(data.decisions);
            })
            .catch(() => { /* no saved decisions */ });
    }, [projectId]);

    if (!report || report.totalChunks === 0) return null;

    const status = report.summary.passRate >= 80 ? 'pass' : report.summary.passRate >= 50 ? 'warn' : 'fail';

    const visibleScores = showAll ? report.scores : report.scores.filter(s => !s.passed);

    const handleChunkDecision = (chunkIndex: number, decision: 'approved' | 'rejected') => {
        const updated = { ...chunkDecisions, [chunkIndex]: decision };
        setChunkDecisions(updated);

        // Persist to backend
        if (projectId) {
            fetch(`${BACKEND}/project-data/${projectId}/chunk_review_decisions.json`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ decisions: updated, updatedAt: new Date().toISOString() }),
            }).catch(() => { /* non-critical */ });
        }
    };

    const approvedCount = Object.values(chunkDecisions).filter(d => d === 'approved').length;
    const rejectedCount = Object.values(chunkDecisions).filter(d => d === 'rejected').length;

    return (
        <div style={{ borderBottom: '1px solid var(--panel-border)' }}>
            <SectionHeader title="📊 Chunk Edit Quality" status={status} expanded={expanded} onToggle={() => setExpanded(v => !v)} />
            {expanded && (
                <div style={{ padding: '0 0 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <ScoreRing score={report.summary.avgScore} label="Avg Score" />
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span>{report.summary.passed}/{report.totalChunks} passed ({report.summary.passRate}%)</span>
                            {report.summary.failed > 0 && (
                                <span style={{ color: '#e74c3c' }}>{report.summary.failed} chunks need improvement</span>
                            )}
                            {(approvedCount > 0 || rejectedCount > 0) && (
                                <span style={{ color: '#3498db' }}>
                                    Reviewed: {approvedCount} approved, {rejectedCount} rejected
                                </span>
                            )}
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 6, marginBottom: 2 }}>
                        <button
                            onClick={() => setShowAll(v => !v)}
                            style={{
                                fontSize: 9, padding: '2px 8px', borderRadius: 3, cursor: 'pointer',
                                background: 'var(--bg-secondary)', border: '1px solid var(--panel-border)', color: 'var(--text-muted)',
                            }}
                        >
                            {showAll ? `Show Failed (${report.summary.failed})` : `Show All (${report.totalChunks})`}
                        </button>
                    </div>

                    {visibleScores.map((s, i) => {
                        const decision = chunkDecisions[s.chunkIndex];
                        return (
                            <div key={i} style={{
                                fontSize: 10, padding: '5px 6px', borderRadius: 3,
                                background: decision === 'approved' ? 'rgba(46,204,113,0.08)'
                                    : decision === 'rejected' ? 'rgba(231,76,60,0.08)'
                                    : s.passed ? 'rgba(46,204,113,0.05)' : 'rgba(243,156,18,0.08)',
                                border: `1px solid ${decision === 'approved' ? 'rgba(46,204,113,0.25)'
                                    : decision === 'rejected' ? 'rgba(231,76,60,0.25)'
                                    : s.passed ? 'rgba(46,204,113,0.12)' : 'rgba(243,156,18,0.15)'}`,
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontWeight: 600 }}>Chunk {s.chunkIndex}</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <span style={{ color: s.passed ? '#2ecc71' : '#f39c12', marginRight: 4 }}>{s.overall}/100</span>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleChunkDecision(s.chunkIndex, 'approved'); }}
                                            title="Approve this chunk"
                                            style={{
                                                fontSize: 10, padding: '1px 5px', borderRadius: 3, cursor: 'pointer',
                                                background: decision === 'approved' ? '#2ecc71' : 'transparent',
                                                border: '1px solid rgba(46,204,113,0.4)',
                                                color: decision === 'approved' ? '#fff' : '#2ecc71',
                                            }}
                                        >✓</button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleChunkDecision(s.chunkIndex, 'rejected'); }}
                                            title="Reject this chunk"
                                            style={{
                                                fontSize: 10, padding: '1px 5px', borderRadius: 3, cursor: 'pointer',
                                                background: decision === 'rejected' ? '#e74c3c' : 'transparent',
                                                border: '1px solid rgba(231,76,60,0.4)',
                                                color: decision === 'rejected' ? '#fff' : '#e74c3c',
                                            }}
                                        >✗</button>
                                    </div>
                                </div>
                                {s.improvementHint && !s.passed && (
                                    <div style={{ color: 'var(--text-muted)', fontSize: 9, marginTop: 1 }}>💡 {s.improvementHint}</div>
                                )}
                                <div style={{ display: 'flex', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
                                    {Object.entries(s.scores).map(([k, v]) => (
                                        <span key={k} style={{
                                            fontSize: 8, padding: '1px 4px', borderRadius: 2,
                                            background: (v as number) >= 70 ? 'rgba(46,204,113,0.15)' : 'rgba(231,76,60,0.15)',
                                            color: (v as number) >= 70 ? '#2ecc71' : '#e74c3c',
                                        }}>
                                            {k}: {v as number}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// ── Global Analysis Section ──────────────────────────────────────────────────

const GlobalAnalysisSection: React.FC<{ report: GlobalReport | null }> = ({ report }) => {
    const [expanded, setExpanded] = useState(false);
    if (!report) return null;

    return (
        <div style={{ borderBottom: '1px solid var(--panel-border)' }}>
            <SectionHeader title="🌍 Global Intelligence" status={report.hook.score >= 70 ? 'pass' : 'warn'} expanded={expanded} onToggle={() => setExpanded(v => !v)} />
            {expanded && (
                <div style={{ padding: '0 0 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {/* Hook Score */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <ScoreRing score={report.hook.score} label="Hook" />
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {report.hook.suggestions.map((s, i) => (
                                <span key={i}>💡 {s}</span>
                            ))}
                        </div>
                    </div>

                    {/* Retention Risks */}
                    {report.retentionRisks.count > 0 && (
                        <div style={{ fontSize: 10 }}>
                            <div style={{ fontWeight: 600, color: '#f39c12', marginBottom: 3 }}>
                                ⚠ {report.retentionRisks.count} Retention Risk Zones ({report.retentionRisks.totalRiskSec}s)
                            </div>
                            {report.retentionRisks.zones.slice(0, 5).map((z, i) => (
                                <div key={i} style={{ color: 'var(--text-muted)', fontSize: 9, marginLeft: 8 }}>
                                    • {formatUs(z.startUs)}–{formatUs(z.endUs)}: {z.message}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* CTA Placements */}
                    {report.ctaPlacements.length > 0 && (
                        <div style={{ fontSize: 10 }}>
                            <div style={{ fontWeight: 600, color: '#3498db', marginBottom: 3 }}>📢 CTA Placement Suggestions</div>
                            {report.ctaPlacements.map((p, i) => (
                                <div key={i} style={{ color: 'var(--text-muted)', fontSize: 9, marginLeft: 8 }}>
                                    • {p.targetPercent}%: {p.suggestion}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Shorts Candidates */}
                    {report.shortsCandidates.count > 0 && (
                        <div style={{ fontSize: 10 }}>
                            <div style={{ fontWeight: 600, color: '#9b59b6', marginBottom: 3 }}>🎬 {report.shortsCandidates.count} Shorts Candidates</div>
                            {report.shortsCandidates.candidates.slice(0, 3).map((c, i) => (
                                <div key={i} style={{ color: 'var(--text-muted)', fontSize: 9, marginLeft: 8 }}>
                                    • {formatUs(c.startUs)}–{formatUs(c.endUs)} ({c.durationSec}s): {c.preview}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ── Cross-Chunk Section ──────────────────────────────────────────────────────

const CrossChunkSection: React.FC<{ report: CrossChunkReport | null }> = ({ report }) => {
    const [expanded, setExpanded] = useState(false);
    if (!report || report.issueCount === 0) return null;

    const status = report.severity.high > 0 ? 'fail' : report.severity.medium > 0 ? 'warn' : 'pass';

    return (
        <div style={{ borderBottom: '1px solid var(--panel-border)' }}>
            <SectionHeader title="🔗 Cross-Chunk Consistency" status={status} expanded={expanded} onToggle={() => setExpanded(v => !v)} />
            {expanded && (
                <div style={{ padding: '0 0 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', gap: 12, fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>
                        <span>{report.issueCount} issues</span>
                        {report.severity.high > 0 && <span style={{ color: '#e74c3c' }}>{report.severity.high} high</span>}
                        {report.severity.medium > 0 && <span style={{ color: '#f39c12' }}>{report.severity.medium} medium</span>}
                    </div>
                    {report.issues.map((issue, i) => {
                        const s = STATUS_COLORS[issue.severity === 'high' ? 'fail' : issue.severity === 'medium' ? 'warn' : 'pass'];
                        return (
                            <div key={i} style={{ fontSize: 10, padding: '3px 6px', borderRadius: 3, background: s.bg }}>
                                <div style={{ color: s.text, fontWeight: 600 }}>{issue.type.replace(/_/g, ' ')}</div>
                                <div style={{ color: 'var(--text-muted)', fontSize: 9 }}>{issue.message}</div>
                                {issue.suggestion && (
                                    <div style={{ color: '#3498db', fontSize: 9, marginTop: 1 }}>💡 {issue.suggestion}</div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// ── Transcript Annotation Section ────────────────────────────────────────────

const TranscriptAnnotationSection: React.FC<{ report: TranscriptAnnotationReport | null }> = ({ report }) => {
    const [expanded, setExpanded] = useState(false);
    if (!report?.reliability) return null;

    const r = report.reliability;
    const status = r.overall === 'good' ? 'pass' : r.overall === 'fair' ? 'warn' : 'fail';

    return (
        <div style={{ borderBottom: '1px solid var(--panel-border)' }}>
            <SectionHeader title="📝 Transcript Quality" status={status} expanded={expanded} onToggle={() => setExpanded(v => !v)} />
            {expanded && (
                <div style={{ padding: '0 0 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', gap: 12, fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>
                        <span>Score: {r.score}/100</span>
                        <span>Confidence: {r.averageConfidence}</span>
                        <span>{r.flaggedSegments}/{r.totalSegments} flagged</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, fontSize: 10 }}>
                        {r.highRiskSegments > 0 && <span style={{ color: '#e74c3c', padding: '2px 6px', borderRadius: 3, background: 'rgba(231,76,60,0.08)' }}>{r.highRiskSegments} high-risk</span>}
                        {r.mediumRiskSegments > 0 && <span style={{ color: '#f39c12', padding: '2px 6px', borderRadius: 3, background: 'rgba(243,156,18,0.08)' }}>{r.mediumRiskSegments} medium-risk</span>}
                    </div>
                </div>
            )}
        </div>
    );
};

// ── Replan Log Section ─────────────────────────────────────────────────────

const ReplanLogSection: React.FC<{ report: ReplanLogReport | null }> = ({ report }) => {
    const [expanded, setExpanded] = useState(false);
    if (!report || report.replanned === 0) return null;

    const allImproved = report.log.every(l => l.improved);
    const status = allImproved ? 'pass' : 'warn';

    return (
        <div style={{ borderBottom: '1px solid var(--panel-border)' }}>
            <SectionHeader title="🔄 QC Re-Plan Log" status={status} expanded={expanded} onToggle={() => setExpanded(v => !v)} />
            {expanded && (
                <div style={{ padding: '0 0 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', gap: 12, fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>
                        <span>{report.replanned} chunks re-planned</span>
                        <span>{report.iterations}/{report.maxIterations} iterations</span>
                    </div>
                    {report.log.map((l, i) => (
                        <div key={i} style={{
                            fontSize: 10, padding: '3px 6px', borderRadius: 3,
                            background: l.improved ? 'rgba(46,204,113,0.08)' : 'rgba(243,156,18,0.08)',
                            color: l.improved ? '#2ecc71' : '#f39c12',
                        }}>
                            <strong>Chunk {l.chunkIndex}:</strong> {l.scoreBefore} → {l.scoreAfter ?? '?'} {l.improved ? '✓' : '✗'}
                            <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{l.hint}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ── Asset Quality Section ────────────────────────────────────────────────────

const AssetQualitySection: React.FC<{ report: AssetQualityReport | null }> = ({ report }) => {
    const [expanded, setExpanded] = useState(false);
    if (!report || report.totalAssets === 0) return null;

    const status = report.summary.fail > 0 ? 'warn' : 'pass';

    return (
        <div style={{ borderBottom: '1px solid var(--panel-border)' }}>
            <SectionHeader title="🖼️ Asset Quality" status={status} expanded={expanded} onToggle={() => setExpanded(v => !v)} />
            {expanded && (
                <div style={{ padding: '0 0 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', gap: 12, fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>
                        <span>{report.totalAssets} assets</span>
                        <span style={{ color: '#2ecc71' }}>✓ {report.summary.pass}</span>
                        <span style={{ color: '#f39c12' }}>⚠ {report.summary.warn}</span>
                        <span style={{ color: '#e74c3c' }}>✗ {report.summary.fail}</span>
                        {report.summary.duplicates > 0 && <span style={{ color: '#e67e22' }}>⚇ {report.summary.duplicates} dupes</span>}
                    </div>
                    {report.validated.filter(a => a.status !== 'pass').map((a, i) => {
                        const s = STATUS_COLORS[a.status] || STATUS_COLORS.unknown;
                        return (
                            <div key={i} style={{ fontSize: 10, padding: '3px 6px', borderRadius: 3, background: s.bg, color: s.text }}>
                                {s.icon} <strong>{a.kind}:</strong> {a.issues.join(', ')}
                                {a.resolution && <span style={{ color: 'var(--text-muted)', fontSize: 9 }}> — {a.resolution}</span>}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// ── Semantic Chunks Section ──────────────────────────────────────────────────

const SemanticChunksSection: React.FC<{ report: SemanticChunksReport | null }> = ({ report }) => {
    const [expanded, setExpanded] = useState(false);
    if (!report?.stats) return null;

    const { stats, validationFlags } = report;
    const status = validationFlags.length > 0 ? 'warn' : 'pass';

    return (
        <div style={{ borderBottom: '1px solid var(--panel-border)' }}>
            <SectionHeader title="🧩 Semantic Chunks" status={status} expanded={expanded} onToggle={() => setExpanded(v => !v)} />
            {expanded && (
                <div style={{ padding: '0 0 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', gap: 12, fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>
                        <span>{stats.totalChunks} chunks</span>
                        <span>avg {stats.avgChunkDurationSec}s</span>
                        {stats.validationFixes > 0 && <span style={{ color: '#f39c12' }}>{stats.validationFixes} fixes</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 10, marginBottom: 4 }}>
                        {Object.entries(stats.intentDistribution).map(([intent, count]) => (
                            <span key={intent} style={{
                                padding: '2px 6px', borderRadius: 3,
                                background: 'rgba(74,158,255,0.10)', color: 'var(--text-secondary)',
                            }}>
                                {intent}: {count as number}
                            </span>
                        ))}
                    </div>
                    {validationFlags.map((f, i) => (
                        <div key={i} style={{ fontSize: 10, padding: '3px 6px', borderRadius: 3, background: 'rgba(243,156,18,0.08)', color: '#f39c12' }}>
                            ⚠ {f.message}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ── Pre-Render QA Section ────────────────────────────────────────────────────

const PreRenderQaSection: React.FC<{ report: QualityReport | null }> = ({ report }) => {
    const [expanded, setExpanded] = useState(false);
    if (!report) return null;

    return (
        <div style={{ borderBottom: '1px solid var(--panel-border)' }}>
            <SectionHeader title="🛡️ Pre-Render QA" status={report.overallStatus} expanded={expanded} onToggle={() => setExpanded(v => !v)} />
            {expanded && (
                <div style={{ padding: '0 0 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', gap: 12, fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>
                        <span style={{ color: '#2ecc71' }}>✓ {report.summary.pass}</span>
                        <span style={{ color: '#f39c12' }}>⚠ {report.summary.warn}</span>
                        <span style={{ color: '#e74c3c' }}>✗ {report.summary.fail}</span>
                    </div>
                    {report.checks.map((c, i) => {
                        const s = STATUS_COLORS[c.status] || STATUS_COLORS.unknown;
                        return (
                            <div key={i} style={{ fontSize: 10, padding: '3px 6px', borderRadius: 3, background: s.bg, color: s.text }}>
                                {s.icon} <strong>{c.check}:</strong> {c.message}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// ── Before / After Comparison ─────────────────────────────────────────────

const BeforeAfterSection: React.FC<{
    cutSafety: CutSafetyReport | null;
    chunkQc: ChunkQcReport | null;
    seamQuality: SeamQualityReport | null;
    assetQuality: AssetQualityReport | null;
    semanticChunks: SemanticChunksReport | null;
    globalAnalysis: GlobalReport | null;
}> = ({ cutSafety, chunkQc, seamQuality, assetQuality, semanticChunks, globalAnalysis }) => {
    const [expanded, setExpanded] = useState(true);

    const stats = useMemo(() => {
        const cutsRemoved = cutSafety?.totalCuts ?? 0;
        const cutDurationSec = cutSafety?.scoredCuts?.reduce((sum, c) => sum + (c.endUs - c.startUs) / 1_000_000, 0) ?? 0;
        const chunksTotal = chunkQc?.totalChunks ?? semanticChunks?.stats?.totalChunks ?? 0;
        const chunksPassed = chunkQc?.summary?.passed ?? 0;
        const avgChunkScore = chunkQc?.summary?.avgScore ?? 0;
        const seamGood = seamQuality?.seams?.filter(s => s.seamQuality === 'good').length ?? 0;
        const seamFair = seamQuality?.seams?.filter(s => s.seamQuality === 'fair').length ?? 0;
        const seamPoor = seamQuality?.seams?.filter(s => s.seamQuality === 'poor').length ?? 0;
        const assetsAdded = assetQuality?.totalAssets ?? 0;
        const hookScore = globalAnalysis?.hook?.score ?? null;
        const riskZones = globalAnalysis?.retentionRisks?.count ?? 0;
        const shortsFound = globalAnalysis?.shortsCandidates?.count ?? 0;
        return { cutsRemoved, cutDurationSec, chunksTotal, chunksPassed, avgChunkScore, seamGood, seamFair, seamPoor, assetsAdded, hookScore, riskZones, shortsFound };
    }, [cutSafety, chunkQc, seamQuality, assetQuality, semanticChunks, globalAnalysis]);

    if (!cutSafety && !chunkQc && !seamQuality) return null;

    const StatRow: React.FC<{ label: string; before: string; after: string; improved?: boolean }> = ({ label, before, after, improved }) => (
        <div style={{ display: 'flex', fontSize: 10, padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <span style={{ flex: 1, color: 'var(--text-muted)' }}>{label}</span>
            <span style={{ width: 70, textAlign: 'right', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{before}</span>
            <span style={{ width: 16, textAlign: 'center', color: '#555' }}>→</span>
            <span style={{ width: 70, textAlign: 'right', fontFamily: 'monospace', color: improved === undefined ? 'var(--text-secondary)' : improved ? '#2ecc71' : '#f39c12' }}>{after}</span>
        </div>
    );

    return (
        <div style={{ borderBottom: '1px solid var(--panel-border)' }}>
            <SectionHeader title="📊 Before / After" expanded={expanded} onToggle={() => setExpanded(v => !v)} />
            {expanded && (
                <div style={{ padding: '0 0 10px' }}>
                    <div style={{ display: 'flex', fontSize: 9, padding: '0 0 4px', color: 'var(--text-muted)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <span style={{ flex: 1 }}>Metric</span>
                        <span style={{ width: 70, textAlign: 'right' }}>Before</span>
                        <span style={{ width: 16 }} />
                        <span style={{ width: 70, textAlign: 'right' }}>After</span>
                    </div>
                    {stats.cutsRemoved > 0 && <StatRow label="Cuts applied" before="0" after={String(stats.cutsRemoved)} />}
                    {stats.cutDurationSec > 0 && <StatRow label="Time removed" before="0s" after={`${stats.cutDurationSec.toFixed(1)}s`} improved />}
                    {stats.chunksTotal > 0 && <StatRow label="Chunks analysed" before="—" after={String(stats.chunksTotal)} />}
                    {stats.chunksPassed > 0 && (
                        <StatRow label="Chunk pass rate" before="—"
                            after={`${stats.chunksPassed}/${stats.chunksTotal} (${Math.round(stats.chunksPassed / Math.max(1, stats.chunksTotal) * 100)}%)`}
                            improved={stats.avgChunkScore >= 70} />
                    )}
                    {(stats.seamGood + stats.seamFair + stats.seamPoor > 0) && (
                        <StatRow label="Seam quality" before="—" after={`${stats.seamGood}g / ${stats.seamFair}f / ${stats.seamPoor}p`} improved={stats.seamPoor === 0} />
                    )}
                    {stats.assetsAdded > 0 && <StatRow label="Assets added" before="0" after={String(stats.assetsAdded)} improved />}
                    {stats.hookScore !== null && <StatRow label="Hook strength" before="—" after={`${stats.hookScore}/100`} improved={stats.hookScore >= 70} />}
                    {stats.riskZones > 0 && <StatRow label="Retention risks" before="unknown" after={`${stats.riskZones} zones`} improved={stats.riskZones <= 2} />}
                    {stats.shortsFound > 0 && <StatRow label="Shorts candidates" before="0" after={String(stats.shortsFound)} improved />}
                </div>
            )}
        </div>
    );
};

// ── Main Dashboard ───────────────────────────────────────────────────────

export const ReviewDashboard: React.FC = () => {
    const { currentProject, seekTo, agenticProgress } = useEditor();

    const [inputQuality, setInputQuality] = useState<QualityReport | null>(null);
    const [cutSafety, setCutSafety] = useState<CutSafetyReport | null>(null);
    const [chunkQc, setChunkQc] = useState<ChunkQcReport | null>(null);
    const [globalAnalysis, setGlobalAnalysis] = useState<GlobalReport | null>(null);
    const [crossChunk, setCrossChunk] = useState<CrossChunkReport | null>(null);
    const [seamQuality, setSeamQuality] = useState<SeamQualityReport | null>(null);
    const [assetQuality, setAssetQuality] = useState<AssetQualityReport | null>(null);
    const [semanticChunks, setSemanticChunks] = useState<SemanticChunksReport | null>(null);
    const [transcriptAnnotation, setTranscriptAnnotation] = useState<TranscriptAnnotationReport | null>(null);
    const [replanLog, setReplanLog] = useState<ReplanLogReport | null>(null);
    const [preRenderQa, setPreRenderQa] = useState<QualityReport | null>(null);
    const [loading, setLoading] = useState(false);

    const projectId = currentProject?.id;

    // Load reports when pipeline completes
    useEffect(() => {
        if (!projectId) return;
        if (agenticProgress?.status !== 'done' && agenticProgress?.currentStep !== 'complete') return;

        setLoading(true);
        const base = `${BACKEND}/project-data/${projectId}`;

        Promise.allSettled([
            fetch(`${base}/input_quality_report.json`).then(r => r.ok ? r.json() : null),
            fetch(`${base}/cut_safety_report.json`).then(r => r.ok ? r.json() : null),
            fetch(`${base}/chunk_qc_report.json`).then(r => r.ok ? r.json() : null),
            fetch(`${base}/global_analysis.json`).then(r => r.ok ? r.json() : null),
            fetch(`${base}/cross_chunk_report.json`).then(r => r.ok ? r.json() : null),
            fetch(`${base}/pre_render_qa_report.json`).then(r => r.ok ? r.json() : null),
            fetch(`${base}/seam_quality_report.json`).then(r => r.ok ? r.json() : null),
            fetch(`${base}/asset_quality_report.json`).then(r => r.ok ? r.json() : null),
            fetch(`${base}/semantic_chunks.json`).then(r => r.ok ? r.json() : null),
            fetch(`${base}/transcript_annotated.json`).then(r => r.ok ? r.json() : null),
            fetch(`${base}/chunk_replan_log.json`).then(r => r.ok ? r.json() : null),
        ]).then(([iq, cs, cq, ga, cc, pq, sq, aq, sc, ta, rl]) => {
            if (iq.status === 'fulfilled') setInputQuality(iq.value);
            if (cs.status === 'fulfilled') setCutSafety(cs.value);
            if (cq.status === 'fulfilled') setChunkQc(cq.value);
            if (ga.status === 'fulfilled') setGlobalAnalysis(ga.value);
            if (cc.status === 'fulfilled') setCrossChunk(cc.value);
            if (pq.status === 'fulfilled') setPreRenderQa(pq.value);
            if (sq.status === 'fulfilled') setSeamQuality(sq.value);
            if (aq.status === 'fulfilled') setAssetQuality(aq.value);
            if (sc.status === 'fulfilled') setSemanticChunks(sc.value);
            if (ta.status === 'fulfilled') setTranscriptAnnotation(ta.value);
            if (rl.status === 'fulfilled') setReplanLog(rl.value);
        }).finally(() => setLoading(false));
    }, [projectId, agenticProgress?.status, agenticProgress?.currentStep]);

    // Compute overall health score
    const overallScore = useMemo(() => {
        const scores: number[] = [];
        if (chunkQc?.summary?.avgScore) scores.push(chunkQc.summary.avgScore);
        if (globalAnalysis?.hook?.score) scores.push(globalAnalysis.hook.score);
        if (cutSafety?.avgSafetyScore) scores.push(Math.round(cutSafety.avgSafetyScore * 100));
        if (seamQuality && seamQuality.seamCount > 0) {
            const good = seamQuality.seams.filter(s => s.seamQuality === 'good').length;
            const fair = seamQuality.seams.filter(s => s.seamQuality === 'fair').length;
            const poor = seamQuality.seams.filter(s => s.seamQuality === 'poor').length;
            const seamScore = Math.round((good * 100 + fair * 70 + poor * 30) / seamQuality.seamCount);
            scores.push(seamScore);
        }
        if (transcriptAnnotation?.reliability?.score) scores.push(transcriptAnnotation.reliability.score);
        if (scores.length === 0) return null;
        return Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
    }, [chunkQc, globalAnalysis, cutSafety, seamQuality, transcriptAnnotation]);

    const hasAnyReport = inputQuality || cutSafety || chunkQc || globalAnalysis || crossChunk || preRenderQa || seamQuality || assetQuality || semanticChunks || transcriptAnnotation || replanLog;

    if (!hasAnyReport && !loading) {
        return (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 11 }}>
                Review reports will appear here after the AI pipeline completes.
            </div>
        );
    }

    if (loading) {
        return (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 11 }}>
                <div className="spinner-small" style={{ width: 20, height: 20, borderWidth: 2, margin: '0 auto 8px' }} />
                Loading review reports…
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: '8px 0' }}>
            {/* Overall Health */}
            {overallScore !== null && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', marginBottom: 8,
                    background: 'rgba(52,152,219,0.06)', borderRadius: 6, border: '1px solid rgba(52,152,219,0.15)',
                }}>
                    <ScoreRing score={overallScore} size={56} label="Overall" />
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                            Pipeline Health
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                            {overallScore >= 80 ? 'Great quality — ready to render' :
                             overallScore >= 60 ? 'Acceptable — review warnings below' :
                             'Needs attention — review issues below'}
                        </div>
                    </div>
                </div>
            )}

            <BeforeAfterSection cutSafety={cutSafety} chunkQc={chunkQc} seamQuality={seamQuality} assetQuality={assetQuality} semanticChunks={semanticChunks} globalAnalysis={globalAnalysis} />
            <InputQualitySection report={inputQuality} />
            <TranscriptAnnotationSection report={transcriptAnnotation} />
            <SemanticChunksSection report={semanticChunks} />
            <CutSafetySection report={cutSafety} seekTo={seekTo} />
            <SeamQualitySection report={seamQuality} seekTo={seekTo} />
            <AssetQualitySection report={assetQuality} />
            <ChunkQcSection report={chunkQc} projectId={projectId} />
            <ReplanLogSection report={replanLog} />
            <CrossChunkSection report={crossChunk} />
            <GlobalAnalysisSection report={globalAnalysis} />
            <PreRenderQaSection report={preRenderQa} />
        </div>
    );
};
