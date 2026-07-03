---
name: cc-codex-adversarial-review
description: Run skeptical adversarial reviews from both Claude Code and Codex CLI from inside Kimi Code
---

# Claude + Codex Adversarial Review

Use this skill when the user wants a challenging combined Claude + Codex review.

## Steps

1. Determine what the user wants to review:
   - Uncommitted changes (default)
   - A branch compared to a base ref (e.g., `main`)
   - Optionally, a focus area such as `security` or `error handling`
2. Run the helper script:
   ```bash
   PLUGIN_ROOT="${KIMI_PLUGIN_ROOT:-${KIMI_CODE_HOME:-$HOME/.kimi-code}/plugins/managed/kimi-plugin-cc-codex}"
   node "$PLUGIN_ROOT/scripts/cc-codex-review.mjs" adversarial-review "$ARGUMENTS"
   ```
   Examples:
   - `adversarial-review`
   - `adversarial-review --base main`
   - `adversarial-review --focus "challenge error handling"`
3. Present the findings to the user, preserving severity headings.
4. Do not apply any fixes unless the user explicitly asks in a separate step.

## Output

Claude and Codex each return a markdown report with Critical / Important / Minor findings; the helper concatenates them into a combined report.
