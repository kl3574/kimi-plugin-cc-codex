---
name: review
description: Run a combined read-only Claude + Codex code review on current changes
---

Run a combined review. Pass `$ARGUMENTS` to set optional flags like `--base main` or `--focus "error handling"`.

Run the following Bash command and show the full output. Do not modify any files.

```bash
PLUGIN_ROOT="${KIMI_PLUGIN_ROOT:-${KIMI_CODE_HOME:-$HOME/.kimi-code}/plugins/managed/kimi-plugin-cc-codex}"
SCRIPT="$PLUGIN_ROOT/scripts/cc-codex-review.mjs"
if [ ! -f "$SCRIPT" ]; then
  echo "❌ Plugin script not found at $SCRIPT. Is kimi-plugin-cc-codex installed?" >&2
  exit 1
fi
REVIEW_ARGS="$ARGUMENTS" node "$SCRIPT" review
```
