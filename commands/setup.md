---
name: setup
description: Check Claude and Codex CLI installation and authentication
---

Run the following Bash command and report the result:

```bash
PLUGIN_ROOT="${KIMI_PLUGIN_ROOT:-${KIMI_CODE_HOME:-$HOME/.kimi-code}/plugins/managed/kimi-plugin-cc-codex}"
SCRIPT="$PLUGIN_ROOT/scripts/cc-codex-review.mjs"
if [ ! -f "$SCRIPT" ]; then
  echo "❌ Plugin script not found at $SCRIPT. Is kimi-plugin-cc-codex installed?" >&2
  exit 1
fi
node "$SCRIPT" setup
```
