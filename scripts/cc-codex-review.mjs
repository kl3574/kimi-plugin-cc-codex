#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { spawnSync } from 'node:child_process';

const USAGE = `Usage: cc-codex-review.mjs <setup|review|adversarial-review> [--base <ref>] [--focus <text>]`;

function runSync(cmd, args, opts = {}) {
  return spawnSync(cmd, args, {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    ...opts,
  });
}

function runAsync(cmd, args, opts = {}) {
  const stdin = opts.stdin;
  delete opts.stdin;
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      ...opts,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (data) => { stdout += data.toString(); });
    child.stderr.on('data', (data) => { stderr += data.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });
    if (stdin !== undefined) {
      child.stdin.write(stdin);
      child.stdin.end();
    }
  });
}

function findGitRoot(cwd = process.cwd()) {
  const result = runSync('git', ['rev-parse', '--show-toplevel'], { cwd });
  if (result.status !== 0) return null;
  return result.stdout.trim();
}

function getDiff(base, cwd) {
  const args = ['diff', '--no-color'];
  if (base) {
    args.push(`${base}...HEAD`);
  }
  const result = runSync('git', args, { cwd });
  if (result.status !== 0) {
    throw new Error(`git diff failed: ${result.stderr}`);
  }
  return result.stdout;
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const command = args[0];
  const options = { base: null, focus: '' };
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--base' && i + 1 < args.length) {
      options.base = args[++i];
    } else if (args[i] === '--focus' && i + 1 < args.length) {
      options.focus = args[++i];
    } else if (args[i].startsWith('--base=')) {
      options.base = args[i].slice(7);
    } else if (args[i].startsWith('--focus=')) {
      options.focus = args[i].slice(8);
    }
  }
  return { command, options };
}

function checkCli(name, versionArgs, authCmd, authOk) {
  const which = runSync('which', [name]);
  if (which.status !== 0 || !which.stdout.trim()) {
    return { ok: false, message: `❌ ${name} not found on PATH.` };
  }
  const version = runSync(name, versionArgs).stdout.trim();
  const auth = runSync(name, authCmd);
  if (!authOk(auth)) {
    return { ok: false, message: `❌ ${name} (${version}) is not authenticated.` };
  }
  return { ok: true, message: `✅ ${name} ${version} authenticated.` };
}

function setup() {
  const claude = checkCli('claude', ['--version'], ['auth', 'status'], (r) => r.status === 0);
  const codex = checkCli('codex', ['--version'], ['login', 'status'], (r) => {
    const output = (r.stdout || '') + (r.stderr || '');
    return r.status === 0 && output.includes('Logged in');
  });
  console.log(claude.message);
  console.log(codex.message);
  if (!claude.ok || !codex.ok) {
    console.log('Install Claude from https://claude.ai/code and Codex from https://github.com/openai/codex, then log in.');
    process.exit(1);
  }
}

async function runClaudeReview({ base, focus, adversarial, gitRoot }) {
  let diff;
  try {
    diff = getDiff(base, gitRoot);
  } catch (err) {
    return { engine: 'Claude', ok: false, output: err.message };
  }
  if (!diff.trim()) {
    return { engine: 'Claude', ok: true, output: 'No changes to review.' };
  }

  const maxDiffChars = 120000;
  let truncated = diff.length > maxDiffChars;
  if (truncated) {
    diff = diff.slice(0, maxDiffChars) + '\n\n[diff truncated]';
  }

  const systemPrompt = adversarial
    ? `You are a senior staff engineer doing a read-only adversarial code review. Challenge design decisions, trade-offs, hidden assumptions, and failure modes. Be constructive but skeptical. Categorize findings as Critical, Important, or Minor. For each finding include severity, file:line, evidence, why it matters, and a recommended fix. End with an overall verdict.`
    : `You are a senior staff engineer doing a read-only code review. Categorize findings as Critical, Important, or Minor. For each finding include severity, file:line, evidence, why it matters, and a recommended fix. End with an overall verdict.`;

  const userPrompt = [
    'Review the following git diff.',
    base ? `Base ref: ${base}` : 'Reviewing current uncommitted changes.',
    focus ? `Focus: ${focus}` : '',
    '',
    '```diff',
    diff,
    '```',
  ].join('\n');

  const result = await runAsync('claude', [
    '-p', userPrompt,
    '--output-format', 'text',
    '--bare',
    '--permission-mode', 'auto',
    '--system-prompt', systemPrompt,
  ], { cwd: gitRoot });

  let output = result.stdout;
  if (truncated) {
    output = '⚠️ Diff was truncated before sending to Claude.\n\n' + output;
  }
  return { engine: 'Claude', ok: result.code === 0, output: result.code === 0 ? output : result.stderr };
}

async function runCodexReview({ base, focus, adversarial, gitRoot }) {
  let diff;
  try {
    diff = getDiff(base, gitRoot);
  } catch (err) {
    return { engine: 'Codex', ok: false, output: err.message };
  }
  if (!diff.trim()) {
    return { engine: 'Codex', ok: true, output: 'No changes to review.' };
  }

  let result;
  if (adversarial) {
    const prompt = [
      'You are a senior staff engineer doing a read-only adversarial code review.',
      focus ? `Focus: ${focus}` : '',
      'Challenge design decisions, trade-offs, hidden assumptions, and failure modes.',
      'Categorize findings as Critical, Important, or Minor.',
      'For each finding include severity, file:line, evidence, why it matters, and a recommended fix.',
      'End with an overall verdict.',
    ].join('\n');

    result = await runAsync('codex', [
      'exec',
      '-s', 'read-only',
      '--ignore-user-config',
      '--ephemeral',
      prompt,
    ], { cwd: gitRoot, stdin: diff });
  } else {
    const args = ['review'];
    if (base) {
      args.push('--base', base);
    } else {
      args.push('--uncommitted');
    }
    result = await runAsync('codex', args, { cwd: gitRoot });
  }

  return { engine: 'Codex', ok: result.code === 0, output: result.code === 0 ? result.stdout : result.stderr };
}

async function review(options) {
  const gitRoot = findGitRoot();
  if (!gitRoot) {
    console.error('❌ Not inside a git repository.');
    process.exit(1);
  }

  const [claudeResult, codexResult] = await Promise.all([
    runClaudeReview({ ...options, gitRoot }),
    runCodexReview({ ...options, gitRoot }),
  ]);

  console.log('# Combined Claude + Codex Code Review\n');
  console.log('---\n');
  console.log(`## ${claudeResult.engine} Review\n`);
  console.log(claudeResult.ok ? claudeResult.output : `Failed: ${claudeResult.output}`);
  console.log('\n---\n');
  console.log(`## ${codexResult.engine} Review\n`);
  console.log(codexResult.ok ? codexResult.output : `Failed: ${codexResult.output}`);
  console.log('\n---\n');
  console.log('## Summary\n');
  if (claudeResult.ok && codexResult.ok) {
    console.log('Both engines completed. Review the findings above and apply fixes in a separate step if needed.');
  } else {
    console.log('One or both engines failed. See details above.');
    process.exit(1);
  }
}

const { command, options } = parseArgs(process.argv);

switch (command) {
  case 'setup':
    setup();
    break;
  case 'review':
    review(options);
    break;
  case 'adversarial-review':
    review({ ...options, adversarial: true });
    break;
  default:
    console.error(USAGE);
    process.exit(1);
}
