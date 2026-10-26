# Lessons

One real failure per file. Newest first is not required; the date in each file is what
matters.

Write one with:

```bash
factory lesson new
```

Each lesson has the same fields:

- **Date**: when the failure happened.
- **South Africa specific**: yes or no.
- **What went wrong**: what the software did, and what the person got instead.
- **How to spot it**: what someone would see, or try, to notice it.
- **The check**: the check that catches it, or a plain description of one.
- **Real example**: where it happened and what it cost.

## The ladder

1. **Report a case.** Open an issue with what happened.
2. **Write a lesson.** One file, the fields above.
3. **Write a check.** Only after the lesson is clear and the check is reliable.

You do not need to write code to do step 1 or 2.

## What reviewers judge

Only two things: is it true, and is it useful. The format is checked by the command.

## Not legal advice

Lessons about personal data are prompts to look, not legal advice. A person who knows the
law has to decide.

## Licence

Lessons are shared under CC BY 4.0. See [LICENSE.md](LICENSE.md).
