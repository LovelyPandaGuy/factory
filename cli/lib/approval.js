// What a person needs to read before approving a spec: the decisions left to them, every
// guess the AI made, which states were covered, and the checks that will prove it.

export function section(text, heading) {
  const lines = String(text).split("\n");
  const start = lines.findIndex((line) => new RegExp(`^##\\s+${heading}\\b`, "i").test(line.trim()));
  if (start === -1) return "";
  const body = [];
  for (const line of lines.slice(start + 1)) {
    if (/^##\s/.test(line)) break;
    body.push(line);
  }
  return body.join("\n").trim();
}

export function assumedLines(text) {
  return String(text)
    .split("\n")
    .map((line) => line.trim().replace(/^[-*]\s+/, ""))
    .filter((line) => /^Assumed:/i.test(line) && !/\[anything decided/i.test(line));
}

export function coveredLine(text) {
  return (
    String(text)
      .split("\n")
      .map((line) => line.trim())
      .find((line) => /^Covered:/i.test(line) && !line.includes("[the states")) ?? ""
  );
}

const NONE = /^(?:none\.?|n\/a\.?|-|\[.*\])$/i;

export function approvalView(text) {
  const open = section(text, "Open questions");
  const checks = section(text, "Acceptance checks");
  const assumed = assumedLines(text);
  const covered = coveredLine(text);
  const out = [];

  if (open && !NONE.test(open)) out.push("Decide these first", indent(open), "");
  if (assumed.length) out.push("The AI assumed", ...assumed.map((line) => `  ${line}`), "");
  if (covered) out.push(`  ${covered}`, "");
  if (checks) out.push("How it will be proven", indent(checks), "");

  if (!out.length) {
    const lines = String(text).split("\n");
    out.push(...lines.slice(0, 32));
    if (lines.length > 32) out.push(`... ${lines.length - 32} more lines`);
  }
  return out.join("\n").trimEnd();
}

function indent(block) {
  return block
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
}

// Jobs where the code cannot know who else is affected or what must never break.
const GUARDED =
  /\b(?:log ?in|sign[ -]?in|sign[ -]?up|signup|password|auth\w*|payments?|pay|card|money|price|billing|checkout|personal|privacy|location|phone|e-?mail|other users?|block\w*|delete account|permissions?)\b/i;

export function guardedTopics(line) {
  return GUARDED.test(String(line));
}

export const GUARDED_QUESTIONS = [
  { key: "people", q: "Who else sees or depends on this?", hint: "a second account, an admin, a client" },
  { key: "never", q: "What must never break while we change this?", hint: "the thing you would be called about" },
];
