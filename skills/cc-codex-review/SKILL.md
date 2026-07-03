---
name: cc-codex-review
description: Run parallel read-only reviews from both Claude Code and Codex CLI from inside Kimi Code
---

# Claude + Codex Combined Review

Use this skill when the user wants a combined Claude + Codex review of their current work.

## Steps

1. Determine what the user wants to review:
   - Uncommitted changes (default)
   - A branch compared to a base ref (e.g., `main`)
   - Optionally, a focus area such as `security` or `error handling`
2. Build the helper command with the appropriate flags:
   ```bash
   PLUGIN_ROOT="${KIMI_PLUGIN_ROOT:-${KIMI_CODE_HOME:-$HOME/.kimi-code}/plugins/managed/kimi-plugin-cc-codex}"
   node "$PLUGIN_ROOT/scripts/cc-codex-review.mjs" review <FLAGS>
   ```
   Examples:
   - `node "$PLUGIN_ROOT/scripts/cc-codex-review.mjs" review`
   - `node "$PLUGIN_ROOT/scripts/cc-codex-review.mjs" review --base main`
   - `node "$PLUGIN_ROOT/scripts/cc-codex-review.mjs" review --focus "security"`
   - `node "$PLUGIN_ROOT/scripts/cc-codex-review.mjs" review --base main --focus "error handling"`
3. Run the command and show the full output. Do not modify any files.
4. Present the findings to the user, preserving severity headings.
5. Do not apply any fixes unless the user explicitly asks in a separate step.

## Output

Claude and Codex each return a markdown report with Critical / Important / Minor findings; the helper concatenates them into a combined report.
