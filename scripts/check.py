#!/usr/bin/env python3
"""Validate data/week.json and data/guides.json before deploy.

Run: python3 scripts/check.py   (exit 1 on any problem)
Optional: --today YYYY-MM-DD to check freshness against a given date.
"""
import datetime as dt
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
ROLES = {"members", "war", "events", "ops", "people", "leader"}
NOTICE_LIMIT = 300
errors = []


def err(msg):
    errors.append(msg)


def load(name):
    try:
        return json.loads((ROOT / "data" / name).read_text(encoding="utf-8"))
    except Exception as e:  # noqa: BLE001
        err(f"{name}: not valid JSON ({e})")
        return None


def date(s, where):
    try:
        return dt.date.fromisoformat(s)
    except Exception:  # noqa: BLE001
        err(f"{where}: bad date {s!r}")
        return None


def walk_strings(obj, path=""):
    if isinstance(obj, str):
        yield path, obj
    elif isinstance(obj, dict):
        for k, v in obj.items():
            yield from walk_strings(v, f"{path}.{k}")
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield from walk_strings(v, f"{path}[{i}]")


week = load("week.json")
guides = load("guides.json")
if week is None or guides is None:
    print("\n".join(errors))
    sys.exit(1)

# guides
for r in ROLES:
    if r not in guides.get("roles", {}):
        err(f"guides.roles missing {r}")
event_ids = set()
for i, e in enumerate(guides.get("events", [])):
    for k in ("id", "name", "when", "know", "todo"):
        if not e.get(k):
            err(f"guides.events[{i}] missing {k}")
    if e.get("owner") and e["owner"] not in ROLES:
        err(f"event {e.get('id')}: owner {e['owner']!r} unknown")
    if e.get("id") in event_ids:
        err(f"duplicate event id {e.get('id')}")
    event_ids.add(e.get("id"))
    for v in e.get("videos", []):
        if not re.match(r"^https://(www\.youtube\.com/watch\?v=[\w-]{11}|youtu\.be/[\w-]{11})", v.get("url", "")):
            err(f"event {e.get('id')}: video url not a YouTube watch link: {v.get('url')}")
        for k in ("title", "channel"):
            if not v.get(k):
                err(f"event {e.get('id')}: video missing {k}")
if not isinstance(guides.get("daily", []), list) or not all(isinstance(x, str) and x for x in guides.get("daily", [])):
    err("guides.daily must be a list of non-empty strings")
for g in guides.get("tool_groups", []):
    for t in g.get("tools", []):
        for k in ("name", "url", "what"):
            if not t.get(k):
                err(f"tool in {g.get('name')}: missing {k}")

# week
for k in ("updated", "next_update", "window", "headline", "goals", "rules", "days"):
    if k not in week:
        err(f"week.json missing {k}")
start = date(week["window"]["start"], "window.start")
end = date(week["window"]["end"], "window.end")
upd = date(week["updated"], "updated")
nxt = date(week["next_update"], "next_update")
if start and end and start > end:
    err("window.start is after window.end")
if upd and nxt and nxt <= upd:
    err("next_update must be after updated")
for i, g in enumerate(week.get("goals", [])):
    if g.get("owner") not in ROLES:
        err(f"goals[{i}] owner {g.get('owner')!r} unknown")
prev = None
for d in week.get("days", []):
    dd = date(d.get("date"), "day")
    if dd and prev and dd <= prev:
        err(f"days out of order at {d.get('date')}")
    if dd and start and end and not (start <= dd <= end + dt.timedelta(days=7)):
        err(f"day {d.get('date')} outside the window")
    prev = dd or prev
    for o in d.get("on", []):
        if isinstance(o, dict) and o.get("event") not in event_ids:
            err(f"day {d.get('date')}: unknown event {o.get('event')!r}")
    for t in d.get("tasks", []):
        if t.get("role") not in ROLES:
            err(f"day {d.get('date')}: task role {t.get('role')!r} unknown")
        if not t.get("text"):
            err(f"day {d.get('date')}: empty task")
def stamp(s, where):
    try:
        return dt.datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:  # noqa: BLE001
        err(f"{where}: bad time {s!r} (use YYYY-MM-DDTHH:MMZ, UTC)")
        return None


tl = week.get("timeline", [])
if not tl:
    err("week.json has no timeline")
if not any(t.get("level") == "main" for t in tl):
    err("timeline has no main event")
for t in tl:
    where = f"timeline {t.get('name')!r}"
    if t.get("level") not in ("main", "routine"):
        err(f"{where}: level must be main or routine")
    s, e = stamp(t.get("start", ""), where), stamp(t.get("end", ""), where)
    if s and e and e <= s:
        err(f"{where}: end is not after start")
    if s and not str(t.get("start", "")).endswith("Z"):
        err(f"{where}: times must end in Z (UTC)")
    if t.get("event") and t["event"] not in event_ids:
        err(f"{where}: unknown event {t['event']!r}")
for r in week.get("recurring", []):
    if r.get("event") and r["event"] not in event_ids:
        err(f"recurring {r.get('name')!r}: unknown event")

for n in week.get("notices", []):
    if n.get("owner") not in ROLES:
        err(f"notice {n.get('title')!r}: owner unknown")
    if n.get("date"):
        nd = date(n["date"], f"notice {n.get('title')!r}")
        if nd and start and end and not (start <= nd <= end + dt.timedelta(days=7)):
            err(f"notice {n.get('title')!r}: date {nd} outside the window")
    if len(n.get("text", "")) > NOTICE_LIMIT:
        err(f"notice {n.get('title')!r} is {len(n['text'])} chars (limit {NOTICE_LIMIT})")

# both files: links https only, house style (en dash, no em dash)
for name, obj in (("week", week), ("guides", guides)):
    for path, s in walk_strings(obj):
        if "—" in s:
            err(f"{name}{path}: contains an em dash; use an en dash")
        if path.endswith(".url") and not s.startswith("https://"):
            err(f"{name}{path}: url must start with https://")

# freshness (only when asked, so old commits still build)
if "--today" in sys.argv:
    today = date(sys.argv[sys.argv.index("--today") + 1], "--today")
    if today and end and today > end:
        err(f"plan window ended {end}; run the weekly update")

if errors:
    print("FAILED")
    print("\n".join(f"- {e}" for e in errors))
    sys.exit(1)
print(f"OK: {len(week['days'])} days, {len(guides['events'])} event guides, "
      f"{sum(len(e.get('videos', [])) for e in guides['events'])} videos, "
      f"{sum(len(g['tools']) for g in guides['tool_groups'])} tools")
