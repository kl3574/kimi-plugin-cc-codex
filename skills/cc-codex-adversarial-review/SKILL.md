---
name: cc-codex-adversarial-review
description: Run a steerable combined adversarial Claude Code + Codex CLI code review from inside Kimi Code
---

# Combined Claude + Codex Adversarial Review

Use this skill when the user wants both Claude Code and Codex CLI to challenge the design, trade-offs, or assumptions behind the current changes.

## Steps

1. Identify any focus area the user provided.
2. Run the helper script with the focus:
   ```bash
   node /home/lkx/.kimi-code/plugins/managed/kimi-plugin-cc-codex/scripts/cc-codex-review.mjs adversarial-review --base main --focus "challenge the retry logic"
   ```
3. Present the combined findings.
4. Do not apply fixes automatically.
