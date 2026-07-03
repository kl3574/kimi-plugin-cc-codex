#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const USAGE = `Usage: cc-codex-review.mjs <setup|review|adversarial-review> [--base <ref>] [--focus <text>]
  review: read-only code review
  adversarial-review: steerable challenge review`;

function runSync(cmd, args, opts = {}) {
  return spawnSync(cmd, args, {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    ...opts,
  });
}

function runGit(args, opts = {}) {
  const { env: callerEnv, ...restOpts } = opts;
  return runSync('git', args, {
    env: { ...process.env, LC_ALL: 'C', ...callerEnv },
    ...restOpts,
  });
}

function runAsync(cmd, args, opts = {}) {
  const { stdin, timeout = 5 * 60 * 1000, maxBuffer = 32 * 1024 * 1024, ...spawnOpts } = opts;
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      ...spawnOpts,
    });
    let stdout = '';
    let stderr = '';
    let killed = false;
    let timedOut = false;
    const timer = timeout
      ? setTimeout(() => {
          timedOut = true;
          child.kill('SIGTERM');
        }, timeout)
      : null;
    child.stdout.on('data', (data) => {
      stdout += data.toString();
      if (Buffer.byteLength(stdout, 'utf8') > maxBuffer && !killed && !timedOut) {
        killed = true;
        child.kill('SIGTERM');
      }
    });
    child.stderr.on('data', (data) => {
      stderr += data.toString();
      if (Buffer.byteLength(stderr, 'utf8') > maxBuffer && !killed && !timedOut) {
        killed = true;
        child.kill('SIGTERM');
      }
    });
    child.on('error', (err) => {
      if (timer) clearTimeout(timer);
      resolve({ code: 1, stdout, stderr: `❌ Failed to start ${cmd}: ${err.message}` });
    });
    child.on('close', (code, signal) => {
      if (timer) clearTimeout(timer);
      if (timedOut) {
        resolve({ code: 1, stdout, stderr: stderr + '\n❌ Review timed out after 5 minutes.' });
        return;
      }
      if (signal === 'SIGTERM' && killed) {
        resolve({ code: 1, stdout, stderr: stderr + '\n❌ Output exceeded maxBuffer limit.' });
        return;
      }
      resolve({ code, stdout, stderr });
    });
    if (stdin !== undefined) {
      child.stdin.write(stdin);
      child.stdin.end();
    }
  });
}

function findGitRoot(cwd = process.cwd()) {
  const result = runGit(['rev-parse', '--show-toplevel'], { cwd });
  if (result.status !== 0) return null;
  return result.stdout.trim();
}

function hasCommits(cwd) {
  const result = runGit(['rev-parse', '--verify', 'HEAD'], { cwd });
  return result.status === 0;
}

function getUntrackedFiles(cwd) {
  const result = runGit(['ls-files', '-z', '--others', '--exclude-standard'], { cwd });
  if (result.status !== 0) return [];
  return result.stdout.split('\0').filter(Boolean);
}

const MAX_UNTRACKED_BYTES = 1024 * 1024; // 1 MB per untracked file

function readRepoFile(cwd, file) {
  const fullPath = path.join(cwd, file);
  try {
    const stat = fs.lstatSync(fullPath);
    if (!stat.isFile()) {
      return { skipped: true, reason: 'not a regular file' };
    }
    if (stat.size > MAX_UNTRACKED_BYTES) {
      return { skipped: true, reason: 'file too large' };
    }
    return { content: fs.readFileSync(fullPath, 'utf8') };
  } catch {
    return { skipped: true, reason: 'read error' };
  }
}

function formatUntrackedDiff(cwd) {
  const files = getUntrackedFiles(cwd);
  if (files.length === 0) return '';
  const parts = [];
  const skipped = [];
  for (const file of files) {
    const result = readRepoFile(cwd, file);
    if (result.skipped) {
      skipped.push(`${file} (${result.reason})`);
      continue;
    }
    const content = result.content;
    const lines = content.split('\n');
    parts.push(`diff --git a/${file} b/${file}`);
    parts.push('new file mode 100644');
    parts.push('index 0000000..0000000');
    parts.push('--- /dev/null');
    parts.push(`+++ b/${file}`);
    parts.push(`@@ -0,0 +1,${lines.length} @@`);
    for (const line of lines) {
      parts.push(`+${line}`);
    }
  }
  if (skipped.length) {
    parts.push(`\n# Skipped untracked files: ${skipped.join(', ')}`);
  }
  return parts.join('\n');
}

function buildReviewDiff(base, cwd) {
  const trackedDiff = getDiff(base, cwd);
  const untrackedDiff = formatUntrackedDiff(cwd);
  if (!untrackedDiff) {
    return trackedDiff;
  }
  return [trackedDiff, untrackedDiff].filter(Boolean).join('\n');
}

function checkGitDiff(result, label) {
  if (result.status !== 0) {
    throw new Error(`git diff (${label}) failed: ${result.stderr || result.error?.message || 'unknown error'}`);
  }
}

function sanitizePromptInput(s) {
  return String(s || '').replace(/[\n\r]/g, ' ').replace(/```/g, "'''").trim();
}

function validateBaseRef(base) {
  if (base === undefined || base === null) return;
  if (base.trim() === '') {
    throw new Error('--base requires a non-empty ref');
  }
  if (base.startsWith('-')) {
    throw new Error('--base value cannot start with "-"');
  }
}

function getDiff(base, cwd) {
  if (base) {
    // Compare the base ref directly to the working tree so the review covers
    // both committed branch changes and local edits, without duplication.
    const result = runGit(['diff', '--no-color', base, '--'], { cwd });
    checkGitDiff(result, 'base');
    return result.stdout;
  }
  // Combine staged and unstaged diffs separately so that working-tree changes
  // that cancel out staged changes do not hide the staged patch.
  const unstaged = runGit(['diff', '--no-color'], { cwd });
  checkGitDiff(unstaged, 'unstaged');
  const staged = runGit(['diff', '--cached', '--no-color'], { cwd });
  checkGitDiff(staged, 'staged');
  return [staged.stdout, unstaged.stdout].filter(Boolean).join('\n');
}

function splitArgsString(s) {
  const tokens = [];
  let i = 0;
  while (i < s.length) {
    while (i < s.length && /\s/.test(s[i])) i++;
    if (i >= s.length) break;
    let token = '';
    if (s[i] === '"' || s[i] === "'") {
      const quote = s[i++];
      while (i < s.length && s[i] !== quote) {
        if (s[i] === '\\' && i + 1 < s.length) token += s[++i];
        else token += s[i];
        i++;
      }
      if (i < s.length) i++;
    } else {
      while (i < s.length && !/\s/.test(s[i])) token += s[i++];
    }
    tokens.push(token);
  }
  return tokens;
}

function normalizeArgv(argv) {
  // When invoked from the Kimi Code command wrapper, arguments arrive as a
  // single quoted string in REVIEW_ARGS (avoids shell interpolation of user
  // input). The subcommand (review/adversarial-review/setup) is still passed
  // as argv[2], so we prepend it to any env-var flags.
  const envArgs = process.env.REVIEW_ARGS;
  const args = argv.slice(2).filter((a) => a.length > 0);
  let tokens = [];
  if (envArgs !== undefined) {
    tokens = envArgs.length > 0 ? splitArgsString(envArgs) : [];
  } else if (args.length === 1 && /\s/.test(args[0])) {
    tokens = splitArgsString(args[0]);
  } else {
    tokens = args;
  }
  if (args.length > 0 && args[0] !== tokens[0]) {
    tokens = [args[0], ...tokens];
  }
  return tokens;
}

function parseArgs(argv) {
  const args = normalizeArgv(argv);
  const command = args[0];
  const options = { base: null, focus: '', unknown: [], positional: [] };
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--base') {
      if (i + 1 >= args.length) {
        throw new Error('--base requires a value');
      }
      options.base = args[++i];
    } else if (args[i] === '--focus') {
      if (i + 1 >= args.length) {
        throw new Error('--focus requires a value');
      }
      options.focus = args[++i];
    } else if (args[i].startsWith('--base=')) {
      const value = args[i].slice(7);
      if (!value) throw new Error('--base requires a value');
      options.base = value;
    } else if (args[i].startsWith('--focus=')) {
      const value = args[i].slice(8);
      if (!value) throw new Error('--focus requires a value');
      options.focus = value;
    } else if (args[i].startsWith('-')) {
      options.unknown.push(args[i]);
    } else {
      options.positional.push(args[i]);
    }
  }
  return { command, options };
}

function checkCli(name, versionArgs, authCmd, authOk) {
  const versionResult = runSync(name, versionArgs);
  if (versionResult.status !== 0) {
    return { ok: false, message: `❌ ${name} not found on PATH or failed to run.` };
  }
  const version = versionResult.stdout.trim();
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
    return r.status === 0 && /\bLogged in\b/.test(output);
  });
  console.log(claude.message);
  console.log(codex.message);
  if (!claude.ok || !codex.ok) {
    console.log('Install Claude from https://claude.ai/code and Codex from https://github.com/openai/codex, then log in.');
    process.exit(1);
  }
}

async function runClaudeReview({ base, focus, adversarial, gitRoot, diff }) {
  if (!diff.trim()) {
    return { engine: 'Claude', ok: true, output: 'No changes to review.' };
  }

  const maxDiffChars = 120000;
  const codePoints = [...diff];
  let truncated = codePoints.length > maxDiffChars;
  if (truncated) {
    diff = codePoints.slice(0, maxDiffChars).join('') + '\n\n[diff truncated]';
  }

  const systemPrompt = adversarial
    ? `You are a senior staff engineer doing a read-only adversarial code review. Challenge design decisions, trade-offs, hidden assumptions, and failure modes. Be constructive but skeptical. Categorize findings as Critical, Important, or Minor. For each finding include severity, file:line, evidence, why it matters, and a recommended fix. End with an overall verdict.`
    : `You are a senior staff engineer doing a read-only code review. Categorize findings as Critical, Important, or Minor. For each finding include severity, file:line, evidence, why it matters, and a recommended fix. End with an overall verdict.`;

  const fence = diff.includes('```') ? '````' : '```';
  const userPrompt = [
    'Review the following git diff.',
    base ? `Base ref: ${base}` : 'Reviewing current uncommitted changes.',
    focus ? `Focus: ${focus}` : '',
    '',
    `${fence}diff`,
    diff,
    fence,
  ].filter(Boolean).join('\n');

  const result = await runAsync('claude', [
    '-p', userPrompt,
    '--output-format', 'text',
    '--bare',
    '--permission-mode', 'plan',
    '--system-prompt', systemPrompt,
  ], { cwd: gitRoot, maxBuffer: 32 * 1024 * 1024, timeout: 5 * 60 * 1000 });

  let output = result.stdout;
  if (truncated) {
    output = '⚠️ Diff was truncated before sending to Claude.\n\n' + output;
  }
  return { engine: 'Claude', ok: result.code === 0, output: result.code === 0 ? output : result.stderr };
}

async function runCodexReview({ base, focus, adversarial, gitRoot, diff }) {
  if (!diff.trim()) {
    return { engine: 'Codex', ok: true, output: 'No changes to review.' };
  }

  const promptLines = [
    'You are a senior staff engineer doing a read-only code review.',
    'Review the git diff provided on stdin. Do not modify any files.',
  ];
  if (adversarial) {
    promptLines.push('Challenge design decisions, trade-offs, hidden assumptions, and failure modes. Be constructive but skeptical.');
  }
  if (focus) {
    promptLines.push(`Focus: ${focus}`);
  }
  if (base) {
    promptLines.push(`Base ref: ${base}`);
  }
  promptLines.push(
    'Categorize findings as Critical, Important, or Minor.',
    'For each finding include severity, file:line, evidence, why it matters, and a recommended fix.',
    'End with an overall verdict.',
  );
  const prompt = promptLines.join('\n');

  const result = await runAsync('codex', [
    'exec',
    '-s', 'read-only',
    '--ignore-user-config',
    '--ephemeral',
    prompt,
  ], { cwd: gitRoot, stdin: diff, maxBuffer: 32 * 1024 * 1024, timeout: 5 * 60 * 1000 });

  return { engine: 'Codex', ok: result.code === 0, output: result.code === 0 ? result.stdout : result.stderr };
}

async function review(options) {
  if (options.unknown && options.unknown.length) {
    console.error(`❌ Unknown option(s): ${options.unknown.join(', ')}`);
    process.exit(1);
  }

  let effectiveFocus = options.focus;
  if (options.adversarial && options.positional && options.positional.length) {
    if (effectiveFocus) {
      console.error('❌ Cannot use positional focus text together with --focus.');
      process.exit(1);
    }
    effectiveFocus = options.positional.join(' ');
  } else if (options.positional && options.positional.length) {
    console.error(`❌ Unexpected positional argument(s): ${options.positional.join(' ')}`);
    process.exit(1);
  }

  const gitRoot = findGitRoot();
  if (!gitRoot) {
    console.error('❌ Not inside a git repository.');
    process.exit(1);
  }

  const claude = checkCli('claude', ['--version'], ['auth', 'status'], (r) => r.status === 0);
  const codex = checkCli('codex', ['--version'], ['login', 'status'], (r) => {
    const output = (r.stdout || '') + (r.stderr || '');
    return r.status === 0 && /\bLogged in\b/.test(output);
  });
  if (!claude.ok || !codex.ok) {
    console.error(claude.message);
    console.error(codex.message);
    process.exit(1);
  }

  try {
    validateBaseRef(options.base);
  } catch (err) {
    console.error(`❌ ${err.message}`);
    process.exit(1);
  }

  if (!options.base && !hasCommits(gitRoot)) {
    console.error('❌ This repository has no commits yet. Commit some changes before reviewing, or use --base <ref>.');
    process.exit(1);
  }

  let diff;
  try {
    diff = buildReviewDiff(options.base, gitRoot);
  } catch (err) {
    console.error(`❌ ${err.message}`);
    process.exit(1);
  }

  const displayBase = sanitizePromptInput(options.base);
  const displayFocus = sanitizePromptInput(effectiveFocus);
  const reviewOptions = { ...options, focus: displayFocus, base: displayBase, gitRoot, diff };

  const [claudeResult, codexResult] = await Promise.all([
    runClaudeReview(reviewOptions),
    runCodexReview(reviewOptions),
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
  if (!diff.trim()) {
    console.log('No changes to review.');
  } else if (claudeResult.ok && codexResult.ok) {
    console.log('Both engines completed. Review the findings above and apply fixes in a separate step if needed.');
  } else {
    console.log('One or both engines failed. See details above.');
    process.exit(1);
  }
}

let command;
let options;
try {
  ({ command, options } = parseArgs(process.argv));
} catch (err) {
  console.error(`❌ ${err.message}`);
  console.error(USAGE);
  process.exit(1);
}

switch (command) {
  case 'setup':
    setup();
    break;
  case 'review':
    review(options).catch((err) => {
      console.error('❌ Unexpected error:', err.message);
      process.exit(1);
    });
    break;
  case 'adversarial-review':
    review({ ...options, adversarial: true }).catch((err) => {
      console.error('❌ Unexpected error:', err.message);
      process.exit(1);
    });
    break;
  default:
    console.error(USAGE);
    process.exit(1);
}
