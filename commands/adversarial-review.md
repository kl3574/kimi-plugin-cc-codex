---
name: adversarial-review
description: Run a combined steerable adversarial Claude + Codex code review
---

Run a combined adversarial review. Pass `$ARGUMENTS` for optional flags and focus text.

Run the following Bash command and show the full output. Do not modify any files.

```bash
PLUGIN_ROOT="${KIMI_PLUGIN_ROOT:-${KIMI_CODE_HOME:-$HOME/.kimi-code}/plugins/managed/kimi-plugin-cc-codex}"
node "$PLUGIN_ROOT/scripts/cc-codex-review.mjs" adversarial-review "$ARGUMENTS"
```
