---
name: k2389-weekly
description: Weekly refresh of the K2389 Alliance Board (Kingshot, Kingdom 2389) – rewrite data/week.json for the next 7–14 days from the kingdom's event calendar, keep data/guides.json current, open a PR for Alex. Use for the Sunday scheduled run, or whenever someone asks to "update the alliance site / board / plan", add a video or tool, or fix an event guide.
---

# K2389 weekly update

The site is static: `index.html` + `assets/` render two data files. Weekly work edits **data only**.

- `data/week.json` – the plan: window, goals, rules for everyone, day-by-day calendar with tasks per role, notices.
- `data/guides.json` – evergreen: roles (+ officer names), `daily` (the every-day checklist for all members), event guides (`know` = In short, `todo` = What you do, `tips` = Get the most out of it, `videos`, `links` = Full guides, optional `owner` = the officer role who runs it), tool groups, things to confirm in game.
- `ours` (our alliance's rules for an event, with a `chat` copy) and `plan` (a battle plan by group) are written by Alex's officers. Never change or drop them in a weekly run; if research contradicts them, say so in the PR. Event `todo` must not contradict `ours`.
- The page is person-centred: a reader picks "I am" (Member or an officer role) and sees today's to-do, the next 14 days, goals and notices for that role. So every task must make sense on its own, read by that one person.
- `scripts/check.py` – the gate CI runs. Run it locally before every commit.
- Merge to `main` = deploy to GitHub Pages (https://havelexey.github.io/k2389/). Never push to main directly; always a PR.

## Steps (Sunday run)

1. Branch `weekly/<YYYY-MM-DD>` from `main`.
2. Get the dates. Open https://www.kingshotguide.org/kingdom-rankings/2389 → **Events** tab (it renders client-side: use a real browser such as Playwright, `chromium.launch()`; plain curl returns a loading shell). Read every event from tomorrow (Monday) to the Sunday 13 days later. Note KvK phases (Field Triage links to its own guide, `triage`), Castle Battle, Tri-Alliance, Swordland, Sanctuary, Championship, Vikings, Caesar's Fury, Mobilization, Brawl, and the smaller events.
   - Fallback if the tracker fails: https://www.kingshotguide.org/calendar (generic rotation; per-kingdom phase can shift Champagne Fair, Fishing, Mystic Divination, Call of the Sovereign by 14 days and Caesar's Fury by 7).
3. Rewrite `data/week.json`:
   - `updated` = today, `next_update` = next Sunday, `window.start` = Monday, `window.end` = the Sunday 13 days later (two weeks; the second week can be lighter).
   - `headline`: one or two sentences naming the big moments with dates.
   - `timeline`: the main block at the top of the page. One item per event occurrence: `name`, `level`, `start`, `end` (UTC, `YYYY-MM-DDTHH:MMZ`, end exclusive; whole days = `T00:00Z` to next day `T00:00Z`), optional `event` (guide id) and `note` (one line, what to do). Include anything overlapping the window, plus events starting up to 2 days after it.
     - `level: "main"` = the big moments people plan around: KvK phases (matchmaking, prep, battle, Field Triage), Castle Battle, Tri-Alliance Clash battle day, Swordland battle day, Alliance Brawl, Strongest Governor, Flamedragon Tyrant, and every seasonal or limited event (Halloween Party, Christmas Festival, New Year, anniversary). Find seasonal ones on the official news (https://www.centurygames.com/ – Kingshot posts) and kingshotmastery.com/blog; add only with confirmed dates.
     - `level: "routine"` = everything regular: Championship, Mobilization, Sanctuary, Vikings, Caesar's Fury, Armament, Officer Project, Golden Glaives, Hero Roulette, Defeat Beasts, Blizzard Brawl, Merchant Empire, Treasure Cove and the rest.
   - `recurring`: things with no fixed date in the data (Bear Hunt at the alliance's hour).
   - `goals`: 3–5, each with an owner role, a date, and a measurable target.
   - `rules`: what every member must do or hold this fortnight (spending freezes before KvK prep or Strongest Governor, troop backlog, intel timing, shield rules).
   - `days`: one entry per day with something on it. Every day in the window should have at least one `members` task: it is the member's to-do for that day. Link events with `{"text": ..., "event": "<guides id>"}`; plain strings for events with no guide. Tasks: `{"role", "on", "text"}` where `on` is the exact `text` of that day's event it belongs to (the page groups duties under each event); leave `on` out only for jobs tied to no event that day. One task = one event: split a sentence that covers two events. `members` tasks first, then the officer who owns it. Peak battle days `"kind": "peak"`, KvK prep days `"kind": "prep"`.
   - `notices`: paste-ready Alliance Notices, ≤300 characters each, with `post` = when to post and `date` (ISO) when it has a fixed day – the owner then sees it in Your day with a Copy button.
   - Keep `alliance` and officer names as they are unless Alex changed them.
4. Check `data/guides.json`: every timeline item and every day `on` item must link to a guide (`event`); the check fails otherwise. If a new event appears (e.g. Flamedragon Tyrant, Strongest Governor), add a guide from the official help center (https://centurygames.helpshift.com/hc/en/140-kingshot/) and fan guides (kingshotmastery.com, kingshotguide.org, kingshothandbook.com): 3–5 know, 3–4 todo, 3–4 tips, 1–3 links (each checked for HTTP 200). Official help often has no article for small events; use facts two fan sources agree on, else say "check the in-game event page". Fix any rule the official help contradicts.
5. Videos: only add a YouTube video after checking `https://www.youtube.com/oembed?url=<watch url>&format=json` returns a Kingshot title. Prefer the latest year. Replace a video when a newer, better one exists; never more than 2 per event.
6. Tools: spot-check that every tool URL still answers (HTTP 200). Remove dead ones.
7. `python3 scripts/check.py --today <today>` must print OK. Fix, rerun.
8. Commit, push, open a PR titled `Week of <Mon date>` with a 5-line summary: big dates, goals, anything changed in guides, anything you could not confirm. Do NOT merge – Alex reviews and merges (merge = publish).

## Writing rules

- English, plain, short sentences. Members read this on a phone in a game break.
- En dash "–" for ranges, never an em dash (the check rejects it).
- All times UTC, written `HH:MM UTC`. Members are in Europe.
- Say what to do, not what the event is, in tasks. Facts go in guides.
- Never invent a date, slot or rule. If unsure, add it to `confirm` in guides.json or say "check in game".

## Keep this skill current

When a run teaches something new (tracker layout changed, an event's cadence differs from what's written, a check that should exist, a better video source), fold it into this file in the same PR: one terse line in the right section. No week-specific state here.
