# Rules for AI assistants working on this repository

This repository is Next-Gen Factory: the `factory` command in `cli/`, the rules and
templates it ships in `cli/template/`, the shared `lessons/`, and the movement's pages.

## Before changing anything

1. Read `CONTRIBUTING.md` and `docs/WHAT-IT-CANNOT-DO.md`.
2. The rules the tool enforces live in `cli/template/` (constitution, spec, plan, tasks,
   review rules, roles). That folder is the source of truth.
3. Run the tests: `cd cli && npm test`. Run the tool on this repository: `node cli/bin/factory.js`.

## House rules

- **No credentials anywhere.** Not in code, tests, docs or commits. Fake values in tests are
  marked `factory:allow-secret`.
- **No real people's data and no client names**, in lessons or anywhere else.
- **Zero runtime dependencies.** The CLI uses Node's standard library only.
- **Every change keeps CI green** on macOS, Linux and Windows.
- **Honest output.** The tool never says "bug-free", "secure" or "compliant".
- **Plain language, British/South African spelling, dates as YYYY-MM-DD, no em dashes** in
  anything a person reads.
- **Draft outward-facing messages; never send them.**
