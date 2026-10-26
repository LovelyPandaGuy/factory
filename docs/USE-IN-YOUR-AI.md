# Use it inside your AI

You do not need to type factory commands. Add Next-Gen Factory to the AI tool you already
use, then ask for what you want in plain words. The AI plans it, you approve it, the AI
builds it, and the factory proves it.

## Claude Code

In Claude Code, type:

```
/plugin install factory --marketplace next-generation-collective/factory
```

Then just ask, for example "add a discount for orders over 100". Or type `/factory` to see
what your project can prove.

## Cursor

[![Add to Cursor](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en/install-mcp?name=factory&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIkBuZXh0LWdlbmVyYXRpb24tY29sbGVjdGl2ZS9mYWN0b3J5QGxhdGVzdCIsIm1jcCJdfQ==)

Or add this to `.cursor/mcp.json`:

```json
{ "mcpServers": { "factory": { "command": "npx", "args": ["-y", "@next-generation-collective/factory@latest", "mcp"] } } }
```

## Codex

```bash
codex mcp add factory -- npx -y @next-generation-collective/factory@latest mcp
```

## Gemini CLI

```bash
gemini mcp add factory npx -y @next-generation-collective/factory@latest mcp
```

## VS Code

```bash
code --add-mcp '{"name":"factory","command":"npx","args":["-y","@next-generation-collective/factory@latest","mcp"]}'
```

## What happens

1. You ask for a change.
2. The factory sets up the job and your AI writes the plan.
3. **You approve it.** Where your AI tool can show an approval box, you click it there.
   Otherwise your AI shows you the plan and waits for your yes, and the factory records
   your exact words.
4. Your AI builds it.
5. The factory runs your tests and build. Anything that fails goes back to your AI.
6. A separate AI session reviews the change. This needs Claude Code, Codex, Gemini CLI or
   OpenCode installed on your computer; without one, the proof says the review did not run.
7. You get the proof in `specs/` and a one-page report in `.factory/report.md`.

Using the app in a real browser, with screenshots, is not part of the in-chat flow yet. Run
`npx @next-generation-collective/factory verify --app` in a terminal for that step.

## Tested so far

Tested end to end in Claude Code on 2026-10-26: a plain request, the person's approval, the
build, the tests and a separate review. The other tools use the same open standard (MCP)
but have not been tested by us yet. If you try one, tell us how it went in a
[pilot report](https://github.com/next-generation-collective/factory/issues/new?template=pilot-report.yml).
