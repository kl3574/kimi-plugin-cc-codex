---
name: doctor
description: Diagnose Claude Code + Codex CLI readiness, network, and runtime
---

Run a diagnostic check for the combined Claude + Codex plugin. Pass `--probe-runtime` to also send a minimal prompt to each external CLI and verify they can reach their APIs.

Run the following Bash command and show the full output. Do not modify any files.

```bash
PLUGIN_ROOT="${KIMI_PLUGIN_ROOT:-${KIMI_CODE_HOME:-$HOME/.kimi-code}/plugins/managed/kimi-plugin-cc-codex}"
SCRIPT="$PLUGIN_ROOT/scripts/cc-codex-review.mjs"
if [ ! -f "$SCRIPT" ]; then
  echo "❌ Plugin script not found at $SCRIPT. Is kimi-plugin-cc-codex installed?" >&2
  exit 1
fi
node "$SCRIPT" doctor "$ARGUMENTS"
```
