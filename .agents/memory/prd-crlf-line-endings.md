---
name: PRD doc CRLF line endings
description: Why multi-line edits to the Travis PRD asset fail and how to edit it reliably.
---

The consolidated Travis PRD (`attached_assets/travis-platform-website-overview_*.md`) is stored with **CRLF (`\r\n`)** line endings.

**Why this matters:** the `read` tool strips `\r`, so any multi-line `old_string` you copy from read output uses `\n` and will NOT match the file's `\r\n` — the edit fails with "did not appear verbatim" even though the text looks identical.

**How to apply:**
- Single-line edits work fine (the match is a substring within one line, excluding the newline).
- For multi-line inserts/replacements, either build the search/replace strings joined with `\r\n`, or run a small Node/`fs` script that does an EOL-aware `indexOf`/replace and writes back with CRLF preserved.
- Confirm endings with `sed -n 'a,bp' FILE | cat -A` (look for `^M$`).
