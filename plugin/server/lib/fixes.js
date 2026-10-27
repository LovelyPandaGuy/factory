// The first run offers to fix the top problem it found, so a person sees the whole
// factory work on their own project. Only problems with a clear, small, checkable fix are
// offered; personal-data and offline findings are for a person to judge.

function find(results, id) {
  return results.find((result) => result.id === id);
}

export function pickFix(results) {
  const secrets = find(results, "secrets");
  if (secrets?.status === "fail") {
    const hit = secrets.details.find((detail) => /:\d+\s{2}/.test(detail));
    if (hit) {
      const where = hit.split(/\s{2}/)[0];
      return {
        id: "secret",
        requires: ["secrets"],
        problem: `A credential is written in the code at ${where}`,
        title: "move a credential out of the code",
        job:
          `Move the credential at ${where} out of the code. Read it from an environment variable instead, ` +
          "named for what it is for, and add that name with an empty value to .env.example. Never print, " +
          "log or copy the value, and never put it in the spec, the plan, a test or a commit message. " +
          "Note for the person that the old value must be changed (rotated), because it is in the git history.",
      };
    }
    if (secrets.details.some((detail) => detail.includes(".env is tracked by git"))) {
      return {
        id: "env",
        requires: ["secrets"],
        problem: ".env, which holds secrets, is tracked by git",
        title: "stop tracking .env in git",
        job:
          "Stop tracking .env in git (git rm --cached .env, keeping the file on disk), add .env to " +
          ".gitignore, and add a .env.example with the variable names only, never the values. Note for " +
          "the person that every value in it must be changed (rotated), because it is in the git history.",
      };
    }
  }

  const proof = find(results, "test-proof");
  if (proof?.status === "fail") {
    const empty = proof.details.find((detail) => /no assertion/.test(detail));
    if (empty) {
      const file = empty.split(":")[0];
      return {
        id: "assertions",
        requires: ["tests", "test-proof"],
        problem: `The tests in ${file} never check anything`,
        title: "make the tests in one file prove something",
        job:
          `Make the tests in ${file} prove something. Each test should check the outcome (the data ` +
          "written, the value returned, the record read back), not only that the code ran or what the " +
          "screen says. Run the tests and show that each new check fails if the code it covers is broken.",
      };
    }
    if (/No tests found/.test(proof.summary)) {
      return {
        id: "first-test",
        requires: ["tests", "test-proof"],
        problem: "This project has no automated tests, so nothing can be proven",
        title: "add the first automated test",
        job:
          "Add the first automated test for the most important thing this project does, with the usual " +
          "test tool for its stack. Add a test command to the project if it has none, so " +
          '"factory verify --deep" can run it. The test checks an outcome, not a label on the screen.',
      };
    }
  }
  return null;
}

// A few lines a person can paste to their team. File names and line numbers only, never
// a value.
export function fixSummary({ project, fix, run, approval, diffStat, review }) {
  const proved = run.results.filter((result) => result.kind === "proven" && result.status === "pass");
  const notChecked = run.results.filter((result) => result.status === "na" || result.status === "not-run");
  const lines = [
    `factory: ${project}`,
    `Found: ${fix.problem}.`,
    `Fixed: ${fix.title}${approval ? `, approved by ${approval.approvedBy}` : ""}.`,
  ];
  if (diffStat) lines.push(`Changed: ${diffStat}`);
  if (proved.length) lines.push(`Proved by: ${proved.map((result) => result.title.toLowerCase()).join(", ")}.`);
  if (review) lines.push(`Review: ${review.summary}.`);
  if (review?.unproven?.length) lines.push(`For a person to check: ${review.unproven.join("; ")}`);
  if (notChecked.length) lines.push(`Not checked: ${notChecked.map((result) => result.title.toLowerCase()).join(", ")}.`);
  lines.push("Made with factory: npx @next-generation-collective/factory");
  return `${lines.join("\n")}\n`;
}
