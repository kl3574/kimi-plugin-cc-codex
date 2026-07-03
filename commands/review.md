---
name: review
description: Run a combined read-only Claude + Codex code review on current changes
---

Run a combined review. Pass `$ARGUMENTS` to set optional flags like `--base main`.

Run the Bash command `node /home/lkx/.kimi-code/plugins/managed/kimi-plugin-cc-codex/scripts/cc-codex-review.mjs review $ARGUMENTS` and show the full output. Do not modify any files.
