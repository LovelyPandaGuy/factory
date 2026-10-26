// The factory inside an AI tool. Claude Code, Cursor, Codex, Gemini CLI and VS Code all
// speak the Model Context Protocol: JSON-RPC messages, one per line, over stdin and stdout.
// The person talks to their AI as usual; the AI uses these tools, and the factory keeps the
// same rules as on the command line: a person approves, the checks decide, proof is kept.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { analyseProject } from "./analyse.js";
import { approvalView } from "./approval.js";
import { firstName, fullName, isFirstVisit, rememberVisit } from "./banner.js";
import { ensureConfig, report, runReview } from "./commands.js";
import { paths, readConfig, readState, writeState } from "./config.js";
import { composeBuildPrompt, composeSpecPrompt } from "./prompts.js";
import { isGitRepo, reviewBase } from "./review.js";
import { activeSpec, approve, findSpec, nextSpecName, setActive } from "./spec.js";
import { formatResults, verify } from "./verify.js";

const PROTOCOLS = ["2024-11-05", "2025-03-26", "2025-06-18", "2025-11-25"];

const INSTRUCTIONS = `Next-Gen Factory checks the work you build with AI and proves it works.

When the person asks you to build, add, fix or change something in this project:
1. Call factory_start with their request, then write the spec exactly where it says.
2. Call factory_approve. The person approves the spec, not you. If the tool asks you to,
   show the person the summary and wait for their own words before calling it again.
3. Build what the approved spec says.
4. Call factory_prove. If it says NOT DONE, fix what failed and call it again.
5. Tell the person the result in plain words, with the proof file.

Never say the work is done, bug-free, secure or compliant unless factory_prove says DONE,
and even then only report what was proven. Call factory_check when the person asks what
the project can prove, or before you start on a project for the first time.`;

const TOOLS = [
  {
    name: "factory_check",
    description:
      "What this project can prove right now: credentials in code, tests that check nothing, missing tests, personal data in logs. Fast, and it changes nothing. Use it first on a new project, or when the person asks how healthy the project is.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "factory_start",
    description:
      "Start any build, feature, fix or change the person asks for. Returns the instructions for writing the spec and where to save it. Always call this before changing code.",
    inputSchema: {
      type: "object",
      properties: { request: { type: "string", description: "What the person asked for, in their words." } },
      required: ["request"],
      additionalProperties: false,
    },
  },
  {
    name: "factory_approve",
    description:
      "Get the person's approval of the spec before building. The person approves, never the AI. When the AI tool cannot show the person an approval box, this returns the summary to show them; call it again with person_said set to their exact words only after they approve.",
    inputSchema: {
      type: "object",
      properties: {
        spec: { type: "string", description: "Spec name. Leave out for the active spec." },
        person_said: { type: "string", description: "The person's own words approving the spec, quoted exactly." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "factory_prove",
    description:
      "After building, prove the work: runs the project's tests and build and the factory's checks. Says DONE or NOT DONE with what failed. Fix and call again until DONE, then call factory_review.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "factory_review",
    description:
      "The independent review: a separate AI session that never saw how you worked checks the change against the approved spec. Run it after factory_prove says DONE. It can take a few minutes.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
];

// Every console line from the commands is collected for the reply, never written to stdout.
function captured(fn) {
  const lines = [];
  const keep = (...args) => lines.push(args.map(String).join(" "));
  const saved = { log: console.log, error: console.error, warn: console.warn };
  console.log = keep;
  console.error = keep;
  console.warn = keep;
  try {
    const value = fn();
    return { value, text: lines.join("\n") };
  } finally {
    Object.assign(console, saved);
  }
}

function welcome() {
  const name = firstName();
  const you = name ? `, ${name}` : "";
  if (!isFirstVisit()) return null;
  rememberVisit();
  return `Welcome to Next-Gen Factory${you}. You are one of the builders of the AI economy. Africa builds.`;
}

const text = (body, isError = false) => ({ content: [{ type: "text", text: body }], ...(isError ? { isError: true } : {}) });

export function createServer({ root = process.cwd(), send }) {
  let clientCanAsk = false;
  let nextId = 1;
  const waiting = new Map();

  // A question to the person through the AI tool's own approval box, which the AI cannot answer.
  const askPerson = (message, requestedSchema) =>
    new Promise((resolveAnswer) => {
      const id = `factory-${nextId++}`;
      waiting.set(id, resolveAnswer);
      send({ jsonrpc: "2.0", id, method: "elicitation/create", params: { message, requestedSchema } });
    });

  const tools = {
    factory_check() {
      const analysis = analyseProject(root);
      if (analysis.empty) return text("No project found here. Open a project folder first.", true);
      const config = readConfig(root);
      const { value: run } = captured(() => verify(root, { deep: false, config, save: false }));
      const greeting = welcome();
      return text(
        [
          greeting ? `${greeting}\n(Show this welcome to the person.)\n` : "",
          `${config.name} (${analysis.label})`,
          ...analysis.summary.slice(1),
          "",
          "What this project can prove right now",
          formatResults(root, run, { header: false }),
          "",
          "Checked by Next-Gen Factory.",
        ].join("\n"),
      );
    },

    factory_start({ request }) {
      const job = String(request ?? "").trim();
      if (!job) return text("Say what the person asked for in request.", true);
      const config = captured(() => ensureConfig(root)).value;
      const name = nextSpecName(root, job);
      const target = `specs/${name}/spec.md`;
      mkdirSync(join(root, "specs", name), { recursive: true });
      setActive(root, name);
      const prompt = composeSpecPrompt(root, config, job, target, { analysis: analyseProject(root), answers: {} });
      const greeting = welcome();
      return text(
        [
          greeting ? `${greeting}\n(Show this welcome to the person.)\n` : "",
          `Next-Gen Factory job: ${name}`,
          `Write the spec to ${target}, following the instructions below. Then call factory_approve.`,
          "",
          prompt,
        ].join("\n"),
      );
    },

    async factory_approve({ spec, person_said: personSaid }) {
      const config = readConfig(root);
      const name = findSpec(root, String(spec ?? config.spec?.active ?? "").trim());
      if (!name) return text("No spec yet. Call factory_start first.", true);
      const current = activeSpec(root);
      const specText = current?.name === name ? current.artifacts?.spec : null;
      const view = approvalView(specText ?? "");
      if (!String(specText ?? "").trim()) return text(`The spec for ${name} is empty. Write it first.`, true);

      let how = null;
      const said = String(personSaid ?? "").trim();
      const answer = clientCanAsk && !said
        ? await askPerson(
            `Next-Gen Factory: approve this plan before anything is built?\n\n${view}`,
            { type: "object", properties: { approve: { type: "boolean", title: "Approve and build" } }, required: ["approve"] },
          )
        : null;
      if (answer?.action === "accept" && answer.content?.approve === true) {
        how = { via: "approval box in the AI tool" };
      } else if (answer?.action === "decline" || (answer?.action === "accept" && answer.content?.approve === false)) {
        return text("The person did not approve. Ask what to change, update the spec, then call factory_approve again.");
      } else if (said) {
        how = { via: "chat", personSaid: String(personSaid).trim().slice(0, 500) };
      } else {
        return text(
          [
            "Show the person this summary of the spec and ask them to approve it.",
            "Only after they say yes, call factory_approve again with person_said set to their exact words.",
            "",
            view,
          ].join("\n"),
        );
      }

      const approval = approve(root, name, fullName(), how);
      setActive(root, name);
      const head = isGitRepo(root) ? spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).stdout?.trim() : null;
      writeState(root, { buildBase: head || null, buildStartedAt: new Date().toISOString() });
      const artifacts = activeSpec(root)?.artifacts;
      return text(
        [
          `Approved by ${approval.approvedBy} (${how.via}). Editing the spec now cancels the approval.`,
          "Build it now, following these rules. Then call factory_prove.",
          "",
          composeBuildPrompt(root, config, "", [], artifacts),
        ].join("\n"),
      );
    },

    factory_prove() {
      const current = activeSpec(root);
      if (!current) return text("No job yet. Call factory_start first.", true);
      if (current.state !== "approved") return text(`The spec ${current.name} is ${current.state}. Get the person's approval with factory_approve.`, true);
      const config = readConfig(root);
      const { value: run } = captured(() => verify(root, { deep: true, config, save: true }));
      const results = formatResults(root, run, { header: false });
      if (!run.ok) {
        return text(["NOT DONE. Fix what failed, then call factory_prove again.", "", results].join("\n"));
      }
      return text(["DONE: the checks passed.", "", results, "", "Now call factory_review for the independent review."].join("\n"));
    },

    factory_review() {
      if (!isGitRepo(root)) return text("The independent review needs git, to know what changed.", true);
      const current = activeSpec(root);
      const config = readConfig(root);
      const base = reviewBase(root, { state: readState(root) });
      const p = paths(root);
      const lastRun = existsSync(p.lastVerify) ? JSON.parse(readFileSync(p.lastVerify, "utf8")) : null;
      const { value: result } = captured(() =>
        runReview(root, config, { artifacts: current?.state === "approved" ? current.artifacts : null, base, run: lastRun }),
      );
      const { text: reportText } = captured(() => report(root, {}));
      if (result.problem?.startsWith("No reviewer agent")) {
        return text(
          `The independent review did not run: no second AI is installed on this computer (it uses ${config.agent?.command ?? "claude"}). Tell the person the change passed the checks but has no independent review. ${reportText}`,
        );
      }
      const verdict = result.passed ? "Proven by Next-Gen: the checks passed and a separate session approved the change." : `NOT DONE: ${result.summary}`;
      return text([verdict, result.file ? `Review: ${result.file}` : "", reportText].filter(Boolean).join("\n"));
    },
  };

  async function handle(message) {
    const { id, method, params } = message;

    if (method === undefined && id !== undefined && waiting.has(id)) {
      const resolveAnswer = waiting.get(id);
      waiting.delete(id);
      resolveAnswer(message.result ?? { action: "unavailable" });
      return;
    }

    const reply = (result) => id !== undefined && send({ jsonrpc: "2.0", id, result });
    const fail = (code, msg) => id !== undefined && send({ jsonrpc: "2.0", id, error: { code, message: msg } });

    switch (method) {
      case "initialize": {
        clientCanAsk = Boolean(params?.capabilities?.elicitation);
        const asked = params?.protocolVersion;
        reply({
          protocolVersion: PROTOCOLS.includes(asked) ? asked : "2025-06-18",
          capabilities: { tools: {} },
          serverInfo: { name: "next-gen-factory", title: "Next-Gen Factory", version: VERSION },
          instructions: INSTRUCTIONS,
        });
        return;
      }
      case "notifications/initialized":
      case "notifications/cancelled":
        return;
      case "ping":
        reply({});
        return;
      case "tools/list":
        reply({ tools: TOOLS });
        return;
      case "tools/call": {
        const tool = tools[params?.name];
        if (!tool) return fail(-32602, `Unknown tool: ${params?.name}`);
        try {
          reply(await tool(params?.arguments ?? {}));
        } catch (error) {
          reply(text(`The factory hit an error: ${error?.message ?? error}`, true));
        }
        return;
      }
      default:
        if (id !== undefined) fail(-32601, `Method not found: ${method}`);
    }
  }

  return { handle };
}

let VERSION = "0.0.0";

export async function serve(version, root = process.cwd()) {
  VERSION = version;
  process.env.FACTORY_MCP = "1";
  const send = (message) => process.stdout.write(`${JSON.stringify(message)}\n`);
  const server = createServer({ root: resolve(root), send });
  const lines = createInterface({ input: process.stdin });
  for await (const line of lines) {
    if (!line.trim()) continue;
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
      continue;
    }
    server.handle(message);
  }
  return 0;
}
