#!/usr/bin/env node
// Flags Maestro flows that tap a mutating action (Send, Block, Delete...) and
// then only check a screen title, or check nothing. Such a flow passes even
// when the action did nothing (constitution VIII, test rule).
//
//   node scripts/lint-outcome-flows.mjs            # .maestro/flows/*.yaml
//   node scripts/lint-outcome-flows.mjs path/to/flows
//
// After the LAST mutating tap, a flow needs one outcome check:
//   - runScript (a helper that checks the other account or the database), or
//   - assertNotVisible / extendedWaitUntil { notVisible: ... } (it left a list), or
//   - assertTrue, or
//   - a visible-check of something that is not a bare title: a pattern with a
//     wildcard (".*"), or any check with a "# outcome" comment on the line above.
// A bare title is short text with no wildcard ("Settings", "Around you").
// Exit 0 = every flow ends with an outcome. Exit 1 = flows listed need one.
// Line-based on purpose: no YAML package needed, and Maestro flows are simple.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const MUTATING = new RegExp(
  process.env.MUTATING_PATTERN ??
    "^(Send|Block|Unblock|Delete|Remove|Unsend|Accept|Decline|Pass|Invite|Save|Report|Hide|Pause|Resume|Cancel invite|Reply|Submit|Confirm)\\b",
  "i",
);
const dir = process.argv[2] ?? ".maestro/flows";
const files = statSync(dir).isDirectory()
  ? readdirSync(dir).filter((f) => f.endsWith(".yaml")).map((f) => join(dir, f))
  : [dir];

const textOf = (line) => {
  const m = line.match(/(?:text|visible|notVisible|tapOn|assertVisible|assertNotVisible):\s*"([^"]*)"/);
  return m ? m[1] : null;
};
const isBareTitle = (text) =>
  text != null && !/[.*+?^$()[\]|\\]/.test(text) && text.trim().split(/\s+/).length <= 4;

// Turn a flow into steps: each top-level "- command" plus its indented lines.
function steps(source) {
  const body = source.includes("\n---") ? source.slice(source.indexOf("\n---") + 4) : source;
  const out = [];
  let comment = "";
  for (const line of body.split("\n")) {
    if (/^\s*#/.test(line)) { comment = line; continue; }
    if (/^- /.test(line)) { out.push({ lines: [line], outcomeNote: /#\s*outcome/i.test(comment) }); comment = ""; }
    else if (out.length && line.trim()) out[out.length - 1].lines.push(line);
  }
  return out.map((s) => {
    const command = s.lines[0].match(/^- (\w+)/)?.[1] ?? "";
    const all = s.lines.join("\n");
    return { command, all, text: textOf(all), outcomeNote: s.outcomeNote };
  });
}

function isOutcome(step) {
  if (step.outcomeNote) return true;
  if (["runScript", "assertNotVisible", "assertTrue"].includes(step.command)) return true;
  if (step.command === "extendedWaitUntil" && /notVisible:/.test(step.all)) return true;
  if (["assertVisible", "extendedWaitUntil"].includes(step.command)) return !isBareTitle(step.text);
  return false;
}

let flagged = 0;
for (const file of files) {
  const list = steps(readFileSync(file, "utf8"));
  let last = -1;
  list.forEach((s, i) => {
    if (s.command === "tapOn" && s.text && MUTATING.test(s.text)) last = i;
  });
  if (last === -1) continue; // read-only flow: nothing to prove
  const after = list.slice(last + 1);
  if (after.some(isOutcome)) continue;
  flagged++;
  const checks = after.filter((s) => ["assertVisible", "extendedWaitUntil"].includes(s.command));
  const why = checks.length
    ? `only checks a title (${checks.map((s) => `"${s.text}"`).join(", ")})`
    : "checks nothing";
  console.log(`FLAG  ${file}: taps "${list[last].text}" then ${why}`);
}
console.log(flagged ? `${flagged} flow(s) need an outcome check.` : "Every mutating flow ends with an outcome check.");
process.exit(flagged ? 1 : 0);
