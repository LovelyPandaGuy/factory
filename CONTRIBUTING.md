# Contributing

Read [`HOW-WE-WORK.md`](docs/HOW-WE-WORK.md) first. It is the order of work the tool is built
against, and it says which steps the tool already does.

The most valuable contribution here is a rule that came from a real failure, with the
evidence attached.

## What to send

- **A known trap.** Something the factory let through that cost real time. Say what
  happened, why it bit, what to do instead, and how the check proves it. It goes in the
  constitution's "Known traps" table.
- **A lesson.** A real failure, added as one dated file in `lessons/`. Say what happened,
  how to spot it, and the check that catches it. See below.
- **A check.** A reliable check with a test and a fixture. It must be right on at least
  five projects, including cases where it should say "not applicable".
- **A bug in the method.** A step that assumes something untrue, or a rule that is unclear.
- **A typo or broken link.** Small pull requests are welcome.

Please do not send:

- Code copied from a project with no licence, or GPL/AGPL code without a written reason.
- Real people's data, client data, credentials or screenshots of production systems.
- Generated bulk changes with no explanation of the failure that motivated them.

## How to send it

1. Open an issue first for anything larger than a typo. Say which rule or step it
   affects.
2. Fork, branch, make the change.
3. Keep the change to one idea. One rule, one trap, one tool.
4. Say in the pull request: what happened, what changed, and how you would know it
   worked.
5. If you are changing a principle or a gate, expect a discussion. Those move slowly.

## Style

- Dates are YYYY-MM-DD.
- British/South African spelling in this repository.
- Short sentences. Concrete examples. Name the failure, not the theory.
- No emojis unless the surrounding file already uses them.

## Add a lesson in 10 minutes

```bash
factory lesson new
```

It asks six things: a title, what went wrong, how to spot it, the check, a real example,
and whether it is South Africa specific. It writes one dated file in `lessons/`.

Rules:

- One failure per file.
- A real example, not a theory.
- If it is about personal data, the file must carry the "not legal advice" note. The
  command adds it automatically.
- Keep it short. If it needs more than a page, it is two lessons.

## Where things live

The rules and templates the tool uses are in `cli/template/` (the constitution, the spec,
plan and task templates, the review rules and the roles). That folder is the source.

## Checks

There is no build. Before sending:

```bash
cd cli
npm test
node bin/factory.js verify
```

`npm test` must pass. `verify` must not report a proven failure. A flagged result is a
prompt to look, not a failure.

If you change a script in `kit/`, run it against a test project and paste the result in
the pull request.

## Licence

By contributing code you agree that it is licensed under the repository's
[MIT licence](LICENSE). Lessons are shared under CC BY 4.0; see
[`lessons/LICENSE.md`](lessons/LICENSE.md).

## Conduct

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
