# Tasks: [what changes]

- Spec: `specs/[NNN-name]/spec.md` (approved)
- Plan: `specs/[NNN-name]/plan.md`

Each task is one small change a person can review. Tick a box only when its proof passes.
The most uncertain task comes first, not last.

- [ ] T001 [the change]
  Files: `path/to/file`
  Proves: [the check that shows the outcome, and where it looks]

- [ ] T002 [the change]
  Files: `path/to/file`
  Proves: [the check]

- [ ] TNNN The factory's checks pass
  Proves: `factory verify --deep` reports no proven failure, and the independent review
  approves. The factory records the evidence; the person commits after the review.
