# K2389 Alliance Board

Public plan page for our Kingshot alliance in Kingdom 2389: this week's goals, calendar, event guides with videos, tools, officers.

Live: https://havelexey.github.io/k2389/

- Content: `data/week.json` (this fortnight) and `data/guides.json` (evergreen guides, videos, tools, roles).
- Weekly refresh: every Sunday a scheduled Claude run follows `.claude/skills/k2389-weekly/SKILL.md` and opens a PR. Merging it publishes.
- Checks: `python3 scripts/check.py` (CI runs it on every PR). Preview locally with `python3 -m http.server` in this folder.
