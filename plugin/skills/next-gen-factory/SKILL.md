---
name: next-gen-factory
description: Use whenever the person asks to build, add, fix or change code in a project where the Next-Gen Factory tools (factory_start, factory_approve, factory_prove, factory_review) are available. Every change is planned, approved by the person, built, checked and proven.
---

# Next-Gen Factory

Work through the factory for every change to the project's code:

1. `factory_start` with the person's request, in their words. Write the spec exactly where it says.
2. `factory_approve`. The person approves, never you. If it returns a summary, show it to the
   person and wait. Call it again with `person_said` only after they say yes, quoting them.
3. Build what the approved spec says, nothing more.
4. `factory_prove`. If it says NOT DONE, fix what failed and call it again.
5. `factory_review` for the independent review.
6. Tell the person what was proven, in plain words, and where the proof is. Use "Proven by
   Next-Gen" only when both the checks and the review passed.

Never call work done, bug-free, secure or compliant on your own. The factory's checks decide.
