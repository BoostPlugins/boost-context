# LLM Agent Workflow

This file captures best practices for using the Boost Context CLI alongside large-language-model agents.

## Capturing the right context
- Run `bctx dump ...` to gather filtered source trees and file contents before crafting a prompt.
- Pipe build or test output through `bctx tee` to archive logs while leaving stdout untouched.
- Use `bctx snap <url>` to grab visual snapshots that supplement textual descriptions when debugging UI issues.

## Recommended prompt structure
1. **Goal** – Briefly state what you want the assistant to achieve.
2. **Context** – Paste the `bctx dump` output with key files.
3. **Logs** – Attach the captured log file or quote the relevant sections.
4. **Questions** – Supply any clarifying questions that narrow the task.

## Automation tips
- Add `BCTX_SCREENSHOT_DIR` to your environment so browser captures land in a shared workspace for the team.
- Record repeatable command sequences in shell scripts that run `bctx dump`, `bctx tee`, and your test suite so future prompts start from consistent artifacts.
- Refer back to this document from your agent instructions to keep conversations focused and actionable.
