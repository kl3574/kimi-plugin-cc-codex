# Kimi Plugin CC + Codex

A Kimi Code plugin that runs independent read-only code reviews from both Claude Code CLI and OpenAI Codex CLI, then presents a combined report.

## Install

From GitHub (recommended):

```text
/plugins install https://github.com/kl3574/kimi-plugin-cc-codex
/reload
```

Or clone manually into your Kimi Code plugins directory:

```bash
git clone https://github.com/kl3574/kimi-plugin-cc-codex.git ~/.kimi-code/plugins/managed/kimi-plugin-cc-codex
```

Then restart Kimi Code or run `/reload`.

## Usage

```text
/kimi-plugin-cc-codex:setup
/kimi-plugin-cc-codex:review
/kimi-plugin-cc-codex:review --base main
/kimi-plugin-cc-codex:adversarial-review
/kimi-plugin-cc-codex:adversarial-review --base main --focus "challenge the error handling"
```

Or use skills directly:

```text
Use the skill cc-codex-review
Use the skill cc-codex-adversarial-review with base main
```

### Flags

- `--base <ref>`: review the current branch against `<ref>` instead of uncommitted changes.
- `--focus <text>`: steer the review (most useful with `adversarial-review`); when provided, Codex falls back to `codex exec` with the focus text in the prompt.

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
  - No commits yet → clear error, exit 1.
  - Staged changes only → reviewed as part of the working-tree diff, exit 0.
  - Untracked files → warning in summary, but not included in the diff sent to Claude.

## Limitations

- Requires a local git repository with at least one commit (for non-base reviews).
- Requires both `claude` and `codex` on PATH and authenticated.
- Very large diffs sent to Claude are truncated.
- Untracked files are reported but not reviewed by Claude; Codex may see them via its own `codex review` behavior.
- Does **not** implement background execution (`--background`, `--wait`), rescue/transfer/status/result/cancel commands, or the review gate from `codex-plugin-cc`.
- Skills and commands resolve the helper script via `PLUGIN_ROOT` using `KIMI_PLUGIN_ROOT`, `KIMI_CODE_HOME`, or the default `~/.kimi-code/plugins/managed/kimi-plugin-cc-codex` path.
- This is a v0.1 local prototype.
