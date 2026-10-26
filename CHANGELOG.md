# Changelog

Newest first. Dates are YYYY-MM-DD.

## 0.3.2 (2026-10-26)

### Added

- The Next-Gen mark in the terminal: when you start the factory it greets you with the NG
  mark in gold, its name and version, and "Africa builds."

## 0.3.1 (2026-10-26)

### Fixed

- Run from your home folder or the top of the disk, the factory read every file on the
  computer and showed nothing for minutes. It now says in plain words to go into a project
  folder first.
- It says "Reading your project..." straight away, so you know it has started.
- Plain wording in its messages: no em dashes, and "1 thing" or "2 things" instead of
  "thing(s)".

## 0.3.0 (2026-10-26)

The first public release, as `@next-generation-collective/factory`.

### Added

- `factory` with no arguments shows what the project can prove in about a second, with no
  questions, no account and nothing written into the project, then offers to fix the top
  problem it found.
- The fix offer: one key runs the whole loop on a real problem (a credential in the code, a
  tracked `.env`, tests that check nothing, no tests) and ends with a summary to paste.
- `factory approve`: shows the decisions left to you, the AI's guesses, the states covered
  and the proofs, then records the approval.
- An independent review in a separate session after every build, with a verdict for every
  acceptance check. `factory review` runs it alone. Method adapted from Otta (MIT).
- Using the app: websites through Playwright or the Chrome or Firefox DevTools MCP server,
  phone apps through Maestro; a screenshot for every journey. `factory verify --app`.
- Presets for Claude Code, Codex, Gemini CLI and OpenCode; the installed one is found.
- Monorepo detection; Python projects use their own test runner.
- CI on macOS, Linux and Windows with Node 20, 22 and 24.

### Changed

- Specs are written from the code; the tool asks nothing except two questions for jobs
  about login, money, personal data and similar. `--ask` asks all seven.
- Secrets: real credentials fail; test and dev passwords are flagged for a person.
- A test command that cannot start is "not run", never a failure.
- Proof is saved in `specs/<name>/evidence/`, committed with the code.
- The spec, plan and task templates are the factory's own (no more "tests are optional").
- The prompt reaches the agent on stdin or as a file, not on the command line.
- Agents may edit files in the project but not run commands, unless you allow it; the
  factory runs the checks.

### Removed

- The five-question setup before the first run.
- The `lessons/_template.md` file the first run used to add to every project.

## 0.2.0 (2026-10-22)

The spec gate, the build loop with seven checks, the report and lessons. Not published.
