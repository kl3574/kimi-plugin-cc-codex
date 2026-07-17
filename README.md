# Kimi Plugin CC + Codex

A Kimi Code plugin that runs independent read-only code reviews from both Claude Code CLI and OpenAI Codex CLI, then presents a combined report.

## Install

From GitHub (recommended):

```text
/plugins install https://github.com/kl3574/kimi-plugin-cc-codex
/reload
```

Or clone manually into your Kimi Code plugins directory (replace `~/.kimi-code` with your `$KIMI_CODE_HOME` if you changed it):

```bash
git clone https://github.com/kl3574/kimi-plugin-cc-codex.git ~/.kimi-code/plugins/managed/kimi-plugin-cc-codex
```

Then restart Kimi Code or run `/reload`.

### Custom CLI locations

If your Claude or Codex binary is not on PATH under the default names, set one or both environment variables:

```bash
export CC_CLAUDE_BIN=/path/to/claude
export CC_CODEX_BIN=/path/to/codex
```

## Usage

```text
/kimi-plugin-cc-codex:setup
/kimi-plugin-cc-codex:doctor
/kimi-plugin-cc-codex:doctor --probe-runtime
/kimi-plugin-cc-codex:review
/kimi-plugin-cc-codex:review --base main
/kimi-plugin-cc-codex:review --path src/utils.js
/kimi-plugin-cc-codex:review --path src --focus "error handling"
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
- `--focus <text>`: steer the review; appended to both the Claude and Codex prompts.

## How It Works

The helper script builds a single git diff, then runs Claude and Codex reviews in parallel.

- Default (no `--base`): staged + unstaged + untracked files, rendered as a single review input sent to both engines. Untracked files are included only in the default working-tree review.
- `--base <ref>`: computes `git merge-base <ref> HEAD` and reviews only the committed branch changes since that merge-base (`<merge-base>..HEAD`); untracked files are excluded.
- `--path <file-or-dir>`: restricts the diff to the given file or directory before sending it to both engines.

## Diagnostics

Run `/kimi-plugin-cc-codex:doctor` to check:

- Plugin-local environment (Node.js version, git repo, writable directories).
- Whether `claude` and `codex` are on PATH, their versions, and authentication status.
- Proxy environment variables and proxy socket reachability.
- Direct connectivity to `api.anthropic.com:443` and `api.openai.com:443`.

Add `--probe-runtime` to send a minimal prompt to each engine and confirm the API paths work end-to-end. If either external CLI fails, the plugin prints the real CLI exit code/signal and stderr under the corresponding engine heading and exits without fabricating a review.

Claude is invoked with `--permission-mode plan` (read-only tools only), and Codex is invoked with `exec -s read-only --ignore-user-config --ephemeral`. Both receive the same diff and any focus text in their prompts. The combined output is printed under per-engine headings followed by a short summary. Each engine has a 5-minute timeout and a 32 MB output buffer.

## Verification

- Plugin manifest: valid JSON, `skills` and `commands` paths present.
- Helper script: tested with `setup`, `review`, `adversarial-review`, and `--base <ref>`.
- Runs Claude and Codex reviews in parallel and combines outputs under per-engine headings.
- Smoke test in `/tmp/review-test` produced a combined report with findings from both engines.
- Boundary tests passed:
  - Non-git directory → clear error, exit 1.
  - Empty diff → "No changes to review." summary, exit 0.
  - Invalid base ref → clear git error, exit 1.
  - No commits yet → clear error, exit 1.
  - Staged changes only → reviewed as part of the working-tree diff, exit 0.
  - Untracked files → included in the diff sent to both engines.

## Limitations

- Requires a local git repository with at least one commit (for non-base reviews).
- Requires both `claude` and `codex` on PATH and authenticated.
- Very large diffs sent to Claude are truncated.
- Untracked files are included in the diff sent to both engines, up to 500 KB per file and 1 MB total across all untracked files.
- Does **not** implement background execution (`--background`, `--wait`), rescue/transfer/status/result/cancel commands, or the review gate from `codex-plugin-cc`.
- Skills and commands resolve the helper script via `PLUGIN_ROOT` using `KIMI_PLUGIN_ROOT`, `KIMI_CODE_HOME`, or the default `~/.kimi-code/plugins/managed/kimi-plugin-cc-codex` path.
- This is an early-stage local prototype.
