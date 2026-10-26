# Third-party notices

This repository is MIT licensed (see [LICENSE](../LICENSE)). It also contains or derives
from the following MIT-licensed work. Their notices are kept here.

## Spec Kit

- Source: <https://github.com/github/spec-kit>
- Licence: MIT
- What is included: `.specify/` (templates, scripts, workflows) and the
  `.claude/skills/speckit-*` commands, vendored from Spec Kit 1.0.13.
- Copyright: GitHub, Inc. and contributors.

The skills have been edited for this repository (for example, the constitution and
`/find-existing`). Changes are not marked file by file; the upstream project is the
reference for the original. The CLI's own templates in `cli/template/` are no longer
Spec Kit's; they are this repository's work.

## Agent Reach

- Source: <https://github.com/Panniantong/Agent-Reach> (referenced by `/find-existing`)
- Licence: MIT
- What is included: a recommendation in `.claude/skills/find-existing/SKILL.md`. No code
  is vendored.

## Ponytail

- Source: <https://github.com/DietrichGebert/ponytail>
- Licence: MIT
- What is included: a reference in `.claude/settings.json` that registers the plugin's
  marketplace. The plugin is **not** installed or enabled by this repository; each user
  chooses to install it.

## Otta

- Source: <https://github.com/wiselancer/otta-plugin> (`agents/qa.md` and `agents/reviewer.md`)
- Licence: MIT
- What is included: the method in `cli/template/review-rules.md` by which the independent
  reviewer gives every acceptance check its own verdict with evidence, assumes the change is
  broken until evidence says otherwise, and lists missing and extra behaviour. The wording is
  our own; the method is adapted from Otta. No code is copied.
- Copyright: wiselancer and contributors.

## Natural Earth

- Source: <https://www.naturalearthdata.com> (`ne_50m_admin_0_countries`)
- Licence: public domain
- What is included: the country outlines drawn in `assets/africa-network.svg` and `assets/next-gen-africa.svg`.

## Test kit

`kit/expo-supabase-maestro/` is original work from a production run and is covered by
this repository's MIT licence. It uses [Maestro](https://maestro.mobile.dev/) and
[Supabase](https://supabase.com/), which are separate projects under their own licences.
