import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const templatesDir = path.join(rootDir, 'src', 'templates');

const args = process.argv.slice(2);
const outputJson = args.includes('--json');

function parseNumericValues(raw) {
  const values = [];
  if (!raw) return values;
  const matches = raw.match(/(?<![A-Za-z_])-?\d+(?:\.\d+)?(?![A-Za-z_])/g) || [];
  for (const match of matches) {
    const value = Number(match);
    if (Number.isFinite(value)) {
      values.push(value);
    }
  }
  return values;
}

function parseConstNumericMap(content) {
  const constants = new Map();
  for (const match of content.matchAll(/const\s+([A-Za-z_$][\w$]*)\s*=\s*([^;]+);/g)) {
    const name = String(match[1] || '').trim();
    const expression = String(match[2] || '');
    if (!name || !expression) continue;
    const numericValues = parseNumericValues(expression);
    if (numericValues.length > 0) {
      constants.set(name, numericValues);
    }
  }
  return constants;
}

function resolveExpressionNumericValues(expression, constNumericMap) {
  const values = [];
  const direct = parseNumericValues(expression);
  values.push(...direct);

  const identifiers = expression.match(/\b[A-Za-z_$][\w$]*\b/g) || [];
  for (const identifier of identifiers) {
    const mapped = constNumericMap.get(identifier);
    if (!mapped) continue;
    values.push(...mapped);
  }

  return [...new Set(values)];
}

function extractFontSizes(content, constNumericMap) {
  const values = [];

  for (const match of content.matchAll(/fontSize\s*:\s*([^,\n}]+)/g)) {
    const parsed = resolveExpressionNumericValues(match[1], constNumericMap).filter((value) => value >= 2);
    values.push(...parsed);
  }

  for (const match of content.matchAll(/fontSize\s*=\s*{([^}]+)}/g)) {
    const parsed = resolveExpressionNumericValues(match[1], constNumericMap).filter((value) => value >= 2);
    values.push(...parsed);
  }

  for (const match of content.matchAll(/fontSize\s*=\s*['\"]([^'\"]+)['\"]/g)) {
    const parsed = resolveExpressionNumericValues(match[1], constNumericMap).filter((value) => value >= 2);
    values.push(...parsed);
  }

  return values;
}

async function listTemplateFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listTemplateFiles(fullPath)));
      continue;
    }
    if (entry.isFile() && fullPath.endsWith('.tsx')) {
      files.push(fullPath);
    }
  }
  return files;
}

function computeMinMax(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return { min: null, max: null, avg: null };
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  return { min, max, avg };
}

function analyzeTemplate(relativePath, content) {
  const constNumericMap = parseConstNumericMap(content);
  const fontSizes = extractFontSizes(content, constNumericMap);
  const paddingValues = [];

  for (const match of content.matchAll(/padding(?:Top|Right|Bottom|Left|Inline|Block)?\s*:\s*([^,\n}]+)/g)) {
    paddingValues.push(...resolveExpressionNumericValues(match[1], constNumericMap));
  }

  const textAlignCenterCount = (content.match(/textAlign\s*:\s*['\"]center['\"]/g) || []).length;
  const textAlignLeftCount = (content.match(/textAlign\s*:\s*['\"]left['\"]/g) || []).length;
  const justifyCenterCount = (content.match(/justifyContent\s*:\s*['\"]center['\"]/g) || []).length;
  const alignCenterCount = (content.match(/alignItems\s*:\s*['\"]center['\"]/g) || []).length;

  const fontStats = computeMinMax(fontSizes);
  const paddingStats = computeMinMax(paddingValues);

  const issues = [];
  if (fontSizes.length === 0) {
    issues.push({ severity: 'low', message: 'No explicit fontSize declarations found.' });
  } else {
    if (fontStats.min !== null && fontStats.min < 24) {
      issues.push({ severity: 'medium', message: `Small font tokens detected (min ${fontStats.min}).` });
    }
    if (fontStats.max !== null && fontStats.max > 180) {
      issues.push({ severity: 'medium', message: `Very large font tokens detected (max ${fontStats.max}).` });
    }

    const safeMin = Math.max(1, Number(fontStats.min || 1));
    const hierarchyRatio = Number(fontStats.max || safeMin) / safeMin;
    if (fontSizes.length >= 3 && hierarchyRatio < 1.9) {
      issues.push({
        severity: 'medium',
        message: `Weak font hierarchy detected (max/min ratio ${hierarchyRatio.toFixed(2)}).`,
      });
    }
  }

  if (paddingValues.length > 0) {
    const positivePaddingMin = paddingValues
      .filter((value) => value > 0)
      .reduce((min, value) => Math.min(min, value), Number.POSITIVE_INFINITY);
    if (paddingStats.max !== null && paddingStats.max > 160) {
      issues.push({
        severity: 'medium',
        message: `Large padding values may create empty space (max ${paddingStats.max}).`,
      });
    }
    if (
      paddingStats.min !== null &&
      paddingStats.max !== null &&
      Number.isFinite(positivePaddingMin) &&
      positivePaddingMin <= 8 &&
      paddingStats.max >= 120
    ) {
      issues.push({
        severity: 'low',
        message: `Wide spacing spread detected (min ${positivePaddingMin}, max ${paddingStats.max}).`,
      });
    }
  }

  const centerDensity = textAlignCenterCount + justifyCenterCount + alignCenterCount;
  if (centerDensity >= 10 && textAlignLeftCount === 0) {
    issues.push({
      severity: 'low',
      message: 'Heavy center alignment usage; check for balance and readability.',
    });
  }

  const issueWeight = issues.reduce((sum, issue) => {
    if (issue.severity === 'high') return sum + 3;
    if (issue.severity === 'medium') return sum + 2;
    return sum + 1;
  }, 0);

  const score = Math.max(0, 100 - issueWeight * 10);
  const status = issues.some((issue) => issue.severity === 'high')
    ? 'high_risk'
    : issues.some((issue) => issue.severity === 'medium')
      ? 'needs_review'
      : 'ok';

  return {
    template: relativePath,
    status,
    score,
    metrics: {
      fontTokenCount: fontSizes.length,
      fontMin: fontStats.min,
      fontMax: fontStats.max,
      paddingTokenCount: paddingValues.length,
      paddingMin: paddingStats.min,
      paddingMax: paddingStats.max,
      textAlignCenterCount,
      textAlignLeftCount,
      justifyCenterCount,
      alignCenterCount,
    },
    issues,
  };
}

function formatReport(report) {
  const lines = [];
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Templates scanned: ${report.summary.totalTemplates}`);
  lines.push(
    `Status: ok=${report.summary.ok}, needs_review=${report.summary.needsReview}, high_risk=${report.summary.highRisk}`,
  );
  lines.push(
    `Issues: high=${report.summary.issueCounts.high}, medium=${report.summary.issueCounts.medium}, low=${report.summary.issueCounts.low}`,
  );
  lines.push('');
  lines.push('Templates (lowest score first):');

  for (const result of report.results) {
    const metric = result.metrics;
    const fontRange =
      metric.fontMin === null || metric.fontMax === null
        ? 'n/a'
        : `${metric.fontMin}-${metric.fontMax}`;
    const paddingRange =
      metric.paddingMin === null || metric.paddingMax === null
        ? 'n/a'
        : `${metric.paddingMin}-${metric.paddingMax}`;

    lines.push(`- [${result.status}] score=${result.score} ${result.template}`);
    lines.push(
      `  metrics: fontRange=${fontRange}, paddingRange=${paddingRange}, centerAlign=${metric.textAlignCenterCount + metric.justifyCenterCount + metric.alignCenterCount}`,
    );
    if (result.issues.length === 0) {
      lines.push('  issues: none');
    } else {
      for (const issue of result.issues) {
        lines.push(`  - (${issue.severity}) ${issue.message}`);
      }
    }
  }

  return lines.join('\n');
}

async function main() {
  const files = await listTemplateFiles(templatesDir);
  files.sort();

  const results = [];
  const issueCounts = { high: 0, medium: 0, low: 0 };

  for (const file of files) {
    const relativePath = path.relative(rootDir, file);
    const content = await fs.readFile(file, 'utf8');
    const result = analyzeTemplate(relativePath, content);
    for (const issue of result.issues) {
      if (issue.severity === 'high') issueCounts.high += 1;
      else if (issue.severity === 'medium') issueCounts.medium += 1;
      else issueCounts.low += 1;
    }
    results.push(result);
  }

  results.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    return a.template.localeCompare(b.template);
  });

  const summary = {
    totalTemplates: results.length,
    ok: results.filter((result) => result.status === 'ok').length,
    needsReview: results.filter((result) => result.status === 'needs_review').length,
    highRisk: results.filter((result) => result.status === 'high_risk').length,
    issueCounts,
  };

  const report = {
    ok: true,
    generatedAt: new Date().toISOString(),
    summary,
    results,
  };

  if (outputJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(formatReport(report));
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    error: String(error?.message || error),
  }, null, 2));
  process.exitCode = 1;
});
