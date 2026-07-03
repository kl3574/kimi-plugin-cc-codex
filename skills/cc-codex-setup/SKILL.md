---
name: cc-codex-setup
description: Check that both Claude Code and Codex CLI are installed and authenticated
---

# Claude + Codex Setup

Use this skill when the user wants to verify both CLIs are ready.

## Steps

1. Run the helper script:
   ```bash
   PLUGIN_ROOT="${KIMI_PLUGIN_ROOT:-${KIMI_CODE_HOME:-$HOME/.kimi-code}/plugins/managed/kimi-plugin-cc-codex}"
   node "$PLUGIN_ROOT/scripts/cc-codex-review.mjs" setup
   ```
2. Report the result to the user, including any missing CLI or authentication issues.

## Output

The setup command prints a status line for each CLI (e.g., found and authenticated) or a clear error describing what is missing.
