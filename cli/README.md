# @next-generation-collective/factory

**It checks the work before it says done, and it remembers every mistake.**

A command that works with the AI coding tool you already use: Claude Code, Codex, Gemini
CLI or OpenCode. It plans each change with you, has your AI build it, runs your tests, uses
the app like a person, has a separate AI session review it, and reports only what it proved.

A [Next-Gen Collective](https://github.com/next-generation-collective) tool. Node 20 or newer.

## Inside your AI

In Claude Code, once:

```
/plugin install factory --marketplace next-generation-collective/factory
```

Then ask for what you want in plain words. Cursor, Codex, Gemini CLI and VS Code:
[one line each](https://github.com/next-generation-collective/factory/blob/main/docs/USE-IN-YOUR-AI.md).

## Try it

```bash
cd your-project
npx @next-generation-collective/factory
```

In about a second it shows what your project can prove: credentials in the code, tests
that check nothing, no tests at all, and more. No account, no questions, nothing written
into your project. If it finds a problem and you have an AI tool installed, it offers to
fix it: you approve a short plan first.

Give it a job:

```bash
npx @next-generation-collective/factory "add a booking form that survives a reload"
```

Or install it:

```bash
npm install -g @next-generation-collective/factory
factory
```

## A job, step by step

1. **Spec from your code.** Every screen state and how each check will be proven. Guesses
   are marked `Assumed:`. It asks nothing, except two questions for login, money or
   personal data.
2. **Your approval**, recorded with a fingerprint. Editing the spec later makes it stale.
3. **Plan, tasks, build.** Your AI may edit files in the project, not run commands.
4. **The factory's checks**: your tests and build, secrets, tests that prove nothing, and
   more. Failures go back to the builder.
5. **Using the app** in Chrome or Firefox (or Playwright, or Maestro), a screenshot per check.
6. **An independent review** by a separate session, a verdict for every acceptance check.
7. **The report**: what passed, what a person must look at, what was not checked.

Nothing is committed for you.

## Commands

| Command | What it does |
|---|---|
| `factory` | What the project can prove; then offers to fix the top problem |
| `factory "..."` | A job, from spec to review |
| `factory approve [name]` | Read what matters in a spec, then approve it |
| `factory build` | Plan, build, check, use the app, review (resumes where it stopped) |
| `factory verify [--deep] [--app] [--json]` | The checks alone |
| `factory review [--base=ref]` | The independent review alone |
| `factory report` | A one-page handover |
| `factory status`, `factory doctor` | The state of things; what was detected |
| `factory lesson new` | Turn a real failure into a dated lesson |
| `factory mcp` | Run inside an AI tool (Claude Code, Cursor, Codex, Gemini CLI, VS Code) |

Exit codes: `0` nothing proven wrong; `1` a proven failure, or a command could not do its
job; `2` no agent found (the prompt is saved in `.factory/prompts/`).

## Honest limits

It cannot prove your software is correct, and it never says "bug-free", "secure" or
"compliant". It does not set up a phone simulator. Screenshots show what the AI saw on
your machine. The reviewer is an AI too; what it cannot prove is marked for a person.

Full guide, limits and security notes:
<https://github.com/next-generation-collective/factory>

## Licence

MIT.
