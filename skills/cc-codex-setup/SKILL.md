---
name: cc-codex-setup
description: Verify that both Claude Code CLI and Codex CLI are installed and authenticated before running combined reviews from Kimi Code
---

# Claude + Codex Setup

Run the setup check and report the result to the user.

```bash
node /home/lkx/.kimi-code/plugins/managed/kimi-plugin-cc-codex/scripts/cc-codex-review.mjs setup
```

If it fails, guide the user to install Claude Code from https://claude.ai/code and Codex from https://github.com/openai/codex, then log in to both.
