// How each coding agent takes a prompt. No placeholder in args means the prompt goes on
// stdin; {promptFile} is the saved prompt's path; {prompt} puts the text itself in an
// argument (kept for custom configs, but Windows cuts command lines off at 32 KB).
// Each preset may edit files inside the project and nothing more; it cannot run shell
// commands on its own (the factory runs the checks). To let an agent run commands, add
// its own flags to agent.args in factory.config.json.
export const PRESETS = {
  // claude -p reads the prompt from stdin; acceptEdits allows edits, not commands.
  claude: { command: "claude", args: ["-p", "--permission-mode", "acceptEdits"] },
  // codex exec reads stdin when no prompt is given; workspace-write keeps writes in the project.
  codex: { command: "codex", args: ["exec", "-s", "workspace-write"] },
  // gemini -p appends its text to what arrives on stdin; auto_edit allows edits only.
  gemini: { command: "gemini", args: ["--approval-mode", "auto_edit", "-p", "Follow the instructions above exactly."] },
  opencode: {
    command: "opencode",
    args: ["run", "--file", "{promptFile}", "Read the attached file and follow it exactly."],
  },
};

export const AGENT_ORDER = ["claude", "codex", "gemini", "opencode"];

const LEGACY_CLAUDE = [JSON.stringify(["-p", "{prompt}"]), JSON.stringify(["-p"])];

export function presetName(command) {
  const name = String(command ?? "")
    .split(/[\\/]/)
    .pop()
    .toLowerCase()
    .replace(/\.(?:cmd|exe|bat)$/, "");
  return PRESETS[name] ? name : null;
}

// Fills in args for a known agent when the config names only the command, and moves
// configs written by 0.2.0 (claude -p {prompt}) and early 0.3.0 (claude -p) to the preset.
export function normaliseAgent(agent) {
  const command = agent?.command ?? PRESETS.claude.command;
  const preset = presetName(command);
  let args = agent?.args;
  if (!Array.isArray(args)) args = preset ? PRESETS[preset].args : [];
  if (preset === "claude" && LEGACY_CLAUDE.includes(JSON.stringify(args))) args = PRESETS.claude.args;
  return { ...agent, command, args: [...args] };
}
