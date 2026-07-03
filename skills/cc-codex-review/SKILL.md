---
name: cc-codex-review
description: Run a read-only combined Claude Code + Codex CLI code review on current git changes from inside Kimi Code
---

# Combined Claude + Codex Review

Use this skill when the user wants independent reviews from both Claude Code and Codex CLI.

## Steps

1. Determine whether the user wants to review:
   - Uncommitted changes (default)
   - A branch compared to a base ref (e.g., `main`)
2. Run the helper script:
   ```bash
   node /home/lkx/.kimi-code/plugins/managed/kimi-plugin-cc-codex/scripts/cc-codex-review.mjs review
   ```
   or with a base ref:
   ```bash
   node /home/lkx/.kimi-code/plugins/managed/kimi-plugin-cc-codex/scripts/cc-codex-review.mjs review --base main
   ```
3. Present the combined report, preserving the per-engine sections.
4. Do not apply any fixes unless the user explicitly asks in a separate step.
