import { basename } from "node:path";
import { colors } from "./util.js";

// The Next-Gen mark in the terminal: an N whose diagonal runs into a G, in the brand gold.
const MARK = [
  "█▄  █ ▄▀▀▀▀",
  "█ ▀▄█ █  ▄▄",
  "█   █ ▀▄▄▄▀",
];

const truecolor = /truecolor|24bit/i.test(process.env.COLORTERM ?? "");
const gold = (t) => colors.paint(truecolor ? "38;2;245;166;35" : "38;5;214", t);
const cream = (t) => colors.paint(truecolor ? "38;2;253;251;247" : "97", t);

const width = (text) => [...text.replace(/\u001b\[[0-9;]*m/g, "")].length;

export function banner(version, root) {
  const lines = [
    `${colors.bold(cream("Next-Gen Factory"))} ${colors.dim(`v${version}`)}`,
    gold("Africa builds."),
    colors.dim(`Reading ${basename(root) || root}...`),
  ];
  const rows = MARK.map((mark, i) => `  ${gold(mark)}   ${lines[i]}`);
  const inner = Math.max(...rows.map(width)) + 2;
  const edge = (l, r) => colors.dim(`${l}${"─".repeat(inner)}${r}`);
  return [
    edge("╭", "╮"),
    ...rows.map((row) => `${colors.dim("│")}${row}${" ".repeat(inner - width(row))}${colors.dim("│")}`),
    edge("╰", "╯"),
    "",
  ].join("\n");
}
