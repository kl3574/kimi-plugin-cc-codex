# Kimi Plugin CC + Codex

A Kimi Code plugin that runs independent read-only code reviews from both Claude Code CLI and OpenAI Codex CLI, then presents a combined report.

## Install

From a local path:

```text
/plugins install /home/lkx/kimi-plugin-cc-codex
/reload
```

From GitHub:

```text
/plugins install https://github.com/kl3574/kimi-plugin-cc-codex
/reload
```

## Usage

```text
/kimi-plugin-cc-codex:setup
/kimi-plugin-cc-codex:review
/kimi-plugin-cc-codex:review --base main
/kimi-plugin-cc-codex:adversarial-review --base main challenge the error handling
```

Or use skills directly:

```text
Use the skill cc-codex-review
Use the skill cc-codex-adversarial-review with base main
```

## How It Works

The helper script runs Claude review and Codex review in parallel, then prints both findings under clear headings followed by a short summary.

## Verification

- Plugin manifest: valid JSON, `skills` and `commands` paths present.
- Helper script: tested with `setup`, `review`, `adversarial-review`, and `--base <ref>`.
- Runs Claude and Codex reviews in parallel and combines outputs under per-engine headings.
- Smoke test in `/tmp/review-test` produced a combined report with findings from both engines.
- Boundary tests passed:
  - Non-git directory → clear error, exit 1.
  - Empty diff → "No changes to review." from both engines, exit 0.
  - Invalid base ref → clear git error, exit 1.

## Limitations

- Requires a local git repository.
- Requires both `claude` and `codex` on PATH and authenticated.
- Very large diffs sent to Claude are truncated.
- Skills and commands reference the helper script by absolute path `/home/lkx/.kimi-code/plugins/managed/kimi-plugin-cc-codex/scripts/cc-codex-review.mjs`.
- This is a v0.1 local prototype.
