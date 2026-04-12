---
name: command allowance preferences
description: Commands approved for future sessions without prompting
type: feedback
---

## Allowed Commands

- `npm install` — user selects "Yes, and don't ask again" repeatedly

**Why:** User frequently approves `npm install` and doesn't want to be prompted each time.

**How to apply:** When `npm install` is requested in a future session, run it without prompting for permission. Do NOT prompt again for this command.
