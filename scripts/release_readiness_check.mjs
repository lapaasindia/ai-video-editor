#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';

const execFile = promisify(execFileCb);

async function run(command, args = [], timeout = 20000) {
  const { stdout, stderr } = await execFile(command, args, {
    timeout,
    maxBuffer: 1024 * 1024 * 8,
  });
  return {
    stdout: String(stdout || '').trim(),
    stderr: String(stderr || '').trim(),
  };
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function commandPath(command) {
  try {
    const result = await run('which', [command], 10000);
    return {
      ok: Boolean(result.stdout),
      path: result.stdout || '',
    };
  } catch {
    return {
      ok: false,
      path: '',
    };
  }
}

async function cargoTauriAvailable() {
  try {
    const result = await run('cargo', ['tauri', '--version'], 15000);
    const output = result.stdout || result.stderr;
    return {
      ok: Boolean(output),
      version: output,
    };
  } catch {
    return {
      ok: false,
      version: '',
    };
  }
}

function envPresence(name) {
  const value = String(process.env[name] || '').trim();
  return {
    name,
    set: Boolean(value),
  };
}

function evaluateSigningEnv() {
  const required = [
    envPresence('APPLE_CERTIFICATE'),
    envPresence('APPLE_CERTIFICATE_PASSWORD'),
    envPresence('APPLE_SIGNING_IDENTITY'),
    envPresence('APPLE_TEAM_ID'),
  ];
  return {
    required,
    ok: required.every((item) => item.set),
  };
}

function evaluateNotarizationEnv() {
  const keychainProfile = envPresence('NOTARYTOOL_KEYCHAIN_PROFILE');
  const appleIdFlow = [
    envPresence('APPLE_ID'),
    envPresence('APPLE_TEAM_ID'),
    envPresence('APPLE_APP_PASSWORD'),
  ];
  const appleIdFlowOk = appleIdFlow.every((item) => item.set);
  return {
    keychainProfile,
    appleIdFlow,
    ok: keychainProfile.set || appleIdFlowOk,
  };
}

function statusFromChecks(checks) {
  if (checks.some((check) => check.severity === 'fail')) {
    return 'fail';
  }
  if (checks.some((check) => check.severity === 'warn')) {
    return 'warn';
  }
  return 'pass';
}

async function main() {
  const checks = [];
  const recommendations = [];
  const workspaceRoot = process.cwd();

  const isDarwin = process.platform === 'darwin';
  checks.push({
    key: 'platform',
    severity: isDarwin ? 'ok' : 'warn',
    message: isDarwin ? 'macOS host detected.' : 'Non-macOS host detected. Desktop release build should run on macOS.',
    value: `${process.platform}/${process.arch}`,
  });
  if (!isDarwin) {
    recommendations.push('Run release builds on macOS (preferably macOS-14) for signing and notarization.');
  }

  const nodeMajor = Number(process.versions.node.split('.')[0] || '0');
  checks.push({
    key: 'node_version',
    severity: nodeMajor >= 20 ? 'ok' : 'warn',
    message: `Node version ${process.versions.node}`,
    value: process.versions.node,
  });
  if (nodeMajor < 20) {
    recommendations.push('Use Node 20+ to align with workflow tooling.');
  }

  const cargo = await commandPath('cargo');
  checks.push({
    key: 'cargo',
    severity: cargo.ok ? 'ok' : 'fail',
    message: cargo.ok ? 'cargo available.' : 'cargo not found in PATH.',
    value: cargo.path,
  });
  if (!cargo.ok) {
    recommendations.push('Install Rust toolchain (`rustup`) before building desktop artifacts.');
  }

  const tauri = await cargoTauriAvailable();
  checks.push({
    key: 'cargo_tauri',
    severity: tauri.ok ? 'ok' : 'warn',
    message: tauri.ok ? 'cargo tauri available.' : 'cargo tauri not found.',
    value: tauri.version,
  });
  if (!tauri.ok) {
    recommendations.push('Install Tauri CLI (`cargo install tauri-cli --locked`).');
  }

  const workflowPath = path.join(workspaceRoot, '.github', 'workflows', 'macos-desktop-build.yml');
  const workflowExists = await exists(workflowPath);
  checks.push({
    key: 'workflow',
    severity: workflowExists ? 'ok' : 'warn',
    message: workflowExists ? 'macOS build workflow found.' : 'macOS build workflow missing.',
    value: workflowPath,
  });

  const qualityWorkflowPath = path.join(workspaceRoot, '.github', 'workflows', 'quality-ci.yml');
  const qualityWorkflowExists = await exists(qualityWorkflowPath);
  checks.push({
    key: 'quality_workflow',
    severity: qualityWorkflowExists ? 'ok' : 'warn',
    message: qualityWorkflowExists ? 'Quality CI workflow found.' : 'Quality CI workflow missing.',
    value: qualityWorkflowPath,
  });

  const packageJsonPath = path.join(workspaceRoot, 'package.json');
  const packageJsonExists = await exists(packageJsonPath);
  let packageName = '';
  if (packageJsonExists) {
    try {
      const raw = await fs.readFile(packageJsonPath, 'utf8');
      const parsed = JSON.parse(raw);
      packageName = String(parsed?.name || '').trim();
    } catch {
      packageName = '';
    }
  }
  const validPackageName = /^[a-z0-9._-]+$/.test(packageName);
  checks.push({
    key: 'package_name',
    severity: packageName && validPackageName ? 'ok' : 'warn',
    message:
      packageName && validPackageName
        ? 'package.json name uses release-safe npm format.'
        : 'package.json name is missing or not release-safe for npm/tooling.',
    value: packageName || '(missing)',
  });

  const notarizeScriptPath = path.join(workspaceRoot, 'scripts', 'macos_notarize_and_staple.sh');
  const notarizeScriptExists = await exists(notarizeScriptPath);
  checks.push({
    key: 'notarize_script',
    severity: notarizeScriptExists ? 'ok' : 'warn',
    message: notarizeScriptExists
      ? 'Notarization helper script found.'
      : 'Notarization helper script missing.',
    value: notarizeScriptPath,
  });

  const signingEnv = evaluateSigningEnv();
  checks.push({
    key: 'signing_env',
    severity: signingEnv.ok ? 'ok' : 'warn',
    message: signingEnv.ok
      ? 'Signing environment variables are configured.'
      : 'Some signing environment variables are missing.',
    value: signingEnv.required,
  });
  if (!signingEnv.ok) {
    recommendations.push(
      'Set APPLE_CERTIFICATE, APPLE_CERTIFICATE_PASSWORD, APPLE_SIGNING_IDENTITY, and APPLE_TEAM_ID.',
    );
  }

  const notarizationEnv = evaluateNotarizationEnv();
  checks.push({
    key: 'notarization_env',
    severity: notarizationEnv.ok ? 'ok' : 'warn',
    message: notarizationEnv.ok
      ? 'Notarization environment is configured.'
      : 'Notarization environment is incomplete.',
    value: {
      keychainProfile: notarizationEnv.keychainProfile,
      appleIdFlow: notarizationEnv.appleIdFlow,
    },
  });
  if (!notarizationEnv.ok) {
    recommendations.push(
      'Configure NOTARYTOOL_KEYCHAIN_PROFILE or APPLE_ID + APPLE_TEAM_ID + APPLE_APP_PASSWORD.',
    );
  }

  const bundlePath = path.join(workspaceRoot, 'src-tauri', 'target', 'release', 'bundle');
  const bundleExists = await exists(bundlePath);
  checks.push({
    key: 'bundle_dir',
    severity: bundleExists ? 'ok' : 'warn',
    message: bundleExists ? 'Bundle directory exists (previous build artifacts present).' : 'Bundle directory not found yet.',
    value: bundlePath,
  });

  const status = statusFromChecks(checks);
  const result = {
    ok: true,
    status,
    checkedAt: new Date().toISOString(),
    checks,
    recommendations,
  };

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${String(error?.message || error)}\n`);
  process.exit(1);
});
