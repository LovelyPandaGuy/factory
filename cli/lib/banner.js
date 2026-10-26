import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
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

// The builder's first name, from their git identity. Nothing is sent anywhere.
export function firstName() {
  try {
    const name = execFileSync("git", ["config", "user.name"], { encoding: "utf8", timeout: 1000, stdio: ["ignore", "pipe", "ignore"] });
    return name.trim().split(/\s+/)[0] || null;
  } catch {
    return null;
  }
}

// One small file in the builder's own settings folder, so the first welcome happens once.
function welcomeFile() {
  const base = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
  return join(base, "next-gen", "welcomed");
}

export function isFirstVisit() {
  try {
    return !existsSync(welcomeFile());
  } catch {
    return false;
  }
}

export function rememberVisit() {
  try {
    const file = welcomeFile();
    mkdirSync(join(file, ".."), { recursive: true });
    writeFileSync(file, `${new Date().toISOString().slice(0, 10)}\n`);
  } catch {
    // A read-only home folder only means the long welcome shows again.
  }
}

export function welcomeLines({ name, first, version }) {
  const you = name ? `, ${name}` : "";
  return first
    ? [
        colors.bold(cream(`Welcome to Next-Gen Factory${you}.`)),
        cream("You are one of the builders of the AI economy."),
        `${gold("Africa builds.")} ${colors.dim(`v${version}`)}`,
      ]
    : [
        colors.bold(cream(`Welcome back${you}.`)),
        cream("Every build you prove makes every builder stronger."),
        `${gold("Africa builds.")} ${colors.dim(`v${version}`)}`,
      ];
}

export function banner(version, root, { name = firstName(), first = isFirstVisit() } = {}) {
  const lines = welcomeLines({ name, first, version });
  const rows = lines.map((line, i) => `  ${gold(MARK[i] ?? " ".repeat(width(MARK[0])))}   ${line}`);
  const inner = Math.max(...rows.map(width)) + 2;
  const edge = (l, r) => colors.dim(`${l}${"─".repeat(inner)}${r}`);
  if (first) rememberVisit();
  return [
    edge("╭", "╮"),
    ...rows.map((row) => `${colors.dim("│")}${row}${" ".repeat(inner - width(row))}${colors.dim("│")}`),
    edge("╰", "╯"),
    colors.dim(`  Reading ${basename(root) || root}...`),
    "",
  ].join("\n");
}
