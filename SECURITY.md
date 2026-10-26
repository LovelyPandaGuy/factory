# Security policy

## Reporting a vulnerability

Do not open a public issue for a security problem.

Use GitHub's private reporting: on the repository's **Security** tab, choose
**Report a vulnerability**. That opens a private advisory visible only to the
maintainers.

Include:

- What the problem is and what it allows
- The smallest reproduction you can manage
- Which files or scripts are affected
- Whether the problem is in this repository or in a project it references

## What to expect

- We acknowledge within 7 days.
- We tell you whether we accept the report, and roughly when a fix will land.
- We credit you in the advisory unless you ask us not to.

## What the tool runs on your machine

- **The first run and `factory verify`** read your files and write nothing until you start
  a job. `verify --deep` also runs your own test and build commands.
- **A job** (`factory "..."`, the fix offer, `build`, `review`, `verify --app`) runs your AI
  coding tool inside your project, with your account. The presets allow it to edit files in
  the project and not to run commands (Claude Code: `--permission-mode acceptEdits`; Codex:
  `-s workspace-write`; Gemini CLI: `--approval-mode auto_edit`). The factory runs the checks
  itself. If you widen what the agent may do in `agent.args`, you are trusting it with that.
- **Using the app** starts your dev script on a free local port and stops it afterwards.
  The tester is given only the browser tool (or Playwright, or Maestro) it needs. It works
  against `localhost` unless `checks.allowRemoteApp` is true; never point it at a live
  system with real people's data.
- **`factory.config.json`** is trusted like a `package.json` script: it names the programs
  that run. A command name containing shell syntax is refused.
- **Inside an AI tool** (`factory mcp`, the Claude Code plugin), the factory runs only when
  your AI calls it. Checking, starting a job and approving read and write files in your
  project's `specs/` and `.factory/`; proving runs your own test and build commands; the
  review starts a separate session of your AI tool, which may edit nothing but its review.
- **Anonymous counts** are sent to Next-Gen only if you said yes when asked; never code, file
  names or personal details. See [docs/TELEMETRY.md](docs/TELEMETRY.md). Otherwise nothing is
  sent anywhere by the factory itself. Your AI tool sends what it sends.

## Scope

This repository contains documents, small Node and shell scripts, and a test kit. It
does not run a service. The most likely real issues are:

- A script that writes a credential or personal data somewhere it should not
- A kit check that passes when it should fail (a false green)
- An instruction that, followed literally, would expose a production system

Problems in third-party projects belong upstream. See [THIRD-PARTY.md](docs/THIRD-PARTY.md).

## What is not a vulnerability

- A rule you disagree with
- A missing feature
- The absence of a licence on someone else's code that we correctly refuse to copy

Those are ordinary issues.
